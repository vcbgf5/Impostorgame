/* Mafia – wspólna logika gry (telewizor i telefon hosta). Bez DOM – da się testować w node. */
(function (root) {
'use strict';

const ROLES = {
  mafia:   { name: 'Mafia', emoji: '🕴️', team: 'mafia', desc: 'W nocy razem z resztą mafii wybieracie ofiarę. W dzień udawaj niewinnego.' },
  cop:     { name: 'Policjant', emoji: '🕵️', team: 'town', desc: 'W nocy sprawdzasz jedną osobę i dowiadujesz się, czy jest w mafii.' },
  doctor:  { name: 'Lekarz', emoji: '🩺', team: 'town', desc: 'W nocy ratujesz jedną osobę (może być to ktoś inny niż poprzedniej nocy).' },
  citizen: { name: 'Obywatel', emoji: '🙂', team: 'town', desc: 'Nie masz mocy. Obserwuj, dyskutuj i znajdź mafię w głosowaniu.' },
};
const DEFAULTS = { mafia: 0, cop: true, doctor: true, reveal: true, discuss: 180, vote: 45, voice: true, night: 60 };

const shuffle = (a, rnd = Math.random) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function autoMafia(n) { return n <= 6 ? 1 : n <= 9 ? 2 : n <= 12 ? 3 : 4; }
function maxMafia(n) { return Math.max(1, Math.floor((n - 1) / 2)); }
function mafiaCount(n, s) { return Math.min(maxMafia(n), Math.max(1, s.mafia || autoMafia(n))); }

/** ids → { id: rola } */
function assignRoles(ids, s, rnd = Math.random) {
  const n = ids.length, k = mafiaCount(n, s);
  const pool = [];
  for (let i = 0; i < k; i++) pool.push('mafia');
  if (s.cop && n - k >= 2) pool.push('cop');
  if (s.doctor && n - k >= 3) pool.push('doctor');
  while (pool.length < n) pool.push('citizen');
  const sh = shuffle(pool, rnd), out = {};
  ids.forEach((id, i) => { out[id] = sh[i]; });
  return out;
}

const alive = st => st.players.filter(p => p.alive);
const roleOf = (st, id) => st.roles[id];
const isMafia = (st, id) => st.roles[id] === 'mafia';

/** Cel mafii z wyborów żywych mafiozów: najczęstszy; remis → losowo. null gdy brak wyborów. */
function resolveMafiaTarget(picks, mafiaIds, rnd = Math.random) {
  const cnt = {};
  mafiaIds.forEach(id => { const t = picks[id]; if (t) cnt[t] = (cnt[t] || 0) + 1; });
  const e = Object.entries(cnt);
  if (!e.length) return null;
  const max = Math.max(...e.map(([, v]) => v));
  const top = e.filter(([, v]) => v === max).map(([k]) => k);
  return top[Math.floor(rnd() * top.length)];
}
/** Czy mafia jest zgodna (wszyscy żywi mafiozi wybrali ten sam cel)? */
function mafiaAgreed(picks, mafiaIds) {
  if (!mafiaIds.length) return true;
  const t = picks[mafiaIds[0]];
  return !!t && mafiaIds.every(id => picks[id] === t);
}

/** Kto jeszcze musi wykonać ruch nocny (żywi gracze bez akcji). */
function nightPending(st) { return alive(st).filter(p => !st.night.done[p.id]).map(p => p.id); }

/** Rozstrzygnięcie nocy. Zwraca { victim, saved, target, suspect } i zabija ofiarę w st. */
function resolveNight(st, rnd = Math.random) {
  const N = st.night;
  const mafiaIds = alive(st).filter(p => isMafia(st, p.id)).map(p => p.id);
  const target = resolveMafiaTarget(N.mafia, mafiaIds, rnd);
  const docId = alive(st).find(p => roleOf(st, p.id) === 'doctor');
  const heal = docId ? N.heal : null;
  const saved = !!(target && heal && heal === target);
  const victim = target && !saved ? target : null;
  if (victim) { const p = st.players.find(q => q.id === victim); if (p) { p.alive = false; p.diedNight = st.day; } }
  // pozorne „podejrzenia” obywateli – dla zabawy
  const cnt = {};
  Object.values(N.suspect || {}).forEach(t => { cnt[t] = (cnt[t] || 0) + 1; });
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
  st.lastHeal = heal || null;
  return { victim, saved, target, suspect: top && top[1] >= 2 ? top[0] : null };
}

/** Głosy dzienne { voter: target|'skip' } → { out: id|null, tie, counts } */
function tally(ballots) {
  const counts = {};
  Object.values(ballots).forEach(t => { counts[t] = (counts[t] || 0) + 1; });
  const e = Object.entries(counts);
  if (!e.length) return { out: null, tie: false, counts };
  const max = Math.max(...e.map(([, v]) => v));
  const top = e.filter(([, v]) => v === max).map(([k]) => k);
  if (top.length > 1) return { out: null, tie: true, counts };
  return { out: top[0] === 'skip' ? null : top[0], tie: false, counts };
}

/** 'town' | 'mafia' | null */
function checkWin(st) {
  const a = alive(st), m = a.filter(p => isMafia(st, p.id)).length;
  if (m === 0) return 'town';
  if (m >= a.length - m) return 'mafia';
  return null;
}

/** Punkty po partii: zwycięska drużyna +2, żywi zwycięzcy +1. */
function applyScores(st, winner) {
  st.players.forEach(p => {
    p.delta = 0;
    if (ROLES[st.roles[p.id]] && ROLES[st.roles[p.id]].team === winner) { p.delta = 2 + (p.alive ? 1 : 0); p.score = (p.score || 0) + p.delta; }
  });
}

/** Nowa partia: role, wszyscy żywi, noc 1 przed nami. */
function newGame(st, rnd = Math.random) {
  const ids = st.players.map(p => p.id);
  st.roles = assignRoles(ids, st.settings, rnd);
  st.players.forEach(p => { p.alive = true; p.delta = 0; delete p.diedNight; });
  st.day = 0; st.lastHeal = null; st.log = []; st.winner = null;
  st.night = null; st.ballots = {}; st.seen = {};
}
function startNight(st) {
  st.day += 1;
  st.night = { mafia: {}, check: null, checkRes: null, heal: null, suspect: {}, done: {} };
}
/** Akcja nocna gracza. kind zależny od roli; zwraca wynik dla policjanta. */
function nightAction(st, id, target) {
  const N = st.night, r = st.roles[id], p = st.players.find(q => q.id === id);
  if (!N || !p || !p.alive) return { ok: false };
  const t = st.players.find(q => q.id === target);
  if (r === 'mafia') {
    if (!t || !t.alive || isMafia(st, target)) return { ok: false };
    N.mafia[id] = target; N.done[id] = true; return { ok: true };
  }
  if (r === 'cop') {
    if (N.check || !t || !t.alive || target === id) return { ok: false };
    N.check = target; N.checkRes = isMafia(st, target); N.done[id] = true;
    return { ok: true, result: N.checkRes };
  }
  if (r === 'doctor') {
    if (!t || !t.alive || target === st.lastHeal) return { ok: false };
    N.heal = target; N.done[id] = true; return { ok: true };
  }
  if (!t || !t.alive || target === id) return { ok: false };
  N.suspect[id] = target; N.done[id] = true; return { ok: true };
}
/** Kogo dana osoba może wskazać w nocy. */
function nightTargets(st, id) {
  const r = st.roles[id];
  return alive(st).filter(p => {
    if (r === 'mafia') return !isMafia(st, p.id);
    if (r === 'doctor') return p.id !== st.lastHeal;
    return p.id !== id;
  }).map(p => p.id);
}
function teammates(st, id) { return isMafia(st, id) ? st.players.filter(p => p.id !== id && isMafia(st, p.id)).map(p => p.id) : []; }

const API = { ROLES, DEFAULTS, autoMafia, maxMafia, mafiaCount, assignRoles, resolveMafiaTarget, mafiaAgreed, nightPending, resolveNight, tally, checkWin, applyScores, newGame, startNight, nightAction, nightTargets, teammates, alive, isMafia, shuffle };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
root.MafiaCore = API;
})(typeof window !== 'undefined' ? window : globalThis);
