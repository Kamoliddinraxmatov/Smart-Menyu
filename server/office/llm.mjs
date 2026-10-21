// AI ofisning "miyalari": bir nechta tekin AI provayder, hammasi OpenAI uslubidagi API orqali.
//
// Har provayderning kaliti muhit o'zgaruvchisida (masalan GEMINI_API_KEY). Kaliti bor provayderlar ishlaydi, qolganlari
// o'tkazib yuboriladi. Har provayderga kunlik so'rov chegarasi bor (LLM_DAILY_LIMIT, tekin limitdan oshmaslik uchun).
// Provayder javob bermasa, chegarasi tugasa yoki 429 qaytarsa, so'rov keyingi provayderga o'tadi.
// Model nomini <NOM>_MODEL bilan o'zgartirish mumkin (tekin modellar ro'yxati tez o'zgaradi).

export const PRESETS = {
  gemini: { url: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-flash", label: "Gemini" },
  groq: { url: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile", label: "Llama (Groq)" },
  openrouter: { url: "https://openrouter.ai/api/v1", model: "meta-llama/llama-3.3-70b-instruct:free", label: "OpenRouter" }
};

const today = () => new Date().toISOString().slice(0, 10);

// env: process.env kabi obyekt. usage: { [kun]: { [provayder]: son } } (holat faylida saqlanadi). fetchFn: test uchun.
export function createLLM(env, usage, fetchFn = fetch) {
  const limit = Number(env.LLM_DAILY_LIMIT || 150);
  const providers = Object.entries(PRESETS)
    .filter(([id]) => env[`${id.toUpperCase()}_API_KEY`])
    .map(([id, p]) => ({
      id,
      label: p.label,
      url: (env[`${id.toUpperCase()}_URL`] || p.url).replace(/\/$/, ""),
      model: env[`${id.toUpperCase()}_MODEL`] || p.model,
      key: env[`${id.toUpperCase()}_API_KEY`]
    }));

  const used = (id) => (usage[today()] || {})[id] || 0;
  const count = (id) => {
    for (const d of Object.keys(usage)) if (d !== today()) delete usage[d];
    const u = (usage[today()] = usage[today()] || {});
    u[id] = (u[id] || 0) + 1;
  };

  // messages: [{role, content}]. prefer: provayder tartib raqami (har rol o'z modelini olsin, kengashda fikr xilma-xil bo'lsin).
  async function ask(messages, { prefer = 0, json = false, maxTokens = 900 } = {}) {
    if (!providers.length) throw new Error("AI kaliti yo'q: office.env ga kamida bitta kalit yozing");
    const order = providers.map((_, i) => providers[(i + prefer) % providers.length]);
    let last = null;
    for (const p of order) {
      if (used(p.id) >= limit) { last = new Error(`${p.label}: bugungi chegara tugadi`); continue; }
      try {
        count(p.id);
        const res = await fetchFn(`${p.url}/chat/completions`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${p.key}` },
          body: JSON.stringify({ model: p.model, messages, max_tokens: maxTokens, temperature: 0.7 })
        });
        if (!res.ok) { last = new Error(`${p.label}: HTTP ${res.status}`); continue; }
        const j = await res.json();
        const text = j.choices?.[0]?.message?.content?.trim();
        if (!text) { last = new Error(`${p.label}: bo'sh javob`); continue; }
        if (!json) return { text, provider: p.label };
        const data = parseJSON(text);
        if (data !== undefined) return { text, data, provider: p.label };
        last = new Error(`${p.label}: JSON emas`);
      } catch (e) { last = new Error(`${p.label}: ${e.message}`); }
    }
    throw last;
  }

  return { ask, providers, usage: () => providers.map((p) => ({ label: p.label, used: used(p.id), limit })) };
}

// Model JSON'ni ko'pincha ```json ... ``` ichida yoki izoh bilan qaytaradi: birinchi { yoki [ dan oxirgisigacha olamiz.
export function parseJSON(text) {
  const s = text.replace(/```(?:json)?/gi, "");
  const a = s.search(/[[{]/);
  const b = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
  if (a < 0 || b < a) return undefined;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return undefined; }
}
