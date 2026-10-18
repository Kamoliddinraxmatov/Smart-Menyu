// Realtime aloqa qatlami.
// Barcha qurilmalar (ofitsiant planshetlari, oshxona ekrani, admin) bitta MQTT kanaliga ulanadi.
// Har bir buyurtma "retained" xabar sifatida saqlanadi: yangi ulangan qurilma darhol joriy holatni oladi.
//
// Mavzular (topic):
//   <base>/config          restoran sozlamalari, menyu, stollar, ofitsiantlar
//   <base>/stop            stop-list (tugagan taomlar): { itemId: true }
//   <base>/orders/<id>     har bir buyurtma (chek)
//   <base>/calls/<tableId> stoldan signal: ofitsiantni chaqirish yoki hisobni so'rash
//   <base>/reserves/<tableId> stol oldindan band (bron): { at, waiterId, waiterName, note }
//   <base>/sales/<sana>/<id> yopilgan chekning ixcham nusxasi (hisobot uchun, faqat admin o'qiydi)
import { DEFAULT_CONFIG } from "./defaults.js";
import { brokerUrl, brokerOpts, V2 } from "./license.js";
import { seal, open } from "./crypto.js";

const PREFIX = "menyuuz/v1"; // namoyish (demo) restorani: shifrlanmagan

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
  if ((c.v || 1) < 3) out.items = (out.items || []).map((i) => {
    const d = defs[i.id];
    if (!d || d.name !== i.name || i.variants || i.extras) return i;
    return { ...i, ...(d.variants ? { variants: structuredClone(d.variants) } : {}), ...(d.extras ? { extras: structuredClone(d.extras) } : {}) };
  });
  // v4: rasmsiz demo taomlarga (osh, lag'mon, choy...) haqiqiy rasm
  out.items = (out.items || []).map((i) => {
    const d = defs[i.id];
    return d && d.name === i.name && !i.img && d.img ? { ...i, img: d.img } : i;
  });
  return out;
}

// Buyurtma holatlari tartibi: birlashtirishda holat orqaga qaytmaydi
const RANK = { new: 0, cooking: 1, ready: 2, served: 3, closed: 4 };
const STAMPS = ["startedAt", "readyAt", "servedAt", "closedAt", "closedBy", "serviceRate"];
const body = (o) => { if (!o) return ""; const { rev, base, dev, updatedAt, ...x } = o; return JSON.stringify(x, Object.keys(x).sort()); };
const same = (a, b) => body(a) === body(b);
const vid = (o) => `${o.rev || 0}:${o.dev || ""}`; // versiya belgisi
function mergeOrder(a, b) {
  // Ikkala qurilmada bir xil natija chiqishi uchun tartib: rev, vaqt, qurilma belgisi
  const key = (o) => [o.rev || 0, o.updatedAt || 0, o.dev || ""];
  const ka = key(a), kb = key(b);
  const bFirst = kb[0] !== ka[0] ? kb[0] > ka[0] : kb[1] !== ka[1] ? kb[1] > ka[1] : kb[2] > ka[2];
  const [hi, lo] = bFirst ? [b, a] : [a, b];
  const out = { ...hi };
  if ((RANK[lo.status] ?? 0) > (RANK[hi.status] ?? 0)) out.status = lo.status;
  for (const k of STAMPS) if (out[k] == null && lo[k] != null) out[k] = lo[k];
  return out;
}

