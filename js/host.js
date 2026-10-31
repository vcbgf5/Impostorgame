/* Impostor – aplikacja hosta (telefon) */
(() => {
'use strict';
const CFG = window.IMPOSTOR_CONFIG || {};
const app = document.getElementById('app');
const tvStat = document.getElementById('tvstat');

/* ---------- narzędzia ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ini = n => esc((n || '?').trim().charAt(0).toUpperCase());
const fmt = ms => { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const vib = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
const COLORS = ['#ff4d6d', '#4dabf7', '#51cf66', '#fcc419', '#cc5de8', '#ff922b', '#20c997', '#f06595', '#5c7cfa', '#94d82d', '#22b8cf', '#e599f7', '#ffa8a8', '#74c0fc', '#ffd43b', '#b197fc'];
const MAX_PLAYERS = 16;
const EMOJI = ['🐱', '🐶', '🦊', '🐼', '🐸', '🐵', '🦁', '🐯', '🐷', '🐨', '🐙', '🦄', '🐲', '👽', '🤖', '👻', '🎃', '🤠', '😎', '🥸', '🦖', '🐧', '🦉', '🐝'];
const GMODES = { classic: 'Klasyczny', double: 'Podwójny agent', blitz: 'Błyskawica' };
const store = {
  get(k, d) { try { const v = localStorage.getItem('imp_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('imp_' + k, JSON.stringify(v)); } catch (e) {} },
};

/* ---------- stan ---------- */
const S = {
  players: store.get('players', []),
  settings: Object.assign({ cats: null, impostors: 1, hint: true, troll: 0, discuss: 180, vote: 30, gmode: 'classic', goal: 0 }, store.get('settings', {})),
  final: null,
  phase: 'setup', round: 0, R: null, timer: null, showForgot: false,
};
S.players.forEach(p => { if (!p.emoji) p.emoji = EMOJI[Math.floor(Math.random() * EMOJI.length)]; });
const save = () => { store.set('players', S.players); store.set('settings', S.settings); };
const player = id => S.players.find(p => p.id === id);
const nextEmoji = () => { const used = new Set(S.players.map(p => p.emoji)); return pick(EMOJI.filter(e => !used.has(e))) || pick(EMOJI); };
// Błyskawica: krótka dyskusja i szybkie głosowanie
const dur = k => S.settings.gmode === 'blitz' ? (k === 'discuss' ? 45 : 15) : S.settings[k];
const nextColor = () => { const used = new Set(S.players.map(p => p.color)); return COLORS.find(c => !used.has(c)) || pick(COLORS); };

/* ---------- słowa z GitHuba ---------- */
const DB = { cats: [], status: 'loading', error: '' };
async function loadWords() {
  const base = CFG.WORDS_BASE || 'words/';
  try {
    const idx = await (await fetch(base + 'index.json', { cache: 'no-cache' })).json();
    const res = await Promise.all(idx.categories.map(async c => {
      try { return normCat(c, await (await fetch(base + c.file, { cache: 'no-cache' })).json()); }
      catch (e) { console.warn('Nie udało się wczytać', c.file, e); return null; }
    }));
    DB.cats = res.filter(c => c && c.items.length);
    DB.status = 'ok';
  } catch (e) {
    DB.status = 'error'; DB.error = String(e.message || e);
  }
  const ids = DB.cats.map(c => c.id);
  if (!S.settings.cats) S.settings.cats = ids;
  else S.settings.cats = S.settings.cats.filter(id => ids.includes(id));
  render();
}
function normCat(meta, d) {
  const items = [], seen = new Set();
  for (const [g, list] of Object.entries(d.groups || {})) {
    const arr = Array.isArray(list) ? list : String(list).split(',');
    for (let w of arr) {
      w = String(w).trim(); if (!w) continue;
      const k = w.toLowerCase(); if (seen.has(k)) continue;
      seen.add(k); items.push({ w, g });
    }
  }
  return { id: meta.id, name: d.name || meta.name, emoji: d.emoji || meta.emoji || '🎲', items };
}
const selCats = () => DB.cats.filter(c => (S.settings.cats || []).includes(c.id));

/* ---------- zegar ---------- */
const mkTimer = (sec, onEnd) => ({ total: sec, endsAt: Date.now() + sec * 1000, left: sec * 1000, running: true, done: false, onEnd });
const timerLeft = () => { const t = S.timer; if (!t) return 0; return t.running ? Math.max(0, t.endsAt - Date.now()) : t.left; };
function pauseTimer() { const t = S.timer; if (t && t.running) { t.left = timerLeft(); t.running = false; } }
function resumeTimer() { const t = S.timer; if (t && !t.running && !t.done) { t.endsAt = Date.now() + t.left; t.running = true; } }
setInterval(() => {
  const t = S.timer; if (!t) return;
  const left = timerLeft();
  app.querySelectorAll('[data-timer]').forEach(el => { el.textContent = fmt(left); el.classList.toggle('low', left < 10000); });
  if (t.running && left <= 0 && !t.done) {
    t.done = true; t.running = false; t.left = 0;
    vib([250, 120, 250]);
    if (t.onEnd) t.onEnd(); else render();
  }
}, 250);

/* ---------- runda ---------- */
function startRound() {
  const cats = selCats();
  if (S.players.length < 3) return alert('Potrzeba minimum 3 graczy.');
  if (!cats.length) return alert('Wybierz przynajmniej jedną kategorię.');
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
  const ids = S.players.map(p => p.id);
  const n = ids.length;
  const gmode = S.settings.gmode || 'classic';
  const troll = gmode !== 'double' && S.settings.troll > 0 && Math.random() * 100 < S.settings.troll;
  const k = clamp(S.settings.impostors, 1, n - 1);
  const fake = gmode === 'double' ? (same[0] || rest[0] || '???') : null;
  const impostors = troll ? [...ids] : shuffle(ids).slice(0, k);
  const off = S.round % n;
  const order = [...ids.slice(off), ...ids.slice(0, off)];
  const crew = ids.filter(i => !impostors.includes(i));
  S.round++;
  S.players.forEach(p => { p.delta = 0; });
  S.R = {
    word: it.w, group: it.g, catName: it.c.name, emoji: it.c.emoji,
    impostors, troll, order, idx: 0, stage: 'pass', seen: false, peek: null,
    starter: pick(crew.length ? crew : ids), votes: {}, guessed: [], res: null,
    options, picks: {}, pickFor: impostors[0], gmode, fake,
  };
  S.final = null;
  S.timer = null; S.showForgot = false; S.phase = 'reveal';
  wake(); render();
}
function goVote() {
  S.phase = 'vote'; S.R.votes = {}; S.R.ballots = {};
  S.timer = mkTimer(dur('vote'), () => render());
  render();
}
function endVote() {
  const R = S.R;
  const entries = Object.entries(R.votes).filter(([, v]) => v > 0);
  const max = entries.reduce((m, [, v]) => Math.max(m, v), 0);
  const top = entries.filter(([, v]) => v === max).map(([k]) => k);
  R.res = { step: 'accused', accused: top.length === 1 ? top[0] : null, tie: top.length > 1, applied: false, headline: '' };
  S.timer = null; S.phase = 'result'; render();
}
function applyPoints() {
  const R = S.R, res = R.res;
  if (res.applied) return;
  res.applied = true;
  S.players.forEach(p => { p.delta = 0; });
  const add = (id, v) => { const p = player(id); if (p) { p.score += v; p.delta += v; } };
  const B = R.ballots || {};
  if (R.troll) {
    // runda trolla: trafny głos = "troll"; punkt tylko, gdy troll wygrał głosowanie
    if (res.accused === 'troll') { Object.keys(B).filter(v => B[v] === 'troll').forEach(v => add(v, 1)); res.headline = '🤡 Przejrzeliście trolla!'; }
    else res.headline = '🤡 Wkręceni! Wszyscy byli impostorami';
  } else {
    const caught = res.accused && R.impostors.includes(res.accused);
    if (caught) {
      // +1 dla każdego z załogi, kto głosował na impostora
      Object.keys(B).filter(v => !R.impostors.includes(v) && R.impostors.includes(B[v])).forEach(v => add(v, 1));
      R.impostors.filter(i => i !== res.accused).forEach(i => add(i, 2));
      res.headline = R.guessed.length ? '🎯 Złapany… ale zgadł słowo!' : '🎉 Impostor wyeliminowany!';
    } else {
      R.impostors.forEach(i => add(i, 2));
      res.headline = res.accused === 'troll' ? '🕵️ To nie był troll! Impostor wygrywa' : '🕵️ Impostor wygrywa!';
    }
    R.guessed.forEach(i => add(i, 2));
  }
  const goal = S.settings.goal, top = Math.max(0, ...S.players.map(p => p.score));
  S.final = goal && top >= goal ? S.players.filter(p => p.score === top).map(p => p.id) : null;
  save();
}

/* ---------- akcje ---------- */
const ACT = {
  rmPlayer: id => { S.players = S.players.filter(p => p.id !== id); S.settings.impostors = clamp(S.settings.impostors, 1, Math.max(1, S.players.length - 1)); save(); render(); },
  mvPlayer: id => { const i = S.players.findIndex(p => p.id === id); if (i > 0) { const [p] = S.players.splice(i, 1); S.players.splice(i - 1, 0, p); save(); render(); } },
  togCat: id => { const s = new Set(S.settings.cats || []); s.has(id) ? s.delete(id) : s.add(id); S.settings.cats = [...s]; save(); render(); },
  allCats: () => { S.settings.cats = DB.cats.map(c => c.id); save(); render(); },
  noCats: () => { S.settings.cats = []; save(); render(); },
  imp: d => { S.settings.impostors = clamp(S.settings.impostors + Number(d), 1, Math.max(1, S.players.length - 1)); save(); render(); },
  hint: () => { S.settings.hint = !S.settings.hint; save(); render(); },
  setS: arg => { const [k, v] = arg.split(':'); S.settings[k] = v; save(); render(); },
  emo: id => { const p = player(id); if (!p) return; const used = new Set(S.players.map(q => q.emoji)); let i = EMOJI.indexOf(p.emoji); do { i = (i + 1) % EMOJI.length; } while (used.has(EMOJI[i]) && EMOJI[i] !== p.emoji); p.emoji = EMOJI[i]; save(); render(); },
  newGame: () => { S.players.forEach(p => { p.score = 0; p.delta = 0; }); S.final = null; save(); ACT.lobby(); },
  set: arg => { const [k, v] = arg.split(':'); S.settings[k] = Number(v); save(); render(); },
  start: startRound,
  iam: () => { S.R.stage = 'look'; S.R.seen = false; render(); },
  nextPlayer: () => {
    const R = S.R; if (!R.seen) return;
    R.stage = 'pass'; R.seen = false;
    if (R.peek) { R.peek = null; S.phase = 'discuss'; resumeTimer(); render(); return; }
    R.idx++;
    if (R.idx >= R.order.length) S.phase = 'ready';
    render();
  },
  discuss: () => { S.phase = 'discuss'; S.timer = dur('discuss') ? mkTimer(dur('discuss'), goVote) : null; render(); },
  pause: () => { S.timer && S.timer.running ? pauseTimer() : resumeTimer(); render(); },
  plus30: () => { const t = S.timer; if (!t) return; t.left = timerLeft() + 30000; t.total += 30; t.done = false; if (t.running) t.endsAt = Date.now() + t.left; render(); },
  forgot: () => { S.showForgot = !S.showForgot; render(); },
  peek: id => { pauseTimer(); Object.assign(S.R, { peek: id, stage: 'pass', seen: false }); S.phase = 'reveal'; S.showForgot = false; render(); },
  vote: goVote,
  ballot: arg => {
    const [voter, target] = arg.split(':'), R = S.R;
    if (R.ballots[voter] === target) delete R.ballots[voter]; else R.ballots[voter] = target;
    R.votes = {};
    Object.values(R.ballots).forEach(t => { R.votes[t] = (R.votes[t] || 0) + 1; });
    vib(10); render();
  },
  endVote,
  showImp: () => { S.R.res.step = 'impostors'; render(); },
  pickFor: id => { S.R.pickFor = id; render(); },
  pick: i => {
    const R = S.R, w = R.options[Number(i)], who = R.pickFor;
    if (R.picks[who] === w) delete R.picks[who]; else R.picks[who] = w;
    R.guessed = R.impostors.filter(id => R.picks[id] === R.word);
    const next = R.impostors.find(id => !R.picks[id]);
    if (next && R.picks[who]) R.pickFor = next;
    vib(15); render();
  },
  showWord: () => { applyPoints(); S.R.res.step = 'word'; render(); },
  scores: () => { S.phase = 'scores'; render(); },
  next: startRound,
  lobby: () => { S.phase = 'setup'; S.R = null; S.timer = null; render(); },
  abort: () => { if (confirm('Przerwać rundę i wrócić do lobby? (punkty z tej rundy przepadną)')) ACT.lobby(); },
  resetScores: () => { if (confirm('Wyzerować punkty wszystkich graczy?')) { S.players.forEach(p => { p.score = 0; p.delta = 0; }); save(); render(); } },
  openTv: () => { window.open('tv.html', 'impostor-tv'); },
};
app.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const fn = ACT[b.dataset.act];
  if (fn) fn(b.dataset.arg, b);
});
app.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.id !== 'addForm') return;
  const inp = e.target.querySelector('input');
  const name = inp.value.trim().replace(/\s+/g, ' ').slice(0, 16);
  if (!name) return;
  if (S.players.length >= MAX_PLAYERS) return alert('Maksymalnie ' + MAX_PLAYERS + ' graczy.');
  if (S.players.some(p => p.name.toLowerCase() === name.toLowerCase())) return alert('Taki gracz już jest.');
  S.players.push({ id: uid(), name, color: nextColor(), emoji: nextEmoji(), score: 0, delta: 0 });
  save(); render();
  const ni = app.querySelector('#nameIn'); if (ni) ni.focus();
});

