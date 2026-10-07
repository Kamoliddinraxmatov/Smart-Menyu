// Realtime aloqa qatlami.
// Barcha qurilmalar (ofitsiant planshetlari, oshxona ekrani, admin) bitta MQTT kanaliga ulanadi.
// Har bir buyurtma "retained" xabar sifatida saqlanadi: yangi ulangan qurilma darhol joriy holatni oladi.
//
// Mavzular (topic):
//   <base>/config          restoran sozlamalari, menyu, stollar, ofitsiantlar
//   <base>/stop            stop-list (tugagan taomlar): { itemId: true }
//   <base>/orders/<id>     har bir buyurtma (chek)
//   <base>/calls/<tableId> stoldan signal: ofitsiantni chaqirish yoki hisobni so'rash
//   <base>/sales/<sana>/<id> yopilgan chekning ixcham nusxasi (hisobot uchun, faqat admin o'qiydi)
import { DEFAULT_CONFIG } from "./defaults.js";

const PREFIX = "menyuuz/v1";
const DEFAULT_BROKER = "wss://broker.emqx.io:8084/mqtt";

function brokerUrl() {
  const q = new URLSearchParams(location.search).get("broker");
  if (q) { try { localStorage.setItem("menyu.broker", q); } catch {} return q; }
  try { return localStorage.getItem("menyu.broker") || DEFAULT_BROKER; } catch { return DEFAULT_BROKER; }
}

// Eski (v1) demo menyuni yangi dizayndagi menyuga almashtirish.
// Restoran o'z taomlarini qo'shgan bo'lsa, menyusiga tegilmaydi.
const V1_IDS = new Set(Array.from({ length: 19 }, (_, i) => `i${i + 1}`));
function migrate(c) {
  if (!c || (c.v || 1) >= DEFAULT_CONFIG.v) return c;
  const out = { ...c, v: DEFAULT_CONFIG.v };
  if ((c.items || []).every((i) => V1_IDS.has(i.id))) {
    out.categories = structuredClone(DEFAULT_CONFIG.categories);
    out.items = structuredClone(DEFAULT_CONFIG.items);
  }
  // v3: demo taomlarga porsiya va qo'shimchalar (restoran o'zgartirmagan taomlarga)
  const defs = Object.fromEntries(DEFAULT_CONFIG.items.map((i) => [i.id, i]));
  out.items = (out.items || []).map((i) => {
    const d = defs[i.id];
    if (!d || d.name !== i.name || i.variants || i.extras) return i;
    return { ...i, ...(d.variants ? { variants: structuredClone(d.variants) } : {}), ...(d.extras ? { extras: structuredClone(d.extras) } : {}) };
  });
  return out;
}

