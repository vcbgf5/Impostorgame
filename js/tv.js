/* Impostor – ekran telewizora (Chromecast / karta / Presentation API) */
(() => {
'use strict';
const stage = document.getElementById('stage');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ini = n => esc((n || '?').trim().charAt(0).toUpperCase());
const fmt = ms => { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const av = (p, cls = '', style = '') => p ? `<div class="av ${cls}" style="--c:${p.color};${style}">${ini(p.name)}</div>` : '';

let S = null, recvAt = 0, scene = '', known = new Set(), loops = [];
const senders = [];
let CODE = '', NET = 'connecting';
const TV = window.TV = {
  addSender(fn) { senders.push(fn); hello(); },
  setCode(code, net) {
    const changed = code !== CODE;
    CODE = code; NET = net;
    if (changed && (scene === 'wait' || scene === 'lobby')) { fullKey = ''; draw(); }
    stage.querySelectorAll('.tv-code').forEach(el => { el.textContent = CODE; });
    stage.querySelectorAll('.tv-net').forEach(el => { el.textContent = netTxt(); el.className = 'tv-net ' + NET; });
  },
  onMessage(m) {
    if (typeof m === 'string') { try { m = JSON.parse(m); } catch (e) { return; } }
    if (!m || m.type !== 'state' || !m.state) return;
    S = m.state; recvAt = performance.now(); draw();
  },
};
function hello() { senders.forEach(fn => { try { fn({ type: 'hello' }); } catch (e) {} }); }
setInterval(hello, 4000);

const netTxt = () => ({ ready: 'gotowe do połączenia', connecting: 'łączenie z serwerem…', offline: 'brak internetu – ponawiam…' }[NET] || '');
const hostUrl = () => { const u = new URL('index.html', location.href); u.searchParams.set('tv', CODE); return u.href; };
function drawQR() {
  const el = stage.querySelector('#qr'); if (!el || !CODE || !window.qrcode) return;
  try { const q = qrcode(0, 'M'); q.addData(hostUrl()); q.make(); el.innerHTML = q.createSvgTag({ cellSize: 8, margin: 0, scalable: true }); } catch (e) {}
}
const P = id => S.players.find(p => p.id === id);
function every(ms, fn) { const t = setInterval(fn, ms); loops.push(t); fn(); }
function clearLoops() { loops.forEach(clearInterval); loops = []; }

/* ---------- zegar ---------- */
function timerLeft() {
  const t = S && S.timer; if (!t) return 0;
  return t.running ? Math.max(0, t.left - (performance.now() - recvAt)) : t.left;
}
setInterval(() => {
  if (!S || !S.timer) return;
  const left = timerLeft(), frac = S.timer.total ? left / (S.timer.total * 1000) : 0;
  stage.querySelectorAll('.tv-timer').forEach(el => { el.textContent = fmt(left); el.classList.toggle('low', left < 10000 && left > 0); });
  stage.querySelectorAll('.tv-ring').forEach(el => { el.style.strokeDashoffset = String(100 - Math.max(0, Math.min(1, frac)) * 100); el.classList.toggle('low', left < 10000); });
}, 200);
const ring = (cls = '') => `<div class="ringbox ${cls}"><svg viewBox="0 0 120 120"><circle class="rbg" cx="60" cy="60" r="52"/><circle class="rfg tv-ring" cx="60" cy="60" r="52" pathLength="100"/></svg><div class="tv-timer">${S.timer ? fmt(timerLeft()) : '∞'}</div></div>`;

/* ---------- sceny ---------- */
const HOW = [
  ['📱', 'Jeden telefon krąży', 'Host podaje telefon kolejnym graczom. Na tym ekranie widać, czyja teraz kolej.'],
  ['👆', 'Przytrzymaj kafelek', 'Przytrzymaj palcem, aby podnieść kafelek i zobaczyć słowo. Puść — schowa się. Podaj dalej.'],
  ['🕵️', 'Impostor nie zna słowa', 'Zamiast słowa widzi „IMPOSTOR” i czasem małą podpowiedź. Musi blefować!'],
  ['💬', 'Mówcie skojarzenia', 'Po kolei każdy mówi jedno słowo kojarzące się z hasłem. Nie za oczywiste — impostor słucha!'],
  ['🗳️', 'Głosowanie', 'Na trzy wskażcie podejrzanego. Złapany impostor ma jeszcze szansę zgadnąć słowo.'],
  ['🤡', 'Tryb trolla', 'Czasem… WSZYSCY są impostorami. Odważycie się to zgłosić?'],
];
const TIPS = ['Mów jedno skojarzenie — krótko!', 'Nie bądź zbyt oczywisty, impostor słucha 👂', 'Impostorze: udawaj pewność siebie 😎', 'Obserwujcie, kto się waha 🤔', 'Kto mówi za ogólnie? 🧐'];

const SCENES = {
  wait: () => `<div class="scene wait">
    <div class="wait-l">
      <div class="logo-big glitch" data-t="IMPOSTOR">IMPOSTOR</div>
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
        <ul class="rules"><li><b>+1</b> każdy z załogi, gdy złapiecie impostora</li><li><b>+2</b> impostor, który nie został złapany</li><li><b>+1</b> impostor, który zgadnie słowo</li><li><b>+2</b> wszyscy, gdy wykryją trolla 🤡</li></ul></div>
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
      <p class="big-p">Oddajcie telefon hostowi</p>
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
      <div class="tip" id="tip"></div></div>`;
  },

  vote: () => {
    const rows = S.players.map(p => ({ id: p.id, html: `${av(p, 'sm')}<span>${esc(p.name)}</span>`, c: p.color }));
    if (S.R.trollVote) rows.push({ id: 'troll', html: '<div class="av sm" style="--c:#ffd43b">🤡</div><span>Troll – wszyscy!</span>', c: '#ffd43b' });
    return `<div class="scene vote">
      <div class="vote-head">${ring('md')}<div><div class="title">🗳️ GŁOSOWANIE</div><p class="big-p">Na trzy wskażcie podejrzanego!</p><div class="count321"><span>3</span><span>2</span><span>1</span><span>👉</span></div></div></div>
      <div class="bars">${rows.map(r => `<div class="bar" data-id="${r.id}"><div class="bl">${r.html}</div><div class="track"><div class="fill" style="--c:${r.c}"></div></div><b class="num">0</b></div>`).join('')}</div></div>`;
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
      <p class="muted late2">Host: odkryj impostora</p></div>`;
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
      ${stamp}
      <div class="kicker late">${imps.length > 1 ? 'Impostorami byli' : 'Impostorem był'}</div>
      <div class="imps late">${imps.map((p, i) => `<div class="imp-card red" style="animation-delay:${1.6 + i * .2}s">${av(p, 'lg')}<span>${esc(p.name)}</span></div>`).join('')}</div>
      <div class="lastchance late2">🎯 Ostatnia szansa! Impostorze, zgadnij słowo na głos</div></div>`;
  },

  'res-word': () => {
    const res = S.R.res;
    const word = res.word ? `<div class="kicker">Słowo to</div><div class="word">${[...res.word].map((ch, i) => `<span style="animation-delay:${i * 70}ms">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`).join('')}</div>
      <div class="cat">${esc(res.cat)} · podpowiedź: <i>${esc(res.group)}</i></div>` : '<div class="clown sm">🤡</div>';
    const guessed = (res.guessed || []).map(P).filter(Boolean);
    const gained = S.players.filter(p => p.delta > 0);
    return `<div class="scene center wordscene">
      ${word}
      <div class="headline">${esc(res.headline)}</div>
      ${guessed.length ? `<div class="guessed">🎯 ${guessed.map(p => esc(p.name)).join(', ')} ${guessed.length > 1 ? 'zgadli' : 'zgadł'} słowo! +1</div>` : ''}
      <div class="gains">${gained.map((p, i) => `<div class="gain" style="animation-delay:${1 + i * .12}s">${av(p, 'sm')}<span>${esc(p.name)}</span><b>+${p.delta}</b></div>`).join('') || '<span class="muted">Nikt nie zdobył punktów</span>'}</div></div>`;
  },

  scores: () => {
    const list = [...S.players].sort((a, b) => b.score - a.score);
    const max = Math.max(1, ...list.map(p => p.score));
    return `<div class="scene scores">
      <div class="title">🏆 Tabela wyników</div><div class="kicker">po rundzie ${S.round}</div>
      <div class="board">${list.map((p, i) => `<div class="brow" style="animation-delay:${i * 90}ms">
        <div class="place">${i === 0 && p.score > 0 ? '👑' : i + 1}</div>${av(p, 'sm')}<div class="bn">${esc(p.name)}</div>
        <div class="track"><div class="fill" style="--c:${p.color};--w:${(p.score / max) * 100}%"></div></div>
        <div class="sc">${p.score}${p.delta ? `<i>+${p.delta}</i>` : ''}</div></div>`).join('')}</div>
      <div class="footer"><span class="pulse">Host: następna runda?</span></div></div>`;
  },
};

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
      `🕵️ Impostorów: ${st.impostors}`, st.hint ? '💡 Z podpowiedzią' : '🚫 Bez podpowiedzi',
      st.troll ? `🤡 Troll ${st.troll}%` : '', `⏱️ Dyskusja: ${st.discuss ? st.discuss / 60 + ' min' : 'bez limitu'}`, `🗳️ Głosowanie: ${st.vote} s`,
      ...cats.slice(0, 8), cats.length > 8 ? `+${cats.length - 8} kategorii` : '',
    ].filter(Boolean).map(t => `<span class="chip">${esc(t)}</span>`).join('');
  },
  vote() {
    const v = S.R.votes || {}, max = Math.max(1, ...Object.values(v));
    stage.querySelectorAll('.bar').forEach(b => {
      const n = v[b.dataset.id] || 0, num = b.querySelector('.num');
      b.querySelector('.fill').style.width = (n / max) * 100 + '%';
      if (num.textContent !== String(n)) { num.textContent = n; num.classList.remove('bump'); void num.offsetWidth; num.classList.add('bump'); }
      b.classList.toggle('lead', n > 0 && n === max);
    });
  },
};
const MOUNT = {
  wait() { drawQR(); },
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
  discuss() { let i = 0; const el = stage.querySelector('#tip'); every(6000, () => { el.innerHTML = `<span>${TIPS[i++ % TIPS.length]}</span>`; }); },
  'res-word'() { const res = S.R.res; if (res.troll || res.wasImp) confetti(); else flash(); },
  'res-impostors'() { if (S.R.res.troll) confetti(); },
  scores() { confetti(40); },
};

function sceneKey() {
  if (!S) return 'wait';
  const R = S.R || {};
  switch (S.phase) {
    case 'setup': return 'lobby';
    case 'reveal': return 'reveal';
    case 'result': return 'res-' + R.res.step;
    default: return S.phase;
  }
}
let fullKey = '';
function draw() {
  const k = sceneKey();
  const R = S && S.R;
  const fk = k + (k === 'reveal' ? (R.peek || R.idx) + R.stage : '') + (S ? S.round : '');
  if (fk !== fullKey) {
    fullKey = fk; scene = k; clearLoops();
    stage.innerHTML = SCENES[k]();
    stage.firstElementChild.classList.add('enter');
    if (MOUNT[k]) MOUNT[k]();
  }
  if (UPDATE[scene]) UPDATE[scene]();
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

draw();
})();