/* ---------- widoki ---------- */
const av = (p, cls = '') => `<span class="av ${cls} ${p.emoji ? 'emo' : ''}" style="--c:${p.color}">${p.emoji || ini(p.name)}</span>`;
const seg = (label, key, opts, cur, note = '') => `
  <div class="set"><div class="set-l">${label}${note ? `<small>${note}</small>` : ''}</div>
  <div class="seg">${opts.map(([v, t]) => `<button class="${cur === v ? 'on' : ''}" data-act="set" data-arg="${key}:${v}">${t}</button>`).join('')}</div></div>`;

function vSetup() {
  if (DB.status === 'loading') return '<div class="loading">Ładowanie słów…</div>';
  const st = S.settings, n = S.players.length;
  const pool = selCats().reduce((s, c) => s + c.items.length, 0);
  const bigScreen = !matchMedia('(pointer: coarse)').matches && window.innerWidth >= 900;
  return `
  ${bigScreen ? `<a class="btn big primary tvlink" href="tv.html">📺 To jest telewizor — otwórz ekran gry</a>
    <p class="muted small cen-t">Na telefonie hosta wejdź na ten sam adres i zeskanuj kod QR z telewizora.</p>` : ''}
  ${DB.status === 'error' ? `<div class="card err">⚠️ Nie udało się wczytać słów (${esc(DB.error)}). Uruchom grę przez serwer/GitHub Pages, a nie jako plik.</div>` : ''}
  <section class="card">
    <h2>👥 Gracze <span class="badge">${n}</span></h2>
    <form id="addForm" class="row">
      <input id="nameIn" maxlength="16" placeholder="Imię gracza" autocomplete="off" enterkeyhint="done">
      <button class="btn">Dodaj</button>
    </form>
    <ul class="players">${S.players.map((p, i) => `
      <li><button class="emo-btn" data-act="emo" data-arg="${p.id}" title="Zmień emoji">${av(p)}</button><span class="pname">${esc(p.name)}</span><span class="pts">${p.score} pkt</span>
      ${i ? `<button class="icon" data-act="mvPlayer" data-arg="${p.id}" title="W górę">↑</button>` : '<span class="icon ph"></span>'}
      <button class="icon x" data-act="rmPlayer" data-arg="${p.id}" title="Usuń">✕</button></li>`).join('')}
    </ul>
    <p class="muted small">${n < 3 ? 'Dodaj minimum 3 graczy. ' : ''}Kolejność = kolejność podawania telefonu (najlepiej jak siedzicie).</p>
  </section>

  <section class="card">
    <div class="row between"><h2>🗂️ Kategorie</h2>
      <div class="row"><button class="btn sm ghost" data-act="allCats">Wszystkie</button><button class="btn sm ghost" data-act="noCats">Żadna</button></div></div>
    <div class="chips">${DB.cats.map(c => `
      <button class="chip ${st.cats.includes(c.id) ? 'on' : ''}" data-act="togCat" data-arg="${c.id}">${c.emoji} ${esc(c.name)} <small>${c.items.length}</small></button>`).join('')}
    </div>
    <p class="muted small">W puli: <b>${pool}</b> słów z ${selCats().length} kategorii</p>
  </section>

  <section class="card">
    <h2>⚙️ Zasady</h2>
    <div class="set"><div class="set-l">Tryb gry<small>${{ classic: 'Impostor nie zna słowa', double: 'Impostor dostaje PODOBNE słowo i nie wie, że jest impostorem', blitz: '45 s dyskusji, 15 s głosowania' }[st.gmode]}</small></div>
      <div class="seg">${Object.entries(GMODES).map(([v, t]) => `<button class="${st.gmode === v ? 'on' : ''}" data-act="setS" data-arg="gmode:${v}">${t}</button>`).join('')}</div></div>
    ${seg('Gra do', 'goal', [[0, '∞'], [10, '10 pkt'], [15, '15 pkt'], [20, '20 pkt']], st.goal, 'Kto pierwszy zdobędzie tyle punktów, wygrywa')}
    <div class="set"><div class="set-l">Liczba impostorów</div>
      <div class="stepper"><button data-act="imp" data-arg="-1">−</button><b>${st.impostors}</b><button data-act="imp" data-arg="1">+</button></div></div>
    <div class="set"><div class="set-l">Podpowiedź dla impostora<small>Impostor zobaczy ogólne hasło, np. „owoc”</small></div>
      <button class="toggle ${st.hint ? 'on' : ''}" data-act="hint"><span></span></button></div>
    ${seg('Tryb trolla 🤡', 'troll', [[0, 'Wył'], [10, '10%'], [20, '20%'], [35, '35%']], st.troll, 'Szansa, że w rundzie WSZYSCY są impostorami')}
    ${seg('Czas dyskusji', 'discuss', [[0, '∞'], [60, '1m'], [120, '2m'], [180, '3m'], [300, '5m']], st.discuss)}
    ${seg('Czas głosowania', 'vote', [[20, '20s'], [30, '30s'], [45, '45s'], [60, '60s']], st.vote)}
  </section>

  <section class="card">
    <h2>📺 Telewizor</h2>
    <p class="muted small">Na laptopie podłączonym do telewizora otwórz <b>tv.html</b> (F11 = pełny ekran). Zeskanuj QR z telewizora albo wpisz kod:</p>
    <form id="tvForm" class="row">
      <input class="code-in" maxlength="6" placeholder="KOD" value="${esc(T.code)}" autocomplete="off" autocapitalize="characters">
      <button class="btn">Połącz</button>
      ${T.code ? '<button type="button" class="btn ghost" data-act="disconnectTv">✕</button>' : ''}
    </form>
    <p class="small" id="tvStatus"></p>
    <button class="btn sm ghost" data-act="openTv">🖥️ Test: ekran TV w nowej karcie</button>
  </section>

  <div class="row wrap">
    <button class="btn big primary grow" data-act="start" ${n < 3 || !pool ? 'disabled' : ''}>▶ START RUNDY</button>
  </div>
  ${S.players.some(p => p.score) ? '<button class="btn sm ghost center-b" data-act="resetScores">Wyzeruj punkty</button>' : ''}`;
}

