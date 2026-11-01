/* Kalambury – telefon hosta (tryb jednego telefonu: telefon trafia do rysującego) */
(() => {
'use strict';
const CFG = window.IMPOSTOR_CONFIG || {};
const app = document.getElementById('app'), tvStat = document.getElementById('tvstat');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = ms => { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const vib = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
const uid = () => Math.random().toString(36).slice(2, 9);
const COLORS = ['#ff4d6d', '#4dabf7', '#51cf66', '#fcc419', '#cc5de8', '#ff922b', '#20c997', '#f06595', '#5c7cfa', '#94d82d', '#22b8cf', '#e599f7', '#ffa8a8', '#74c0fc', '#ffd43b', '#b197fc'];
const EMOJI = ['🐱', '🐶', '🦊', '🐼', '🐸', '🐵', '🦁', '🐯', '🐷', '🐨', '🐙', '🦄', '🐲', '👽', '🤖', '👻', '🎃', '🤠', '😎', '🥸', '🦖', '🐧', '🦉', '🐝'];
const store = {
  get(k, d) { try { const v = localStorage.getItem('impdrawh_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('impdrawh_' + k, JSON.stringify(v)); } catch (e) {} },
};
const E = DrawEngine.create({ mode: 'single', settings: store.get('settings', {}), render: () => render() });
store.get('players', []).forEach(p => E.players.push(Object.assign({ score: 0, delta: 0, online: true }, p)));
const save = () => { store.set('players', E.players.map(p => ({ id: p.id, name: p.name, color: p.color, emoji: p.emoji, score: p.score }))); store.set('settings', { cats: E.settings.cats, time: E.settings.time, rounds: E.settings.rounds }); };
const player = id => E.players.find(p => p.id === id);
const av = (p, cls = '') => p ? `<span class="av ${cls} emo" style="--c:${p.color}">${p.emoji || esc(p.name[0])}</span>` : '';
const link = TVLink.init({ getState: () => E.pub(), onStatus: (t, ok) => { tvStat.textContent = ok ? '📺 ' + t : t ? '📺 ' + t : '📺 brak TV'; tvStat.classList.toggle('on', ok); } });
let ui = { passFor: null }, pad = null;
DrawCore.loadWords(CFG.WORDS_BASE || 'words/').then(c => { E.cats = c; render(); }).catch(() => alert('Nie udało się wczytać słów.'));

const seg = (label, key, opts, cur) => `<div class="set"><div class="set-l">${label}</div><div class="seg">${opts.map(([v, t]) => `<button class="${cur === v ? 'on' : ''}" data-act="set" data-arg="${key}:${v}">${t}</button>`).join('')}</div></div>`;
function vSetup() {
  const n = E.players.length, st = E.settings, sel = st.cats;
  return `
  <section class="card"><h2>👥 Gracze <span class="badge">${n}</span></h2>
    <form id="addForm" class="row"><input id="nameIn" maxlength="16" placeholder="Imię gracza" autocomplete="off"><button class="btn">Dodaj</button></form>
    <ul class="players">${E.players.map(p => `<li><button class="emo-btn" data-act="emo" data-arg="${p.id}">${av(p)}</button><span class="pname">${esc(p.name)}</span><span class="pts">${p.score || 0} pkt</span><button class="icon x" data-act="rm" data-arg="${p.id}">✕</button></li>`).join('')}</ul>
    <p class="muted small">${n < 2 ? 'Dodaj minimum 2 graczy. ' : ''}Rysują po kolei w tej kolejności.</p></section>
  <section class="card"><h2>⚙️ Zasady</h2>
    ${seg('Czas rysowania', 'time', [[60, '60s'], [80, '80s'], [100, '100s'], [120, '120s']], st.time)}
    ${seg('Obiegi (ile razy każdy rysuje)', 'rounds', [[1, '1'], [2, '2'], [3, '3']], st.rounds)}</section>
  <section class="card"><div class="row between"><h2>🗂️ Kategorie haseł</h2><button class="btn sm ghost" data-act="allCats">Wszystkie</button></div>
    <div class="chips">${E.cats.map(c => `<button class="chip ${!sel || sel.includes(c.id) ? 'on' : ''}" data-act="cat" data-arg="${c.id}">${c.emoji} ${esc(c.name)}</button>`).join('') || '<span class="muted">Ładowanie…</span>'}</div></section>
  <section class="card"><h2>📺 Telewizor</h2>
    <p class="muted small">Na telewizorze wybierz ✏️ Kalambury → 📱 Jeden telefon i zeskanuj QR albo wpisz kod:</p>
    <form id="tvForm" class="row"><input class="code-in" maxlength="6" placeholder="KOD" value="${esc(link.code)}" autocomplete="off"><button class="btn">Połącz</button></form></section>
  <button class="btn big primary" data-act="start" ${n < 2 ? 'disabled' : ''}>✏️ ZACZNIJ GRĘ</button>`;
}
function vChoose() {
  const d = player(E.drawer);
  if (ui.passFor !== E.drawer) return `<div class="center pass"><div class="step">Rysunek ${E.turn + 1}/${E.total}</div><div class="pass-anim">📱</div>${av(d, 'xl')}
    <h1>Podaj telefon:<br><span style="color:${d.color}">${esc(d.name)}</span></h1><p class="muted">Teraz rysujesz Ty! Nikt inny nie patrzy na ekran.</p>
    <button class="btn big primary" data-act="iam">To ja — ${esc(d.name)}</button></div>`;
  return `<div class="center"><h1>✏️ Wybierz hasło</h1><div class="choices">${E.choices.map((c, i) => `<button class="choice" data-act="choose" data-arg="${i}"><b>${esc(c.w)}</b><small>${esc(c.emoji + ' ' + c.cat)}</small></button>`).join('')}</div></div>`;
}
function vDraw() {
  const others = E.players.filter(p => p.id !== E.drawer);
  return `<div class="drphone" data-rid="${E.roundId}"><div class="drhead"><span class="clock sm" data-timer>${fmt(E.timerLeft())}</span><span class="small">Rysujesz: <b>${esc(E.word)}</b></span></div>
    <div id="padwrap" class="padwrap"></div>
    <div class="card"><b>Kto zgadł pierwszy?</b><div class="chips">${others.map(p => `<button class="chip" data-act="mark" data-arg="${p.id}">${av(p, 'sm')} ${esc(p.name)}</button>`).join('')}</div>
    <button class="btn sm ghost" data-act="nobody">🤷 Nikt nie zgadł</button></div></div>`;
}
function vReveal() {
  const g = E.players.filter(p => p.delta > 0);
  return `<div class="center"><div class="step">Koniec rysunku</div><h1>Hasło: <span class="hl">${esc(E.word)}</span></h1>
    <ul class="deltas">${g.map(p => `<li>${av(p, 'sm')} ${esc(p.name)} <b>+${p.delta}</b></li>`).join('') || '<li class="muted">Nikt nie zgadł</li>'}</ul>
    <button class="btn big primary" data-act="next">${E.turn + 1 >= E.total ? '🏆 Wyniki' : '➜ Następny rysuje'}</button></div>`;
}
function vFinal() {
  const list = [...E.players].sort((a, b) => b.score - a.score);
  return `<div class="center"><div class="big-emoji pop">🏆</div><h1>Koniec gry!</h1><ol class="board">${list.map(p => `<li>${av(p, 'sm')}<span class="pname">${esc(p.name)}</span><b>${p.score}</b></li>`).join('')}</ol>
    <button class="btn big primary" data-act="start">✏️ Jeszcze raz</button><button class="btn ghost" data-act="lobby">⚙️ Ustawienia</button></div>`;
}
function render() {
  if (E.msg) { const m = E.msg; E.msg = ''; setTimeout(() => alert(m), 0); }
  link.sync();
  // w trakcie rysowania nie przebudowujemy ekranu (płótno!)
  const cur = app.querySelector('.drphone');
  if (E.phase === 'draw' && cur && cur.dataset.rid === String(E.roundId)) return;
  const v = { setup: vSetup, choose: vChoose, draw: vDraw, reveal: vReveal, final: vFinal }[E.phase];
  if (pad) { pad.destroy(); pad = null; }
  app.innerHTML = v ? v() : '';
  window.scrollTo(0, 0);
  const w = app.querySelector('#padwrap');
  if (w) pad = DrawPad.mount(w, { onSend: m => { E.draw(E.drawer, m); link.send(Object.assign({ type: 'dr', rid: E.roundId }, m)); } });
  save();
}
setInterval(() => { if (E.timer) app.querySelectorAll('[data-timer]').forEach(el => { el.textContent = fmt(E.timerLeft()); el.classList.toggle('low', E.timerLeft() < 10000); }); }, 250);

const ACT = {
  rm: id => E.removePlayer(id),
  emo: id => { const p = player(id), used = new Set(E.players.map(q => q.emoji)); let i = EMOJI.indexOf(p.emoji); do { i = (i + 1) % EMOJI.length; } while (used.has(EMOJI[i]) && EMOJI[i] !== p.emoji); p.emoji = EMOJI[i]; render(); },
  set: a => { const [k, v] = a.split(':'); E.settings[k] = Number(v); render(); },
  cat: id => { const all = E.cats.map(c => c.id), s = new Set(E.settings.cats || all); s.has(id) ? s.delete(id) : s.add(id); E.settings.cats = s.size === all.length ? null : [...s]; render(); },
  allCats: () => { E.settings.cats = null; render(); },
  start: () => { if (E.settings.cats && !E.settings.cats.length) return alert('Wybierz kategorię.'); ui.passFor = null; E.start(); },
  iam: () => { ui.passFor = E.drawer; render(); },
  choose: i => E.choose(E.drawer, Number(i)),
  mark: id => E.markGuess(id), nobody: () => E.markGuess(null),
  next: () => { ui.passFor = null; E.next(); }, lobby: () => E.lobby(),
};
app.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b || b.disabled) return; const f = ACT[b.dataset.act]; if (f) { f(b.dataset.arg); vib(15); } });
app.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.id === 'tvForm') { link.connect(e.target.querySelector('input').value); return; }
  if (e.target.id !== 'addForm') return;
  const inp = e.target.querySelector('input'), name = inp.value.trim().replace(/\s+/g, ' ').slice(0, 16);
  if (!name) return;
  if (E.players.length >= 16) return alert('Maksymalnie 16 graczy.');
  if (E.players.some(p => p.name.toLowerCase() === name.toLowerCase())) return alert('Taki gracz już jest.');
  const uc = new Set(E.players.map(p => p.color)), ue = new Set(E.players.map(p => p.emoji));
  E.addPlayer({ id: uid(), name, color: COLORS.find(c => !uc.has(c)) || COLORS[0], emoji: EMOJI.find(x => !ue.has(x)) || EMOJI[0] });
  const ni = app.querySelector('#nameIn'); if (ni) ni.focus();
});
render();
})();