function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function createStore(rid) {
  const base = `${PREFIX}/${rid}`;
  const cacheKey = `menyu.cache.${rid}`;
  const cached = load(cacheKey, null);

  const state = {
    rid,
    online: false,
    config: migrate(cached?.config) || structuredClone(DEFAULT_CONFIG),
    stop: cached?.stop || {},
    orders: cached?.orders || {},
    calls: {},
    sales: {},
    salesLoaded: false,
    configLoaded: !!cached?.config
  };

  const listeners = new Set();
  let notifyQueued = false;
  function emit(evt) {
    for (const fn of listeners) { try { fn(evt, state); } catch (e) { console.error(e); } }
  }
  function changed(evt) {
    emit(evt);
    if (!notifyQueued) {
      notifyQueued = true;
      setTimeout(() => {
        notifyQueued = false;
        save(cacheKey, { config: state.config, stop: state.stop, orders: state.orders });
        emit({ type: "render" });
      }, 30);
    }
  }

  const client = window.MENYU_DEMO ? localBus() : window.mqtt.connect(brokerUrl(), {
    clientId: `menyu_${rid}_${Math.random().toString(16).slice(2, 10)}`,
    clean: true,
    keepalive: 30,
    reconnectPeriod: 2000,
    connectTimeout: 10000,
    queueQoSZero: true
  });

  // Ulanishdan keyin kanaldan kelmagan (boshqa qurilmada o'chirilgan) keshdagi cheklarni tozalash
  let seen = null;
  client.on("connect", () => {
    state.online = true;
    seen = new Set();
    client.subscribe([`${base}/config`, `${base}/stop`, `${base}/orders/+`, `${base}/calls/+`], { qos: 1 }, (err) => {
      if (err) return;
      setTimeout(() => {
        if (!seen || !state.online) return;
        let removed = false;
        for (const id of Object.keys(state.orders)) {
          if (!seen.has(id) && Date.now() - (state.orders[id].updatedAt || 0) > 15000) { delete state.orders[id]; removed = true; }
        }
        seen = null;
        if (removed) changed({ type: "order-removed" });
      }, 5000);
    });
    changed({ type: "online" });
  });
  for (const ev of ["close", "offline"]) {
    client.on(ev, () => { if (state.online) { state.online = false; changed({ type: "offline" }); } });
  }
  client.on("error", (e) => console.warn("MQTT:", e?.message || e));

  client.on("message", (topic, payload) => {
    const text = payload.toString();
    let data = null;
    if (text) { try { data = JSON.parse(text); } catch { return; } }

    if (topic === `${base}/config`) {
      if (data && (data.updatedAt || 0) >= (state.config.updatedAt || 0)) {
        state.config = migrate({ ...structuredClone(DEFAULT_CONFIG), v: 1, ...data });
        state.configLoaded = true;
        changed({ type: "config" });
      }
      return;
    }
    if (topic === `${base}/stop`) {
      state.stop = data || {};
      changed({ type: "stop" });
      return;
    }
    const sm = topic.match(/\/sales\/[^/]+\/([^/]+)$/);
    if (sm) {
      if (data) state.sales[sm[1]] = data; else delete state.sales[sm[1]];
      changed({ type: "sales" });
      return;
    }
    const cm = topic.match(/\/calls\/([^/]+)$/);
    if (cm) {
      const tid = cm[1];
      const prev = state.calls[tid];
      // 3 soatdan eski signallar e'tiborga olinmaydi
      if (data && Date.now() - (data.at || 0) < 3 * 3600 * 1000) state.calls[tid] = data;
      else delete state.calls[tid];
      changed({ type: "call", tableId: tid, call: state.calls[tid] || null, prev });
      return;
    }
    const m = topic.match(/\/orders\/([^/]+)$/);
    if (m) {
      const id = m[1];
      if (seen) seen.add(id);
      const prev = state.orders[id];
      if (!data) {
        if (prev) { delete state.orders[id]; changed({ type: "order-removed", id }); }
        return;
      }
      // Eski versiyani yangisi ustiga yozmaslik
      if (prev && (prev.rev || 0) > (data.rev || 0)) return;
      state.orders[id] = data;
      changed({ type: "order", order: data, prev });
    }
  });

  function publish(topic, obj) {
    client.publish(topic, obj == null ? "" : JSON.stringify(obj), { qos: 1, retain: true });
  }

  const api = {
    state,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    saveConfig(config) {
      config.updatedAt = Date.now();
      state.config = config;
      state.configLoaded = true;
      publish(`${base}/config`, config);
      changed({ type: "config" });
    },

    setStop(itemId, stopped) {
      const next = { ...state.stop };
      if (stopped) next[itemId] = true; else delete next[itemId];
      state.stop = next;
      publish(`${base}/stop`, next);
      changed({ type: "stop" });
    },

    putOrder(order) {
      order.rev = (order.rev || 0) + 1;
      order.updatedAt = Date.now();
      const prev = state.orders[order.id];
      state.orders[order.id] = order;
      publish(`${base}/orders/${order.id}`, order);
      changed({ type: "order", order, prev, local: true });
      return order;
    },

    updateOrder(id, patch) {
      const cur = state.orders[id];
      if (!cur) return null;
      const next = { ...structuredClone(cur), ...(typeof patch === "function" ? patch(structuredClone(cur)) : patch) };
      return api.putOrder(next);
    },

    // Stol signali: { type: "waiter" | "bill", at, tableNo, waiterId } yoki null (bajarildi)
    setCall(tableId, call) {
      const prev = state.calls[tableId];
      if (call) state.calls[tableId] = call; else delete state.calls[tableId];
      publish(`${base}/calls/${tableId}`, call);
      changed({ type: "call", tableId, call, prev, local: true });
    },

    // Yopilgan chekni hisobot arxiviga yozish (kun/hafta/oy hisobotlari shundan olinadi)
    recordSale(o) {
      const d = new Date(o.closedAt || Date.now());
      const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const sum = (o.items || []).reduce((s, it) => s + it.price * it.qty, 0);
      const sale = {
        id: o.id, no: o.no, day, at: o.closedAt || Date.now(), createdAt: o.createdAt, tableNo: o.tableNo, zone: o.zone || "",
        waiterId: o.waiterId || "", waiterName: o.waiterName || "", guests: o.guests || 0, pay: o.pay || "naqd",
        sum, svc: Math.round(sum * (o.serviceRate || 0) / 100), cook: o.readyAt ? o.readyAt - (o.startedAt || o.createdAt) : 0,
        byGuest: !!o.byGuest, items: (o.items || []).map((it) => [it.name + (it.opts ? ` (${it.opts})` : ""), it.qty, it.price])
      };
      state.sales[o.id] = sale;
      publish(`${base}/sales/${day}/${o.id}`, sale);
    },

    // Hisobot arxivini yuklash (faqat admin ochganda)
    loadSales() {
      if (api._salesSub) return;
      api._salesSub = true;
      const sub = () => client.subscribe(`${base}/sales/#`, { qos: 1 }, () => setTimeout(() => { state.salesLoaded = true; changed({ type: "sales" }); }, 1500));
      if (state.online) sub();
      client.on("connect", sub);
    },

    removeOrder(id) {
      delete state.orders[id];
      publish(`${base}/orders/${id}`, null);
      changed({ type: "order-removed", id });
    },

    // Yopilgan va 2 kundan eski cheklarni kanaldan tozalash
    cleanup(maxAgeMs = 2 * 24 * 3600 * 1000) {
      const now = Date.now();
      for (const o of Object.values(state.orders)) {
        if (o.status === "closed" && now - (o.closedAt || o.createdAt) > maxAgeMs) api.removeOrder(o.id);
      }
    },

    reconnect() { client.reconnect(); },
    client
  };
  return api;
}