function secretHTML(id) {
  const R = S.R;
  if (R.gmode === 'double' && R.impostors.includes(id)) return `<div class="role crew"><span>Twoje słowo:</span><b class="word">${esc(R.fake)}</b><small>${R.emoji} ${esc(R.catName)}</small></div>`;
  if (R.impostors.includes(id)) {
    return `<div class="role imp"><div class="role-ico">🕵️</div><b>JESTEŚ IMPOSTOREM</b>
      ${S.settings.hint ? `<span>Podpowiedź:</span><em>${esc(R.group)}</em>` : '<span>Bez podpowiedzi — blefuj!</span>'}
      ${S.settings.impostors > 1 ? '<small>Impostorów może być więcej 😉</small>' : ''}</div>`;
  }
  return `<div class="role crew"><span>Twoje słowo:</span><b class="word">${esc(R.word)}</b><small>${R.emoji} ${esc(R.catName)}</small></div>`;
}

function vReveal() {
  const R = S.R;
  const p = player(R.peek || R.order[R.idx]);
  const label = R.peek ? 'Przypomnienie' : `Gracz ${R.idx + 1} z ${R.order.length}`;
  if (R.stage === 'pass') return `
    <div class="center pass">
      <div class="step">${label}</div>
      <div class="pass-anim">📱</div>
      ${av(p, 'xl')}
      <h1>Podaj telefon:<br><span style="color:${p.color}">${esc(p.name)}</span></h1>
      <p class="muted">Nikt inny nie może patrzeć na ekran!</p>
      <button class="btn big primary" data-act="iam">To ja — ${esc(p.name)}</button>
    </div>
    ${R.peek ? '' : '<button class="btn sm ghost center-b" data-act="abort">Przerwij rundę</button>'}`;
  const last = !R.peek && R.idx === R.order.length - 1;
  return `
    <div class="center look">
      <div class="step">${label}</div>
      <h2>${av(p)} ${esc(p.name)}</h2>
      <div class="tile" data-seen>
        <div class="tile-secret">${secretHTML(p.id)}</div>
        <div class="tile-cover"><div class="hand">👆</div><b>PRZYTRZYMAJ</b><span>aby podnieść kafelek</span></div>
      </div>
      <p class="muted small">Puść, żeby schować. Potem kliknij przycisk.</p>
      <button class="btn big ${R.seen ? 'primary' : 'ghost'}" data-act="nextPlayer" ${R.seen ? '' : 'disabled'}>
        ${R.peek ? 'Schowane — wracamy ➜' : last ? 'Schowane — oddaj hostowi ✔' : 'Schowane — podaj dalej ➜'}</button>
    </div>`;
}

