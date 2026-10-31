/* Impostor – tryb „każdy swój telefon”: telewizor prowadzi grę, gracze dołączają telefonami */
(() => {
'use strict';
const CFG = window.IMPOSTOR_CONFIG || {};
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const COLORS = ['#ff4d6d', '#4dabf7', '#51cf66', '#fcc419', '#cc5de8', '#ff922b', '#20c997', '#f06595', '#5c7cfa', '#94d82d', '#22b8cf', '#e599f7', '#ffa8a8', '#74c0fc', '#ffd43b', '#b197fc'];
const store = {
  get(k, d) { try { const v = localStorage.getItem('impm_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('impm_' + k, JSON.stringify(v)); } catch (e) {} },
};
const CYCLE = { impostors: [1, 2, 3], troll: [0, 10, 20, 35], discuss: [0, 60, 120, 180, 300], vote: [20, 30, 45, 60] };
const PICK_TIME = 40;

const G = {
  active: false, players: [], conns: {}, cats: [], loaded: false,
  settings: Object.assign({ cats: null, impostors: 1, hint: true, troll: 0, discuss: 180, vote: 30 }, store.get('settings', {})),
  phase: 'setup', round: 0, R: null, timer: null, auto: null, msg: '', msgT: null,
};
const save = () => store.set('settings', G.settings);
const player = id => G.players.find(p => p.id === id);
const online = id => { const p = player(id); return !!(p && p.online); };
const nextColor = () => { const used = new Set(G.players.map(p => p.color)); return COLORS.find(c => !used.has(c)) || pick(COLORS); };
function toast(t) { G.msg = t; clearTimeout(G.msgT); G.msgT = setTimeout(() => { G.msg = ''; render(); }, 3500); render(); }

/* ---------- słowa ---------- */
function normCat(meta, d) {
  const items = [], seen = new Set();
  for (const [g, list] of Object.entries(d.groups || {})) {
    for (let w of (Array.isArray(list) ? list : String(list).split(','))) {
      w = String(w).trim(); if (!w) continue;
      const k = w.toLowerCase(); if (seen.has(k)) continue;
      seen.add(k); items.push({ w, g });
    }
  }
  return { id: meta.id, name: d.name || meta.name, emoji: d.emoji || meta.emoji || '🎲', items };
}
async function loadWords() {
  if (G.loaded) return;
  const base = CFG.WORDS_BASE || 'words/';
  try {
    const idx = await (await fetch(base + 'index.json', { cache: 'no-cache' })).json();
    const res = await Promise.all(idx.categories.map(async c => {
      try { return normCat(c, await (await fetch(base + c.file, { cache: 'no-cache' })).json()); } catch (e) { return null; }
    }));
    G.cats = res.filter(c => c && c.items.length);
  } catch (e) { toast('⚠️ Nie udało się wczytać słów'); }
  G.loaded = true;
  const ids = G.cats.map(c => c.id);
  G.settings.cats = (G.settings.cats || ids).filter(i => ids.includes(i));
  if (!G.settings.cats.length) G.settings.cats = ids;
  render();
}

/* ---------- zegar i automaty ---------- */
const mkTimer = (sec, onEnd) => ({ total: sec, endsAt: Date.now() + sec * 1000, left: sec * 1000, running: true, done: false, onEnd });
const timerLeft = () => { const t = G.timer; if (!t) return 0; return t.running ? Math.max(0, t.endsAt - Date.now()) : t.left; };
setInterval(() => {
  const t = G.timer;
  if (!G.active || !t || !t.running || t.done || timerLeft() > 0) return;
  t.done = true; t.running = false; t.left = 0;
  if (t.onEnd) t.onEnd(); else render();
}, 250);
function later(ms, fn) { clearTimeout(G.auto); G.auto = setTimeout(() => { G.auto = null; fn(); }, ms); }
function cancelLater() { clearTimeout(G.auto); G.auto = null; }

/* ---------- przebieg rundy ---------- */
function startRound() {
  const cats = G.cats.filter(c => G.settings.cats.includes(c.id));
  const ps = G.players.filter(p => p.online);
  if (ps.length < 3) return toast('Potrzeba minimum 3 graczy z telefonami');
  if (!cats.length) return toast('Wybierz przynajmniej jedną kategorię');
  let used = new Set(store.get('used', []));
  const pool = [];
  cats.forEach(c => c.items.forEach(it => pool.push({ ...it, c })));
  let fresh = pool.filter(x => !used.has(x.c.id + '|' + x.w));
  if (!fresh.length) { pool.forEach(x => used.delete(x.c.id + '|' + x.w)); fresh = pool; }
  const it = pick(fresh);
  used.add(it.c.id + '|' + it.w);
  store.set('used', [...used].slice(-6000));
  const same = shuffle(it.c.items.filter(x => x.g === it.g && x.w !== it.w).map(x => x.w));
  const rest = shuffle(it.c.items.filter(x => x.g !== it.g).map(x => x.w));
  const options = shuffle([it.w, ...same.slice(0, 9), ...rest.slice(0, Math.max(0, 9 - same.length))]);

  const ids = ps.map(p => p.id), n = ids.length;
  const troll = G.settings.troll > 0 && Math.random() * 100 < G.settings.troll;
  const impostors = troll ? [...ids] : shuffle(ids).slice(0, clamp(G.settings.impostors, 1, n - 1));
  const crew = ids.filter(i => !impostors.includes(i));
  G.round++;
  G.players.forEach(p => { p.delta = 0; });
  G.R = {
    word: it.w, group: it.g, catName: it.c.name, emoji: it.c.emoji, impostors, troll, ids, order: ids,
    starter: pick(crew.length ? crew : ids), seen: [], ballots: {}, votes: {}, picks: {}, guessed: [], options, res: null,
  };
  cancelLater(); G.timer = null; G.phase = 'reveal'; render();
}
function checkSeen() {
  const R = G.R;
  if (G.phase === 'reveal' && R.ids.filter(online).every(id => R.seen.includes(id))) toReady();
}
function toReady() { cancelLater(); G.phase = 'ready'; render(); later(3500, goDiscuss); }
function goDiscuss() { cancelLater(); G.phase = 'discuss'; G.timer = G.settings.discuss ? mkTimer(G.settings.discuss, goVote) : null; render(); }
function goVote() { cancelLater(); G.phase = 'vote'; G.R.ballots = {}; G.R.votes = {}; G.timer = mkTimer(G.settings.vote, endVote); render(); }
function tally() { const R = G.R; R.votes = {}; Object.values(R.ballots).forEach(t => { R.votes[t] = (R.votes[t] || 0) + 1; }); }
function checkVotes() {
  const R = G.R, need = R.ids.filter(online);
  if (G.phase === 'vote' && need.length && need.every(id => R.ballots[id])) later(1500, endVote); else if (G.phase === 'vote') cancelLater();
}
function endVote() {
  cancelLater();
  const R = G.R; tally();
  const entries = Object.entries(R.votes).filter(([, v]) => v > 0);
  const max = entries.reduce((m, [, v]) => Math.max(m, v), 0);
  const top = entries.filter(([, v]) => v === max).map(([k]) => k);
  R.res = { step: 'accused', accused: top.length === 1 ? top[0] : null, tie: top.length > 1, applied: false, headline: '' };
  G.timer = null; G.phase = 'result'; render();
  later(5500, showImp);
}
function showImp() {
  cancelLater(); G.R.res.step = 'impostors';
  if (G.R.troll) { render(); later(6000, showWord); return; }
  G.timer = mkTimer(PICK_TIME, showWord); render(); checkPicks();
}
function checkPicks() {
  const R = G.R;
  if (G.phase !== 'result' || R.res.step !== 'impostors') return;
  const need = R.impostors.filter(online);
  if (!need.length || need.every(id => R.picks[id])) later(need.length ? 2500 : 4000, showWord); else cancelLater();
}
function showWord() { cancelLater(); G.timer = null; applyPoints(); G.R.res.step = 'word'; render(); later(15000, showScores); }
function showScores() { cancelLater(); G.timer = null; G.phase = 'scores'; render(); }
function toLobby() { cancelLater(); G.phase = 'setup'; G.R = null; G.timer = null; render(); }
function applyPoints() {
  const R = G.R, res = R.res;
  if (res.applied) return;
  res.applied = true;
  G.players.forEach(p => { p.delta = 0; });
  const add = (id, v) => { const p = player(id); if (p) { p.score += v; p.delta += v; } };
  const B = R.ballots;
  if (R.troll) {
    if (res.accused === 'troll') { Object.keys(B).filter(v => B[v] === 'troll').forEach(v => add(v, 1)); res.headline = '🤡 Przejrzeliście trolla!'; }
    else res.headline = '🤡 Wkręceni! Wszyscy byli impostorami';
  } else {
    const caught = res.accused && R.impostors.includes(res.accused);
    if (caught) {
      Object.keys(B).filter(v => !R.impostors.includes(v) && R.impostors.includes(B[v])).forEach(v => add(v, 1));
      R.impostors.filter(i => i !== res.accused).forEach(i => add(i, 2));
      res.headline = R.guessed.length ? '🎯 Złapany… ale zgadł słowo!' : '🎉 Impostor wyeliminowany!';
    } else {
      R.impostors.forEach(i => add(i, 2));
      res.headline = res.accused === 'troll' ? '🕵️ To nie był troll! Impostor wygrywa' : '🕵️ Impostor wygrywa!';
    }
    R.guessed.forEach(i => add(i, 2));
  }
}

/* ---------- akcje z pilota ---------- */
const ACT = {
  set(k) {
    if (k === 'hint') G.settings.hint = !G.settings.hint;
    else { const arr = CYCLE[k]; G.settings[k] = arr[(arr.indexOf(G.settings[k]) + 1) % arr.length]; }
    save(); render();
  },
  cat(id) { const s = new Set(G.settings.cats); s.has(id) ? s.delete(id) : s.add(id); G.settings.cats = [...s]; save(); render(); },
  allCats() { G.settings.cats = G.cats.map(c => c.id); save(); render(); },
  noCats() { G.settings.cats = []; save(); render(); },
  start: startRound,
  next: startRound,
  kick(id) {
    const c = G.conns[id];
    if (c) { send(c, { type: 'kicked' }); c._replaced = true; setTimeout(() => { try { c.close(); } catch (e) {} }, 300); delete G.conns[id]; }
    G.players = G.players.filter(p => p.id !== id); render();
  },
  skipReveal: toReady,
  voteNow: goVote,
  endVote,
  showWord,
  scores: showScores,
  lobby: toLobby,
  resetScores() { G.players.forEach(p => { p.score = 0; p.delta = 0; }); render(); },
  back() { if (window.TV) TV.setMode(null); },
};

/* ---------- wiadomości od telefonów ---------- */
function send(c, m) { try { if (c && c.open !== false) c.send(m); } catch (e) {} }
function onPlayerMsg(c, m) {
  if (!m || typeof m !== 'object') return;
  if (!G.active) { send(c, { type: 'err', text: 'Telewizor jest w trybie jednego telefonu. Wybierz na telewizorze „Każdy swój telefon”.' }); return; }
  const R = G.R, pid = c._pid;
  switch (m.type) {
    case 'join': {
      const id = String(m.pid || '').slice(0, 32);
      let name = String(m.name || '').trim().replace(/\s+/g, ' ').slice(0, 16);
      if (!id || !name) return;
      let p = player(id);
      const taken = n => G.players.some(q => q.id !== id && q.name.toLowerCase() === n.toLowerCase());
      if (taken(name)) { let k = 2; while (taken(name + ' ' + k)) k++; name = (name.slice(0, 13) + ' ' + k); }
      if (!p) {
        if (G.players.length >= COLORS.length) { send(c, { type: 'err', text: 'Gra jest pełna (max ' + COLORS.length + ' graczy).' }); return; }
        p = { id, name, color: nextColor(), score: 0, delta: 0, online: true };
        G.players.push(p);
      } else {
        p.online = true;
        if (G.phase === 'setup') p.name = name;
      }
      const old = G.conns[id];
      if (old && old !== c) { old._replaced = true; try { old.close(); } catch (e) {} }
      G.conns[id] = c; c._pid = id;
      render();
      break;
    }
    case 'seen':
      if (G.phase === 'reveal' && R && R.ids.includes(pid) && !R.seen.includes(pid)) { R.seen.push(pid); render(); checkSeen(); }
      break;
    case 'vote': {
      if (G.phase !== 'vote' || !R || !R.ids.includes(pid)) return;
      const t = String(m.target || '');
      const ok = t === 'troll' ? G.settings.troll > 0 : (t !== pid && R.ids.includes(t));
      if (!ok) return;
      if (R.ballots[pid] === t) delete R.ballots[pid]; else R.ballots[pid] = t;
      tally(); render(); checkVotes();
      break;
    }
    case 'pick': {
      if (G.phase !== 'result' || !R || R.res.step !== 'impostors' || R.troll || !R.impostors.includes(pid)) return;
      const w = R.options[Number(m.i)]; if (!w) return;
      R.picks[pid] = w;
      R.guessed = R.impostors.filter(id => R.picks[id] === R.word);
      render(); checkPicks();
      break;
    }
    case 'leave':
      if (G.phase === 'setup') G.players = G.players.filter(p => p.id !== pid);
      else { const p = player(pid); if (p) p.online = false; }
      delete G.conns[pid]; c._replaced = true;
      render();
      break;
  }
}
function onClose(c) {
  if (c._replaced) return;
  const pid = c._pid;
  if (!pid || G.conns[pid] !== c) return;
  delete G.conns[pid];
  const p = player(pid); if (p) p.online = false;
  render();
  if (!G.R) return;
  if (G.phase === 'reveal') checkSeen();
  else if (G.phase === 'vote') checkVotes();
  else if (G.phase === 'result') checkPicks();
}

/* ---------- stan dla TV i dla telefonów ---------- */
function pub() {
  const R = G.R, S = G.settings;
  const st = {
    mode: 'multi', phase: G.phase, round: G.round, msg: G.msg, loaded: G.loaded,
    players: G.players.map(p => ({ id: p.id, name: p.name, color: p.color, score: p.score, delta: p.delta || 0, online: p.online })),
    settings: {
      cats: G.cats.filter(c => S.cats.includes(c.id)).map(c => c.emoji + ' ' + c.name), allCats: G.cats.length,
      catList: G.cats.map(c => ({ id: c.id, name: c.name, emoji: c.emoji, n: c.items.length, on: S.cats.includes(c.id) })),
      impostors: S.impostors, hint: S.hint, troll: S.troll, discuss: S.discuss, vote: S.vote,
    },
    timer: G.timer ? { total: G.timer.total, left: timerLeft(), running: G.timer.running } : null,
  };
  if (R) {
    st.R = { order: R.ids, idx: 0, stage: '', starter: R.starter, votes: R.votes, ballots: R.ballots, trollVote: S.troll > 0, seen: R.seen, ids: R.ids };
    if (G.phase === 'result') {
      const res = R.res;
      st.R.res = { step: res.step, accused: res.accused, tie: res.tie };
      if (res.step !== 'accused') Object.assign(st.R.res, { impostors: R.impostors, troll: R.troll, wasImp: !!res.accused && R.impostors.includes(res.accused), options: R.troll ? [] : R.options, picks: R.picks });
      if (res.step === 'word') Object.assign(st.R.res, { word: R.troll ? '' : R.word, cat: R.emoji + ' ' + R.catName, group: R.group, guessed: R.guessed, headline: res.headline });
    }
  }
  return st;
}
function pstate(p) {
  const R = G.R;
  const st = {
    type: 'p', phase: G.phase, round: G.round,
    me: { id: p.id, name: p.name, color: p.color, score: p.score, delta: p.delta || 0 },
    players: G.players.map(q => ({ id: q.id, name: q.name, color: q.color, score: q.score, delta: q.delta || 0, online: q.online })),
    timer: G.timer ? { total: G.timer.total, left: timerLeft(), running: G.timer.running } : null,
    troll: G.settings.troll > 0,
  };
  if (R && R.ids.includes(p.id)) {
    const imp = R.impostors.includes(p.id);
    st.inRound = true;
    st.role = imp ? { imp: true, hint: G.settings.hint ? R.group : null, many: G.settings.impostors > 1 } : { imp: false, word: R.word, cat: R.emoji + ' ' + R.catName };
    st.seen = R.seen.includes(p.id); st.seenCount = R.seen.length; st.total = R.ids.length;
    st.starter = R.starter; st.ids = R.ids; st.myVote = R.ballots[p.id] || null; st.voteCount = Object.keys(R.ballots).length;
    if (G.phase === 'result') {
      st.step = R.res.step; st.accused = R.res.accused; st.tie = R.res.tie;
      if (R.res.step !== 'accused') { st.impostors = R.impostors; st.troll = R.troll; }
      if (R.res.step === 'impostors' && imp && !R.troll) { st.options = R.options; st.myPick = R.picks[p.id] || null; }
      if (R.res.step === 'word') { st.word = R.troll ? '' : R.word; st.headline = R.res.headline; }
    }
  }
  return st;
}
function render() {
  if (!G.active) return;
  if (window.TV) TV.local(pub());
  Object.entries(G.conns).forEach(([id, c]) => { const p = player(id); if (p) send(c, pstate(p)); });
}
setInterval(render, 3000);

window.TVGame = {
  get active() { return G.active; },
  activate() { G.active = true; loadWords(); render(); },
  deactivate() {
    G.active = false; cancelLater(); G.timer = null;
    Object.values(G.conns).forEach(c => { send(c, { type: 'err', text: 'Telewizor przełączył się na tryb jednego telefonu.' }); });
  },
  action(act, arg) { if (G.active && ACT[act]) ACT[act](arg); },
  onPlayerMsg, onClose,
};
})();
