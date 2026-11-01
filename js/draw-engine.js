/* Kalambury – przebieg gry (wspólny dla TV w trybie multi i telefonu hosta w trybie jednego telefonu) */
(function (root) {
'use strict';
const D = root.DrawCore;
const MAX_PTS = 4000; // limit punktów kresek w rundzie (żeby wiadomości nie puchły)

function create(opts) {
  const mode = opts.mode;
  const E = {
    mode, players: [], cats: [],
    settings: Object.assign({ cats: null, time: 80, rounds: 1 }, opts.settings || {}),
    phase: 'setup', timer: null, auto: null, msg: '',
    order: [], turn: 0, total: 0, drawer: null, choices: [], word: null, cat: '', emoji: '',
    shown: [], guessed: [], chat: [], notes: {}, strokes: [], bg: '#ffffff', roundId: 0, nPts: 0,
    used: new Set(), lastGains: {}, final: null,
  };
  const changed = () => opts.render && opts.render();
  const player = id => E.players.find(p => p.id === id);
  const online = id => { const p = player(id); return mode === 'single' || !!(p && p.online); };
  const nameOf = id => (player(id) || {}).name || '?';

  E.timerLeft = () => { const t = E.timer; if (!t) return 0; return t.running ? Math.max(0, t.endsAt - Date.now()) : t.left; };
  const mkTimer = (sec, onEnd) => ({ total: sec, endsAt: Date.now() + sec * 1000, left: sec * 1000, running: true, done: false, onEnd });
  const tick = setInterval(() => {
    const t = E.timer; if (!t) return;
    // odsłanianie liter w trakcie rysowania
    if (E.phase === 'draw' && t.running) {
      const frac = 1 - E.timerLeft() / (t.total * 1000), idx = D.letterIdx(E.word || '');
      const want = idx.length >= 4 ? (frac >= 0.7 ? 2 : frac >= 0.4 ? 1 : 0) : 0;
      if (E.shown.length < want) {
        const left = idx.filter(i => !E.shown.includes(i));
        if (left.length > 1) { E.shown.push(left[Math.floor(Math.random() * left.length)]); changed(); }
      }
    }
    if (!t.running || t.done || E.timerLeft() > 0) return;
    t.done = true; t.running = false; t.left = 0;
    if (t.onEnd) t.onEnd(); else changed();
  }, 250);
  function later(ms, fn) { clearTimeout(E.auto); E.auto = setTimeout(() => { E.auto = null; fn(); }, ms); }
  function cancel() { clearTimeout(E.auto); E.auto = null; }
  E.destroy = () => { clearInterval(tick); cancel(); };
  E.toast = t => { E.msg = t; changed(); setTimeout(() => { if (E.msg === t) { E.msg = ''; changed(); } }, 3500); };
  E.pause = () => { const t = E.timer; if (t && t.running) { t.left = E.timerLeft(); t.running = false; changed(); } };
  E.resume = () => { const t = E.timer; if (t && !t.running && !t.done) { t.endsAt = Date.now() + t.left; t.running = true; changed(); } };

  E.addPlayer = p => { E.players.push(Object.assign({ score: 0, delta: 0, online: true }, p)); changed(); };
  E.removePlayer = id => { E.players = E.players.filter(p => p.id !== id); changed(); };

  /* ---------- przebieg ---------- */
  E.start = () => {
    const ps = E.players.filter(p => online(p.id));
    if (ps.length < 2) return E.toast('Kalambury potrzebują minimum 2 graczy');
    if (!E.cats.length) return E.toast('Ładowanie słów…');
    E.order = ps.map(p => p.id); E.turn = 0; E.total = E.order.length * E.settings.rounds;
    E.players.forEach(p => { p.score = 0; p.delta = 0; });
    E.final = null;
    nextTurn(true);
  };
  function nextTurn(first) {
    cancel();
    if (!first) E.turn++;
    // pomiń graczy, którzy wyszli
    while (E.turn < E.total && !player(E.order[E.turn % E.order.length])) E.turn++;
    if (E.turn >= E.total) return finish();
    E.drawer = E.order[E.turn % E.order.length];
    E.choices = D.pickWords(E.cats, E.settings.cats, E.used, 3);
    E.word = null; E.strokes = []; E.nPts = 0; E.bg = '#ffffff'; E.guessed = []; E.chat = []; E.notes = {}; E.shown = [];
    E.players.forEach(p => { p.delta = 0; });
    E.roundId++;
    E.phase = 'choose';
    E.timer = mode === 'multi' ? mkTimer(20, () => E.choose(E.drawer, 0)) : null;
    changed();
  }
  E.choose = (id, i) => {
    if (E.phase !== 'choose' || id !== E.drawer || !E.choices[i]) return;
    const c = E.choices[i];
    E.word = c.w; E.cat = c.cat; E.emoji = c.emoji; E.used.add(c.key);
    E.phase = 'draw';
    E.timer = mkTimer(E.settings.time, endRound);
    changed();
  };
  /** Kreski od rysującego: { ops:[{i,c,w,p:[[x,y]…]}], undo, clear, bg } (x,y w 0..1000). */
  E.draw = (id, m) => {
    if (E.phase !== 'draw' || id !== E.drawer || !m) return false;
    if (m.clear) { E.strokes = []; E.nPts = 0; }
    if (m.undo) { const s = E.strokes.pop(); if (s) E.nPts -= s.p.length; }
    if (typeof m.bg === 'string' && /^#[0-9a-f]{6}$/i.test(m.bg)) E.bg = m.bg;
    (m.ops || []).forEach(o => {
      if (!o || !Array.isArray(o.p)) return;
      const pts = o.p.filter(q => Array.isArray(q) && q.length === 2).map(([x, y]) => [Math.max(0, Math.min(1000, x | 0)), Math.max(0, Math.min(1000, y | 0))]);
      if (E.nPts + pts.length > MAX_PTS) return;
      let s = E.strokes.find(q => q.i === o.i);
      if (!s) { s = { i: o.i, c: /^(#[0-9a-f]{6}|erase)$/i.test(o.c) ? o.c : '#000000', w: Math.max(1, Math.min(60, +o.w || 6)), p: [] }; E.strokes.push(s); }
      s.p.push(...pts); E.nPts += pts.length;
    });
    return true;
  };
  E.guess = (id, text) => {
    if (E.phase !== 'draw' || id === E.drawer || !player(id) || E.guessed.some(g => g.id === id)) return null;
    text = String(text || '').trim().slice(0, 30);
    if (!text) return null;
    const r = D.check(text, E.word);
    if (r === 'ok') {
      const order = E.guessed.length, frac = E.timer ? E.timerLeft() / (E.timer.total * 1000) : 0;
      const pts = D.guessPoints(order, frac);
      E.guessed.push({ id, pts, at: Date.now() });
      add(id, pts); add(E.drawer, D.DRAWER_PER_GUESS);
      E.chat.push({ id, ok: true, t: '✅ zgadł(a)!' });
      E.notes[id] = { k: 'ok', t: `✅ Brawo! +${pts} pkt` };
      const need = E.players.filter(p => p.id !== E.drawer && online(p.id) && E.order.includes(p.id));
      if (need.every(p => E.guessed.some(g => g.id === p.id))) later(1500, endRound);
    } else if (r === 'close') {
      E.notes[id] = { k: 'close', t: `🔥 „${text}” – blisko!` };
    } else {
      E.chat.push({ id, t: text });
    }
    if (E.chat.length > 30) E.chat.splice(0, E.chat.length - 30);
    changed();
    return r;
  };
  function add(id, v) { const p = player(id); if (p) { p.score += v; p.delta += v; } }
  /** Tryb jednego telefonu: host zaznacza, kto zgadł (albo nikt). */
  E.markGuess = id => {
    if (E.phase !== 'draw') return;
    if (id && id !== E.drawer && player(id)) { E.guessed.push({ id, pts: 3, at: Date.now() }); add(id, 3); add(E.drawer, 2); }
    endRound();
  };
  E.skipChoose = () => { if (E.phase === 'choose') E.choose(E.drawer, 0); };
  function endRound() {
    cancel(); E.timer = null;
    E.phase = 'reveal'; changed();
    if (mode === 'multi') later(7000, () => nextTurn());
  }
  E.endRound = () => { if (E.phase === 'draw') endRound(); };
  E.next = () => { if (E.phase === 'reveal') nextTurn(); };
  function finish() {
    cancel(); E.timer = null;
    const top = Math.max(0, ...E.players.map(p => p.score));
    E.final = E.players.filter(p => p.score === top && top > 0).map(p => p.id);
    E.phase = 'final'; changed();
  }
  E.lobby = () => { cancel(); E.timer = null; E.phase = 'setup'; changed(); };

  /* ---------- stan ---------- */
  const pubP = p => ({ id: p.id, name: p.name, color: p.color, emoji: p.emoji, score: p.score || 0, delta: p.delta || 0, online: online(p.id) });
  E.pub = (withStrokes = true) => {
    const o = {
      game: 'draw', mode, phase: E.phase, msg: E.msg, round: E.turn + 1, total: E.total, roundId: E.roundId,
      players: E.players.map(pubP), drawer: E.drawer,
      settings: { time: E.settings.time, rounds: E.settings.rounds, catList: E.cats.map(c => ({ id: c.id, name: c.name, emoji: c.emoji, n: c.items.length, on: !E.settings.cats || E.settings.cats.includes(c.id) })) },
      timer: E.timer ? { total: E.timer.total, left: E.timerLeft(), running: E.timer.running } : null,
    };
    if (E.phase === 'draw' || E.phase === 'reveal') {
      o.mask = E.phase === 'reveal' ? [...E.word] : D.mask(E.word, E.shown); o.cat = E.emoji + ' ' + E.cat;
      o.guessed = E.guessed.map(g => ({ id: g.id, pts: g.pts })); o.chat = E.chat.slice(-8); o.bg = E.bg;
      if (withStrokes) o.strokes = E.strokes;
    }
    if (E.phase === 'reveal' || E.phase === 'final') { o.word = E.word; o.winner = E.guessed[0] ? E.guessed[0].id : null; }
    if (E.phase === 'final') o.final = E.final;
    return o;
  };
  E.pstate = id => {
    const me = player(id), o = { type: 'p', game: 'draw', phase: E.phase, me: me && pubP(me), players: E.players.map(pubP), drawer: E.drawer, round: E.turn + 1, total: E.total, timer: E.pub(false).timer, roundId: E.roundId };
    o.isDrawer = id === E.drawer;
    if (E.phase === 'choose' && o.isDrawer) o.choices = E.choices.map(c => ({ w: c.w, cat: c.emoji + ' ' + c.cat }));
    if (E.phase === 'draw' || E.phase === 'reveal') {
      o.mask = E.phase === 'reveal' || o.isDrawer ? [...E.word] : D.mask(E.word, E.shown);
      o.cat = E.emoji + ' ' + E.cat;
      const g = E.guessed.find(x => x.id === id);
      o.guessedMe = !!g; o.myPts = g ? g.pts : 0;
      if (g || o.isDrawer) o.word = E.word;
      o.guessCount = E.guessed.length; o.note = E.notes[id] || null;
      o.chat = E.chat.slice(-6);
    }
    if (E.phase === 'reveal' || E.phase === 'final') { o.word = E.word; o.winner = E.guessed[0] ? E.guessed[0].id : null; }
    if (E.phase === 'final') o.final = E.final;
    return o;
  };
  return E;
}
root.DrawEngine = { create };
})(typeof window !== 'undefined' ? window : globalThis);