function vReady() {
  const st = player(S.R.starter);
  return `<div class="center">
    <div class="big-emoji pop">✅</div>
    <h1>Wszyscy znają swoje role!</h1>
    <p>Zaczyna: ${av(st)} <b>${esc(st.name)}</b></p>
    <p class="muted small">Każdy po kolei mówi jedno skojarzenie ze słowem.</p>
    <button class="btn big primary" data-act="discuss">💬 Start dyskusji</button>
  </div>`;
}

function vDiscuss() {
  const st = player(S.R.starter), t = S.timer;
  return `<div class="center">
    <div class="step">Runda ${S.round} · dyskusja</div>
    ${t ? `<div class="clock" data-timer>${fmt(timerLeft())}</div>
      <div class="row"><button class="btn sm ghost" data-act="pause">${t.running ? '⏸ Pauza' : '▶ Wznów'}</button><button class="btn sm ghost" data-act="plus30">+30 s</button></div>`
        : '<div class="clock inf">∞</div><p class="muted small">Bez limitu czasu</p>'}
    <p>Zaczyna: ${av(st)} <b>${esc(st.name)}</b></p>
    <button class="btn big primary" data-act="vote">🗳️ Przejdź do głosowania</button>
    <button class="btn sm ghost" data-act="forgot">🤔 Ktoś zapomniał słowa?</button>
    ${S.showForgot ? `<div class="chips">${S.players.map(p => `<button class="chip" data-act="peek" data-arg="${p.id}">${av(p, 'sm')} ${esc(p.name)}</button>`).join('')}</div>` : ''}
  </div>
  <button class="btn sm ghost center-b" data-act="abort">Przerwij rundę</button>`;
}

