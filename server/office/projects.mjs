// Loyihalar: ofis bir vaqtda bir nechta loyiha bilan ishlaydi (masalan Smart Menyu, UZBIONIC, Novum web).
// Har loyihaning o'z faktlari, qarorlari, haftalik raqamlari va vakansiya orqali olingan xodimlari bor, ular aralashmaydi.
// Asosiy loyiha profile.json + facts.md dan keladi (xodimlari "staff", qat'iy narx tekshiruvi bilan). Qolganlarini egasi
// Telegramda /loyiha bilan ochadi va o'zi tasvirlaydi: ular "project_staff" xodimlari bilan ishlaydi.
// Holat (state.projects) faqat serverdagi DATA_DIR da saqlanadi.
import { PROFILE, BASE_ROLES, PROJECT_ROLES } from "./roles.mjs";

export function slug(name) {
  return String(name).toLowerCase().replace(/[‘’`']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20);
}

export const MAIN = slug(PROFILE.company) || "asosiy";

// Eski holat faylida (bitta loyiha davri) qarorlar, raqamlar va xodimlar state ning o'zida edi: asosiy loyihaga ko'chiramiz.
export function migrate(state) {
  state.projects = state.projects || {};
  if (!state.projects[MAIN]) {
    state.projects[MAIN] = { id: MAIN, name: PROFILE.company, facts: "", roles: state.roles || [], decisions: state.decisions || [],
      metrics: state.metrics || [], created: new Date().toISOString() };
  }
  // Asosiy loyihaning reposi profile.json da ("repo"). Egasi /repo bilan boshqasini ulagan bo'lsa, o'shanisi qoladi.
  if (PROFILE.repo && state.projects[MAIN].repo === undefined) state.projects[MAIN].repo = PROFILE.repo;
  state.claude = state.claude || {};
  delete state.roles; delete state.decisions; delete state.metrics;
  return state;
}

export function list(state) {
  return Object.values(state.projects).filter((p) => !p.closed);
}

// Nomi yoki id si bo'yicha (katta-kichik harf farqsiz).
export function find(state, name) {
  const s = slug(name);
  return list(state).find((p) => p.id === s || p.name.toLowerCase() === String(name).trim().toLowerCase()) || null;
}

export function create(state, name) {
  let id = slug(name) || `loyiha-${Object.keys(state.projects).length + 1}`;
  while (state.projects[id]) id = `${id.slice(0, 17)}-${Math.floor(Math.random() * 90 + 10)}`;
  state.projects[id] = { id, name: String(name).trim().slice(0, 40), facts: "", roles: [], decisions: [], metrics: [], created: new Date().toISOString() };
  return state.projects[id];
}

// AI ishi uchun loyiha ko'rinishi. mainFacts: facts.md matni.
export function view(state, id, mainFacts) {
  const p = state.projects[id];
  const main = id === MAIN;
  const facts = [main ? mainFacts : "", p.facts ? `## ${PROFILE.owner} qo'shgan ma'lumotlar\n${p.facts}` : ""].filter(Boolean).join("\n\n");
  return { ...p, main, strict: main, staff: main ? BASE_ROLES : PROJECT_ROLES, facts };
}
