/* Kalambury – telewizor w trybie „każdy swój telefon” */
(() => {
'use strict';
const CFG = window.IMPOSTOR_CONFIG || {};
const COLORS = ['#ff4d6d', '#4dabf7', '#51cf66', '#fcc419', '#cc5de8', '#ff922b', '#20c997', '#f06595', '#5c7cfa', '#94d82d', '#22b8cf', '#e599f7', '#ffa8a8', '#74c0fc', '#ffd43b', '#b197fc'];
const EMOJI = ['🐱', '🐶', '🦊', '🐼', '🐸', '🐵', '🦁', '🐯', '🐷', '🐨', '🐙', '🦄', '🐲', '👽', '🤖', '👻', '🎃', '🤠', '😎', '🥸', '🦖', '🐧', '🦉', '🐝'];
const REACTS = ['😂', '😱', '🤔', '😡', '👏', '🔥', '🤡', '🕵️', '❤️', '👀'];
const store = {
  get(k, d) { try { const v = localStorage.getItem('impdraw_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('impdraw_' + k, JSON.stringify(v)); } catch (e) {} },
};
const CYCLE = { time: [60, 80, 100, 120], rounds: [1, 2, 3] };
let active = false, loaded = false;
const conns = {}, lastReact = {};
const E = DrawEngine.create({ mode: 'multi', settings: store.get('settings', {}), render });
const player = id => E.players.find(p => p.id === id);
const send = (c, m) => { try { if (c && c.open !== false) c.send(m); } catch (e) {} };
const save = () => store.set('settings', { cats: E.settings.cats, time: E.settings.time, rounds: E.settings.rounds });

function render() {
  if (!active) return;
  if (window.TV) TV.local(E.pub());
  Object.entries(conns).forEach(([id, c]) => { if (player(id)) send(c, Object.assign(E.pstate(id), { emojis: EMOJI, reacts: REACTS })); });
}
setInterval(render, 3000);

async function load() {
  if (loaded) return;
  try { E.cats = await DrawCore.loadWords(CFG.WORDS_BASE || 'words/'); } catch (e) { E.toast('⚠️ Nie udało się wczytać słów'); }
  loaded = true;
  const ids = E.cats.map(c => c.id);
  if (E.settings.cats) { E.settings.cats = E.settings.cats.filter(i => ids.includes(i)); if (!E.settings.cats.length) E.settings.cats = null; }
  render();
}

const ACT = {
  set(k) { const a = CYCLE[k]; E.settings[k] = a[(a.indexOf(E.settings[k]) + 1) % a.length]; save(); render(); },
  cat(id) {
    const all = E.cats.map(c => c.id), s = new Set(E.settings.cats || all);
    s.has(id) ? s.delete(id) : s.add(id);
    E.settings.cats = s.size === all.length ? null : [...s]; save(); render();
  },
  allCats() { E.settings.cats = null; save(); render(); },
  noCats() { E.settings.cats = []; save(); render(); },
  start: () => { if (E.settings.cats && !E.settings.cats.length) return E.toast('Wybierz przynajmniej jedną kategorię'); E.start(); },
  next: () => E.next(), skipChoose: () => E.skipChoose(), endRound: () => E.endRound(),
  again: () => E.start(), lobby: () => E.lobby(),
  kick(id) {
    const c = conns[id];
    if (c) { send(c, { type: 'kicked' }); c._replaced = true; setTimeout(() => { try { c.close(); } catch (e) {} }, 300); delete conns[id]; }
    E.removePlayer(id);
  },
  back() { if (window.TV) TV.setMode(null); },
};

function onPlayerMsg(c, m) {
  if (!m || typeof m !== 'object') return;
  if (!active) { send(c, { type: 'err', text: 'Telewizor jest teraz w innym trybie albo grze.' }); return; }
  const pid = c._pid;
  switch (m.type) {
    case 'join': {
      const id = String(m.pid || '').slice(0, 32);
      let name = String(m.name || '').trim().replace(/\s+/g, ' ').slice(0, 16);
      if (!id || !name) return;
      let p = player(id);
      const taken = n => E.players.some(q => q.id !== id && q.name.toLowerCase() === n.toLowerCase());
      if (taken(name)) { let k = 2; while (taken(name + ' ' + k)) k++; name = name.slice(0, 13) + ' ' + k; }
      if (!p) {
        if (E.players.length >= COLORS.length) { send(c, { type: 'err', text: 'Gra jest pełna.' }); return; }
        const used = new Set(E.players.map(q => q.color));
        E.players.push(p = { id, name, color: COLORS.find(x => !used.has(x)) || COLORS[0], emoji: '', score: 0, delta: 0, online: true });
      } else { p.online = true; if (E.phase === 'setup') p.name = name; }
      if (EMOJI.includes(m.emoji) && !E.players.some(q => q.id !== id && q.emoji === m.emoji)) p.emoji = m.emoji;
      if (!p.emoji) { const used = new Set(E.players.map(q => q.emoji)); p.emoji = EMOJI.find(e => !used.has(e)) || EMOJI[0]; }
      const old = conns[id];
      if (old && old !== c) { old._replaced = true; try { old.close(); } catch (e) {} }
      conns[id] = c; c._pid = id;
      render(); break;
    }
    case 'choose': E.choose(pid, Number(m.i)); break;
    case 'dr': if (E.draw(pid, m) && window.TV && TV.drawOps) TV.drawOps(Object.assign({ rid: E.roundId }, m)); break;
    case 'mark': if (pid === E.drawer) E.markGuess(m.id ? String(m.id) : null); break;
    case 'guess': { const r = E.guess(pid, m.text); if (r && window.TV && TV.drawEvent) TV.drawEvent(r, pid); break; }
    case 'react': {
      const p = player(pid); if (!p || !REACTS.includes(m.e)) return;
      const now = Date.now(); if (now - (lastReact[pid] || 0) < 600) return;
      lastReact[pid] = now;
      if (window.TV && TV.react) TV.react({ name: p.name, color: p.color, emoji: p.emoji }, m.e);
      break;
    }
    case 'emoji': { const p = player(pid); if (!p || !EMOJI.includes(m.e) || E.players.some(q => q.id !== pid && q.emoji === m.e)) return; p.emoji = m.e; render(); break; }
    case 'leave':
      if (E.phase === 'setup') E.removePlayer(pid); else { const p = player(pid); if (p) p.online = false; }
      delete conns[pid]; c._replaced = true; render(); break;
  }
}
function onClose(c) {
  if (c._replaced) return;
  const pid = c._pid; if (!pid || conns[pid] !== c) return;
  delete conns[pid]; const p = player(pid); if (p) p.online = false; render();
}

window.DrawGame = {
  get active() { return active; },
  activate() { active = true; load(); render(); },
  deactivate() { active = false; },
  action(act, arg) { if (active && ACT[act]) ACT[act](arg); },
  onPlayerMsg, onClose,
};
})();
