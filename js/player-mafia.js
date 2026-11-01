/* Mafia – ekrany telefonu gracza (tryb „każdy swój telefon”) */
(() => {
'use strict';
const R = window.MafiaCore.ROLES;
let ui = { card: null, gift: null }; // wybrana karta do zagrania / karta ducha do oddania
const fxSeen = {}; // animacja ma się odegrać raz – potem pokazujemy stan końcowy
const once = key => { const now = Date.now(); if (!fxSeen[key]) fxSeen[key] = now; return now - fxSeen[key] > 4500 ? 'still' : ''; };

window.PlayerMafia = {
  reset() { ui = { card: null, gift: null }; },
  /** h: { esc, av, fmt, timerLeft, tile(roleHtml) } */
  view(P, h) {
    const { esc, av } = h;
    const PL = id => P.players.find(p => p.id === id);
    const nm = id => { const p = PL(id); return p ? esc(p.name) : '?'; };
    const pick = (act, ids, sel, extra = {}) => `<div class="vgrid">${ids.map(id => { const p = PL(id); if (!p) return ''; return `<button class="vbtn ${sel === id ? 'on' : ''}" data-act="${act}" data-arg="${id}">${av(p)}<span>${esc(p.name)}</span>${extra[id] || ''}</button>`; }).join('')}</div>`;
    const msgs = () => (P.priv || []).length ? `<div class="card inbox"><b>📬 Tylko dla ciebie</b>${P.priv.map(t => `<p>${esc(t)}</p>`).join('')}</div>` : '';
    const clock = () => P.timer ? `<div class="clock sm" data-timer>${h.fmt(h.timerLeft())}</div>` : '';
    const role = P.role && R[P.role];

    // ---------- animacje prywatne (śledztwo, tarcza, gołąb, alarm, zlecenie) ----------
    function fxHTML() {
      return (P.fx || []).filter(f => f.k !== 'dead').map((f, i) => {
        const st = once(`${P.day}|${i}|${JSON.stringify(f)}`), p = f.t && PL(f.t);
        if (f.k === 'check') return `<div class="fxc check ${f.m ? 'bad' : 'good'} ${st}"><small>${esc(f.src || '🕵️ Śledztwo')}</small>
          <div class="scan">${av(p, 'xl')}<i class="lens">🔍</i><i class="beam"></i></div><div class="stamp2">${f.m ? 'MAFIA!' : 'CZYSTY'}</div><b>${nm(f.t)}</b></div>`;
        if (f.k === 'role') { const r = R[f.r]; return `<div class="fxc check role ${f.r === 'mafia' ? 'bad' : 'good'} ${st}"><small>${esc(f.src)}</small>
          <div class="scan">${av(p, 'xl')}<i class="lens">📁</i><i class="beam"></i></div><div class="stamp2">${r.emoji} ${r.name.toUpperCase()}</div><b>${nm(f.t)}</b></div>`; }
        if (f.k === 'shield') return `<div class="fxc shieldc ${st}"><div class="sv2">${av(P.me, 'xl')}<i class="knife2">🔪</i><i class="shield2"></i></div><b>Ktoś cię zaatakował… ale przeżyłeś!</b></div>`;
        if (f.k === 'dove') return `<div class="fxc dovec ${st}"><div class="dove2">🕊️</div><b>Druga szansa uratowała ci życie!</b></div>`;
        if (f.k === 'alarm') return `<div class="fxc alarmc ${st}"><div class="siren">🚨</div><b>Napastnik: ${nm(f.t)}</b></div>`;
        if (f.k === 'hit') return `<div class="fxc hit ${f.ok ? 'bad' : 'good'} ${st}"><div class="scan">${av(p, 'xl')}${f.ok ? '<i class="slash2"></i><i class="slash2 b"></i>' : '<i class="shield2"></i>'}</div><b>${f.ok ? '🔪 Zlecenie wykonane' : '🛡️ Ofiara przeżyła atak'}: ${nm(f.t)}</b></div>`;
        return '';
      }).join('');
    }
    const deathFx = () => (P.fx || []).some(f => f.k === 'dead') && P.phase === 'morning' ? `<div class="deathfx ${once('dead|' + P.day)}"><div class="crack"></div><b>💀</b><h2>Zginąłeś tej nocy</h2></div>` : '';

    // ---------- karty w ręce ----------
    const phaseNames = { night: 'w nocy', day: 'w dyskusji', vote: 'w głosowaniu', passive: 'działa sama' };
    function handHTML() {
      if (!P.cardsOn || !P.alive) return '';
      const hand = P.hand || [];
      if (ui.card !== null && hand[ui.card]) {
        const c = hand[ui.card];
        const ids = c.target === 'dead' ? (P.deadPlayers || []) : (P.alivePlayers || []).filter(id => id !== P.me.id);
        return `<div class="card cardsel"><div class="pcard big t-${c.team}"><div class="pe">${c.emoji}</div><b>${esc(c.name)}</b><p>${esc(c.desc)}</p></div>
          <p><b>Na kogo?</b></p>${pick('m-cardt', ids, null)}<button class="btn ghost" data-act="m-cardx">Anuluj</button></div>`;
      }
      if (!hand.length) return `<div class="card hand"><b>🃏 Twoje karty</b><p class="muted small">Brak kart. Telewizor rozdaje je losowo co rano.</p></div>`;
      return `<div class="card hand"><b>🃏 Twoje karty ${P.cardPlayed ? '<span class="muted small">(w tej fazie już zagrałeś)</span>' : ''}</b>
        <div class="pcards">${hand.map((c, i) => {
          const now = c.when === P.phase && !P.cardPlayed;
          return `<button class="pcard t-${c.team} ${now ? 'now' : ''}" data-act="m-card" data-arg="${i}" ${now ? '' : 'disabled'}><div class="pe">${c.emoji}</div><b>${esc(c.name)}</b><p>${esc(c.desc)}</p><i>${phaseNames[c.when]}</i></button>`;
        }).join('')}</div></div>`;
    }

    // ---------- duch: rozdawanie kart ----------
    function ghostHTML() {
      const o = P.offer || [];
      if (!o.length) return '<p class="muted">Co rano dostaniesz 2 karty do rozdania żywym graczom.</p>';
      if (ui.gift !== null && o[ui.gift]) {
        const c = o[ui.gift];
        return `<div class="card cardsel"><div class="pcard big t-${c.team}"><div class="pe">${c.emoji}</div><b>${esc(c.name)}</b><p>${esc(c.desc)}</p></div>
          <p><b>Komu dajesz tę kartę?</b></p>${pick('m-giftt', P.alivePlayers || [], null)}<button class="btn ghost" data-act="m-giftx">Anuluj</button></div>`;
      }
      return `<div class="card"><b>👻 Karty z zaświatów – rozdaj je żywym</b>
        <div class="pcards">${o.map((c, i) => `<button class="pcard t-${c.team} now" data-act="m-gift" data-arg="${i}"><div class="pe">${c.emoji}</div><b>${esc(c.name)}</b><p>${esc(c.desc)}</p><i>Daj komuś →</i></button>`).join('')}</div>
        <button class="btn sm ghost" data-act="m-giftskip">Nie rozdaję</button></div>`;
    }

    // ---------- fazy ----------
    if (P.phase === 'setup') return `<div class="center">${av(P.me, 'xl')}<h1>Jesteś w grze!</h1><p class="muted">Gramy w <b>🌙 Mafię</b>. Czekajcie na start z telewizora.</p>
      <div class="chips cen">${P.players.map(p => `<span class="chip ${p.id === P.me.id ? 'on' : ''}">${av(p, 'sm')} ${esc(p.name)}</span>`).join('')}</div>
      <button class="btn sm ghost center-b" data-act="leave">Wyjdź z gry</button></div>`;
    if (P.phase === 'scores') {
      const list = [...P.players].sort((a, b) => b.score - a.score);
      return `<div class="center"><h1>🏆 Wyniki</h1><ol class="board">${list.map(p => `<li class="${p.id === P.me.id ? 'me' : ''}">${av(p, 'sm')}<span class="pname">${esc(p.name)}</span>${p.delta ? `<i>+${p.delta}</i>` : ''}<b>${p.score}</b></li>`).join('')}</ol><p class="muted">Kolejna partia startuje z telewizora 📺</p></div>`;
    }
    if (!P.inRound) return `<div class="center"><div class="big-emoji">📺</div><h2>Partia już trwa</h2><p class="muted">Dołączysz w następnej.</p></div>`;

    if (P.phase === 'roles') {
      const secret = `<div class="role mrole-card r-${P.role}"><div class="role-ico">${role.emoji}</div><b>${role.name.toUpperCase()}</b><span>${esc(role.desc)}</span>
        ${P.mates && P.mates.length ? `<small>Twoja mafia: ${P.mates.map(nm).join(', ')}</small>` : ''}</div>`;
      return `<div class="center look"><div class="step">Twoja rola</div>${h.tile(secret)}
        ${P.seenRole ? '<p class="ok">✔ Czekamy na resztę…</p>' : '<button class="btn big ghost" data-act="seen" disabled>Znam swoją rolę ✔</button>'}</div>`;
    }

    if (P.alive === false && P.phase !== 'end') {
      return `${deathFx()}<div class="center ghostscr"><div class="big-emoji">👻</div><h1>Jesteś duchem</h1>
        <p class="muted">Nie zdradzaj nic żywym! Byłeś: ${role.emoji} <b>${role.name}</b>.</p>
        ${P.cardsOn ? ghostHTML() : ''}</div>`;
    }

    if (P.phase === 'night') {
      const head = `<div class="step">🌙 Noc ${P.day}</div>${clock()}`;
      let act;
      if (P.role === 'mafia') {
        const ex = {}; Object.entries(P.matePicks || {}).forEach(([m, t]) => { if (t) ex[t] = (ex[t] || '') + `<small>🕴️ ${nm(m)}</small>`; });
        act = `<h2>🕴️ Kogo mafia eliminuje?</h2><p class="muted small">Ustalcie wspólny cel – widzisz wybory wspólników.</p>${pick('m-night', P.targets || [], P.myPick, ex)}`;
      } else if (P.role === 'cop') act = P.done ? `<h2>🕵️ Sprawdzasz: ${nm(P.myPick)}</h2><p class="muted">Wynik poznasz rano.</p>` : `<h2>🕵️ Kogo sprawdzasz?</h2>${pick('m-night', P.targets || [], P.myPick)}`;
      else if (P.role === 'doctor') act = `<h2>🩺 Kogo ratujesz?</h2>${P.lastHeal ? `<p class="muted small">Nie możesz dwie noce z rzędu ratować: ${nm(P.lastHeal)}</p>` : ''}${pick('m-night', P.targets || [], P.myPick)}`;
      else act = `<h2>🤔 Kogo podejrzewasz?</h2><p class="muted small">Wszyscy coś klikają, żeby nikt nie zgadł ról. Rano TV pokaże najczęstsze podejrzenie.</p>${pick('m-night', P.targets || [], P.myPick)}`;
      return `<div class="center nightscr">${head}${act}${P.done ? '<p class="ok">✔ Ruch zapisany (możesz zmienić do końca nocy)</p>' : ''}${handHTML()}</div>`;
    }
    if (P.phase === 'morning') {
      const m = P.morning || { victims: [] };
      return `<div class="center"><div class="step">☀️ Dzień ${m.day}</div>
        <h2>${m.victims.length ? '💀 ' + m.victims.map(v => nm(v.id)).join(', ') : m.saved || m.dove ? '🩺 Nikt nie zginął!' : '🌤️ Spokojna noc'}</h2>
        ${fxHTML()}${msgs()}<p class="muted">Patrzcie na telewizor 📺</p>${handHTML()}</div>`;
    }
    if (P.phase === 'day') return `<div class="center"><div class="step">☀️ Dyskusja</div>${clock()}<p>Kto jest w mafii? Rozmawiajcie!</p>
      <button class="btn ${P.mySkip ? 'primary' : 'ghost'} skipbtn" data-act="m-skip">⏭ ${P.mySkip ? 'Chcesz pominąć dzień ✔' : 'Pomiń dzień → głosowanie'} <small>${P.skips || 0}/${P.skipNeed || '?'}</small></button>
      <p class="muted small">Gdy większość kliknie, dyskusja kończy się i od razu głosujecie.</p>${fxHTML()}${msgs()}${handHTML()}</div>`;
    if (P.phase === 'vote') {
      if (P.gagged) return `<div class="center"><div class="big-emoji">🤐</div><h2>Masz knebel</h2><p class="muted">W tym głosowaniu nie głosujesz.</p>${handHTML()}</div>`;
      return `<div class="center"><div class="step">🗳️ Głosowanie · ${P.voteCount || 0}/${P.voteTotal || 0}</div>${clock()}
        <h2>Kogo wyrzucamy?</h2>${pick('mvote', P.voteTargets || [], P.myVote)}
        <button class="btn ${P.myVote === 'skip' ? 'primary' : 'ghost'}" data-act="mvote" data-arg="skip">⏭️ Pomijam</button>${handHTML()}</div>`;
    }
    if (P.phase === 'elim') {
      const e = P.elim || {};
      return `<div class="center"><div class="big-emoji pop">${e.out ? '⚖️' : '🤷'}</div><h2>${e.out ? 'Odpada: ' + nm(e.out) : e.tie ? 'Remis – nikt nie odpada' : 'Nikt nie odpada'}</h2>
        ${(e.notes || []).map(n => `<p>${esc(n)}</p>`).join('')}<p class="muted">Patrzcie na telewizor 📺</p></div>`;
    }
    if (P.phase === 'end') {
      const won = R[P.role].team === P.winner;
      return `<div class="center"><div class="big-emoji pop">${won ? '🏆' : '💀'}</div><h1>${won ? 'WYGRANA!' : 'Przegrana'}</h1>
        <p>Wygrywa: <b>${P.winner === 'town' ? '🏙️ Miasto' : '🕴️ Mafia'}</b></p><p>Twoja rola: ${role.emoji} ${role.name}</p>
        ${P.me.delta ? `<div class="mydelta plus">+${P.me.delta} <small>pkt</small></div>` : ''}</div>`;
    }
    return '';
  },
  /** Obsługa przycisków. Zwraca true, gdy akcja była mafijna. */
  act(a, arg, send, P, rerender) {
    switch (a) {
      case 'm-night': send({ type: 'night', target: arg }); return true;
      case 'm-card': {
        const c = (P.hand || [])[Number(arg)];
        if (!c) return true;
        if (c.target === 'none') send({ type: 'card', i: Number(arg) });
        else { ui.card = Number(arg); rerender(); }
        return true;
      }
      case 'm-cardt': send({ type: 'card', i: ui.card, target: arg }); ui.card = null; rerender(); return true;
      case 'm-cardx': ui.card = null; rerender(); return true;
      case 'm-gift': ui.gift = Number(arg); rerender(); return true;
      case 'm-giftt': send({ type: 'gift', i: ui.gift, target: arg }); ui.gift = null; rerender(); return true;
      case 'm-giftx': ui.gift = null; rerender(); return true;
      case 'm-giftskip': send({ type: 'skipgift' }); return true;
      case 'mvote': send({ type: 'mvote', target: arg }); return true;
      case 'm-skip': send({ type: 'skipday' }); return true;
    }
    return false;
  },
};
})();