function vVote() {
  const R = S.R, t = S.timer, left = timerLeft(), B = R.ballots || {};
  const done = Object.keys(B).length;
  const troll = S.settings.troll > 0;
  return `<div class="center">
    <div class="step">Głosowanie · ${done}/${S.players.length} głosów</div>
    <div class="clock ${left <= 0 ? 'done' : ''}" data-timer>${fmt(left)}</div>
    <p class="muted small">${left <= 0 ? '⏰ Czas minął! Uzupełnij ostatnie głosy.' : 'Na 3 wszyscy wskazują podejrzanego. Zaznacz, kto na kogo wskazał:'}</p>
    <ul class="ballots">${S.players.map(v => `<li class="${B[v.id] ? 'voted' : ''}">
      <div class="who">${av(v, 'sm')} <b>${esc(v.name)}</b> <span class="muted">wskazuje:</span></div>
      <div class="targets">${S.players.filter(p => p.id !== v.id).map(p => `<button class="tgt ${B[v.id] === p.id ? 'on' : ''}" data-act="ballot" data-arg="${v.id}:${p.id}">${av(p, 'sm')}<span>${esc(p.name)}</span></button>`).join('')}
        ${troll ? `<button class="tgt ${B[v.id] === 'troll' ? 'on' : ''}" data-act="ballot" data-arg="${v.id}:troll"><span class="av sm" style="--c:#ffd43b">🤡</span><span>Troll</span></button>` : ''}</div></li>`).join('')}</ul>
    <button class="btn big primary" data-act="endVote">🔒 Zakończ głosowanie</button>
  </div>`;
}

