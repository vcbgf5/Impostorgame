/* Kalambury – sceny na telewizorze (oba tryby) */
(() => {
'use strict';
const T = window.TV, H = T.h;
const { esc, av, btn, ring, SFX } = H;
const S = () => H.S;
const P = id => H.P(id);
const MULTI = () => H.MULTI();
const nm = id => { const p = P(id); return p ? p.name : '?'; };
const HOW = [
  ['✏️', 'Rysujesz po kolei', 'Każdy po kolei dostaje 3 hasła do wyboru i rysuje palcem na swoim telefonie.'],
  ['📺', 'Rysunek na żywo', 'Kreski pojawiają się od razu na telewizorze. Nie wolno pisać liter ani mówić!'],
  ['📣', 'Krzyczcie odpowiedzi', 'Zgadujecie na głos. Rysujący klika na telefonie, kto zgadł pierwszy.'],
  ['⭐', 'Trudność = punkty', 'Kto odgadnie: +2 pkt. Rysujący dostaje tyle, ile warte było słowo: ⭐ łatwe 1, ⭐⭐ średnie 2, ⭐⭐⭐ trudne 3.'],
  ['🔤', 'Podpowiedzi', 'W trakcie rundy telewizor odsłania kilka liter hasła.'],
];

/* ---------- płótno na TV (kreski na żywo) ---------- */
const TVS = { rid: -1, strokes: [], dirty: false };
const total = a => (a || []).reduce((s, x) => s + x.p.length, 0);
function syncStrokes(s) {
  if (!s || !s.strokes) return;
  if (s.roundId !== TVS.rid || total(s.strokes) >= total(TVS.strokes)) { TVS.rid = s.roundId; TVS.strokes = JSON.parse(JSON.stringify(s.strokes)); TVS.dirty = true; }
}
T.drawOps = m => {
  if (m.rid !== undefined && m.rid !== TVS.rid) { TVS.rid = m.rid; TVS.strokes = []; }
  if (m.clear) TVS.strokes = [];
  if (m.undo) TVS.strokes.pop();
  if (m.bg) { const b = document.querySelector('.drbox'); if (b) b.style.background = m.bg; }
  (m.ops || []).forEach(o => {
    let s = TVS.strokes.find(q => q.i === o.i);
    if (!s) { s = { i: o.i, c: o.c, w: o.w, p: [] }; TVS.strokes.push(s); }
    s.p.push(...o.p);
  });
  TVS.dirty = true;
};
(function loop() {
  if (TVS.dirty) { const c = document.getElementById('drc'); if (c) { DrawPad.fit(c); DrawPad.render(c, TVS.strokes); } TVS.dirty = false; }
  requestAnimationFrame(loop);
})();
T.drawEvent = (r, pid) => { if (r === 'ok') { SFX('correct'); H.confetti(25); } else if (r === 'no') SFX('pop'); };

// galeria rysunków z całej gry
let gallery = [];
function snapshot() {
  const c = document.getElementById('drc'), s = S(); if (!c || !s) return;
  try {
    const t = document.createElement('canvas'); t.width = 400; t.height = 225;
    const x = t.getContext('2d'); x.fillStyle = s.bg || '#fff'; x.fillRect(0, 0, 400, 225);
    const tmp = document.createElement('canvas'); tmp.width = 400; tmp.height = 225; DrawPad.render(tmp, TVS.strokes); x.drawImage(tmp, 0, 0);
    if (!gallery.some(g => g.rid === s.roundId)) gallery.push({ rid: s.roundId, word: s.word, drawer: s.drawer, url: t.toDataURL('image/jpeg', 0.75) });
  } catch (e) {}
}

/* ---------- lobby ---------- */
function catsBtns() {
  const st = S().settings, list = st.catList || [];
  const on = list.filter(c => c.on);
  const cc = document.getElementById('cc'); if (cc) cc.textContent = `(${on.length}/${list.length} · ${on.reduce((s, c) => s + c.n, 0)} haseł)`;
  return list.length ? btn('allCats', '', '✅ Wszystkie', 'cat util') + btn('noCats', '', '⬜ Żadna', 'cat util') + list.map(c => btn('cat', c.id, `${c.emoji} ${esc(c.name)}`, 'cat ' + (c.on ? 'on' : ''))).join('') : '<div class="muted">Ładowanie słów…</div>';
}
function howLoop() {
  let i = 0; const box = document.getElementById('how'), dots = document.getElementById('howdots'); if (!box) return;
  dots.innerHTML = HOW.map(() => '<i></i>').join('');
  H.every(5500, () => { const [e, t, d] = HOW[i % HOW.length]; box.innerHTML = `<div class="how-step"><div class="how-e">${e}</div><b>${t}</b><p>${d}</p></div>`; [...dots.children].forEach((el, k) => el.classList.toggle('on', k === i % HOW.length)); i++; });
}
T.reg('dr-mlobby', {
  html: () => `<div class="scene mlobby draw-bg">
    <div class="mcol">
      <div class="mhead"><div class="logo-mid glitch drw" data-t="KALAMBURY">KALAMBURY</div><div class="muted">✏️ każdy swój telefon</div></div>
      <div class="join panel"><div class="qr-box sm"><div id="qr"></div></div>
        <div class="join-t"><b>Dołączcie telefonem!</b><p>Zeskanuj QR albo wejdź na<br><span class="url">${esc(H.playShort())}</span><br>i wpisz kod:</p><div class="code-mid tv-code">${esc(H.code())}</div><div class="tv-net ${H.net()}">${H.netTxt()}</div></div></div>
      <div class="panel grow"><h3>Gracze <span id="pc"></span> <small>OK = usuń</small></h3><div class="mplayers" id="mp"></div></div>
    </div>
    <div class="mcol">
      <div class="panel"><h3>Zasady <small>OK = zmień</small></h3><div class="setgrid" id="ms"></div></div>
      <div class="panel grow"><h3>Kategorie haseł <span id="cc"></span></h3><div class="catgrid" id="mc"></div></div>
      <div class="mactions">${btn('back', '', '← Tryb', 'ghost')}${btn('start', '', '✏️ ZACZNIJ GRĘ', 'primary big', 'data-focus')}</div>
    </div></div>`,
  update: () => {
    const s = S(), st = s.settings;
    document.getElementById('pc').textContent = `(${s.players.length})`;
    document.getElementById('mp').innerHTML = s.players.length ? s.players.map(p => btn('kick', p.id, `${av(p, 'sm')}<span>${esc(p.name)}</span>${p.score ? `<small>${p.score}</small>` : ''}${p.online ? '' : '<i>📵</i>'}`, 'pchip ' + (p.online ? '' : 'off'))).join('') : '<div class="muted empty">Nikt jeszcze nie dołączył…<br>Zeskanujcie QR telefonami 📱</div>';
    const LV = { easy: '🟢 łatwy', normal: '🟡 normalny', hard: '🔴 trudny' };
    document.getElementById('ms').innerHTML = btn('set', 'level', `🎯 Poziom: <b>${LV[st.level] || LV.normal}</b>`, 'opt wide') + btn('set', 'time', `⏱️ Czas rysowania: <b>${st.time} s</b>`, 'opt') + btn('set', 'rounds', `🔁 Obiegi: <b>${st.rounds}× każdy rysuje</b>`, 'opt');
    document.getElementById('mc').innerHTML = catsBtns();
  },
  mount: () => H.drawQR(),
});
T.reg('dr-lobby', {
  html: () => `<div class="scene lobby draw-bg">
    <div class="col"><div class="logo-big glitch drw" data-t="KALAMBURY">KALAMBURY</div><div class="sub">Rysuj, zgaduj, wygrywaj ✏️</div>
      <div class="panel grow"><h3>Gracze <span id="pc"></span></h3><div class="pgrid" id="lp"></div></div><div class="chips" id="ls"></div></div>
    <div class="col narrow"><div class="panel how"><h3>Jak grać</h3><div id="how" class="how-body"></div><div class="dots" id="howdots"></div></div></div>
    <div class="footer"><span class="pulse">Host: wciśnij <b>ZACZNIJ</b> na telefonie</span></div>
    <div class="code-corner">Kod TV: <b class="tv-code">${esc(H.code())}</b></div></div>`,
  update: () => {
    const s = S(), st = s.settings;
    document.getElementById('pc').textContent = s.players.length ? `(${s.players.length})` : '';
    document.getElementById('lp').innerHTML = s.players.map(p => `<div class="pc">${av(p, 'md')}<span>${esc(p.name)}</span>${p.score ? `<small>${p.score} pkt</small>` : ''}</div>`).join('') || '<div class="muted empty">Dodaj graczy w aplikacji…</div>';
    document.getElementById('ls').innerHTML = [`🎯 Poziom: ${({ easy: 'łatwy', normal: 'normalny', hard: 'trudny' })[st.level] || 'normalny'}`, `⏱️ ${st.time} s na rysunek`, `🔁 ${st.rounds}× każdy rysuje`, `🗂️ ${(st.catList || []).filter(c => c.on).length} kategorii`].map(t => `<span class="chip">${esc(t)}</span>`).join('');
  },
  mount: howLoop,
});

/* ---------- wybór hasła ---------- */
T.reg('dr-choose', {
  html: () => {
    const s = S(), p = P(s.drawer);
    if (s.round === 1) gallery = [];
    return `<div class="scene center drchoose draw-bg">
      <div class="round-tag">Rysunek ${s.round} / ${s.total}</div>
      <div class="pencil">✏️</div>
      <div class="kicker">Teraz rysuje</div>
      ${av(p, 'huge bounce')}<div class="name-big" style="color:${p.color}">${esc(p.name)}</div>
      <p class="big-p pulse">${MULTI() ? 'wybiera hasło na swoim telefonie…' : 'Podajcie mu/jej telefon – wybiera hasło…'}</p>
      ${MULTI() ? btn('skipChoose', '', 'Losuj hasło ⏭', 'ghost sm') : ''}
      <div class="mini-board">${[...s.players].sort((a, b) => b.score - a.score).slice(0, 6).map(q => `<span>${av(q, 'xs')} ${esc(q.name)} <b>${q.score}</b></span>`).join('')}</div></div>`;
  },
  mount: () => SFX('pencil'),
});

/* ---------- rysowanie ---------- */
const maskHTML = m => (m || []).map(ch => ch === ' ' ? '<i class="sp"></i>' : `<b class="${ch === '_' ? 'blank' : 'lt'}">${ch === '_' ? '' : esc(ch)}</b>`).join('');
const chatHTML = () => (S().chat || []).slice(-8).map(c => { const p = P(c.id); return `<div class="cm ${c.ok ? 'ok' : ''}">${av(p, 'xs')}<b>${esc(p ? p.name : '?')}</b> <span>${esc(c.t)}</span></div>`; }).join('');
T.reg('dr-draw', {
  html: () => {
    const s = S(), p = P(s.drawer);
    return `<div class="scene drscene">
      <div class="drtop">
        <div class="who">${av(p, 'md')}<div><small>Rysuje</small><b style="color:${p.color}">${esc(p.name)}</b></div></div>
        <div class="maskbox"><div class="mask" id="mask">${maskHTML(s.mask)}</div><small>${esc(s.cat)} · ${(s.mask || []).filter(c => c !== ' ').length} liter · <b class="ptsb p${s.pts}">${'⭐'.repeat(s.pts || 1)} rysujący +${s.pts || 1} · zgadujący +2</b></small></div>
        ${ring('md')}
      </div>
      <div class="drmain">
        <div class="drbox" style="background:${s.bg || '#fff'}"><canvas id="drc"></canvas></div>
        <div class="drside">
          <div class="panel shoutp"><div class="sh-e">📣</div><b>Krzyczcie odpowiedzi!</b><p>Kto pierwszy zgadnie, wygrywa rundę. ${esc(p.name)} kliknie zwycięzcę na telefonie.</p></div>
          <div class="panel grow"><h3>Zgadują</h3><div class="glist">${s.players.filter(q => q.id !== s.drawer && q.online).map(q => `<div class="gi">${av(q, 'sm')}<b>${esc(q.name)}</b><i>${q.score} pkt</i></div>`).join('')}</div></div>
          ${MULTI() ? btn('endRound', '', 'Zakończ rundę ⏭', 'ghost sm') : ''}
        </div>
      </div></div>`;
  },
  update: () => {
    const s = S();
    syncStrokes(s);
    const b = document.querySelector('.drbox'); if (b && s.bg) b.style.background = s.bg;
    const mk = document.getElementById('mask'); const mh = maskHTML(s.mask); if (mk && mk.dataset.h !== mh) { mk.innerHTML = mh; mk.dataset.h = mh; }

  },
  mount: () => { TVS.dirty = true; SFX('whoosh'); },
});

/* ---------- odsłonięcie ---------- */
T.reg('dr-reveal', {
  html: () => {
    const s = S(), p = P(s.drawer), gains = s.players.filter(q => q.delta > 0).sort((a, b) => b.delta - a.delta);
    return `<div class="scene center drreveal draw-bg">
      <div class="kicker">Hasło to</div>
      <div class="word">${[...(s.word || '')].map((ch, i) => `<span style="animation-delay:${i * 60}ms">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`).join('')}</div>
      <div class="cat">${esc(s.cat || '')} · rysował(a) ${esc(p ? p.name : '?')}</div>
      ${s.winner ? `<div class="winline">🏆 Odgadł(a): ${av(P(s.winner), 'md')} <b style="color:${P(s.winner).color}">${esc(P(s.winner).name)}</b></div>` : ''}
      <div class="revrow"><div class="drbox small" style="background:${s.bg || '#fff'}"><canvas id="drc"></canvas></div>
        <div class="gains col">${gains.map((q, i) => `<div class="gain" style="animation-delay:${0.6 + i * 0.12}s">${av(q, 'sm')}<span>${esc(q.name)}</span><b>+${q.delta}</b></div>`).join('') || '<span class="muted">Nikt nie zgadł 😅</span>'}</div></div>
      ${MULTI() ? btn('next', '', 'Dalej ⏭', 'primary', 'data-focus') : '<div class="footer"><span class="pulse">Host: dalej na telefonie</span></div>'}</div>`;
  },
  mount: () => { const s = S(); syncStrokes(s); TVS.dirty = true; SFX((s.guessed || []).length ? 'round_end' : 'wah'); setTimeout(snapshot, 300); },
});

/* ---------- finał ---------- */
T.reg('dr-final', {
  html: () => {
    const s = S(), list = [...s.players].sort((a, b) => b.score - a.score), pod = [list[1], list[0], list[2]].filter(Boolean);
    return `<div class="scene center final drfinal">
      <div class="title glitch" data-t="KONIEC GRY">🏆 KONIEC GRY</div>
      <div class="podium">${pod.map(p => { const place = list.indexOf(p) + 1; return `<div class="pod p${place}">${place === 1 ? '<div class="crown">👑</div>' : ''}${av(p, place === 1 ? 'lg' : 'md')}<b>${esc(p.name)}</b><span>${p.score} pkt</span><div class="block">${place}</div></div>`; }).join('')}</div>
      ${gallery.length ? `<div class="gallery">${gallery.map((g, i) => `<figure style="animation-delay:${1.5 + i * 0.15}s"><img src="${g.url}" alt=""><figcaption>${esc(g.word || '')} · ${esc(nm(g.drawer))}</figcaption></figure>`).join('')}</div>` : ''}
      ${MULTI() ? `<div class="mactions c">${btn('lobby', '', '⚙️ Ustawienia', 'ghost')}${btn('again', '', '✏️ Jeszcze raz', 'primary big', 'data-focus')}</div>` : '<div class="footer"><span class="pulse">Host: nowa gra?</span></div>'}</div>`;
  },
  mount: () => { H.confetti(150); SFX('win'); },
});

T.drawMusic = k => ({ 'dr-mlobby': 'lobby', 'dr-lobby': 'lobby', 'dr-choose': 'menu', 'dr-draw': 'draw', 'dr-final': 'victory' })[k] || null;
})();
