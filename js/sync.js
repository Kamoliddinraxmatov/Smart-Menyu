// Realtime aloqa qatlami.
// Barcha qurilmalar (ofitsiant planshetlari, oshxona ekrani, admin) bitta MQTT kanaliga ulanadi.
// Har bir buyurtma "retained" xabar sifatida saqlanadi: yangi ulangan qurilma darhol joriy holatni oladi.
//
// Mavzular (topic):
//   <base>/config          restoran sozlamalari, menyu, stollar, ofitsiantlar
//   <base>/stop            stop-list (tugagan taomlar): { itemId: true }
//   <base>/orders/<id>     har bir buyurtma (chek)
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

  const client = window.mqtt.connect(brokerUrl(), {
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
    client.subscribe([`${base}/config`, `${base}/stop`, `${base}/orders/+`], { qos: 1 }, (err) => {
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

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