function vResult() {
  const R = S.R, res = R.res;
  const acc = res.accused && res.accused !== 'troll' ? player(res.accused) : null;
  const accTxt = res.accused === 'troll' ? '🤡 Uznaliście, że to troll' : acc ? `Wyrzucacie: ${av(acc)} <b>${esc(acc.name)}</b>` : res.tie ? '⚖️ Remis — nikt nie odpada' : '🤷 Nikt nie dostał głosu';
  if (res.step === 'accused') return `<div class="center">
    <div class="step">Wynik głosowania</div><h2>${accTxt}</h2>
    <p class="muted">Na telewizorze trwa werbel… 🥁</p>
    <button class="btn big primary" data-act="showImp">🔍 Odkryj impostora</button></div>`;
  const imps = R.impostors.map(player).filter(Boolean);
  if (res.step === 'impostors') {
    if (R.troll) return `<div class="center"><div class="big-emoji pop">🤡</div><h1>TROLL!</h1><p>Wszyscy byli impostorami.</p>
      <button class="btn big primary" data-act="showWord">Podsumuj rundę ➜</button></div>`;
    if (R.gmode === 'double') return `<div class="center">
      <div class="step">Podwójny agent</div>
      <div class="row wrap cen">${imps.map(p => `<span class="tag">${av(p, 'sm')} ${esc(p.name)}</span>`).join('')}</div>
      <p>Impostor miał podobne słowo: <b class="hl">${esc(R.fake)}</b></p>
      <button class="btn big primary" data-act="showWord">📺 Pokaż prawdziwe słowo</button></div>`;
    return `<div class="center">
      <div class="step">Impostor${imps.length > 1 ? 'zy' : ''}</div>
      <div class="row wrap cen">${imps.map(p => `<span class="tag">${av(p, 'sm')} ${esc(p.name)}</span>`).join('')}</div>
      <p><b>Ostatnia szansa!</b> Na telewizorze jest ${R.options.length} słów. Impostor mówi, które to — zaznacz:</p>
      ${imps.length > 1 ? `<div class="chips cen">${imps.map(p => `<button class="chip ${R.pickFor === p.id ? 'on' : ''}" data-act="pickFor" data-arg="${p.id}">${av(p, 'sm')} ${esc(p.name)}${R.picks[p.id] ? ' ✔' : ''}</button>`).join('')}</div>` : ''}
      <div class="opts">${R.options.map((w, i) => { const who = imps.filter(p => R.picks[p.id] === w); return `<button class="opt ${R.picks[R.pickFor] === w ? 'on' : ''}" data-act="pick" data-arg="${i}">${esc(w)}${who.map(p => av(p, 'xs')).join('')}</button>`; }).join('')}</div>
      <button class="btn big primary" data-act="showWord">${Object.keys(R.picks).length ? '📺 Sprawdź i pokaż słowo' : '📺 Pokaż słowo (bez typowania)'}</button></div>`;
  }
  return `<div class="center">
    <h1>${esc(res.headline)}</h1>
    ${R.troll ? '' : `<p>Słowo: <b class="hl">${esc(R.word)}</b></p>`}
    <ul class="deltas">${S.players.filter(p => p.delta).map(p => `<li>${av(p, 'sm')} ${esc(p.name)} <b>+${p.delta}</b></li>`).join('') || '<li class="muted">Nikt nie zdobył punktów</li>'}</ul>
    <button class="btn big primary" data-act="scores">🏆 Tabela wyników</button></div>`;
}

