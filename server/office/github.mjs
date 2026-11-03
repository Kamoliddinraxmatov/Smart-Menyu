// GitHub: ofis loyihaning reposiga qaraydi (so'nggi commitlar, PRlar) va "Claude'ga topshir" vazifalarini Issue qilib ochadi.
//
// Issue matnida "@claude" bor: repodagi .github/workflows/claude.yml (Claude Code GitHub Action) uni oladi, kodni o'zgartiradi
// va Issue'ga javob yozadi. Ofis Issue izohlarini kuzatib, Claude tugatgan javobni Telegramga yuboradi.
// Kalit (GITHUB_TOKEN) faqat serverdagi office.env da. Token yo'q bo'lsa, GitHub qismi o'chiq, ofisning qolgani ishlayveradi.

// env: process.env kabi obyekt. fetchFn: test uchun.
export function createGitHub(env, fetchFn = fetch) {
  const token = env.GITHUB_TOKEN;
  const api = (env.GITHUB_API || "https://api.github.com").replace(/\/$/, "");

  async function gh(method, url, body) {
    const res = await fetchFn(`${api}${url}`, {
      method,
      headers: { accept: "application/vnd.github+json", authorization: `Bearer ${token}`, "user-agent": "virtual-ofis",
        "x-github-api-version": "2022-11-28", ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      const why = res.status === 404 ? "repo topilmadi yoki tokenga ruxsat berilmagan" : res.status === 401 ? "token noto'g'ri yoki muddati o'tgan" : `HTTP ${res.status}`;
      throw new Error(`GitHub: ${why}`);
    }
    return res.json();
  }

  // So'nggi o'zgarishlar: AI uchun kontekst va /holat uchun. 10 daqiqa keshlanadi (GitHub limiti tejaladi).
  const cache = {};
  async function activity(repo) {
    const c = cache[repo];
    if (c && Date.now() - c.at < 600000) return c.data;
    const [commits, prs] = await Promise.all([
      gh("GET", `/repos/${repo}/commits?per_page=5`),
      gh("GET", `/repos/${repo}/pulls?state=all&sort=updated&direction=desc&per_page=5`)
    ]);
    const data = {
      commits: commits.map((c) => ({ at: c.commit.author?.date || "", text: c.commit.message.split("\n")[0].slice(0, 120) })),
      prs: prs.map((p) => ({ n: p.number, title: p.title.slice(0, 120), state: p.merged_at ? "merge qilingan" : p.state === "open" ? "ochiq" : "yopilgan", at: p.updated_at }))
    };
    cache[repo] = { at: Date.now(), data };
    return data;
  }

  // AI xodimlar faktlariga qo'shiladigan matn.
  async function summary(repo) {
    const a = await activity(repo);
    return [`## GitHub (${repo}): so'nggi o'zgarishlar`,
      ...a.commits.map((c) => `- ${c.at.slice(0, 10)}: ${c.text}`),
      "PRlar:", ...a.prs.map((p) => `- #${p.n} ${p.title} (${p.state}, ${p.at.slice(0, 10)})`)].join("\n");
  }

  async function createIssue(repo, title, body) {
    const i = await gh("POST", `/repos/${repo}/issues`, { title: title.slice(0, 120), body });
    return { number: i.number, url: i.html_url };
  }

  const comment = (repo, n, body) => gh("POST", `/repos/${repo}/issues/${n}/comments`, { body });

  // Issue holati va izohlari (eng ko'pi 30 ta oxirgisi).
  async function issue(repo, n) {
    const [i, comments] = await Promise.all([
      gh("GET", `/repos/${repo}/issues/${n}`),
      gh("GET", `/repos/${repo}/issues/${n}/comments?per_page=30`)
    ]);
    return { state: i.state, url: i.html_url, comments: comments.map((c) => ({ id: c.id, by: c.user?.login || "", bot: c.user?.type === "Bot", body: c.body || "", updated: c.updated_at })) };
  }

  return { enabled: !!token, activity, summary, createIssue, comment, issue };
}

// "Kamoliddinraxmatov/Smart-Menyu" yoki https://github.com/... havolasidan "egasi/repo".
export function parseRepo(text) {
  const m = String(text).trim().match(/^(?:https?:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i);
  return m ? `${m[1]}/${m[2]}` : null;
}

// Claude Code Action izohi ishlayotganda "Claude Code is working…" deydi, tugaganda "Claude finished ..." yoki xato yozadi.
export function claudeDone(body) {
  if (/is working|working…|working\.\.\./i.test(body) && !/finished|encountered an error|failed/i.test(body)) return false;
  return true;
}

// Telegram uchun izohni qisqartiradi: HTML izohlar va <details> ichidagi uzun loglar olib tashlanadi.
export function cleanComment(body) {
  return String(body).replace(/<!--[\s\S]*?-->/g, "").replace(/<details>[\s\S]*?<\/details>/gi, "").replace(/<img[^>]*>/gi, "")
    .replace(/\n{3,}/g, "\n\n").trim().slice(0, 3000);
}