function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// opts.key: restoranning AES kaliti (faollashtirilgan planshetda). Bo'lsa, barcha ma'lumotlar shifrlanadi
//           va <v2>/<rid>/... mavzulariga yoziladi. Bo'lmasa (namoyish), eski ochiq <v1> mavzulari.
// opts.watcher: ruxsatnoma o'zgarishini kuzatuvchi (license.js)
// opts.url / opts.auth: server manzili va login (egasi ilovasi o'z sozlamasidan beradi)
export function createStore(rid, opts = {}) {
  const key = opts.key || null;
  const base = key ? `${V2}/${rid}` : `${PREFIX}/${rid}`;
  const cacheKey = key ? `menyu.cache2.${rid}` : `menyu.cache.${rid}`;
  const cached = load(cacheKey, null);

  const state = {
    rid,
    online: false,
    config: migrate(cached?.config) || structuredClone(DEFAULT_CONFIG),
    stop: cached?.stop || {},
    orders: cached?.orders || {},
    calls: {},
    reserves: {},
    sales: {},
    salesLoaded: false,
    configLoaded: !!cached?.config
  };

  // Yuborilmagan buyurtmalar (internet yo'q paytda): sahifa qayta ochilsa ham yo'qolmaydi
  const outKey = `menyu.outbox.${key ? "2." : ""}${rid}`;
  const outbox = load(outKey, {});
  const saveOut = () => save(outKey, outbox);
  // Har qurilmaning qisqa belgisi: bir vaqtda qilingan o'zgarishlarni bir xil tartibda birlashtirish uchun
  let dev = "";
  try { dev = localStorage.getItem("menyu.dev") || Math.random().toString(36).slice(2, 6); localStorage.setItem("menyu.dev", dev); } catch { dev = "x"; }

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
        // Sozlama serverdan kelmaguncha keshga yozilmaydi: aks holda keyingi safar standart (namoyish) menyu "yuklangan" deb olinadi
        save(cacheKey, { config: state.configLoaded ? state.config : cached?.config, stop: state.stop, orders: state.orders });
        emit({ type: "render" });
      }, 30);
    }
  }

  const url = opts.url || brokerUrl(!key);
  const auth = opts.auth || (key ? brokerOpts() : {});
  const client = window.MENYU_DEMO ? localBus() : window.mqtt.connect(url, {
    ...auth,
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
    const topics = [`${base}/config`, `${base}/stop`, `${base}/orders/+`, `${base}/calls/+`, `${base}/reserves/+`];
    if (opts.watcher) topics.push(`${base}/lic`);
    client.subscribe(topics, { qos: 1 }, (err) => {
      if (err) return;
      setTimeout(() => {
        if (!seen || !state.online) return;
        let removed = false;
        for (const id of Object.keys(state.orders)) {
          if (!seen.has(id) && !(id in outbox) && Date.now() - (state.orders[id].updatedAt || 0) > 15000) { delete state.orders[id]; removed = true; }
        }
        seen = null;
        if (removed) changed({ type: "order-removed" });
        // Namoyish restoranida serverda sozlama bo'lmasa, standart menyu bilan ishlaymiz
        if (!key && !state.configLoaded) { state.configLoaded = true; changed({ type: "config" }); }
      }, 5000);
    });
    opts.watcher?.online?.(true);
    // Internet yo'q paytda qilingan buyurtmalarni qayta yuborish
    for (const [id, o] of Object.entries(outbox)) sendOrder(id, o);
    changed({ type: "online" });
  });
  for (const ev of ["close", "offline"]) {
    client.on(ev, () => { opts.watcher?.online?.(false); if (state.online) { state.online = false; changed({ type: "offline" }); } });
  }
  client.on("error", (e) => console.warn("MQTT:", e?.message || e));

  // Shifrni ochish asinxron: xabarlar kelgan tartibda ishlanishi uchun navbat
  let inbox = Promise.resolve();
  client.on("message", (topic, payload) => {
    const text = payload.toString();
    inbox = inbox.then(() => receive(topic, text)).catch((e) => console.warn("xabar:", e?.message || e));
  });

  async function receive(topic, raw) {
    if (topic === `${base}/lic`) { await opts.watcher?.handle(raw); return; }
    let text = raw;
    if (key && raw) {
      try { text = await open(key, raw, topic); } catch {
        // kaliti yo'q yoki soxta xabar: e'tiborsiz. Chek ustiga begona narsa yozilgan bo'lsa, bizdagi nusxani o'chirmaymiz
        const om = topic.match(/\/orders\/([^/]+)$/);
        if (om && seen) seen.add(om[1]);
        return;
      }
    }
    let data = null;
    if (text) { try { data = JSON.parse(text); } catch { return; } }

    if (topic === `${base}/config`) {
      // Versiya raqami bo'yicha: planshet soati noto'g'ri bo'lsa ham yangi sozlama eskisini bosmaydi
      const cv = state.config.ver || 0, dv = data?.ver || 0;
      if (data && (dv > cv || (dv === cv && (data.updatedAt || 0) >= (state.config.updatedAt || 0)))) {
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
    const rm = topic.match(/\/reserves\/([^/]+)$/);
    if (rm) {
      // bron 24 soatdan keyin o'z-o'zidan tushadi
      if (data && Date.now() - (data.at || 0) < 24 * 3600 * 1000) state.reserves[rm[1]] = data;
      else delete state.reserves[rm[1]];
      changed({ type: "reserve", tableId: rm[1] });
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
        if (prev) { delete state.orders[id]; changed({ type: "order-removed", id, prev }); }
        return;
      }
      if (id in outbox) {
        const mine = outbox[id];
        // Server bizning so'nggi o'zgarishimizni oldi
        if (mine && mine.rev === data.rev && mine.dev === data.dev) { delete outbox[id]; saveOut(); }
      }
      const accept = () => { state.orders[id] = data; changed({ type: "order", order: data, prev }); };
      // Oddiy holat: o'zgarish biz ko'rgan oxirgi versiyadan qilingan
      if (!prev || data.base === vid(prev)) return accept();
      if (data.base === undefined || prev.base === undefined) { if ((prev.rev || 0) <= (data.rev || 0)) accept(); return; }
      if (same(prev, data)) return;
      // Ikki planshet bir vaqtda (yoki internetsiz) o'zgartirgan: holatni orqaga qaytarmasdan birlashtiramiz
      const merged = mergeOrder(prev, data);
      if (same(merged, data)) return accept();
      if (same(merged, prev) && (data.rev || 0) <= (prev.rev || 0)) return; // bizdagi versiya to'liqroq va yangiroq
      merged.rev = Math.max(prev.rev || 0, data.rev || 0);
      api.putOrder(merged);
    }
  }

  // Yuborish ham navbat bilan: shifrlash tugagach, yozilgan tartibda ketadi
  let sending = Promise.resolve();
  function publish(topic, obj, onAck) {
    const text = obj == null ? "" : JSON.stringify(obj);
    sending = sending.then(async () => {
      const body = key && text ? await seal(key, text, topic) : text;
      client.publish(topic, body, { qos: 1, retain: true }, (err) => { if (!err) onAck?.(); });
    }).catch((e) => console.warn("yuborish:", e?.message || e));
    return sending;
  }
  // Buyurtmani yuborish; server qabul qilgach "yuborilmagan"lar ro'yxatidan chiqadi
  function sendOrder(id, o) {
    publish(`${base}/orders/${id}`, o, () => {
      if (id in outbox && (outbox[id] === o || (outbox[id] && o && outbox[id].rev === o.rev))) { delete outbox[id]; saveOut(); }
    });
  }

  const api = {
    state,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    saveConfig(config) {
      config.ver = Math.max(config.ver || 0, state.config.ver || 0) + 1;
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
      const prev = state.orders[order.id];
      const from = Math.max(order.rev || 0, prev?.rev || 0);
      order.base = prev ? vid(prev) : "0:";
      order.rev = from + 1;
      order.dev = dev;
      order.updatedAt = Date.now();
      state.orders[order.id] = order;
      outbox[order.id] = order;
      saveOut();
      sendOrder(order.id, order);
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

    // Stolni oldindan band qilish (bron) yoki bronni olib tashlash (null)
    setReserve(tableId, r) {
      if (r) state.reserves[tableId] = r; else delete state.reserves[tableId];
      publish(`${base}/reserves/${tableId}`, r);
      changed({ type: "reserve", tableId, local: true });
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
      outbox[id] = null;
      saveOut();
      sendOrder(id, null);
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
    // Navbatdagi barcha xabarlar yuborilgach ulanishni yopish
    close() { return sending.then(() => new Promise((r) => (client.end ? client.end(false, {}, r) : r()))); },
    flush() { return sending; },
    pending() { return Object.keys(outbox).length; },
    // Server manzili va mavzular (Android ilovadagi oshxona xizmati ekran o'chiq paytda ham shu yerni tinglaydi)
    conn: { url, base, user: auth.username || "", pass: auth.password || "" },
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
