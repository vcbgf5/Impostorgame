/* Mafia – telefon hosta (tryb jednego telefonu, telefon krąży między graczami) */
(() => {
'use strict';
const M = window.MafiaCore, R = M.ROLES;
const app = document.getElementById('app'), tvStat = document.getElementById('tvstat');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = ms => { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const vib = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
const uid = () => Math.random().toString(36).slice(2, 9);
const COLORS = ['#ff4d6d', '#4dabf7', '#51cf66', '#fcc419', '#cc5de8', '#ff922b', '#20c997', '#f06595', '#5c7cfa', '#94d82d', '#22b8cf', '#e599f7', '#ffa8a8', '#74c0fc', '#ffd43b', '#b197fc'];
const EMOJI = ['🐱', '🐶', '🦊', '🐼', '🐸', '🐵', '🦁', '🐯', '🐷', '🐨', '🐙', '🦄', '🐲', '👽', '🤖', '👻', '🎃', '🤠', '😎', '🥸', '🦖', '🐧', '🦉', '🐝'];
const store = {
  get(k, d) { try { const v = localStorage.getItem('impmafh_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('impmafh_' + k, JSON.stringify(v)); } catch (e) {} },
};

const E = MafiaEngine.create({ mode: 'single', settings: store.get('settings', {}), render: () => render() });
store.get('players', []).forEach(p => E.players.push(Object.assign({ score: 0, delta: 0, online: true }, p)));
const save = () => { store.set('players', E.players.map(p => ({ id: p.id, name: p.name, color: p.color, emoji: p.emoji, score: p.score }))); store.set('settings', E.settings); };
const player = id => E.players.find(p => p.id === id);
const av = (p, cls = '') => p ? `<span class="av ${cls} emo" style="--c:${p.color}">${p.emoji || esc(p.name[0])}</span>` : '';
const nm = id => { const p = player(id); return p ? esc(p.name) : '?'; };
let ui = { copResult: null, showForgot: false };

const link = TVLink.init({ getState: () => E.pub(), onStatus: (t, ok) => { tvStat.textContent = ok ? '📺 ' + t : t ? '📺 ' + t : '📺 brak TV'; tvStat.classList.toggle('on', ok); } });

/* ---------- widoki ---------- */
const seg = (label, key, opts, cur) => `<div class="set"><div class="set-l">${label}</div><div class="seg">${opts.map(([v, t]) => `<button class="${cur === v ? 'on' : ''}" data-act="set" data-arg="${key}:${v}">${t}</button>`).join('')}</div></div>`;
const tog = (label, key, small) => `<div class="set"><div class="set-l">${label}${small ? `<small>${small}</small>` : ''}</div><button class="toggle ${E.settings[key] ? 'on' : ''}" data-act="tog" data-arg="${key}"><span></span></button></div>`;

function vSetup() {
  const n = E.players.length, st = E.settings;
  return `
  <section class="card"><h2>👥 Mieszkańcy <span class="badge">${n}</span></h2>
    <form id="addForm" class="row"><input id="nameIn" maxlength="16" placeholder="Imię gracza" autocomplete="off"><button class="btn">Dodaj</button></form>
    <ul class="players">${E.players.map(p => `<li><button class="emo-btn" data-act="emo" data-arg="${p.id}">${av(p)}</button><span class="pname">${esc(p.name)}</span><span class="pts">${p.score || 0} pkt</span><button class="icon x" data-act="rm" data-arg="${p.id}">✕</button></li>`).join('')}</ul>
    <p class="muted small">${n < 5 ? 'Mafia potrzebuje minimum 5 graczy. ' : ''}Kolejność = kolejność podawania telefonu.</p></section>
  <section class="card"><h2>⚙️ Zasady</h2>
    ${seg('Liczba mafii', 'mafia', [[0, 'auto (' + M.autoMafia(Math.max(5, n)) + ')'], [1, '1'], [2, '2'], [3, '3'], [4, '4']], st.mafia)}
    ${tog('🕵️ Policjant', 'cop', 'W nocy sprawdza, czy ktoś jest w mafii')}
    ${tog('🩺 Lekarz', 'doctor', 'W nocy ratuje jedną osobę')}
    ${tog('🪪 Pokazuj rolę po śmierci', 'reveal')}
    ${tog('🗣️ Narrator (głos na TV)', 'voice')}
    ${seg('Czas dyskusji', 'discuss', [[0, '∞'], [120, '2m'], [180, '3m'], [300, '5m']], st.discuss)}
    ${seg('Czas głosowania', 'vote', [[30, '30s'], [45, '45s'], [60, '60s']], st.vote)}
  </section>
  <section class="card"><h2>📺 Telewizor</h2>
    <p class="muted small">Na telewizorze otwórz grę, wybierz 🌙 Mafia → 📱 Jeden telefon i zeskanuj QR albo wpisz kod:</p>
    <form id="tvForm" class="row"><input class="code-in" maxlength="6" placeholder="KOD" value="${esc(link.code)}" autocomplete="off"><button class="btn">Połącz</button></form></section>
  <button class="btn big primary" data-act="start" ${n < 5 ? 'disabled' : ''}>🌙 ZACZNIJ GRĘ</button>
  ${E.players.some(p => p.score) ? '<button class="btn sm ghost center-b" data-act="reset">Wyzeruj punkty</button>' : ''}`;
}

function passScreen(label) {
  const p = player(E.passCurrent());
  return `<div class="center pass"><div class="step">${label} · ${E.pass.idx + 1}/${E.pass.order.length}</div><div class="pass-anim">📱</div>${av(p, 'xl')}
    <h1>Podaj telefon:<br><span style="color:${p.color}">${esc(p.name)}</span></h1><p class="muted">Nikt inny nie może patrzeć!</p>
    <button class="btn big primary" data-act="iam">To ja — ${esc(p.name)}</button></div>`;
}
function vRoles() {
  if (E.pass.stage === 'pass') return passScreen('Role');
  const id = E.passCurrent(), r = R[E.st.roles[id]], mates = M.teammates(E.st, id);
  return `<div class="center look"><h2>${av(player(id))} ${nm(id)}</h2>
    <div class="tile" data-seen><div class="tile-secret"><div class="role mrole-card r-${E.st.roles[id]}"><div class="role-ico">${r.emoji}</div><b>${r.name.toUpperCase()}</b><span>${esc(r.desc)}</span>${mates.length ? `<small>Twoja mafia: ${mates.map(nm).join(', ')}</small>` : ''}</div></div>
      <div class="tile-cover"><div class="hand">👆</div><b>PRZYTRZYMAJ</b><span>aby zobaczyć rolę</span></div></div>
    <button class="btn big ghost" data-act="next" disabled>Schowane — podaj dalej ➜</button></div>`;
}
function vNight() {
  if (E.pass.stage === 'pass') return passScreen(`🌙 Noc ${E.st.day}`);
  const id = E.passCurrent(), role = E.st.roles[id], N = E.st.night, targets = M.nightTargets(E.st, id);
  const picked = role === 'mafia' ? N.mafia[id] : role === 'cop' ? N.check : role === 'doctor' ? N.heal : N.suspect[id];
  const grid = (ex = {}) => `<div class="vgrid">${targets.map(t => `<button class="vbtn ${picked === t ? 'on' : ''}" data-act="night" data-arg="${t}">${av(player(t))}<span>${nm(t)}</span>${ex[t] || ''}</button>`).join('')}</div>`;
  let body;
  if (role === 'mafia') {
    const ex = {}; M.teammates(E.st, id).forEach(m => { const t = N.mafia[m]; if (t) ex[t] = (ex[t] || '') + `<small>🕴️ ${nm(m)}</small>`; });
    body = `<h2>🕴️ Kogo mafia eliminuje?</h2><p class="muted small">Widzisz wybory wspólników, którzy już byli.</p>${grid(ex)}`;
  } else if (role === 'cop') {
    body = ui.copResult ? `<h2>🕵️ Wynik śledztwa</h2><div class="card ${ui.copResult.mafia ? 'err' : ''}"><h2>${nm(ui.copResult.target)} ${ui.copResult.mafia ? 'JEST w mafii! 🕴️' : 'nie jest w mafii ✅'}</h2></div><p class="muted small">Zapamiętaj i schowaj telefon.</p>`
      : `<h2>🕵️ Kogo sprawdzasz?</h2>${grid()}`;
  } else if (role === 'doctor') body = `<h2>🩺 Kogo ratujesz?</h2>${E.st.lastHeal ? `<p class="muted small">Nie możesz znowu ratować: ${nm(E.st.lastHeal)}</p>` : ''}${grid()}`;
  else body = `<h2>🤔 Kogo podejrzewasz?</h2><p class="muted small">Każdy coś klika, żeby nikt nie zgadł ról po czasie.</p>${grid()}`;
  const done = !!N.done[id];
  return `<div class="center nightscr"><div class="step">🌙 Noc ${E.st.day} · ${nm(id)}</div>${body}
    <button class="btn big ${done ? 'primary' : 'ghost'}" data-act="next" ${done ? '' : 'disabled'}>${done ? 'Gotowe — schowaj i podaj dalej ➜' : 'Najpierw wybierz osobę'}</button></div>`;
}
function vMorning() {
  const m = E.morning;
  return `<div class="center"><div class="step">☀️ Dzień ${m.day}</div>
    <h1>${m.victims.length ? '💀 ' + m.victims.map(v => nm(v.id)).join(', ') : m.saved ? '🩺 Nikt nie zginął!' : '🌤️ Spokojna noc'}</h1>
    ${m.victims.map(v => v.role ? `<p>${nm(v.id)}: ${R[v.role].emoji} ${R[v.role].name}</p>` : '').join('')}
    <p class="muted">Telewizor ogłasza wieści 📺</p>
    <button class="btn big primary" data-act="toDay">☀️ Zaczynamy dzień</button></div>`;
}
function vDay() {
  const t = E.timer;
  return `<div class="center"><div class="step">☀️ Dyskusja · dzień ${E.st.day}</div>
    ${t ? `<div class="clock" data-timer>${fmt(E.timerLeft())}</div><div class="row"><button class="btn sm ghost" data-act="pause">${t.running ? '⏸ Pauza' : '▶ Wznów'}</button><button class="btn sm ghost" data-act="plus30">+30 s</button></div>` : '<div class="clock inf">∞</div>'}
    <div class="chips cen">${M.alive(E.st).map(p => `<span class="chip">${av(p, 'sm')} ${esc(p.name)}</span>`).join('')}</div>
    <button class="btn big primary" data-act="voteNow">🗳️ Głosowanie</button></div>`;
}
function vVote() {
  const B = E.st.ballots, al = M.alive(E.st);
  return `<div class="center"><div class="step">🗳️ Głosowanie · ${Object.keys(B).length}/${al.length}</div>
    <div class="clock" data-timer>${fmt(E.timerLeft())}</div>
    <p class="muted small">Na 3 wszyscy wskazują. Zaznacz, kto na kogo:</p>
    <ul class="ballots">${al.map(v => `<li class="${B[v.id] ? 'voted' : ''}"><div class="who">${av(v, 'sm')} <b>${esc(v.name)}</b> <span class="muted">wskazuje:</span></div>
      <div class="targets">${al.filter(p => p.id !== v.id).map(p => `<button class="tgt ${B[v.id] === p.id ? 'on' : ''}" data-act="ballot" data-arg="${v.id}:${p.id}">${av(p, 'sm')}<span>${esc(p.name)}</span></button>`).join('')}
      <button class="tgt ${B[v.id] === 'skip' ? 'on' : ''}" data-act="ballot" data-arg="${v.id}:skip">⏭️ Pomija</button></div></li>`).join('')}</ul>
    <button class="btn big primary" data-act="endVote">🔒 Zakończ głosowanie</button></div>`;
}
function vElim() {
  const e = E.elim;
  return `<div class="center"><div class="big-emoji pop">${e.out ? '⚖️' : '🤷'}</div>
    <h1>${e.out ? 'Odpada: ' + nm(e.out) : e.tie ? 'Remis – nikt nie odpada' : 'Nikt nie odpada'}</h1>
    ${e.role ? `<p>${R[e.role].emoji} ${R[e.role].name}</p>` : ''}
    <button class="btn big primary" data-act="toNight">🌙 Dalej</button></div>`;
}
function vEnd() {
  const st = E.st, town = st.winner === 'town';
  return `<div class="center"><div class="big-emoji pop">${town ? '🏙️' : '🕴️'}</div><h1>${town ? 'Wygrywa MIASTO!' : 'Wygrywa MAFIA!'}</h1>
    <ul class="deltas">${st.players.map(p => `<li>${av(p, 'sm')} ${esc(p.name)} <span class="muted">${R[st.roles[p.id]].emoji} ${R[st.roles[p.id]].name}</span> <b>${p.delta ? '+' + p.delta : ''}</b></li>`).join('')}</ul>
    <button class="btn big primary" data-act="scores">🏆 Tabela wyników</button></div>`;
}
function vScores() {
  const list = [...E.players].sort((a, b) => (b.score || 0) - (a.score || 0));
  return `<div class="center"><h1>🏆 Wyniki</h1><ol class="board">${list.map(p => `<li>${av(p, 'sm')}<span class="pname">${esc(p.name)}</span>${p.delta ? `<i>+${p.delta}</i>` : ''}<b>${p.score || 0}</b></li>`).join('')}</ol>
    <button class="btn big primary" data-act="start">🌙 Nowa partia</button><button class="btn ghost" data-act="lobby">⚙️ Ustawienia</button></div>`;
}

let lastKey = '';
function render() {
  const v = { setup: vSetup, roles: vRoles, night: vNight, morning: vMorning, day: vDay, vote: vVote, elim: vElim, end: vEnd, scores: vScores }[E.phase];
  if (E.msg) setTimeout(() => alert(E.msg), 0), E.msg = '';
  app.innerHTML = v ? v() : '';
  document.body.classList.toggle('night-ui', E.phase === 'night');
  bindTiles();
  const k = E.phase + (E.pass ? E.pass.idx + E.pass.stage : '');
  if (k !== lastKey && E.phase !== 'setup' && E.phase !== 'vote') window.scrollTo(0, 0);
  lastKey = k;
  save(); link.sync();
}
setInterval(() => { if (E.timer) app.querySelectorAll('[data-timer]').forEach(el => { el.textContent = fmt(E.timerLeft()); el.classList.toggle('low', E.timerLeft() < 10000); }); }, 250);

function bindTiles() {
  app.querySelectorAll('.tile').forEach(t => {
    const open = e => { e.preventDefault(); t.classList.add('open'); try { t.setPointerCapture(e.pointerId); } catch (x) {} vib(15); };
    const close = () => { if (!t.classList.contains('open')) return; t.classList.remove('open'); const b = app.querySelector('[data-act=next]'); if (b) { b.disabled = false; b.classList.add('primary'); b.classList.remove('ghost'); } };
    t.addEventListener('pointerdown', open);
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => t.addEventListener(ev, close));
    t.addEventListener('contextmenu', e => e.preventDefault());
  });
}

/* ---------- akcje ---------- */
const ACT = {
  rm: id => { E.removePlayer(id); },
  emo: id => { const p = player(id), used = new Set(E.players.map(q => q.emoji)); let i = EMOJI.indexOf(p.emoji); do { i = (i + 1) % EMOJI.length; } while (used.has(EMOJI[i]) && EMOJI[i] !== p.emoji); p.emoji = EMOJI[i]; render(); },
  set: a => { const [k, v] = a.split(':'); E.settings[k] = Number(v); render(); },
  tog: k => { E.settings[k] = !E.settings[k]; render(); },
  start: () => { ui.copResult = null; E.start(); },
  reset: () => { if (confirm('Wyzerować punkty?')) E.resetScores(); },
  iam: () => { ui.copResult = null; E.iam(); },
  next: () => { ui.copResult = null; E.passNext(); },
  night: t => {
    const id = E.passCurrent(), role = E.st.roles[id];
    if (role === 'cop' && E.st.night.check) return;
    const r = E.night(id, t);
    if (r.ok && role === 'cop') { ui.copResult = { target: t, mafia: M.isMafia(E.st, t) }; render(); }
  },
  toDay: () => E.toDay(), voteNow: () => E.voteNow(),
  pause: () => { E.timer && E.timer.running ? E.pause() : E.resume(); },
  plus30: () => E.plus30(),
  ballot: a => { const [v, t] = a.split(':'); E.vote(v, t); vib(10); },
  endVote: () => E.endVote(), toNight: () => E.toNight(),
  scores: () => E.scores(), lobby: () => E.lobby(),
};
app.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b || b.disabled) return; const f = ACT[b.dataset.act]; if (f) f(b.dataset.arg); });
app.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.id === 'tvForm') { link.connect(e.target.querySelector('input').value); return; }
  if (e.target.id !== 'addForm') return;
  const inp = e.target.querySelector('input'), name = inp.value.trim().replace(/\s+/g, ' ').slice(0, 16);
  if (!name) return;
  if (E.players.length >= 16) return alert('Maksymalnie 16 graczy.');
  if (E.players.some(p => p.name.toLowerCase() === name.toLowerCase())) return alert('Taki gracz już jest.');
  const usedC = new Set(E.players.map(p => p.color)), usedE = new Set(E.players.map(p => p.emoji));
  E.addPlayer({ id: uid(), name, color: COLORS.find(c => !usedC.has(c)) || COLORS[0], emoji: EMOJI.find(x => !usedE.has(x)) || EMOJI[0] });
  const ni = app.querySelector('#nameIn'); if (ni) ni.focus();
});
let wl = null;
document.addEventListener('click', async () => { try { if ('wakeLock' in navigator && !wl && E.phase !== 'setup') { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); } } catch (e) {} });
render();
})();
