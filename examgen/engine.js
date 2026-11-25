// Offline question engine + AI prompt helpers (no DOM). Works in browser and node.
(function (root) {
  const AR = /[\u0600-\u06FF]/g;
  function isArabic(t) { const a = (t.match(AR) || []).length; return a > t.replace(/\s/g, '').length * 0.3; }
  function normDigits(s) { return s.replace(/[\u0660-\u0669]/g, d => d.charCodeAt(0) - 0x660); }
  const STOP_EN = new Set('the a an and or but of to in on at for with by from is are was were be been being as that this these those it its into than then so such not no can could will would should may might have has had do does did which who whom whose what when where why how also more most other some any each their there they them he she his her we you your our i about over under between after before during'.split(' '));
  const STOP_AR = new Set('من في على إلى الى عن مع هذا هذه ذلك تلك التي الذي الذين هو هي هم هن كان كانت يكون تكون قد لقد ما لا لم لن إن أن ان إذا اذا أو او ثم كل بعض عند بين حتى كما أي اي أيضا ايضا فقط غير بعد قبل خلال حيث لكن بل و'.split(' '));
  function rand(n) { return Math.floor(Math.random() * n); }
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function sentences(text) {
    text = text.replace(/\r/g, '').replace(/[ \t]+/g, ' ');
    const parts = text.split(/(?<=[.!?؟۔])\s+|\n+/);
    return parts.map(s => s.trim()).filter(s => {
      const w = s.split(/\s+/).length;
      return w >= 7 && w <= 40 && /[\p{L}]/u.test(s) && !/^\d+[\s.)-]*$/.test(s);
    });
  }
  function words(s) { return s.replace(/[.,;:!?؟،()\[\]"“”«»]/g, ' ').split(/\s+/).filter(Boolean); }
  function keywordsOf(s, ar) {
    const stop = ar ? STOP_AR : STOP_EN;
    return words(s).filter(w => {
      const l = w.toLowerCase();
      return w.length > 3 && !stop.has(l) && !stop.has(w);
    });
  }
  function pickBlank(sent, ar, diff) {
    const ws = words(sent);
    const normd = normDigits(sent);
    const numMatch = normd.match(/\b\d[\d,.]*\b/);
    const kws = keywordsOf(sent, ar);
    if (!kws.length) return null;
    let cand;
    if (diff === 'easy') cand = kws.filter(w => w.length >= 5);
    else cand = kws;
    if (!cand.length) cand = kws;
    // prefer capitalised (en) / long words; numbers are great blanks
    let pick;
    if (numMatch && Math.random() < 0.5) pick = numMatch[0];
    else {
      const cap = !ar ? cand.filter((w, i) => /^[A-Z]/.test(w) && ws.indexOf(w) > 0) : [];
      const pool = cap.length ? cap : cand.slice().sort((a, b) => b.length - a.length).slice(0, Math.max(2, Math.ceil(cand.length / 2)));
      pick = pool[rand(pool.length)];
    }
    return pick;
  }
  function distractors(answer, pool, n) {
    const isNum = /^\d/.test(normDigits(answer));
    let out = [];
    if (isNum) {
      const v = parseFloat(normDigits(answer).replace(/,/g, ''));
      if (!isNaN(v)) {
        const cands = [v + 1, v - 1, v * 2, Math.round(v / 2), v + 10, v + 5, v * 10].filter(x => x !== v && x >= 0).map(x => String(Math.round(x * 100) / 100));
        out = shuffle([...new Set(cands)]).slice(0, n);
      }
    }
    if (!isNum && out.length < n) {
      const same = pool.filter(w => w.toLowerCase() !== answer.toLowerCase() && Math.abs(w.length - answer.length) <= 4);
      const rest = pool.filter(w => w.toLowerCase() !== answer.toLowerCase());
      for (const w of shuffle(same).concat(shuffle(rest))) { if (out.length >= n) break; if (!out.includes(w)) out.push(w); }
    }
    return out.slice(0, n);
  }
  const T = {
    ar: { fill: 'أكمل: ', explain: ['اشرح بأسلوبك: ', 'ناقش باختصار: ', 'وضّح المقصود بـ: '], why: 'علّل: ', blank: '________' },
    en: { fill: 'Complete: ', explain: ['Explain in your own words: ', 'Briefly discuss: ', 'Describe: '], why: 'Justify: ', blank: '________' }
  };
  function genOffline(text, cfg) {
    const ar = cfg.lang === 'ar' || (cfg.lang === 'auto' && isArabic(text));
    const t = ar ? T.ar : T.en;
    const sents = sentences(text);
    const allKw = [...new Set(sents.flatMap(s => keywordsOf(s, ar)))].filter(w => !/\d/.test(normDigits(w)));
    const used = new Set();
    const take = () => { const free = sents.filter(s => !used.has(s)); const s = free.length ? free[rand(free.length)] : sents[rand(sents.length)]; used.add(s); return s; };
    const qs = [];
    if (!sents.length) return qs;
    for (let i = 0; i < cfg.mcq; i++) {
      for (let tries = 0; tries < 8; tries++) {
        const s = take(); const b = pickBlank(s, ar, cfg.diff); if (!b) continue;
        const d = distractors(b, allKw, 3); if (d.length < 3) continue;
        const stem = t.fill + s.replace(b, t.blank);
        const opts = shuffle([b, ...d]);
        qs.push({ type: 'mcq', q: stem, options: opts, answer: opts.indexOf(b) }); break;
      }
    }
    for (let i = 0; i < cfg.tf; i++) {
      const s = take(); const makeFalse = Math.random() < 0.5; let stmt = s, val = true;
      if (makeFalse) {
        const b = pickBlank(s, ar, cfg.diff);
        const d = b ? distractors(b, allKw, 1) : [];
        if (b && d.length) { stmt = s.replace(b, d[0]); val = false; }
      }
      qs.push({ type: 'tf', q: stmt, answer: val, note: val ? '' : s });
    }
    for (let i = 0; i < cfg.essay; i++) {
      const s = take(); const kws = keywordsOf(s, ar).slice(0, 4).join(ar ? ' ، ' : ', ');
      const lead = t.explain[i % t.explain.length];
      qs.push({ type: 'essay', q: lead + (kws ? kws + '\n(' + (ar ? 'مرجع: ' : 'Ref: ') + s.slice(0, 120) + (s.length > 120 ? '…' : '') + ')' : s), answer: s });
    }
    return qs;
  }
  function chunk(text, max) { return text.length <= max ? text : text.slice(0, max); }
  function aiPrompt(text, cfg) {
    const lang = cfg.lang === 'auto' ? 'the same language as the source text' : (cfg.lang === 'ar' ? 'Arabic' : 'English');
    const diffMap = { easy: 'easy (recall)', medium: 'medium (understanding)', hard: 'hard (application and analysis)' };
    return 'You are an experienced teacher. From the SOURCE below, write exam questions. Use ONLY facts in the source.\n' +
      `Write in ${lang}. Difficulty: ${diffMap[cfg.diff]}.\n` +
      `Create exactly: ${cfg.mcq} multiple-choice (4 options each, one correct), ${cfg.tf} true/false, ${cfg.essay} essay.\n` +
      'Return ONLY JSON: {"questions":[{"type":"mcq","q":"...","options":["a","b","c","d"],"answer":0},{"type":"tf","q":"statement","answer":true},{"type":"essay","q":"...","answer":"model answer in 1-3 sentences"}]}\n' +
      'For mcq, answer is the 0-based index of the correct option. Do not number the questions.\n\nSOURCE:\n' + chunk(text, 9000);
  }
  function parseAI(content) {
    let s = String(content).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const a = s.indexOf('{'), b = s.lastIndexOf('}'); if (a < 0 || b < 0) throw new Error('no json');
    const j = JSON.parse(s.slice(a, b + 1));
    const out = [];
    for (const q of j.questions || []) {
      if (!q || !q.q) continue;
      if (q.type === 'mcq' && Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(q.answer) && q.options[q.answer] != null) out.push({ type: 'mcq', q: String(q.q), options: q.options.map(String), answer: q.answer });
      else if (q.type === 'tf' && typeof q.answer === 'boolean') out.push({ type: 'tf', q: String(q.q), answer: q.answer, note: '' });
      else if (q.type === 'essay') out.push({ type: 'essay', q: String(q.q), answer: String(q.answer || '') });
    }
    return out;
  }
  const api = { genOffline, aiPrompt, parseAI, isArabic, shuffle, sentences };
  if (typeof module !== 'undefined') module.exports = api; else root.EG = api;
})(typeof window !== 'undefined' ? window : globalThis);