function vScores() {
  const list = [...S.players].sort((a, b) => b.score - a.score);
  return `<div class="center">
    <div class="step">Po rundzie ${S.round}</div><h1>${S.final ? '🏆 KONIEC GRY!' : '🏆 Wyniki'}</h1>
    ${S.final ? `<p class="big-emoji pop">👑</p><h2>Wygrywa: ${S.final.map(player).filter(Boolean).map(p => `${av(p, 'sm')} ${esc(p.name)}`).join(', ')}</h2>` : ''}
    <ol class="board">${list.map(p => `<li>${av(p, 'sm')}<span class="pname">${esc(p.name)}</span>${p.delta ? `<i>+${p.delta}</i>` : ''}<b>${p.score}</b></li>`).join('')}</ol>
    ${S.final ? '<button class="btn big primary" data-act="newGame">🔄 Nowa gra (od zera)</button>' : '<button class="btn big primary" data-act="next">▶ Następna runda</button>'}
    <button class="btn ghost" data-act="lobby">⚙️ Lobby / ustawienia</button></div>`;
}

let lastPhase = '';
function render() {
  const v = { setup: vSetup, reveal: vReveal, ready: vReady, discuss: vDiscuss, vote: vVote, result: vResult, scores: vScores }[S.phase];
  app.innerHTML = v();
  app.dataset.phase = S.phase;
  bindTiles();
  const k = S.phase + (S.R ? S.R.idx + S.R.stage + (S.R.res ? S.R.res.step : '') : '');
  if (k !== lastPhase && S.phase !== 'setup' && S.phase !== 'vote') window.scrollTo(0, 0);
  lastPhase = k;
  sync(); updTv();
}

/* ---------- kafelek "przytrzymaj" ---------- */
function bindTiles() {
  app.querySelectorAll('.tile').forEach(t => {
    const open = e => { e.preventDefault(); t.classList.add('open'); try { t.setPointerCapture(e.pointerId); } catch (x) {} vib(15); };
    const close = () => {
      if (!t.classList.contains('open')) return;
      t.classList.remove('open');
      if (t.hasAttribute('data-seen') && S.R && !S.R.seen) {
        S.R.seen = true;
        const b = app.querySelector('[data-act=nextPlayer]');
        if (b) { b.disabled = false; b.classList.add('primary'); b.classList.remove('ghost'); }
      }
    };
    t.addEventListener('pointerdown', open);
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => t.addEventListener(ev, close));
    t.addEventListener('contextmenu', e => e.preventDefault());
  });
}

/* ---------- ekran nie gaśnie ---------- */
let wl = null;
async function wake() { try { if ('wakeLock' in navigator && !wl) { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); } } catch (e) {} }
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { if (S.phase !== 'setup') wake(); }
  else app.querySelectorAll('.tile.open').forEach(t => t.classList.remove('open'));
});

/* ---------- telewizor: stan publiczny (bez sekretów!) ---------- */
function pub() {
  const R = S.R;
  const st = {
    phase: S.phase, round: S.round,
    players: S.players.map(p => ({ id: p.id, name: p.name, color: p.color, emoji: p.emoji, score: p.score, delta: p.delta || 0 })),
    settings: { cats: selCats().map(c => c.emoji + ' ' + c.name), allCats: DB.cats.length, impostors: S.settings.impostors, hint: S.settings.hint, troll: S.settings.troll, discuss: dur('discuss'), vote: dur('vote'), gmode: S.settings.gmode, goal: S.settings.goal },
    final: S.phase === 'scores' ? S.final : null,
    timer: S.timer ? { total: S.timer.total, left: timerLeft(), running: S.timer.running } : null,
  };
  if (R) {
    st.R = { order: R.order, idx: R.idx, stage: R.stage, peek: R.peek, starter: R.starter, votes: R.votes, ballots: R.ballots || {}, trollVote: S.settings.troll > 0 };
    if (S.phase === 'result') {
      const res = R.res;
      st.R.res = { step: res.step, accused: res.accused, tie: res.tie };
      if (res.step !== 'accused') Object.assign(st.R.res, { impostors: R.impostors, troll: R.troll, wasImp: !!res.accused && R.impostors.includes(res.accused), options: R.troll || R.gmode === 'double' ? [] : R.options, picks: R.picks, fake: R.fake });
      if (res.step === 'word') Object.assign(st.R.res, { word: R.troll ? '' : R.word, cat: R.emoji + ' ' + R.catName, group: R.group, guessed: R.guessed, headline: res.headline });
    }
  }
  return st;
}

