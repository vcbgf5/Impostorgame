/* Impostor – telefon gracza (tryb „każdy swój telefon”) */
(() => {
'use strict';
const CFG = window.IMPOSTOR_CONFIG || {};
const app = document.getElementById('app');
const stat = document.getElementById('tvstat');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ini = n => esc((n || '?').trim().charAt(0).toUpperCase());
const fmt = ms => { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const vib = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
const av = (p, cls = '') => p ? `<span class="av ${cls} ${p.emoji ? 'emo' : ''}" style="--c:${p.color}">${p.emoji || ini(p.name)}</span>` : '';
const EMOJI = ['🐱', '🐶', '🦊', '🐼', '🐸', '🐵', '🦁', '🐯', '🐷', '🐨', '🐙', '🦄', '🐲', '👽', '🤖', '👻', '🎃', '🤠', '😎', '🥸', '🦖', '🐧', '🦉', '🐝'];
const REACTS = ['😂', '😱', '🤔', '😡', '👏', '🔥', '🤡', '🕵️', '❤️', '👀'];
const normCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
const params = new URLSearchParams(location.search);
const LOCAL = params.get('local') === '1';
const box = () => LOCAL ? sessionStorage : localStorage; // test w jednej przeglądarce: każda karta = osobny gracz
// strona testowa (test.html): kilka telefonów w jednej karcie – każdy „slot” ma osobną pamięć
const SLOT = (params.get('slot') || '').replace(/[^0-9a-z]/gi, '').slice(0, 4);
const KEY = 'impp_' + (SLOT ? 's' + SLOT + '_' : '');
const store = {
  get(k, d) { try { const v = box().getItem(KEY + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { box().setItem(KEY + k, JSON.stringify(v)); } catch (e) {} },
};

const ME = {
  pid: store.get('pid', '') || (Math.random().toString(36).slice(2) + Date.now().toString(36)),
  name: store.get('name', ''),
  code: normCode(params.get('tv')) || store.get('code', ''),
  emoji: store.get('emoji', ''),
};
if (params.get('name')) { ME.name = params.get('name').slice(0, 16); store.set('name', ME.name); }
if (params.get('emoji') && EMOJI[Number(params.get('emoji'))]) { ME.emoji = EMOJI[Number(params.get('emoji'))]; store.set('emoji', ME.emoji); }
if (!ME.emoji) { ME.emoji = EMOJI[Math.floor(Math.random() * EMOJI.length)]; store.set('emoji', ME.emoji); }
store.set('pid', ME.pid);
if (ME.code) store.set('code', ME.code);
const AUTO = LOCAL && params.get('auto') === '1';
if (params.get('tv') && !AUTO) history.replaceState(null, '', location.pathname + (LOCAL ? '?local=1' + (SLOT ? '&slot=' + SLOT : '') : ''));

let P = null, recvAt = 0, want = false, status = '', errMsg = '', lastKey = '', holding = false, pending = false;
const T = { peer: null, conn: null, retry: null, bc: null };

/* ---------- połączenie z telewizorem ---------- */
const isOpen = () => LOCAL ? !!T.bc : !!(T.conn && T.conn.open);
function sendTV(m) {
  if (LOCAL && T.bc) { T.bc.postMessage({ from: ME.pid, m }); return; }
  if (T.conn && T.conn.open) { try { T.conn.send(m); } catch (e) {} }
}
function onData(m) {
  if (!m) return;
  if (m.type === 'p') { P = m; recvAt = performance.now(); errMsg = ''; setStatus(''); render(); return; }
  if (m.type === 'err') { errMsg = m.text; P = null; want = false; disconnect(); render(); return; }
  if (m.type === 'rejoin') { if (want) join(); return; }  // telewizor zmienił grę – dołącz ponownie
  if (m.type === 'note') { showNote(m.text); return; }
  if (m.type === 'kicked') { errMsg = 'Zostałeś usunięty z gry na telewizorze.'; P = null; want = false; disconnect(); render(); }
}
function setStatus(s) { status = s; stat.textContent = isOpen() && P ? '📺 ' + ME.code : s ? s : ''; stat.classList.toggle('on', isOpen() && !!P); const el = document.getElementById('jstat'); if (el) el.textContent = s; }
let peerLib = null;
function loadPeer() {
  if (window.Peer) return Promise.resolve();
  if (!peerLib) peerLib = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = CFG.PEERJS_URL || 'js/vendor/peerjs.min.js';
    s.onload = res; s.onerror = () => { peerLib = null; rej(new Error('peerjs')); };
    document.head.appendChild(s);
  });
  return peerLib;
}
function retryLater() { clearTimeout(T.retry); if (want) T.retry = setTimeout(connect, 3000); }
function join() { sendTV({ type: 'join', pid: ME.pid, name: ME.name, emoji: ME.emoji }); }
function connect() {
  clearTimeout(T.retry);
  if (!want || !ME.code) return;
  if (LOCAL) {
    if (!T.bc) { T.bc = new BroadcastChannel('impostor-play'); T.bc.onmessage = e => { const d = e.data || {}; if (d.to === ME.pid) onData(d.m); }; }
    join(); return;
  }
  if (T.conn && T.conn.open) { join(); return; }
  setStatus('łączenie z telewizorem ' + ME.code + '…');
  loadPeer().then(() => {
    const go = () => {
      const c = T.peer.connect((CFG.PEER_PREFIX || 'impostor-pl-gra-') + ME.code, { reliable: true });
      T.conn = c;
      const to = setTimeout(() => { if (T.conn === c && !c.open) { try { c.close(); } catch (e) {} T.conn = null; setStatus('telewizor nie odpowiada, ponawiam…'); retryLater(); } }, 9000);
      c.on('open', () => { clearTimeout(to); if (T.conn === c) { join(); setStatus('dołączanie…'); } });
      c.on('data', onData);
      c.on('close', () => { if (T.conn === c) { T.conn = null; setStatus('rozłączono, ponawiam…'); render(); retryLater(); } });
      c.on('error', () => {});
    };
    if (T.peer && !T.peer.destroyed && T.peer.open) return go();
    if (T.peer) { try { T.peer.destroy(); } catch (e) {} }
    const p = T.peer = new Peer();
    p.on('open', go);
    p.on('error', e => {
      if (T.peer !== p) return;
      setStatus(e.type === 'peer-unavailable' ? 'nie widzę telewizora o kodzie ' + ME.code : 'błąd połączenia (' + e.type + ')');
      if (e.type !== 'peer-unavailable') { try { p.destroy(); } catch (x) {} T.peer = null; }
      T.conn = null; retryLater();
    });
    p.on('disconnected', () => { try { if (!p.destroyed) p.reconnect(); } catch (e) {} });
  }).catch(() => { setStatus('brak internetu'); retryLater(); });
}
function disconnect() {
  clearTimeout(T.retry);
  if (T.conn) { const c = T.conn; T.conn = null; try { c.close(); } catch (e) {} }
  setStatus('');
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { if (want && !isOpen()) connect(); else if (want) join(); wake(); }
  else closeTiles();
});

/* ---------- zegar ---------- */
const timerLeft = () => { const t = P && P.timer; if (!t) return 0; return t.running ? Math.max(0, t.left - (performance.now() - recvAt)) : t.left; };
setInterval(() => {
  if (!P || !P.timer) return;
  const left = timerLeft();
  app.querySelectorAll('[data-timer]').forEach(el => { el.textContent = fmt(left); el.classList.toggle('low', left < 10000); });
}, 250);

/* ---------- widoki ---------- */
const PL = id => P && P.players.find(p => p.id === id);
const tileHTML = (small) => {
  const r = P.role;
  const secret = r.imp
    ? `<div class="role imp"><div class="role-ico">🕵️</div><b>JESTEŚ IMPOSTOREM</b>${r.hint ? `<span>Podpowiedź:</span><em>${esc(r.hint)}</em>` : '<span>Bez podpowiedzi — blefuj!</span>'}${r.many ? '<small>Impostorów może być więcej 😉</small>' : ''}</div>`
    : `<div class="role crew"><span>Twoje słowo:</span><b class="word">${esc(r.word)}</b><small>${esc(r.cat)}</small></div>`;
  return `<div class="tile ${small ? 'mini' : ''}" data-seen>
    <div class="tile-secret">${secret}</div>
    <div class="tile-cover">${small ? '' : '<div class="hand">👆</div>'}<b>PRZYTRZYMAJ</b><span>${small ? 'przypomnij sobie słowo' : 'aby podnieść kafelek'}</span></div></div>`;
};
const watchTV = (t = 'Patrzcie na telewizor 📺') => `<div class="big-emoji pop">📺</div><h2>${t}</h2>`;

function vJoin() {
  return `<div class="center">
    <div class="big-emoji">🕵️</div><h1>Dołącz do gry</h1>
    ${errMsg ? `<div class="card err">${esc(errMsg)}</div>` : ''}
    <form id="joinForm" class="card joinf">
      <label>Twoje imię</label>
      <input id="nm" maxlength="16" placeholder="np. Ania" value="${esc(ME.name)}" autocomplete="off" enterkeyhint="go">
      <label>Twój awatar</label>
      <div class="emogrid">${EMOJI.map(e => `<button type="button" class="emo-pick ${ME.emoji === e ? 'on' : ''}" data-act="emoji" data-arg="${e}">${e}</button>`).join('')}</div>
      <label>Kod z telewizora</label>
      <input id="cd" class="code-in" maxlength="6" placeholder="KOD" value="${esc(ME.code)}" autocomplete="off" autocapitalize="characters">
      <button class="btn big primary">Dołącz ▶</button>
      <p class="small muted" id="jstat">${esc(status)}</p>
    </form></div>`;
}
function vLobby() {
  return `<div class="center">
    ${av(P.me, 'xl')}
    <h1>Jesteś w grze!</h1>
    <p class="muted">Czekajcie, aż ktoś wciśnie <b>START</b> na telewizorze.</p>
    <div class="chips cen">${P.players.map(p => `<span class="chip ${p.id === P.me.id ? 'on' : ''}">${av(p, 'sm')} ${esc(p.name)}</span>`).join('')}</div>
    <details class="card emocard"><summary>Zmień awatar ${esc(P.me.emoji || '')}</summary>
      <div class="emogrid">${EMOJI.map(e => { const taken = P.players.some(p => p.id !== P.me.id && p.emoji === e); return `<button class="emo-pick ${P.me.emoji === e ? 'on' : ''}" data-act="emoji" data-arg="${e}" ${taken ? 'disabled' : ''}>${e}</button>`; }).join('')}</div></details>
    <button class="btn sm ghost center-b" data-act="leave">Wyjdź z gry</button></div>`;
}
function vRound() {
  if (!P.inRound) return `<div class="center">${watchTV('Runda już trwa')}<p class="muted">Dołączysz w następnej rundzie.</p></div>`;
  const ph = P.phase, st = PL(P.starter);
  if (ph === 'reveal') return `<div class="center look">
    <div class="step">Runda ${P.round} · ${P.seenCount}/${P.total} gotowych</div>
    ${tileHTML(false)}
    ${P.seen ? '<p class="ok">✔ Czekamy na resztę graczy…</p><p class="muted small">Możesz jeszcze raz przytrzymać kafelek.</p>'
             : `<p class="muted small">Przytrzymaj kafelek, zapamiętaj i puść.</p><button class="btn big ghost" data-act="seen" disabled>Widziałem ✔</button>`}</div>`;
  if (ph === 'ready') return `<div class="center"><div class="big-emoji pop">✅</div><h1>Wszyscy gotowi!</h1><p>Zaczyna: ${av(st, 'sm')} <b>${esc(st && st.name)}</b></p></div>`;
  if (ph === 'discuss') return `<div class="center">
    <div class="step">Dyskusja</div>
    ${P.timer ? `<div class="clock" data-timer>${fmt(timerLeft())}</div>` : '<div class="clock inf">∞</div>'}
    <p>Zaczyna: ${av(st, 'sm')} <b>${esc(st && st.name)}</b></p>
    <p class="muted small">Powiedz jedno skojarzenie ze słowem.</p>
    ${tileHTML(true)}</div>`;
  if (ph === 'vote') {
    const targets = P.ids.filter(id => id !== P.me.id).map(PL).filter(Boolean);
    return `<div class="center">
      <div class="step">Głosowanie · ${P.voteCount}/${P.total}</div>
      <div class="clock" data-timer>${fmt(timerLeft())}</div>
      <p><b>Kto jest impostorem?</b></p>
      <div class="vgrid">${targets.map(p => `<button class="vbtn ${P.myVote === p.id ? 'on' : ''}" data-act="vote" data-arg="${p.id}">${av(p)}<span>${esc(p.name)}</span></button>`).join('')}
        ${P.troll ? `<button class="vbtn ${P.myVote === 'troll' ? 'on' : ''}" data-act="vote" data-arg="troll"><span class="av" style="--c:#ffd43b">🤡</span><span>Troll — wszyscy!</span></button>` : ''}</div>
      <p class="muted small">${P.myVote ? '✔ Zagłosowano. Możesz zmienić zdanie do końca czasu.' : 'Dotknij gracza, żeby oddać głos.'}</p>
      ${tileHTML(true)}</div>`;
  }
  if (ph === 'result') {
    if (P.step === 'accused') return `<div class="center">${watchTV('Kogo wyrzuciliście?')}<div class="drum-s">🥁</div></div>`;
    if (P.step === 'impostors') {
      if (P.options) return `<div class="center">
        <div class="step">Ostatnia szansa!</div><h1>🎯 Które to słowo?</h1>
        <p class="muted small">Trafisz = +2 punkty. Masz jeden wybór (możesz go zmienić).</p>
        ${P.timer ? `<div class="clock sm" data-timer>${fmt(timerLeft())}</div>` : ''}
        <div class="opts">${P.options.map((w, i) => `<button class="opt ${P.myPick === w ? 'on' : ''}" data-act="pick" data-arg="${i}">${esc(w)}</button>`).join('')}</div></div>`;
      if (P.fake) return `<div class="center">${watchTV('🎭 Podwójny agent!')}<p>Impostor miał słowo: <b class="hl">${esc(P.fake)}</b></p></div>`;
      return `<div class="center">${watchTV(P.troll ? '🤡 TROLL!' : 'Impostor wybiera słowo…')}</div>`;
    }
    return `<div class="center">
      <h1>${esc(P.headline || '')}</h1>
      ${P.word ? `<p>Słowo: <b class="hl">${esc(P.word)}</b></p>` : ''}
      ${P.fake ? `<p class="muted">Impostor miał: <b>${esc(P.fake)}</b></p>` : ''}
      <div class="mydelta ${P.me.delta ? 'plus' : ''}">${P.me.delta ? '+' + P.me.delta : '0'} <small>pkt w tej rundzie</small></div>
      <p class="muted">Razem: <b>${P.me.score}</b> pkt</p></div>`;
  }
  return '';
}
function vScores() {
  const list = [...P.players].sort((a, b) => b.score - a.score);
  const win = (P.final || []).map(PL).filter(Boolean);
  if (win.length) return `<div class="center"><div class="big-emoji pop">👑</div><h1>${win.some(p => p.id === P.me.id) ? 'WYGRAŁEŚ! 🎉' : 'Koniec gry!'}</h1>
    <h2>Wygrywa: ${win.map(p => `${av(p, 'sm')} ${esc(p.name)}`).join(', ')}</h2>
    <ol class="board">${list.map(p => `<li class="${p.id === P.me.id ? 'me' : ''}">${av(p, 'sm')}<span class="pname">${esc(p.name)}</span><b>${p.score}</b></li>`).join('')}</ol></div>`;
  return `<div class="center"><h1>🏆 Wyniki</h1>
    <ol class="board">${list.map(p => `<li class="${p.id === P.me.id ? 'me' : ''}">${av(p, 'sm')}<span class="pname">${esc(p.name)}</span>${p.delta ? `<i>+${p.delta}</i>` : ''}<b>${p.score}</b></li>`).join('')}</ol>
    <p class="muted">Następna runda startuje z telewizora 📺</p></div>`;
}
function viewKey() {
  if (!P) return 'join|' + errMsg;
  const c = { ...P }; delete c.timer; delete c.type; return JSON.stringify(c);
}
let noteT = null;
function showNote(t) {
  let el = document.getElementById('pnote');
  if (!el) { el = document.createElement('div'); el.id = 'pnote'; el.className = 'pnote'; document.body.appendChild(el); }
  el.textContent = t; el.classList.add('on'); vib([30, 50, 30]);
  clearTimeout(noteT); noteT = setTimeout(() => el.classList.remove('on'), 3000);
}
function render(force) {
  const k = viewKey();
  if (!force && k === lastKey) return;
  if (holding) { pending = true; return; }
  lastKey = k; pending = false;
  let html;
  const mafia = P && P.game === 'mafia' && window.PlayerMafia;
  if (!P) html = vJoin();
  else if (mafia) html = PlayerMafia.view(P, { esc, av, fmt, timerLeft, tile: secret => `<div class="tile" data-seen><div class="tile-secret">${secret}</div><div class="tile-cover"><div class="hand">👆</div><b>PRZYTRZYMAJ</b><span>aby zobaczyć rolę</span></div></div>` });
  else if (P.phase === 'setup') html = vLobby();
  else if (P.phase === 'scores') html = vScores();
  else html = vRound();
  document.body.classList.toggle('mafia-ui', !!mafia);
  { const lg = document.querySelector('.logo'); if (lg) lg.textContent = mafia ? 'MAFIA' : 'IMPOSTOR'; }
  document.body.classList.toggle('night-ui', !!(mafia && P.phase === 'night'));
  if (P && P.phase !== 'reveal' && !(mafia && P.phase === 'night')) html += `<div class="reactbar">${REACTS.map(e => `<button data-act="react" data-arg="${e}">${e}</button>`).join('')}</div>`;
  app.innerHTML = html;
  document.body.classList.toggle('has-react', !!(P && P.phase !== 'reveal' && !(mafia && P.phase === 'night')));
  bindTiles();
  if (!P) { const nm = app.querySelector('#nm'); if (nm && !ME.name) nm.focus(); }
}

/* ---------- kafelek ---------- */
function closeTiles() { app.querySelectorAll('.tile.open').forEach(t => t.classList.remove('open')); holding = false; if (pending) render(true); }
function bindTiles() {
  app.querySelectorAll('.tile').forEach(t => {
    const open = e => { e.preventDefault(); t.classList.add('open'); holding = true; try { t.setPointerCapture(e.pointerId); } catch (x) {} vib(15); };
    const close = () => {
      if (!t.classList.contains('open')) return;
      t.classList.remove('open'); holding = false;
      const b = app.querySelector('[data-act=seen]');
      if (b) { b.disabled = false; b.classList.add('primary'); b.classList.remove('ghost'); }
      if (pending) render(true);
    };
    t.addEventListener('pointerdown', open);
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => t.addEventListener(ev, close));
    t.addEventListener('contextmenu', e => e.preventDefault());
  });
}

/* ---------- akcje ---------- */
app.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  const a = b.dataset.act, arg = b.dataset.arg;
  if (P && P.game === 'mafia' && window.PlayerMafia && PlayerMafia.act(a, arg, sendTV, P, () => render(true))) { vib(20); return; }
  if (a === 'seen') { sendTV({ type: 'seen' }); vib(30); b.disabled = true; }
  else if (a === 'vote') { sendTV({ type: 'vote', target: arg }); vib(20); }
  else if (a === 'pick') { sendTV({ type: 'pick', i: Number(arg) }); vib(20); }
  else if (a === 'react') { sendTV({ type: 'react', e: arg }); vib(10); b.classList.remove('fly'); void b.offsetWidth; b.classList.add('fly'); }
  else if (a === 'emoji') {
    ME.emoji = arg; store.set('emoji', arg);
    app.querySelectorAll('.emo-pick').forEach(x => x.classList.toggle('on', x.dataset.arg === arg));
    if (P) sendTV({ type: 'emoji', e: arg });
  }
  else if (a === 'leave') { if (confirm('Wyjść z gry?')) { sendTV({ type: 'leave' }); want = false; P = null; disconnect(); render(true); } }
});
app.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.id !== 'joinForm') return;
  const name = app.querySelector('#nm').value.trim().replace(/\s+/g, ' ').slice(0, 16);
  const code = normCode(app.querySelector('#cd').value);
  if (!name) return alert('Wpisz swoje imię.');
  if (!code) return alert('Wpisz kod z telewizora.');
  if (code !== ME.code) disconnect();
  ME.name = name; ME.code = code; store.set('name', name); store.set('code', code);
  errMsg = ''; want = true; wake(); connect(); render(true);
});

let wl = null;
async function wake() { try { if ('wakeLock' in navigator && !wl) { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); } } catch (e) {} }

render(true);
// wróć do gry automatycznie (np. po odświeżeniu), jeśli mamy imię i kod
if (ME.name && ME.code && (params.get('tv') || AUTO || store.get('auto', false))) { want = true; connect(); }
window.addEventListener('pagehide', () => store.set('auto', want));
})();
