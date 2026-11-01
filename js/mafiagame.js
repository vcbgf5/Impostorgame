/* Mafia – telewizor w trybie „każdy swój telefon”: TV prowadzi grę, gracze dołączają telefonami */
(() => {
'use strict';
const COLORS = ['#ff4d6d', '#4dabf7', '#51cf66', '#fcc419', '#cc5de8', '#ff922b', '#20c997', '#f06595', '#5c7cfa', '#94d82d', '#22b8cf', '#e599f7', '#ffa8a8', '#74c0fc', '#ffd43b', '#b197fc'];
const EMOJI = ['🐱', '🐶', '🦊', '🐼', '🐸', '🐵', '🦁', '🐯', '🐷', '🐨', '🐙', '🦄', '🐲', '👽', '🤖', '👻', '🎃', '🤠', '😎', '🥸', '🦖', '🐧', '🦉', '🐝'];
const REACTS = ['😂', '😱', '🤔', '😡', '👏', '🔥', '🤡', '🕵️', '❤️', '👀'];
const store = {
  get(k, d) { try { const v = localStorage.getItem('impmaf_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('impmaf_' + k, JSON.stringify(v)); } catch (e) {} },
};
const CYCLE = { mafia: [0, 1, 2, 3, 4], discuss: [0, 120, 180, 300], vote: [30, 45, 60], cards: [0, 1, 2, 3] };

let active = false;
const conns = {}, lastReact = {};
const E = MafiaEngine.create({ mode: 'multi', settings: store.get('settings', {}), render });
const player = id => E.players.find(p => p.id === id);
const nextColor = () => { const used = new Set(E.players.map(p => p.color)); return COLORS.find(c => !used.has(c)) || COLORS[0]; };
function send(c, m) { try { if (c && c.open !== false) c.send(m); } catch (e) {} }

function render() {
  if (!active) return;
  if (window.TV) TV.local(E.pub());
  Object.entries(conns).forEach(([id, c]) => { if (player(id)) send(c, Object.assign(E.pstate(id), { emojis: EMOJI, reacts: REACTS })); });
}
setInterval(render, 3000);

const save = () => store.set('settings', E.settings);
const ACT = {
  set(k) {
    if (['cop', 'doctor', 'reveal', 'voice'].includes(k)) E.settings[k] = !E.settings[k];
    else { const a = CYCLE[k]; E.settings[k] = a[(a.indexOf(E.settings[k]) + 1) % a.length]; }
    save(); render();
  },
  start: () => E.start(), next: () => E.start(),
  kick(id) {
    const c = conns[id];
    if (c) { send(c, { type: 'kicked' }); c._replaced = true; setTimeout(() => { try { c.close(); } catch (e) {} }, 300); delete conns[id]; }
    E.removePlayer(id);
  },
  skipWait: () => E.skipWait(), voteNow: () => E.voteNow(), endVote: () => E.endVote(),
  toDay: () => E.toDay(), toNight: () => E.toNight(),
  scores: () => E.scores(), lobby: () => E.lobby(), resetScores: () => E.resetScores(),
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
        E.players.push(p = { id, name, color: nextColor(), emoji: '', score: 0, delta: 0, online: true });
      } else { p.online = true; if (E.phase === 'setup') p.name = name; }
      if (EMOJI.includes(m.emoji) && !E.players.some(q => q.id !== id && q.emoji === m.emoji)) p.emoji = m.emoji;
      if (!p.emoji) { const used = new Set(E.players.map(q => q.emoji)); p.emoji = EMOJI.find(e => !used.has(e)) || EMOJI[0]; }
      const old = conns[id];
      if (old && old !== c) { old._replaced = true; try { old.close(); } catch (e) {} }
      conns[id] = c; c._pid = id;
      render();
      break;
    }
    case 'seen': E.seen(pid); break;
    case 'night': {
      const r = E.night(pid, String(m.target || ''));
      if (!r.ok) render();
      break;
    }
    case 'mvote': E.vote(pid, String(m.target || '')); break;
    case 'skipday': E.skipDay(pid); break;
    case 'card': { const r = E.playCard(pid, Number(m.i), String(m.target || '')); if (!r.ok && r.msg) send(c, { type: 'note', text: r.msg }); render(); break; }
    case 'gift': { const r = E.gift(pid, Number(m.i), String(m.target || '')); if (!r.ok && r.msg) send(c, { type: 'note', text: r.msg }); render(); break; }
    case 'skipgift': E.skipGift(pid); break;
    case 'react': {
      const p = player(pid); if (!p || !REACTS.includes(m.e)) return;
      if (E.phase === 'night') return; // w nocy cisza – reakcje mogłyby zdradzić role
      const now = Date.now(); if (now - (lastReact[pid] || 0) < 600) return;
      lastReact[pid] = now;
      if (window.TV && TV.react) TV.react({ name: p.name, color: p.color, emoji: p.emoji }, m.e);
      break;
    }
    case 'emoji': {
      const p = player(pid); if (!p || !EMOJI.includes(m.e) || E.players.some(q => q.id !== pid && q.emoji === m.e)) return;
      p.emoji = m.e; render(); break;
    }
    case 'leave':
      if (E.phase === 'setup') E.removePlayer(pid); else { const p = player(pid); if (p) p.online = false; }
      delete conns[pid]; c._replaced = true; render();
      break;
  }
}
function onClose(c) {
  if (c._replaced) return;
  const pid = c._pid;
  if (!pid || conns[pid] !== c) return;
  delete conns[pid];
  const p = player(pid); if (p) p.online = false;
  render();
}

window.MafiaGame = {
  get active() { return active; },
  activate() {
    active = true; render();
    Object.values(conns).forEach(c => send(c, { type: 'rejoin' }));
  },
  deactivate() { active = false; },
  action(act, arg) { if (active && ACT[act]) ACT[act](arg); },
  onPlayerMsg, onClose,
  // telefony podłączone do innej gry na tym TV (przełączenie gry) – poproś o ponowne dołączenie
  adopt(c) { send(c, { type: 'rejoin' }); },
};
})();