/* ---------- transport do TV ----------
   1) PeerJS (WebRTC): telefon ↔ laptop podłączony do telewizora, łączenie kodem z ekranu TV
   2) BroadcastChannel: ekran TV w drugiej karcie tej samej przeglądarki (testy) */
const T = { bc: null, lastHello: 0, peer: null, conn: null, code: '', status: '', retry: null };
try {
  T.bc = new BroadcastChannel('impostor-tv');
  T.bc.onmessage = e => { if (e.data && e.data.type === 'hello') { T.lastHello = Date.now(); sync(); updTv(); } };
} catch (e) {}
const peerOpen = () => !!(T.conn && T.conn.open);
function sync() {
  const msg = { type: 'state', state: pub() };
  try { if (T.bc) T.bc.postMessage(msg); } catch (e) {}
  if (peerOpen()) { try { T.conn.send(msg); } catch (e) {} }
}
function updTv() {
  const on = [];
  if (peerOpen()) on.push('TV ' + T.code);
  if (Date.now() - T.lastHello < 9000) on.push('karta');
  tvStat.textContent = on.length ? '📺 ' + on.join(' + ') : T.code && T.status ? '📺 ' + T.status : '📺 brak TV';
  tvStat.classList.toggle('on', on.length > 0);
  const st = document.getElementById('tvStatus');
  if (st) st.innerHTML = peerOpen() ? `<b class="ok">✔ Połączono z TV ${esc(T.code)}</b>` : T.code ? esc(T.status || '') : '';
}
setInterval(() => { sync(); updTv(); }, 3000);

let peerLib = null;
function loadPeer() {
  if (window.Peer) return Promise.resolve();
  if (!peerLib) peerLib = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = CFG.PEERJS_URL || 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
    s.onload = res; s.onerror = () => { peerLib = null; rej(new Error('peerjs')); };
    document.head.appendChild(s);
  });
  return peerLib;
}
const normCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
function setStatus(s) { T.status = s; updTv(); }
function retryLater() { clearTimeout(T.retry); if (T.code) T.retry = setTimeout(() => connectTv(T.code), 4000); }
function connectTv(code) {
  code = normCode(code);
  if (!code) return;
  clearTimeout(T.retry);
  if (T.conn && T.code === code && T.conn.open) return;
  if (T.conn) { const old = T.conn; T.conn = null; try { old.close(); } catch (e) {} }
  T.code = code; store.set('tvCode', code);
  setStatus('łączenie z ' + code + '…');
  loadPeer().then(() => {
    const go = () => {
      const c = T.peer.connect((CFG.PEER_PREFIX || 'impostor-pl-gra-') + code, { reliable: true });
      T.conn = c;
      const to = setTimeout(() => { if (T.conn === c && !c.open) { setStatus('TV nie odpowiada…'); try { c.close(); } catch (e) {} T.conn = null; retryLater(); } }, 9000);
      c.on('open', () => { clearTimeout(to); if (T.conn !== c) return; setStatus(''); sync(); updTv(); vib(30); });
      c.on('data', m => { if (m && m.type === 'hello') sync(); if (m && m.type === 'err') { T.err = m.text; if (!T.errShown) { T.errShown = true; alert(m.text); } } });
      c.on('close', () => { if (T.conn === c) { T.conn = null; setStatus(T.err ? 'TV w innym trybie – ponawiam…' : 'rozłączono, ponawiam…'); T.err = ''; retryLater(); } });
      c.on('error', () => {});
    };
    if (T.peer && !T.peer.destroyed && T.peer.open) return go();
    if (T.peer) { try { T.peer.destroy(); } catch (e) {} }
    const p = T.peer = new Peer();
    p.on('open', go);
    p.on('error', e => {
      if (T.peer !== p) return;
      setStatus(e.type === 'peer-unavailable' ? 'nie widzę TV o kodzie ' + T.code : 'błąd połączenia (' + e.type + ')');
      if (e.type !== 'peer-unavailable') { try { p.destroy(); } catch (x) {} T.peer = null; }
      T.conn = null; retryLater();
    });
    p.on('disconnected', () => { try { if (!p.destroyed) p.reconnect(); } catch (e) {} });
  }).catch(() => { setStatus('brak internetu'); retryLater(); });
}
function disconnectTv() {
  clearTimeout(T.retry);
  T.code = ''; store.set('tvCode', '');
  if (T.conn) { try { T.conn.close(); } catch (e) {} T.conn = null; }
  setStatus(''); render();
}
ACT.disconnectTv = disconnectTv;
app.addEventListener('submit', e => { if (e.target.id === 'tvForm') connectTv(e.target.querySelector('input').value); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && T.code && !peerOpen()) connectTv(T.code); });

render();
loadWords();
const urlCode = normCode(new URLSearchParams(location.search).get('tv'));
if (urlCode) { connectTv(urlCode); history.replaceState(null, '', location.pathname); }
// kod TV jest za każdym razem nowy – nie łączymy się automatycznie ze starym
})();
