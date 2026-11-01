/* Kalambury – wspólna logika (bez DOM, testowalna w node) */
(function (root) {
'use strict';
const PL = { 'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z' };
/** „Żółw ” → „zolw”: małe litery, bez polskich znaków, bez spacji i znaków. */
function norm(s) {
  return String(s || '').toLowerCase().replace(/[ąćęłńóśźż]/g, c => PL[c])
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}
function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
/** 'ok' | 'close' | 'no' */
function check(guess, word) {
  const g = norm(guess), w = norm(word);
  if (!g) return 'no';
  if (g === w) return 'ok';
  const d = lev(g, w);
  if (w.length >= 4 && d === 1) return 'close';
  if (w.length >= 8 && d === 2) return 'close';
  return 'no';
}
/** Punkty dla zgadującego: pierwszy 10, potem 8, 6, 4, reszta 3 (+1 za szybkość, gdy zostało >60% czasu). */
function guessPoints(order, leftFrac) { return Math.max(3, 10 - 2 * order) + (leftFrac > 0.6 ? 1 : 0); }
const DRAWER_PER_GUESS = 2;
/** Hasło z kreskami: „kot morski” → „_ _ _   _ _ _ _ _ _” z odsłoniętymi literami. */
function mask(word, shown) {
  const s = new Set(shown || []);
  return [...String(word)].map((ch, i) => /[\s-]/.test(ch) ? (ch === '-' ? '-' : ' ') : s.has(i) ? ch : '_');
}
function letterIdx(word) { return [...String(word)].map((ch, i) => /[\s-]/.test(ch) ? -1 : i).filter(i => i >= 0); }

/* ---------- słowa (te same pliki co Impostor) ---------- */
function normCat(meta, d) {
  const items = [], seen = new Set();
  for (const [g, list] of Object.entries(d.groups || {})) {
    for (let w of (Array.isArray(list) ? list : String(list).split(','))) {
      w = String(w).trim(); if (!w || w.length > 22) continue;
      const k = w.toLowerCase(); if (seen.has(k)) continue;
      seen.add(k); items.push({ w, g });
    }
  }
  return { id: meta.id, name: d.name || meta.name, emoji: d.emoji || meta.emoji || '🎲', items };
}
async function loadWords(base) {
  const idx = await (await fetch(base + 'index.json', { cache: 'no-cache' })).json();
  const res = await Promise.all(idx.categories.map(async c => {
    try { return normCat(c, await (await fetch(base + c.file, { cache: 'no-cache' })).json()); } catch (e) { return null; }
  }));
  return res.filter(c => c && c.items.length);
}
/** 3 różne hasła z wybranych kategorii, bez powtórek (used: Set „cat|słowo”). */
function pickWords(cats, sel, used, n = 3, rnd = Math.random) {
  const pool = [];
  cats.filter(c => !sel || sel.includes(c.id)).forEach(c => c.items.forEach(it => pool.push({ w: it.w, cat: c.name, emoji: c.emoji, key: c.id + '|' + it.w })));
  let fresh = pool.filter(x => !used.has(x.key));
  if (fresh.length < n) { pool.forEach(x => used.delete(x.key)); fresh = pool; }
  const out = [];
  while (out.length < n && fresh.length) { const i = Math.floor(rnd() * fresh.length); out.push(fresh.splice(i, 1)[0]); }
  return out;
}

const API = { norm, lev, check, guessPoints, DRAWER_PER_GUESS, mask, letterIdx, normCat, loadWords, pickWords };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
root.DrawCore = API;
})(typeof window !== 'undefined' ? window : globalThis);
