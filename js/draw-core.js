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
/* ---------- trudność rysowania ---------- */
// bazowa trudność kategorii: 0 = łatwo narysować (konkretne rzeczy), 2 = trudno (abstrakcje, nazwy, czynności)
const CAT_BASE = {
  jedzenie: 0, zwierzeta: 0, dom: 0, transport: 0, ubrania: 0, natura: 0.3, cialo: 0.3, sport: 0.6,
  przedmioty: 0.7, szkola: 0.8, muzyka: 0.8, technologia: 0.8, miejsca: 0.8, narzedzia: 0.8, wakacje: 0.9, hobby: 1, swieta: 1, kosmos: 1, zawody: 1.1,
  polska: 1.6, swiat: 1.6, rozrywka: 1.7, historia: 1.8, marki: 1.9, czynnosci: 1.8, emocje: 2.2,
};
/** Wynik trudności (ok. 0–4): kategoria + długość + liczba wyrazów. */
function difficulty(word, catId) {
  const w = String(word).trim(), words = w.split(/[\s-]+/).length, len = w.replace(/[\s-]/g, '').length;
  let d = CAT_BASE[catId] !== undefined ? CAT_BASE[catId] : 1;
  d += Math.max(0, len - 6) * 0.12 + (words - 1) * 0.7;
  if (/^[A-ZĄĆĘŁŃÓŚŹŻ]/.test(w)) d += 0.5; // nazwy własne
  return d;
}
const level = d => d < 1 ? 1 : d < 1.9 ? 2 : 3; // 1 łatwe, 2 średnie, 3 trudne
// które poziomy trudności trafiają do wyboru w danym trybie
const MODES = { easy: [1, 1, 2], normal: [1, 2, 3], hard: [2, 3, 3] };
const MODE_NAMES = { easy: 'łatwy', normal: 'normalny', hard: 'trudny' };
/** 3 hasła z wybranych kategorii (bez powtórek), posortowane od najłatwiejszego: 1, 2 i 3 pkt. */
function pickWords(cats, sel, used, mode = 'normal', rnd = Math.random) {
  if (typeof mode === 'number') mode = 'normal';
  const pool = [];
  cats.filter(c => !sel || sel.includes(c.id)).forEach(c => c.items.forEach(it => { const d = difficulty(it.w, c.id); pool.push({ w: it.w, cat: c.name, emoji: c.emoji, key: c.id + '|' + it.w, d, lv: level(d) }); }));
  let fresh = pool.filter(x => !used.has(x.key));
  if (fresh.length < 3) { pool.forEach(x => used.delete(x.key)); fresh = pool; }
  const out = [];
  for (const lv of (MODES[mode] || MODES.normal)) {
    let cand = fresh.filter(x => x.lv === lv && !out.includes(x));
    if (!cand.length) cand = fresh.filter(x => !out.includes(x));
    if (!cand.length) break;
    out.push(cand[Math.floor(rnd() * cand.length)]);
  }
  out.sort((a, b) => a.d - b.d);
  out.forEach((x, i) => { x.pts = i + 1; });
  return out;
}

const API = { norm, lev, check, guessPoints, DRAWER_PER_GUESS, mask, letterIdx, normCat, loadWords, pickWords, difficulty, level, MODES, MODE_NAMES };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
root.DrawCore = API;
})(typeof window !== 'undefined' ? window : globalThis);
