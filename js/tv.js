/* Impostor – ekran telewizora: tryb jednego telefonu (host) i tryb „każdy swój telefon” */
(() => {
'use strict';
const stage = document.getElementById('stage');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ini = n => esc((n || '?').trim().charAt(0).toUpperCase());
const fmt = ms => { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const av = (p, cls = '', style = '') => p ? `<div class="av ${cls} ${p.emoji ? 'emo' : ''}" style="--c:${p.color};${style}">${p.emoji || ini(p.name)}</div>` : '';
const SFX = (n, d) => { if (window.Sfx) Sfx.play(n, d); };
const GM = { classic: '🎯 Klasyczny', double: '🎭 Podwójny agent', blitz: '⚡ Błyskawica' };

let S = null, recvAt = 0, scene = '', known = new Set(), loops = [];
const senders = [];
let CODE = '', NET = 'connecting';
const TV = window.TV = {
  addSender(fn) { senders.push(fn); hello(); },
  setCode(code, net) {
    const changed = code !== CODE;
    CODE = code; NET = net;
    if (changed && ['wait', 'lobby', 'mlobby', 'ma-mlobby', 'ma-lobby'].includes(scene)) { fullKey = ''; draw(); }
    stage.querySelectorAll('.tv-code').forEach(el => { el.textContent = CODE; });
    stage.querySelectorAll('.tv-net').forEach(el => { el.textContent = netTxt(); el.className = 'tv-net ' + NET; });
  },
  mode: null,
  game: null,
  /** stan od telefonu hosta (tryb jednego telefonu). Zwraca false, gdy TV jest w innej grze/trybie. */
  onMessage(m) {
    if (typeof m === 'string') { try { m = JSON.parse(m); } catch (e) { return; } }
    if (!m || m.type !== 'state' || !m.state) return;
    const g = m.state.game || 'impostor';
    if (TV.mode === 'multi') return false;
    if (TV.game && TV.game !== g && TV.mode === 'single') return false;
    if (TV.game !== g) { TV.game = g; saveGame(g); }
    if (TV.mode !== 'single') TV.setMode('single', true);
    S = m.state; recvAt = performance.now(); draw();
    return true;
  },
  setGame(g) {
    TV.game = g || null;
    if (g) saveGame(g);
    TV.mode = null; S = null; fullKey = '';
    [window.TVGame, window.MafiaGame].forEach(x => { if (x && x.active) x.deactivate(); });
    draw();
  },
  react(p, e) {
    const el = document.createElement('div'); el.className = 'react';
    el.style.cssText = `left:${6 + Math.random() * 84}%;--c:${p.color};--dx:${(Math.random() - .5) * 12}rem`;
    el.innerHTML = `<b>${esc(e)}</b><span>${p.emoji ? esc(p.emoji) + ' ' : ''}${esc(p.name)}</span>`;
    document.body.appendChild(el); SFX('react');
    setTimeout(() => el.remove(), 4200);
  },
  // stan z lokalnego silnika gry (tryb „każdy swój telefon”)
  local(st) { if (TV.mode !== 'multi') return; S = st; recvAt = performance.now(); draw(); },
  setMode(m, keepState) {
    TV.mode = m || null;
    if (m) { try { localStorage.setItem('imp_tv_mode', m); } catch (e) {} }
    if (!keepState) S = null;
    fullKey = '';
    const want = m === 'multi' ? (TV.game === 'mafia' ? window.MafiaGame : window.TVGame) : null;
    [window.TVGame, window.MafiaGame].forEach(x => { if (x && x !== want && x.active) x.deactivate(); });
    if (want) { want.activate(); if (TV.rejoinAll) setTimeout(TV.rejoinAll, 50); }
    draw();
  },
};
const saveGame = g => { try { localStorage.setItem('imp_tv_game', g); } catch (e) {} };
const lastGame = () => { try { return localStorage.getItem('imp_tv_game') || 'impostor'; } catch (e) { return 'impostor'; } };
const GAMES = { impostor: { name: 'IMPOSTOR', emoji: '🕵️' }, mafia: { name: 'MAFIA', emoji: '🌙' } };
const gameName = () => (GAMES[TV.game] || GAMES.impostor).name;
const lastMode = () => { try { return localStorage.getItem('imp_tv_mode') || 'single'; } catch (e) { return 'single'; } };
const MULTI = () => S && S.mode === 'multi';
const btn = (act, arg, html, cls = '', extra = '') => `<button class="tvbtn ${cls}" data-act="${act}" data-arg="${esc(arg)}" ${extra}>${html}</button>`;
const baseDir = () => location.pathname.replace(/[^/]*$/, '');
const playShort = () => location.host + baseDir() + 'play';
function hello() { senders.forEach(fn => { try { fn({ type: 'hello' }); } catch (e) {} }); }
setInterval(hello, 4000);

const netTxt = () => ({ ready: 'gotowe do połączenia', connecting: 'łączenie z serwerem…', offline: 'brak internetu – ponawiam…' }[NET] || '');
const joinUrl = () => { const u = new URL(TV.mode === 'multi' ? 'play.html' : TV.game === 'mafia' ? 'mafia.html' : 'index.html', location.href); u.searchParams.set('tv', CODE); return u.href; };
function drawQR() {
  const el = stage.querySelector('#qr'); if (!el || !CODE || !window.qrcode) return;
  try { const q = qrcode(0, 'M'); q.addData(joinUrl()); q.make(); el.innerHTML = q.createSvgTag({ cellSize: 8, margin: 0, scalable: true }); } catch (e) {}
}
const P = id => S.players.find(p => p.id === id);
function every(ms, fn) { const t = setInterval(fn, ms); loops.push(t); fn(); }
function clearLoops() { loops.forEach(clearInterval); loops = []; }

/* ---------- zegar ---------- */
let lastTickSec = -1;
function timerLeft() {
  const t = S && S.timer; if (!t) return 0;
  return t.running ? Math.max(0, t.left - (performance.now() - recvAt)) : t.left;
}
setInterval(() => {
  // koniec czasu (także gdy gra od razu przeszła dalej): brzęczyk
  const secNow = S && S.timer && S.timer.running ? Math.ceil(timerLeft() / 1000) : 0;
  if (lastTickSec === 1 && (secNow === 0 || secNow > 5)) { SFX('buzzer'); lastTickSec = secNow; }
  if (!S || !S.timer) { lastTickSec = 0; return; }
  const left = timerLeft(), frac = S.timer.total ? left / (S.timer.total * 1000) : 0;
  stage.querySelectorAll('.tv-timer').forEach(el => { el.textContent = fmt(left); el.classList.toggle('low', left < 10000 && left > 0); });
  stage.querySelectorAll('.tv-ring').forEach(el => { el.style.strokeDashoffset = String(100 - Math.max(0, Math.min(1, frac)) * 100); el.classList.toggle('low', left < 10000); });
  const sec = Math.ceil(left / 1000);
  if (S.timer.running && left > 0 && sec <= 10 && sec !== lastTickSec && (scene === 'discuss' || scene === 'vote')) SFX(sec <= 3 ? 'tock' : 'tick');
  lastTickSec = sec;
}, 200);
const ring = (cls = '') => `<div class="ringbox ${cls}"><svg viewBox="0 0 120 120"><circle class="rbg" cx="60" cy="60" r="52"/><circle class="rfg tv-ring" cx="60" cy="60" r="52" pathLength="100"/></svg><div class="tv-timer">${S.timer ? fmt(timerLeft()) : '∞'}</div></div>`;

/* ---------- sceny ---------- */
const HOW = [
  ['📱', 'Jeden telefon krąży', 'Host podaje telefon kolejnym graczom. Na tym ekranie widać, czyja teraz kolej.'],
  ['👆', 'Przytrzymaj kafelek', 'Przytrzymaj palcem, aby podnieść kafelek i zobaczyć słowo. Puść — schowa się. Podaj dalej.'],
  ['🕵️', 'Impostor nie zna słowa', 'Zamiast słowa widzi „IMPOSTOR” i czasem małą podpowiedź. Musi blefować!'],
  ['💬', 'Mówcie skojarzenia', 'Po kolei każdy mówi jedno słowo kojarzące się z hasłem. Nie za oczywiste — impostor słucha!'],
  ['🗳️', 'Głosowanie', 'Na trzy wskażcie podejrzanego. Potem impostor wybiera słowo z 10 na ekranie — trafi, to +2!'],
  ['🤡', 'Tryb trolla', 'Czasem… WSZYSCY są impostorami. Odważycie się to zgłosić?'],
];
const TIPS = ['Mów jedno skojarzenie — krótko!', 'Nie bądź zbyt oczywisty, impostor słucha 👂', 'Impostorze: udawaj pewność siebie 😎', 'Obserwujcie, kto się waha 🤔', 'Kto mówi za ogólnie? 🧐'];

const SCENES = {
  game: () => `<div class="scene center modesel gamesel">
    <div class="logo-big glitch" data-t="GRY IMPREZOWE">GRY IMPREZOWE</div>
    <p class="big-p">W co gramy?</p>
    <div class="modes">
      ${btn('game', 'impostor', '<div class="me">🕵️</div><b>Impostor</b><span>Wszyscy znają słowo… oprócz jednej osoby. Znajdźcie kłamcę!</span>', 'mode-card', lastGame() === 'impostor' ? 'data-focus' : '')}
      ${btn('game', 'mafia', '<div class="me">🌙</div><b>Mafia</b><span>Noc, mafia, policjant i lekarz. Miasto kontra mafia.</span>', 'mode-card mafia-card', lastGame() === 'mafia' ? 'data-focus' : '')}
    </div>
    <p class="muted">🎮 Pilot: strzałki i OK</p></div>`,

  mode: () => `<div class="scene center modesel">
    ${btn('game', '', '← Zmień grę', 'ghost sm corner')}
    <div class="logo-big glitch" data-t="${gameName()}">${gameName()}</div>
    <p class="big-p">Jak gracie?</p>
    <div class="modes">
      ${btn('mode', 'single', '<div class="me">📱</div><b>Jeden telefon</b><span>Host podaje jeden telefon kolejnym graczom</span>', 'mode-card', lastMode() === 'single' ? 'data-focus' : '')}
      ${btn('mode', 'multi', `<div class="me">👥</div><b>Każdy swój telefon</b><span>Gracze dołączają kodem QR, ustawienia robisz pilotem na TV${TV.game === 'mafia' ? ' · karty mocy 🃏' : ''}</span>`, 'mode-card', lastMode() === 'multi' ? 'data-focus' : '')}
    </div>
    <p class="muted">🎮 Pilot: strzałki i OK</p></div>`,

  mlobby: () => `<div class="scene mlobby">
    <div class="mcol">
      <div class="mhead"><div class="logo-mid glitch" data-t="IMPOSTOR">IMPOSTOR</div><div class="muted">👥 każdy swój telefon</div></div>
      <div class="join panel"><div class="qr-box sm"><div id="qr"></div></div>
        <div class="join-t"><b>Dołączcie telefonem!</b><p>Zeskanuj QR albo wejdź na<br><span class="url">${esc(playShort())}</span><br>i wpisz kod:</p><div class="code-mid tv-code">${esc(CODE)}</div><div class="tv-net ${NET}">${netTxt()}</div></div></div>
      <div class="panel grow"><h3>Gracze <span id="pc"></span> <small>OK = usuń</small></h3><div class="mplayers" id="mp"></div></div>
    </div>
    <div class="mcol">
      <div class="panel"><h3>Zasady <small>OK = zmień</small></h3><div class="setgrid" id="ms"></div></div>
      <div class="panel grow"><h3>Kategorie <span id="cc"></span></h3><div class="catgrid" id="mc"></div></div>
      <div class="mactions">${btn('back', '', '← Tryb', 'ghost')}${btn('start', '', '▶ START RUNDY', 'primary big', 'data-focus')}</div>
    </div></div>`,

  mreveal: () => `<div class="scene center mreveal">
    <div class="round-tag">Runda ${S.round} · rozdawanie ról</div>
    <div class="phone-shake">📱</div>
    <div class="title">Sprawdźcie swoje telefony!</div>
    <p class="big-p">Przytrzymaj kafelek, zobacz słowo i kliknij <b>„Widziałem”</b></p>
    <div class="seen-grid" id="sg"></div>
    <div class="warn">🤫 Nie pokazuj ekranu innym!</div>
    ${btn('skipReveal', '', 'Nie czekaj na resztę ⏭', 'ghost sm')}</div>`,

  wait: () => `<div class="scene wait">
    ${btn('mode', '', '← Zmień tryb', 'ghost sm corner')}
    <div class="wait-l">
      <div class="logo-big glitch" data-t="${gameName()}">${gameName()}</div>
      <div class="spy">🕵️</div>
      <p class="big-p">Zeskanuj kod telefonem hosta</p>
      <p class="muted">albo otwórz grę na telefonie i wpisz kod:</p>
      <div class="code-big tv-code">${esc(CODE)}</div>
      <div class="tv-net ${NET}">${netTxt()}</div>
    </div>
    <div class="qr-box"><div id="qr"></div></div></div>`,

  lobby: () => `<div class="scene lobby">
    <div class="col">
      <div class="logo-big glitch" data-t="IMPOSTOR">IMPOSTOR</div>
      <div class="sub">Kto z was kłamie? 🕵️</div>
      <div class="panel grow"><h3>Gracze <span id="pc"></span></h3><div class="pgrid" id="lp"></div></div>
      <div class="chips" id="ls"></div>
    </div>
    <div class="col narrow">
      <div class="panel how"><h3>Jak grać</h3><div id="how" class="how-body"></div><div class="dots" id="howdots"></div></div>
      <div class="panel"><h3>Punkty</h3>
        <ul class="rules"><li><b>+1</b> kto dobrze zagłosował, gdy impostor odpadł</li><li><b>+2</b> impostor, który nie został złapany</li><li><b>+2</b> impostor, który zgadnie słowo</li><li><b>+1</b> kto głosował „troll”, gdy go wykryliście 🤡</li></ul></div>
    </div>
    <div class="footer"><span class="pulse">Host: wciśnij <b>START RUNDY</b> na telefonie</span></div>
    <div class="code-corner">Kod TV: <b class="tv-code">${esc(CODE)}</b></div></div>`,

  reveal: () => {
    const R = S.R, id = R.peek || R.order[R.idx], p = P(id);
    const look = R.stage === 'look';
    return `<div class="scene reveal">
      <div class="round-tag">${R.peek ? 'Przypomnienie' : 'Runda ' + S.round + ' · rozdawanie ról'}</div>
      <div class="pass-box ${look ? 'looking' : ''}">
        ${look ? `<div class="eyes">🙈</div><div class="kicker">Teraz patrzy</div>`
               : `<div class="phone-fly">📱</div><div class="kicker">Podajcie telefon do</div>`}
        ${av(p, 'huge bounce')}
        <div class="name-big" style="color:${p.color}">${esc(p.name)}</div>
        ${look ? '<div class="warn">🤫 Nie podglądać!</div>' : ''}
      </div>
      <div class="instr">
        <div class="ins ${look ? '' : 'act'}"><span>1</span><p>Weź telefon i kliknij <b>„To ja”</b></p></div>
        <div class="ins ${look ? 'act' : ''}"><span>2</span><p><b>Przytrzymaj</b> kafelek, aby zobaczyć słowo</p></div>
        <div class="ins"><span>3</span><p>Puść i kliknij <b>„Podaj dalej”</b></p></div>
      </div>
      ${R.peek ? '' : `<div class="queue">${R.order.map((qid, i) => { const q = P(qid); if (!q) return ''; const cls = i < R.idx ? 'done' : i === R.idx ? 'cur' : ''; return `<div class="q ${cls}">${av(q, 'sm')}<span>${esc(q.name)}</span>${i < R.idx ? '<i>✔</i>' : ''}</div>`; }).join('')}</div>`}
    </div>`;
  },

  ready: () => {
    const st = P(S.R.starter);
    return `<div class="scene center">
      <div class="check pop">✔</div>
      <h1 class="title">Wszyscy znają swoje role!</h1>
      <p class="big-p">${MULTI() ? 'Schowajcie telefony — zaraz dyskusja' : 'Oddajcie telefon hostowi'}</p>
      <div class="starter rise">Zaczyna ${av(st, 'md')} <b style="color:${st.color}">${esc(st.name)}</b></div></div>`;
  },

  discuss: () => {
    const R = S.R, ids = R.order, si = Math.max(0, ids.indexOf(R.starter));
    const ord = [...ids.slice(si), ...ids.slice(0, si)].map(P).filter(Boolean);
    return `<div class="scene discuss">
      <div class="kicker top">💬 Dyskusja · runda ${S.round}</div>
      ${ring('xl')}
      <div class="starter">Zaczyna ${av(P(R.starter), 'md')} <b>${esc(P(R.starter).name)}</b></div>
      <div class="order">${ord.map((p, i) => `<div class="o" style="animation-delay:${i * 80}ms">${av(p, 'sm')}<span>${esc(p.name)}</span></div>${i < ord.length - 1 ? '<em>➜</em>' : ''}`).join('')}</div>
      <div class="tip" id="tip"></div>
      ${MULTI() ? btn('voteNow', '', '🗳️ Głosujemy teraz', 'primary', 'data-focus') : ''}</div>`;
  },

  vote: () => {
    const rows = (S.R.ids ? S.R.ids.map(P).filter(Boolean) : S.players).map(p => ({ id: p.id, html: `${av(p, 'sm')}<span>${esc(p.name)}</span>`, c: p.color }));
    if (S.R.trollVote) rows.push({ id: 'troll', html: '<div class="av sm" style="--c:#ffd43b">🤡</div><span>Troll – wszyscy!</span>', c: '#ffd43b' });
    return `<div class="scene vote">
      <div class="vote-head">${ring('md')}<div><div class="title">🗳️ GŁOSOWANIE</div>${MULTI()
        ? `<p class="big-p">Głosujcie na swoich telefonach! <b id="vc"></b></p>${btn('endVote', '', 'Zakończ głosowanie ⏭', 'ghost sm')}`
        : '<p class="big-p">Na trzy wskażcie podejrzanego!</p><div class="count321"><span>3</span><span>2</span><span>1</span><span>👉</span></div>'}</div></div>
      <div class="bars">${rows.map(r => `<div class="bar" data-id="${r.id}"><div class="bl">${r.html}</div><div class="track"><div class="fill" style="--c:${r.c}"></div><div class="voters"></div></div><b class="num">0</b></div>`).join('')}</div></div>`;
  },

  'res-accused': () => {
    const res = S.R.res, p = res.accused && res.accused !== 'troll' ? P(res.accused) : null;
    let out;
    if (res.accused === 'troll') out = `<div class="big-emoji">🤡</div><div class="name-big">TROLL!</div><p class="big-p">Uważacie, że wszyscy są impostorami</p>`;
    else if (p) out = `${av(p, 'huge')}<div class="name-big" style="color:${p.color}">${esc(p.name)}</div>`;
    else if (res.tie) out = `<div class="big-emoji">⚖️</div><div class="name-big">REMIS</div><p class="big-p">Nikt nie odpada…</p>`;
    else out = `<div class="big-emoji">🤷</div><div class="name-big">NIKT</div><p class="big-p">Nie oddaliście żadnego głosu</p>`;
    return `<div class="scene center accused">
      <div class="kicker">Wyrzucacie…</div>
      <div class="drum">🥁</div>
      <div class="late">${out}</div>
      <p class="muted late2">${MULTI() ? 'Za chwilę prawda…' : 'Host: odkryj impostora'}</p></div>`;
  },

  'res-impostors': () => {
    const res = S.R.res, imps = res.impostors.map(P).filter(Boolean);
    if (res.troll) return `<div class="scene center troll">
      <div class="clown">🤡</div>
      <div class="title glitch" data-t="TROLL!">TROLL!</div>
      <p class="big-p">WSZYSCY BYLI IMPOSTORAMI!</p>
      <div class="imps">${S.players.map((p, i) => `<div class="imp-card spin" style="animation-delay:${i * 90}ms">${av(p, 'md')}<span>${esc(p.name)}</span></div>`).join('')}</div></div>`;
    const acc = res.accused && res.accused !== 'troll' ? P(res.accused) : null;
    const stamp = acc ? `<div class="verdict">${av(acc, 'md')}<b>${esc(acc.name)}</b><div class="stamp ${res.wasImp ? 'yes' : 'no'}">${res.wasImp ? 'BYŁ IMPOSTOREM' : 'NIE BYŁ IMPOSTOREM'}</div></div>` : '';
    return `<div class="scene center impostors ${res.wasImp ? 'win' : 'lose'}">
      <div class="toprow">${stamp}
        <div class="late imp-col"><div class="kicker">${imps.length > 1 ? 'Impostorami byli' : 'Impostorem był'}</div>
        <div class="imps">${imps.map((p, i) => `<div class="imp-card red" style="animation-delay:${1.6 + i * .2}s">${av(p, 'lg')}<span>${esc(p.name)}</span></div>`).join('')}</div></div></div>
      ${res.fake ? `<div class="lastchance late2">🎭 Podwójny agent! Impostor miał słowo: <b class="fake">${esc(res.fake)}</b></div>`
        : `<div class="lastchance late2">🎯 Ostatnia szansa! ${MULTI() ? 'Impostorze, wybierz słowo na swoim telefonie' : 'Impostorze, które to słowo?'}</div>
      ${optGrid(res, false)}
      ${MULTI() ? `<div class="row-c late2">${ring('xs')}${btn('showWord', '', 'Pokaż słowo ⏭', 'ghost sm')}</div>` : ''}`}</div>`;
  },

  'res-word': () => {
    const res = S.R.res;
    const word = res.word ? `<div class="kicker">Słowo to</div><div class="word">${[...res.word].map((ch, i) => `<span style="animation-delay:${i * 70}ms">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`).join('')}</div>
      <div class="cat">${esc(res.cat)} · podpowiedź: <i>${esc(res.group)}</i></div>` : '<div class="clown sm">🤡</div>';
    const guessed = (res.guessed || []).map(P).filter(Boolean);
    const gained = S.players.filter(p => p.delta > 0);
    return `<div class="scene center wordscene">
      ${word}
      ${res.fake ? `<div class="fakeline">🎭 Impostor miał: <b>${esc(res.fake)}</b></div>` : ''}
      <div class="headline">${esc(res.headline)}</div>
      ${res.options && res.options.length && Object.keys(res.picks || {}).length ? optGrid(res, true) : ''}
      ${guessed.length ? `<div class="guessed">🎯 ${guessed.map(p => esc(p.name)).join(', ')} ${guessed.length > 1 ? 'zgadli' : 'zgadł'} słowo! +2</div>` : ''}
      <div class="gains">${gained.map((p, i) => `<div class="gain" style="animation-delay:${1 + i * .12}s">${av(p, 'sm')}<span>${esc(p.name)}</span><b>+${p.delta}</b></div>`).join('') || '<span class="muted">Nikt nie zdobył punktów</span>'}</div>
      ${MULTI() ? btn('scores', '', '🏆 Tabela wyników', 'primary', 'data-focus') : ''}</div>`;
  },

  scores: () => {
    const list = [...S.players].sort((a, b) => b.score - a.score);
    if (S.final && S.final.length) {
      const w = S.final.map(P).filter(Boolean), pod = list.slice(0, 3);
      const order = [pod[1], pod[0], pod[2]].filter(Boolean);
      return `<div class="scene center final">
        <div class="kicker">Koniec gry!</div>
        <div class="title glitch" data-t="ZWYCIĘZCA">${w.length > 1 ? 'ZWYCIĘZCY' : 'ZWYCIĘZCA'}</div>
        <div class="podium">${order.map(p => { const place = list.indexOf(p) + 1; return `<div class="pod p${place}">
          ${place === 1 ? '<div class="crown">👑</div>' : ''}${av(p, place === 1 ? 'lg' : 'md')}<b>${esc(p.name)}</b><span>${p.score} pkt</span>
          <div class="block">${place}</div></div>`; }).join('')}</div>
        ${MULTI() ? `<div class="mactions c">${btn('lobby', '', '⚙️ Ustawienia', 'ghost')}${btn('newGame', '', '🔄 Nowa gra', 'primary big', 'data-focus')}</div>`
          : '<div class="footer"><span class="pulse">Host: nowa gra?</span></div>'}</div>`;
    }
    const max = Math.max(1, ...list.map(p => p.score));
    return `<div class="scene scores">
      <div class="title">🏆 Tabela wyników</div><div class="kicker">${S.game === 'mafia' ? 'po partii ' + S.games : 'po rundzie ' + S.round}</div>
      <div class="board">${list.map((p, i) => `<div class="brow" style="animation-delay:${i * 90}ms">
        <div class="place">${i === 0 && p.score > 0 ? '👑' : i + 1}</div>${av(p, 'sm')}<div class="bn">${esc(p.name)}</div>
        <div class="track"><div class="fill" style="--c:${p.color};--w:${(p.score / max) * 100}%"></div></div>
        <div class="sc">${p.score}${p.delta ? `<i>+${p.delta}</i>` : ''}</div></div>`).join('')}</div>
      ${MULTI() ? `<div class="mactions c">${btn('lobby', '', '⚙️ Ustawienia', 'ghost')}${btn('next', '', '▶ Następna runda', 'primary big', 'data-focus')}</div>`
        : '<div class="footer"><span class="pulse">Host: następna runda?</span></div>'}</div>`;
  },
};

function optGrid(res, reveal) {
  return `<div class="tvopts ${reveal ? 'small' : 'late2'}">${(res.options || []).map((w, i) => {
    const who = Object.keys(res.picks || {}).filter(id => res.picks[id] === w).map(P).filter(Boolean);
    const cls = reveal ? (w === res.word ? 'good' : who.length ? 'bad' : 'dim') : who.length ? 'on' : '';
    return `<div class="tvopt ${cls}" data-w="${esc(w)}" style="animation-delay:${reveal ? 0 : 2.6 + i * .08}s"><span>${esc(w)}</span><div class="pk">${who.map(p => av(p, 'xs')).join('')}</div></div>`;
  }).join('')}</div>`;
}

/* ---------- aktualizacje bez przeładowania sceny ---------- */
const UPDATE = {
  lobby() {
    const lp = stage.querySelector('#lp'); if (!lp) return;
    lp.innerHTML = S.players.length ? S.players.map(p => `<div class="pc ${known.has(p.id) ? '' : 'new'}">${av(p, 'md')}<span>${esc(p.name)}</span>${p.score ? `<small>${p.score} pkt</small>` : ''}</div>`).join('')
      : '<div class="muted empty">Dodaj graczy w aplikacji hosta…</div>';
    S.players.forEach(p => known.add(p.id));
    stage.querySelector('#pc').textContent = S.players.length ? `(${S.players.length})` : '';
    const st = S.settings, cats = st.cats.length === st.allCats ? ['🎲 Wszystkie kategorie'] : st.cats;
    stage.querySelector('#ls').innerHTML = [
      GM[st.gmode] || '', st.goal ? `🏁 Gra do ${st.goal} pkt` : '',
      `🕵️ Impostorów: ${st.impostors}`, st.hint ? '💡 Z podpowiedzią' : '🚫 Bez podpowiedzi',
      st.troll ? `🤡 Troll ${st.troll}%` : '', `⏱️ Dyskusja: ${st.discuss ? st.discuss / 60 + ' min' : 'bez limitu'}`, `🗳️ Głosowanie: ${st.vote} s`,
      ...cats.slice(0, 8), cats.length > 8 ? `+${cats.length - 8} kategorii` : '',
    ].filter(Boolean).map(t => `<span class="chip">${esc(t)}</span>`).join('');
  },
  vote() {
    const vc = stage.querySelector('#vc'); if (vc) vc.textContent = `(${Object.keys(S.R.ballots || {}).length}/${(S.R.ids || S.players).length})`;
    const v = S.R.votes || {}, max = Math.max(1, ...Object.values(v));
    stage.querySelectorAll('.bar').forEach(b => {
      const n = v[b.dataset.id] || 0, num = b.querySelector('.num');
      b.querySelector('.fill').style.width = (n / max) * 100 + '%';
      if (num.textContent !== String(n)) { num.textContent = n; num.classList.remove('bump'); void num.offsetWidth; num.classList.add('bump'); }
      b.classList.toggle('lead', n > 0 && n === max);
      const B = S.R.ballots || {}, vs = Object.keys(B).filter(v => B[v] === b.dataset.id);
      const box = b.querySelector('.voters'), key = vs.join(',');
      if (box.dataset.k !== key) { box.dataset.k = key; box.innerHTML = vs.map(P).filter(Boolean).map(p => av(p, 'xs')).join(''); }
    });
  },
};
UPDATE['res-impostors'] = () => {
  const res = S.R.res; if (res.troll) return;
  stage.querySelectorAll('.tvopt').forEach(el => {
    const w = el.dataset.w, who = Object.keys(res.picks || {}).filter(id => res.picks[id] === w).map(P).filter(Boolean);
    const k = who.map(p => p.id).join(','), pk = el.querySelector('.pk');
    if (pk.dataset.k === k) return;
    pk.dataset.k = k; pk.innerHTML = who.map(p => av(p, 'xs')).join('');
    el.classList.toggle('on', who.length > 0);
  });
};
UPDATE.mlobby = () => {
  const st = S.settings;
  stage.querySelector('#pc').textContent = `(${S.players.length})`;
  stage.querySelector('#mp').innerHTML = S.players.length
    ? S.players.map(p => btn('kick', p.id, `${av(p, 'sm')}<span>${esc(p.name)}</span>${p.score ? `<small>${p.score}</small>` : ''}${p.online ? '' : '<i>📵</i>'}`, 'pchip ' + (p.online ? '' : 'off'))).join('')
    : '<div class="muted empty">Nikt jeszcze nie dołączył…<br>Zeskanujcie QR telefonami 📱</div>';
  stage.querySelector('#ms').innerHTML = [
    btn('set', 'impostors', `🕵️ Impostorów: <b>${st.impostors}</b>`, 'opt'),
    btn('set', 'hint', `💡 Podpowiedź: <b>${st.hint ? 'tak' : 'nie'}</b>`, 'opt'),
    btn('set', 'troll', `🤡 Troll: <b>${st.troll ? st.troll + '%' : 'wył'}</b>`, 'opt'),
    btn('set', 'discuss', `⏱️ Dyskusja: <b>${st.discuss ? st.discuss / 60 + ' min' : '∞'}</b>`, 'opt'),
    btn('set', 'vote', `🗳️ Głosowanie: <b>${st.vote} s</b>`, 'opt'),
    btn('set', 'gmode', `Tryb: <b>${GM[st.gmode] || GM.classic}</b>`, 'opt wide'),
    btn('set', 'goal', `🏁 Gra do: <b>${st.goal ? st.goal + ' pkt' : '∞'}</b>`, 'opt'),
  ].join('');
  const on = (st.catList || []).filter(c => c.on);
  stage.querySelector('#cc').textContent = `(${on.length}/${(st.catList || []).length} · ${on.reduce((s, c) => s + c.n, 0)} słów)`;
  stage.querySelector('#mc').innerHTML = (st.catList || []).length
    ? btn('allCats', '', '✅ Wszystkie', 'cat util') + btn('noCats', '', '⬜ Żadna', 'cat util') + st.catList.map(c => btn('cat', c.id, `${c.emoji} ${esc(c.name)}`, 'cat ' + (c.on ? 'on' : ''))).join('')
    : '<div class="muted">Ładowanie słów…</div>';
};
let seenPrev = new Set();
UPDATE.mreveal = () => {
  const R = S.R, sg = stage.querySelector('#sg');
  const ps = R.ids.map(P).filter(Boolean);
  const key = ps.map(p => p.id + R.seen.includes(p.id) + p.online).join(',');
  if (sg.dataset.k === key) return;
  if (!sg.dataset.k) seenPrev = new Set();
  sg.dataset.k = key;
  sg.innerHTML = ps.map(p => {
    const ok = R.seen.includes(p.id), fresh = ok && !seenPrev.has(p.id);
    return `<div class="sg ${ok ? 'ok' : ''} ${fresh ? 'just' : ''} ${p.online ? '' : 'off'}">${av(p, 'md')}<span>${esc(p.name)}</span><i>${ok ? '✔' : p.online ? '⏳' : '📵'}</i></div>`;
  }).join('');
  seenPrev = new Set(R.seen);
};
const MOUNT = {
  wait() { drawQR(); },
  mlobby() { drawQR(); },
  lobby() {
    let i = 0;
    const box = stage.querySelector('#how'), dots = stage.querySelector('#howdots');
    dots.innerHTML = HOW.map(() => '<i></i>').join('');
    every(5500, () => {
      const [e, t, d] = HOW[i % HOW.length];
      box.innerHTML = `<div class="how-step"><div class="how-e">${e}</div><b>${t}</b><p>${d}</p></div>`;
      [...dots.children].forEach((el, k) => el.classList.toggle('on', k === i % HOW.length));
      i++;
    });
  },
  discuss() { SFX('whoosh'); let i = 0; const el = stage.querySelector('#tip'); every(6000, () => { el.innerHTML = `<span>${TIPS[i++ % TIPS.length]}</span>`; }); },
  'res-word'() { const res = S.R.res; if (res.troll || res.wasImp) { confetti(); SFX('fanfare'); } else { flash(); SFX('wah'); } },
  'res-impostors'() { const r = S.R.res; if (r.troll) { confetti(); SFX('troll'); SFX('clown', 3.2); } else { if (r.accused && r.accused !== 'troll') SFX('stamp', 0.3); SFX(r.fake ? 'reveal' : 'impostor', 1.3); } },
  'res-accused'() { SFX('drum'); },
  scores() { if (S.final && S.final.length) { confetti(160); setTimeout(() => confetti(120), 1500); SFX('win'); } else { confetti(40); SFX('reveal'); } },
  ready() { SFX('ding'); },
  vote() { SFX(MULTI() ? 'blip' : 'count'); },
};

// rozszerzenia (np. js/tv-mafia.js) rejestrują własne sceny i dostają pomocnicze funkcje
TV.reg = (name, def) => { SCENES[name] = def.html; if (def.update) UPDATE[name] = def.update; if (def.mount) MOUNT[name] = def.mount; };
TV.h = { esc, av, btn, ring, SFX, confetti: (n) => confetti(n), flash: () => flash(), P: id => P(id), get S() { return S; }, MULTI, drawQR, every, playShort, netTxt, code: () => CODE, net: () => NET, timerLeft: () => timerLeft() };
function sceneKey() {
  if (!S) return !TV.game ? 'game' : TV.mode === 'single' ? 'wait' : 'mode';
  if (S.game === 'mafia') return S.phase === 'setup' ? (MULTI() ? 'ma-mlobby' : 'ma-lobby') : S.phase === 'scores' ? 'scores' : 'ma-' + S.phase;
  const R = S.R || {};
  switch (S.phase) {
    case 'setup': return MULTI() ? 'mlobby' : 'lobby';
    case 'reveal': return MULTI() ? 'mreveal' : 'reveal';
    case 'result': return 'res-' + R.res.step;
    default: return S.phase;
  }
}
let fullKey = '';
function draw() {
  const k = sceneKey();
  const R = S && S.R;
  const fk = k + (k === 'reveal' ? (R.peek || R.idx) + R.stage : '') + (S ? S.round : '') + (S && S.game === 'mafia' ? '|' + S.games + '|' + S.day + '|' + (S.pass ? S.pass.idx + S.pass.stage : '') : '');
  const fkey = focusKey();
  if (fk !== fullKey) {
    if (k === 'reveal' || k === 'mreveal') SFX(scene === 'reveal' || scene === 'mreveal' ? 'whoosh' : 'start');
    fullKey = fk; scene = k; clearLoops();
    if (window.Sfx) Sfx.music(musicFor(k));
    stage.innerHTML = SCENES[k]();
    stage.firstElementChild.classList.add('enter');
    if (MOUNT[k]) MOUNT[k]();
    if (UPDATE[scene]) UPDATE[scene]();
    restoreFocus(null);
  } else if (UPDATE[scene]) { UPDATE[scene](); restoreFocus(fkey); }
  showToast(S && S.msg);
  eventSounds();
  if (TV.onDraw) TV.onDraw(S, scene);
}
// dźwięki zdarzeń: ktoś dołączył, ktoś zobaczył słowo, ktoś zagłosował / wybrał słowo
let ev = { players: -1, seen: -1, votes: -1, picks: -1, round: -1 };
function eventSounds() {
  if (!S) return;
  const R = S.R || {}, res = R.res || {};
  const now = { players: S.players.length, seen: (R.seen || []).length, votes: Object.keys(R.ballots || {}).length, picks: Object.keys(res.picks || {}).length, round: S.round };
  if (now.round === ev.round) {
    if (now.players > ev.players && ev.players >= 0) SFX('join');
    if (now.seen > ev.seen && ev.seen >= 0) SFX('ding');
    if (now.votes > ev.votes && ev.votes >= 0) SFX('blip');
    if (now.picks > ev.picks && ev.picks >= 0) SFX('blip');
  }
  ev = now;
}

// muzyka zależna od ekranu i trybu gry
function musicFor(k) {
  if (k.startsWith('ma-') || (S && S.game === 'mafia' && k === 'scores')) return TV.mafiaMusic ? TV.mafiaMusic(k) : null;
  if (k === 'game') return 'menu';
  const gm = S && S.settings && S.settings.gmode;
  if (k === 'mode' || k === 'wait' || k === 'reveal' || k === 'mreveal' || k === 'ready') return 'menu';
  if (k === 'lobby' || k === 'mlobby') return 'lobby';
  if (k === 'discuss') return gm === 'double' ? 'double' : gm === 'blitz' ? 'blitz' : 'tension';
  if (k === 'vote') return gm === 'blitz' ? 'blitz' : 'vote';
  if (k === 'scores') return 'victory';
  return null;
}

/* ---------- pilot: strzałki + OK ---------- */
const NAV = '.tvbtn';
const focusables = () => [...document.querySelectorAll(NAV)].filter(el => !el.disabled && el.offsetParent !== null);
function focusKey() { const a = document.activeElement; return a && a.matches && a.matches(NAV) ? a.dataset.act + '|' + a.dataset.arg : null; }
function restoreFocus(key) {
  const els = focusables(); if (!els.length) return;
  let el = key && els.find(e => e.dataset.act + '|' + e.dataset.arg === key);
  if (!el) { const a = document.activeElement; if (a && els.includes(a)) return; el = els.find(e => e.hasAttribute('data-focus')) || els[0]; }
  try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
}
function move(dx, dy) {
  const els = focusables(); if (!els.length) return;
  const cur = document.activeElement;
  if (!els.includes(cur)) return restoreFocus(null);
  const r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let best = null, bs = Infinity;
  for (const el of els) {
    if (el === cur) continue;
    const q = el.getBoundingClientRect(), ex = q.left + q.width / 2, ey = q.top + q.height / 2;
    const along = dx ? (ex - cx) * dx : (ey - cy) * dy;
    if (along <= 2) continue;
    const across = dx ? Math.abs(ey - cy) : Math.abs(ex - cx);
    const score = along + across * 2.2;
    if (score < bs) { bs = score; best = el; }
  }
  if (best) { best.focus(); best.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
}
document.addEventListener('keydown', e => {
  const k = e.key, kc = e.keyCode;
  const d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[k] || { 38: [0, -1], 40: [0, 1], 37: [-1, 0], 39: [1, 0] }[kc];
  if (d) { e.preventDefault(); move(d[0], d[1]); return; }
  if (k === 'Enter' || kc === 13 || k === ' ') {
    const a = document.activeElement;
    if (a && a.matches && a.matches(NAV)) { e.preventDefault(); a.click(); } else { e.preventDefault(); restoreFocus(null); }
    return;
  }
  if (k === 'Backspace' || k === 'Escape' || k === 'GoBack' || kc === 461 || kc === 10009 || kc === 8) {
    e.preventDefault();
    if (scene === 'wait' || scene === 'mlobby' || scene === 'ma-mlobby') TV.setMode(null);
    else if (scene === 'mode') TV.setGame(null);
  }
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act, arg = b.dataset.arg;
  if (act === 'mute') { if (window.Sfx) Sfx.toggle(); }
  else if (act === 'game') TV.setGame(arg || null);
  else if (act === 'mode') TV.setMode(arg || null);
  else if (S && S.game === 'mafia' && window.MafiaGame) MafiaGame.action(act, arg);
  else if (window.TVGame) TVGame.action(act, arg);
});
let curT = null;
document.addEventListener('mousemove', () => { document.body.classList.remove('nocur'); clearTimeout(curT); curT = setTimeout(() => document.body.classList.add('nocur'), 3000); });
let toastEl = null;
function showToast(t) {
  if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; document.body.appendChild(toastEl); }
  toastEl.textContent = t || ''; toastEl.classList.toggle('on', !!t);
}

/* ---------- efekty ---------- */
function confetti(n = 90) {
  const box = document.createElement('div'); box.className = 'confetti';
  const cols = ['#ff3d71', '#ffc53d', '#2ee59d', '#4dabf7', '#cc5de8', '#ff8a3d'];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i');
    c.style.cssText = `left:${Math.random() * 100}%;background:${cols[i % cols.length]};animation-delay:${Math.random() * 0.8}s;animation-duration:${2.2 + Math.random() * 1.8}s;--x:${(Math.random() - .5) * 30}vw;--r:${Math.random() * 1080}deg`;
    box.appendChild(c);
  }
  stage.appendChild(box);
  setTimeout(() => box.remove(), 5000);
}
function flash() { const f = document.createElement('div'); f.className = 'redflash'; stage.appendChild(f); setTimeout(() => f.remove(), 1800); }

// przycisk dźwięku (pilotem: strzałka w górę do prawego rogu → OK)
const muteBtn = document.createElement('button');
muteBtn.className = 'tvbtn ghost sm mute'; muteBtn.dataset.act = 'mute'; muteBtn.dataset.arg = '';
document.body.appendChild(muteBtn);
const muteTxt = () => { muteBtn.textContent = !window.Sfx ? '' : Sfx.muted ? '🔇 Dźwięk wył.' : Sfx.locked ? '🔈 OK = włącz dźwięk' : '🔊'; };
muteTxt(); if (window.Sfx) Sfx.onChange(muteTxt); setInterval(muteTxt, 2000);
// po starcie: tryb z adresu (?mode=multi / ?mode=single), inaczej ekran wyboru
{
  const q = new URLSearchParams(location.search), m = q.get('mode'), g = q.get('game');
  document.addEventListener('DOMContentLoaded', () => {
    if (g === 'mafia' || g === 'impostor') { TV.game = g; saveGame(g); }
    if (TV.game && (m === 'multi' || m === 'single')) TV.setMode(m); else if (m === 'multi' || m === 'single') { TV.game = 'impostor'; TV.setMode(m); } else draw();
  });
}
draw();
})();