// Namoyish rejimi (internet serversiz): MQTT o'rniga shu qurilmadagi xotira.
// Bir telefonda ofitsiant, oshxona va admin sahifalari bir-birini ko'radi.
function localBus() {
  const KEY = "menyu.demo.bus";
  const handlers = {};
  const subs = [];
  const fire = (ev, ...a) => (handlers[ev] || []).forEach((f) => f(...a));
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
  const match = (filter, topic) => {
    const f = filter.split("/"), t = topic.split("/");
    for (let i = 0; i < f.length; i++) {
      if (f[i] === "#") return true;
      if (f[i] !== "+" && f[i] !== t[i]) return false;
    }
    return f.length === t.length;
  };
  const deliver = (topic, text) => { if (subs.some((f) => match(f, topic))) fire("message", topic, { toString: () => text }); };
  let bc = null;
  try { bc = new BroadcastChannel(KEY); bc.onmessage = (e) => deliver(e.data.topic, e.data.text); } catch {}
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY || bc) return;
    const prev = JSON.parse(e.oldValue || "{}"), next = JSON.parse(e.newValue || "{}");
    for (const t of new Set([...Object.keys(prev), ...Object.keys(next)])) if (prev[t] !== next[t]) deliver(t, next[t] || "");
  });
  const client = {
    on(ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); return client; },
    subscribe(filters, opts, cb) {
      const list = Array.isArray(filters) ? filters : [filters];
      subs.push(...list);
      const all = read();
      setTimeout(() => {
        for (const [t, text] of Object.entries(all)) if (list.some((f) => match(f, t))) fire("message", t, { toString: () => text });
        cb?.(null);
      }, 0);
    },
    publish(topic, text) {
      const all = read();
      if (text) all[topic] = text; else delete all[topic];
      try { localStorage.setItem(KEY, JSON.stringify(all)); } catch {}
      try { bc?.postMessage({ topic, text }); } catch {}
    },
    reconnect() {}
  };
  setTimeout(() => fire("connect"), 50);
  return client;
}

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
