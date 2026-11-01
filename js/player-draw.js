/* Kalambury – ekrany telefonu gracza (tryb „każdy swój telefon”) */
(() => {
'use strict';
let pad = null, sendFn = null;
const role = P => P.isDrawer ? 'd' : P.guessedMe ? 'gd' : 'g';
const maskHTML = m => (m || []).map(ch => ch === ' ' ? '<i class="sp"></i>' : `<b class="${ch === '_' ? 'blank' : ''}">${ch === '_' ? '' : ch}</b>`).join('');

window.PlayerDraw = {
  /** Czy można zostawić obecny ekran (płótno / wpisywany tekst) i tylko podmienić drobne elementy? */
  keep(P) {
    const el = document.querySelector('.drphone');
    return !!(el && P.phase === 'draw' && el.dataset.rid === String(P.roundId) && el.dataset.role === role(P));
  },
  patch(P, h) {
    const q = id => document.getElementById(id);
    if (q('dmask')) { const m = maskHTML(P.mask); if (q('dmask').dataset.h !== m) { q('dmask').innerHTML = m; q('dmask').dataset.h = m; } }
    if (q('dcount')) q('dcount').textContent = P.guessCount;
    if (q('dnote')) { const n = P.note ? `<div class="dnote ${P.note.k}">${h.esc(P.note.t)}</div>` : ''; if (q('dnote').dataset.h !== n) { q('dnote').innerHTML = n; q('dnote').dataset.h = n; if (P.note && P.note.k === 'close') try { navigator.vibrate([20, 40, 20]); } catch (e) {} } }
    if (q('dchat')) q('dchat').innerHTML = chat(P, h);
  },
  view(P, h) {
    const { esc, av } = h;
    const PL = id => P.players.find(p => p.id === id);
    const drawer = PL(P.drawer);
    if (P.phase === 'setup') return `<div class="center">${av(P.me, 'xl')}<h1>Jesteś w grze!</h1><p class="muted">Gramy w <b>✏️ Kalambury</b>. Czekajcie na start z telewizora.</p>
      <div class="chips cen">${P.players.map(p => `<span class="chip ${p.id === P.me.id ? 'on' : ''}">${av(p, 'sm')} ${esc(p.name)}</span>`).join('')}</div>
      <button class="btn sm ghost center-b" data-act="leave">Wyjdź z gry</button></div>`;
    if (P.phase === 'choose') {
      if (P.isDrawer) return `<div class="center"><div class="step">Rysunek ${P.round}/${P.total}</div><div class="big-emoji pop">✏️</div><h1>Twoja kolej!</h1><p>Wybierz hasło do narysowania:</p>
        <div class="choices">${(P.choices || []).map((c, i) => `<button class="choice lv${c.pts}" data-act="d-choose" data-arg="${i}"><span class="stars">${'⭐'.repeat(c.pts)} ${['', 'łatwe', 'średnie', 'trudne'][c.pts]} · dla ciebie ${c.pts} pkt</span><b>${esc(c.w)}</b><small>${esc(c.cat)}</small></button>`).join('')}</div>
        <p class="muted small">Nie pokazuj nikomu ekranu! Nie wolno pisać liter ani mówić.</p></div>`;
      return `<div class="center"><div class="step">Rysunek ${P.round}/${P.total}</div><div class="big-emoji">✏️</div><h2>${av(drawer, 'sm')} ${esc(drawer ? drawer.name : '?')} wybiera hasło…</h2><p class="muted">Za chwilę zgadujecie!</p></div>`;
    }
    if (P.phase === 'draw') {
      const head = `<div class="drhead"><span class="clock sm" data-timer>${h.fmt(h.timerLeft())}</span><span class="muted small">✅ <b id="dcount">${P.guessCount}</b> zgadło</span></div>`;
      if (P.isDrawer) return `<div class="drphone" data-rid="${P.roundId}" data-role="d">${head}
        <div class="drword">Rysujesz: <b>${esc(P.word)}</b> <small>${esc(P.cat)} · ${'⭐'.repeat(P.pts || 1)} ${P.pts || 1} pkt</small></div>
        <div id="padwrap" class="padwrap"></div>
        <div class="card whoguess"><b>🗣️ Ktoś zgadł? Kliknij kto:</b>
          <div class="chips">${P.players.filter(p => p.id !== P.me.id && p.online).map(p => `<button class="chip" data-act="d-mark" data-arg="${p.id}">${av(p, 'sm')} ${esc(p.name)}</button>`).join('')}</div>
          <button class="btn sm ghost" data-act="d-mark" data-arg="">🤷 Nikt nie zgadł</button></div></div>`;
      if (P.guessedMe) return `<div class="drphone center" data-rid="${P.roundId}" data-role="gd">${head}<div class="big-emoji pop">✅</div><h1>Zgadłeś!</h1>
        <p>Hasło: <b class="hl">${esc(P.word)}</b> · +${P.myPts} pkt</p><p class="muted small">Nie podpowiadaj innym 🤫</p><div id="dchat" class="dchat">${chat(P, h)}</div></div>`;
      return `<div class="drphone" data-rid="${P.roundId}" data-role="g">${head}
        <div class="dmaskbox"><div id="dmask" class="dmask">${maskHTML(P.mask)}</div><small>${esc(P.cat)} · rysuje ${esc(drawer ? drawer.name : '?')}</small></div>
        <div class="shout"><div class="big-emoji">📣</div><h2>Krzyczcie odpowiedzi na głos!</h2>
        <p class="muted">Patrz na rysunek na telewizorze 📺. Gdy zgadniesz, ${esc(drawer ? drawer.name : 'rysujący')} kliknie Twoje imię.</p></div></div>`;
    }
    if (P.phase === 'reveal') return `<div class="center"><div class="step">Koniec rysunku</div><h2>Hasło: <b class="hl">${esc(P.word)}</b></h2>
      ${P.winner ? `<p>🏆 Odgadł(a): <b>${esc((PL(P.winner) || {}).name || '?')}</b></p>` : '<p class="muted">Nikt nie zgadł</p>'}
      <div class="mydelta ${P.me.delta ? 'plus' : ''}">${P.me.delta ? '+' + P.me.delta : '0'} <small>pkt w tej rundzie</small></div><p class="muted">Razem: <b>${P.me.score}</b> pkt</p></div>`;
    if (P.phase === 'final') {
      const list = [...P.players].sort((a, b) => b.score - a.score), win = (P.final || []).includes(P.me.id);
      return `<div class="center"><div class="big-emoji pop">${win ? '🏆' : '🎨'}</div><h1>${win ? 'WYGRAŁEŚ!' : 'Koniec gry!'}</h1>
        <ol class="board">${list.map(p => `<li class="${p.id === P.me.id ? 'me' : ''}">${av(p, 'sm')}<span class="pname">${esc(p.name)}</span><b>${p.score}</b></li>`).join('')}</ol></div>`;
    }
    return '';
  },
  /** Po wstawieniu HTML: płótno dla rysującego i obsługa formularza odpowiedzi. */
  mounted(app, send) {
    sendFn = send;
    const w = app.querySelector('#padwrap');
    if (pad) { pad.destroy(); pad = null; }
    if (w && window.DrawPad) pad = DrawPad.mount(w, { onSend: m => send(Object.assign({ type: 'dr' }, m)) });
    const f = app.querySelector('#guessForm');
    if (f) f.addEventListener('submit', e => {
      e.preventDefault(); e.stopPropagation();
      const inp = f.querySelector('input'), t = inp.value.trim(); if (!t) return;
      send({ type: 'guess', text: t }); inp.value = ''; inp.focus();
      try { navigator.vibrate(10); } catch (x) {}
    });
  },
  act(a, arg, send) {
    if (a === 'd-choose') { send({ type: 'choose', i: Number(arg) }); return true; }
    if (a === 'd-mark') { send({ type: 'mark', id: arg || null }); return true; }
    return false;
  },
};
function chat(P, h) {
  return (P.chat || []).slice(-5).reverse().map(c => { const p = P.players.find(q => q.id === c.id); return `<div class="dc ${c.ok ? 'ok' : ''}">${h.av(p, 'xs')} <b>${h.esc(p ? p.name : '?')}</b> ${h.esc(c.t)}</div>`; }).join('');
}
})();
