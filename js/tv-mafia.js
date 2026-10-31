/* Mafia – sceny na telewizorze (oba tryby) + narrator */
(() => {
'use strict';
const T = window.TV, H = T.h;
const { esc, av, btn, ring, SFX } = H;
const S = () => H.S;
const P = id => H.P(id);
const ROLES = window.MafiaCore.ROLES;
const MULTI = () => H.MULTI();
const nm = id => { const p = P(id); return p ? p.name : '?'; };
const roleTag = r => r ? `<div class="mrole r-${r}">${ROLES[r].emoji} ${ROLES[r].name}</div>` : '';
const say = (text, o) => { const s = S(); if (window.Narrator && s && s.settings && s.settings.voice) Narrator.say(text, o); };
const plain = t => String(t).replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').trim();

const MAFIA_HOW = [
  ['🌙', 'Noc', 'Mafia wybiera ofiarę, policjant prowadzi śledztwo, a lekarz kogoś ratuje. Wszystko tajnie.'],
  ['☀️', 'Dzień', 'Telewizor ogłasza, kto zginął. Dyskutujcie i szukajcie mafii.'],
  ['🗳️', 'Głosowanie', 'Miasto wyrzuca jedną osobę. Uważajcie – możecie wyrzucić niewinnego!'],
  ['🃏', 'Karty mocy', 'Telewizor co rano daje losowym graczom karty. Duchy dostają po 2 karty i rozdają je żywym.'],
  ['🏆', 'Wygrana', 'Miasto wygrywa, gdy usunie całą mafię. Mafia – gdy jest jej tyle, co reszty.'],
];

const players = (ids, cls = '') => (ids || []).map(P).filter(Boolean).map(p => {
  const s = S(), role = s.dead && s.dead[p.id];
  return `<div class="mp ${p.alive === false ? 'dead' : ''} ${cls}">${av(p, 'md')}<span>${esc(p.name)}</span>${p.alive === false ? `<i>👻</i>${role ? `<small>${ROLES[role].emoji} ${ROLES[role].name}</small>` : ''}` : ''}${S().cardsOn && p.alive && p.cards ? `<b class="cardn">🃏${p.cards}</b>` : ''}</div>`;
}).join('');
const feed = () => { const f = (S().feed || []).slice(-3).reverse(); return f.length ? `<div class="mfeed">${f.map((x, i) => `<div style="opacity:${1 - i * 0.3}">${esc(x.text)}</div>`).join('')}</div>` : ''; };

function settingsBtns() {
  const st = S().settings, n = S().players.length;
  return [
    btn('set', 'mafia', `🕴️ Mafia: <b>${st.mafia ? st.mafia : 'auto (' + st.autoMafia + ')'}</b>`, 'opt'),
    btn('set', 'cop', `🕵️ Policjant: <b>${st.cop ? 'tak' : 'nie'}</b>`, 'opt'),
    btn('set', 'doctor', `🩺 Lekarz: <b>${st.doctor ? 'tak' : 'nie'}</b>`, 'opt'),
    btn('set', 'reveal', `🪪 Rola po śmierci: <b>${st.reveal ? 'pokaż' : 'ukryj'}</b>`, 'opt'),
    btn('set', 'discuss', `⏱️ Dyskusja: <b>${st.discuss ? st.discuss / 60 + ' min' : '∞'}</b>`, 'opt'),
    btn('set', 'vote', `🗳️ Głosowanie: <b>${st.vote} s</b>`, 'opt'),
    btn('set', 'voice', `🗣️ Narrator: <b>${st.voice ? 'głos' : 'tylko napisy'}</b>`, 'opt'),
    btn('set', 'cards', `🃏 Karty co rano: <b>${st.cards ? st.cards + (st.cards === 1 ? ' osoba' : ' osoby') : 'wył.'}</b>`, 'opt'),
  ].join('') + (n && n < 5 ? '<div class="mwarn">Potrzeba min. 5 graczy</div>' : '');
}

/* ---------------- lobby (tryb „każdy swój telefon”) ---------------- */
T.reg('ma-mlobby', {
  html: () => `<div class="scene mlobby mafia-bg">
    <div class="mcol">
      <div class="mhead"><div class="logo-mid glitch maf" data-t="MAFIA">MAFIA</div><div class="muted">🌙 każdy swój telefon · karty mocy</div></div>
      <div class="join panel"><div class="qr-box sm"><div id="qr"></div></div>
        <div class="join-t"><b>Dołączcie telefonem!</b><p>Zeskanuj QR albo wejdź na<br><span class="url">${esc(H.playShort())}</span><br>i wpisz kod:</p><div class="code-mid tv-code">${esc(H.code())}</div><div class="tv-net ${H.net()}">${H.netTxt()}</div></div></div>
      <div class="panel grow"><h3>Mieszkańcy <span id="pc"></span> <small>OK = usuń</small></h3><div class="mplayers" id="mp"></div></div>
    </div>
    <div class="mcol">
      <div class="panel"><h3>Zasady <small>OK = zmień</small></h3><div class="setgrid" id="ms"></div></div>
      <div class="panel grow how"><h3>Jak grać</h3><div id="how" class="how-body"></div><div class="dots" id="howdots"></div></div>
      <div class="mactions">${btn('back', '', '← Tryb', 'ghost')}${btn('start', '', '▶ ZACZNIJ GRĘ', 'primary big', 'data-focus')}</div>
    </div></div>`,
  update: () => {
    const s = S();
    document.getElementById('pc').textContent = `(${s.players.length})`;
    document.getElementById('mp').innerHTML = s.players.length
      ? s.players.map(p => btn('kick', p.id, `${av(p, 'sm')}<span>${esc(p.name)}</span>${p.score ? `<small>${p.score}</small>` : ''}${p.online ? '' : '<i>📵</i>'}`, 'pchip ' + (p.online ? '' : 'off'))).join('')
      : '<div class="muted empty">Nikt jeszcze nie dołączył…<br>Zeskanujcie QR telefonami 📱</div>';
    document.getElementById('ms').innerHTML = settingsBtns();
  },
  mount: () => { H.drawQR(); howLoop(); },
});
function howLoop() {
  let i = 0; const box = document.getElementById('how'), dots = document.getElementById('howdots');
  if (!box) return;
  dots.innerHTML = MAFIA_HOW.map(() => '<i></i>').join('');
  H.every(5500, () => {
    const [e, t, d] = MAFIA_HOW[i % MAFIA_HOW.length];
    box.innerHTML = `<div class="how-step"><div class="how-e">${e}</div><b>${t}</b><p>${d}</p></div>`;
    [...dots.children].forEach((el, k) => el.classList.toggle('on', k === i % MAFIA_HOW.length));
    i++;
  });
}

/* ---------------- lobby (tryb jednego telefonu) ---------------- */
T.reg('ma-lobby', {
  html: () => `<div class="scene lobby mafia-bg">
    <div class="col">
      <div class="logo-big glitch maf" data-t="MAFIA">MAFIA</div>
      <div class="sub">Miasto kontra mafia 🌙</div>
      <div class="panel grow"><h3>Mieszkańcy <span id="pc"></span></h3><div class="pgrid" id="lp"></div></div>
      <div class="chips" id="ls"></div>
    </div>
    <div class="col narrow">
      <div class="panel how"><h3>Jak grać</h3><div id="how" class="how-body"></div><div class="dots" id="howdots"></div></div>
      <div class="panel"><h3>Role</h3><ul class="rules">${['mafia', 'cop', 'doctor', 'citizen'].map(r => `<li><b>${ROLES[r].emoji}</b>${ROLES[r].name}</li>`).join('')}</ul></div>
    </div>
    <div class="footer"><span class="pulse">Host: wciśnij <b>ZACZNIJ</b> na telefonie</span></div>
    <div class="code-corner">Kod TV: <b class="tv-code">${esc(H.code())}</b></div></div>`,
  update: () => {
    const s = S(), st = s.settings;
    document.getElementById('pc').textContent = s.players.length ? `(${s.players.length})` : '';
    document.getElementById('lp').innerHTML = s.players.map(p => `<div class="pc">${av(p, 'md')}<span>${esc(p.name)}</span>${p.score ? `<small>${p.score} pkt</small>` : ''}</div>`).join('') || '<div class="muted empty">Dodaj graczy w aplikacji…</div>';
    document.getElementById('ls').innerHTML = [`🕴️ Mafia: ${st.mafia || 'auto (' + st.autoMafia + ')'}`, st.cop ? '🕵️ Policjant' : '', st.doctor ? '🩺 Lekarz' : '', st.reveal ? '🪪 Rola po śmierci' : '🪪 Role ukryte', `⏱️ ${st.discuss ? st.discuss / 60 + ' min' : '∞'}`, st.voice ? '🗣️ Narrator' : ''].filter(Boolean).map(t => `<span class="chip">${esc(t)}</span>`).join('');
  },
  mount: () => howLoop(),
});

/* ---------------- role ---------------- */
T.reg('ma-roles', {
  html: () => {
    const s = S();
    if (!MULTI() && s.pass) {
      const p = P(s.pass.cur);
      return `<div class="scene reveal mafia-bg">
        <div class="round-tag">Partia ${s.games} · poznajcie role</div>
        <div class="pass-box ${s.pass.stage === 'act' ? 'looking' : ''}">
          ${s.pass.stage === 'act' ? '<div class="eyes">🙈</div><div class="kicker">Rolę poznaje</div>' : '<div class="phone-fly">📱</div><div class="kicker">Podajcie telefon do</div>'}
          ${av(p, 'huge bounce')}<div class="name-big" style="color:${p.color}">${esc(p.name)}</div></div>
        <div class="queue">${s.pass.order.map((id, i) => { const q = P(id); return `<div class="q ${i < s.pass.idx ? 'done' : i === s.pass.idx ? 'cur' : ''}">${av(q, 'sm')}<span>${esc(q.name)}</span>${i < s.pass.idx ? '<i>✔</i>' : ''}</div>`; }).join('')}</div></div>`;
    }
    return `<div class="scene center mreveal mafia-bg">
      <div class="round-tag">Partia ${s.games}</div>
      <div class="phone-shake">🃏</div>
      <div class="title">Poznajcie swoje role!</div>
      <p class="big-p">W grze: ${s.counts.mafia}× 🕴️ Mafia${s.counts.cop ? ' · 🕵️ Policjant' : ''}${s.counts.doctor ? ' · 🩺 Lekarz' : ''} · reszta 🙂 Obywatele</p>
      <div class="seen-grid" id="sg"></div>
      <div class="warn">🤫 Nikomu nie pokazuj swojej roli!</div>
      ${btn('skipWait', '', 'Nie czekaj na resztę ⏭', 'ghost sm')}</div>`;
  },
  update: () => {
    const s = S(), sg = document.getElementById('sg'); if (!sg) return;
    sg.innerHTML = s.ids.map(P).filter(Boolean).map(p => { const ok = s.seen.includes(p.id); return `<div class="sg ${ok ? 'ok' : ''} ${p.online ? '' : 'off'}">${av(p, 'md')}<span>${esc(p.name)}</span><i>${ok ? '✔' : '⏳'}</i></div>`; }).join('');
  },
  mount: () => { SFX('start'); if (!S().pass || S().pass.idx === 0) say('Nowa partia. Poznajcie swoje role. Nikomu ich nie pokazujcie.'); },
});

/* ---------------- noc ---------------- */
T.reg('ma-night', {
  html: () => {
    const s = S();
    const stars = Array.from({ length: 40 }, () => `<i style="left:${Math.random() * 100}%;top:${Math.random() * 60}%;animation-delay:${Math.random() * 3}s"></i>`).join('');
    const passing = !MULTI() && s.pass;
    const p = passing && P(s.pass.cur);
    return `<div class="scene center night">
      <div class="stars">${stars}</div><div class="moon"></div>
      <div class="kicker">Noc ${s.day}</div>
      <div class="title night-t">Miasto śpi…</div>
      ${passing ? `<p class="big-p">${s.pass.stage === 'act' ? 'Ruch wykonuje' : 'Podajcie telefon do'}</p>${av(p, 'lg')}<div class="name-big" style="color:${p.color}">${esc(p.name)}</div>
        <p class="muted">Każdy po kolei coś klika – nikt nie pozna ról po czasie. (${s.pass.idx + 1}/${s.pass.total})</p>`
      : `<p class="big-p">Mafia, policjant i lekarz działają. Patrzcie tylko w swoje telefony.</p>
        <div class="nightprog"><span id="nd"></span></div>
        <div class="row-c">${ring('xs')}${btn('skipWait', '', 'Zakończ noc ⏭', 'ghost sm')}</div>`}
    </div>`;
  },
  update: () => { const s = S(), el = document.getElementById('nd'); if (el) el.textContent = `Ruchy: ${s.nightDone || 0} / ${s.nightTotal || 0}`; },
  mount: () => { const s = S(); if (!s.pass || s.pass.idx === 0) { SFX('night'); say(`Noc ${s.day}. Miasto zasypia. Mafia wybiera ofiarę, policjant prowadzi śledztwo, a lekarz kogoś ratuje.${s.pass ? ' Podawajcie telefon po kolei.' : ''}`); } },
});

/* ---------------- poranek ---------------- */
T.reg('ma-morning', {
  html: () => {
    const s = S(), m = s.morning || { victims: [] };
    let body;
    if (m.victims.length) body = `<div class="kicker">Tej nocy ${m.victims.length > 1 ? 'zginęli' : 'zginęła osoba'}…</div>
      <div class="victims">${m.victims.map((v, i) => { const p = P(v.id); return `<div class="victim" style="animation-delay:${1.2 + i * 0.6}s">${av(p, 'lg')}<b>${esc(p.name)}</b>${v.role ? roleTag(v.role) : '<div class="mrole">❔ rola ukryta</div>'}${v.poison ? '<small>☠️ otruty</small>' : ''}</div>`; }).join('')}</div>`;
    else if (m.saved || m.dove) body = `<div class="big-emoji pop">🩺</div><div class="title">Nikt nie zginął!</div><p class="big-p">Mafia zaatakowała, ale ofiara została uratowana.</p>`;
    else body = `<div class="big-emoji pop">🌤️</div><div class="title">Spokojna noc</div><p class="big-p">Tej nocy nikt nie zginął.</p>`;
    return `<div class="scene center morning">
      <div class="sun"></div>
      <div class="round-tag">Dzień ${m.day}</div>
      ${body}
      ${(m.notes || []).map(n => `<div class="mnote">${esc(n)}</div>`).join('')}
      ${m.suspect ? `<p class="muted">🤔 W nocy najczęściej podejrzewano: <b>${esc(nm(m.suspect))}</b></p>` : ''}
      ${s.ghosts ? `<p class="muted">👻 Duchy rozdają karty (${s.ghosts})…</p>` : ''}
      ${MULTI() ? btn('toDay', '', 'Dalej ⏭', 'ghost sm', 'data-focus') : '<div class="footer"><span class="pulse">Host: dalej na telefonie</span></div>'}
    </div>`;
  },
  mount: () => {
    const m = S().morning || { victims: [] };
    SFX('morning');
    if (m.victims.length) {
      SFX('death', 1.2);
      say('Miasto się budzi. ' + m.victims.map(v => `Tej nocy zginęła osoba: ${nm(v.id)}.${v.role ? ' Jej rola: ' + ROLES[v.role].name + '.' : ''}`).join(' ') + ' ' + (m.notes || []).map(plain).join(' '));
    } else if (m.saved || m.dove) { SFX('saved', 1); say('Miasto się budzi. Mafia zaatakowała, ale ofiara została uratowana. Nikt nie zginął!'); }
    else say('Miasto się budzi. Tej nocy nikt nie zginął.');
  },
});

/* ---------------- dzień ---------------- */
T.reg('ma-day', {
  html: () => {
    const s = S(), alive = s.ids.filter(id => P(id) && P(id).alive !== false), dead = s.ids.filter(id => P(id) && P(id).alive === false);
    return `<div class="scene discuss dayscene">
      <div class="kicker top">☀️ Dzień ${s.day} · dyskusja</div>
      ${ring('xl')}
      ${s.spotlight ? `<div class="spot">🎙️ Głos ma: <b>${esc(nm(s.spotlight))}</b></div>` : '<div class="big-p">Kto z was należy do mafii?</div>'}
      <div class="mplist">${players(alive)}</div>
      ${dead.length ? `<div class="mplist ghosts">${players(dead)}</div>` : ''}
      ${feed()}
      ${MULTI() ? btn('voteNow', '', '🗳️ Głosujemy', 'primary', 'data-focus') : ''}</div>`;
  },
  update: () => { const f = document.querySelector('.mfeed'); const s = S(); if (f) f.outerHTML = feed() || '<div class="mfeed"></div>'; else if ((s.feed || []).length) { const d = document.querySelector('.dayscene'); if (d) d.insertAdjacentHTML('beforeend', feed()); } },
  mount: () => say('Czas na dyskusję. Kto z was należy do mafii?'),
});

/* ---------------- głosowanie ---------------- */
T.reg('ma-vote', {
  html: () => {
    const s = S(), alive = s.ids.map(P).filter(p => p && p.alive !== false);
    const rows = alive.map(p => ({ id: p.id, html: `${av(p, 'sm')}<span>${esc(p.name)}${(s.gagged || []).includes(p.id) ? ' 🤐' : ''}</span>`, c: p.color })).concat([{ id: 'skip', html: '<div class="av sm" style="--c:#888">⏭️</div><span>Pomijam</span>', c: '#999' }]);
    return `<div class="scene vote">
      <div class="vote-head">${ring('md')}<div><div class="title">🗳️ KOGO WYRZUCAMY?</div><p class="big-p">Głosujcie na swoich telefonach <b id="vc"></b></p>${MULTI() ? btn('endVote', '', 'Zakończ głosowanie ⏭', 'ghost sm') : ''}</div></div>
      <div class="bars ${s.secret ? 'secret' : ''}">${s.secret ? '<div class="secretbox">🗳️ Tajna urna – wyniki dopiero po głosowaniu</div>' : rows.map(r => `<div class="bar" data-id="${r.id}"><div class="bl">${r.html}</div><div class="track"><div class="fill" style="--c:${r.c}"></div><div class="voters"></div></div><b class="num">0</b></div>`).join('')}</div>
      ${feed()}</div>`;
  },
  update: () => {
    const s = S(), vc = document.getElementById('vc'); if (vc) vc.textContent = `(${s.voteCount || 0}/${s.voteTotal || 0})`;
    const v = s.votes || {}, max = Math.max(1, ...Object.values(v));
    document.querySelectorAll('.bar').forEach(b => {
      const n = v[b.dataset.id] || 0, num = b.querySelector('.num');
      b.querySelector('.fill').style.width = (n / max) * 100 + '%';
      if (num.textContent !== String(n)) { num.textContent = n; num.classList.remove('bump'); void num.offsetWidth; num.classList.add('bump'); }
      b.classList.toggle('lead', n > 0 && n === max);
      const B = s.ballots || {}, vs = Object.keys(B).filter(x => B[x] === b.dataset.id);
      const box = b.querySelector('.voters'), key = vs.join(',');
      if (box.dataset.k !== key) { box.dataset.k = key; box.innerHTML = vs.map(P).filter(Boolean).map(p => av(p, 'xs')).join(''); }
    });
    const f = document.querySelector('.vote .mfeed'); if (f) f.outerHTML = feed() || '<div class="mfeed"></div>';
  },
  mount: () => { SFX('blip'); say('Głosowanie! Kogo wyrzucamy z miasta?'); },
});

/* ---------------- wyrok ---------------- */
T.reg('ma-elim', {
  html: () => {
    const s = S(), e = s.elim || {}, p = e.out && P(e.out);
    let body;
    if (p) body = `<div class="kicker">Miasto zdecydowało</div>${av(p, 'huge')}<div class="name-big" style="color:${p.color}">${esc(p.name)}</div><div class="late">${e.role ? `<div class="stamp ${e.role === 'mafia' ? 'yes' : 'no'}">${e.role === 'mafia' ? 'BYŁ(A) W MAFII!' : ROLES[e.role].emoji + ' ' + ROLES[e.role].name.toUpperCase()}</div>` : '<div class="mrole">❔ rola ukryta</div>'}</div>`;
    else body = `<div class="big-emoji pop">${e.tie ? '⚖️' : '🤷'}</div><div class="title">${e.tie ? 'Remis' : 'Nikt nie odpada'}</div><p class="big-p">${e.tie ? 'Nikt nie odpada.' : ''}</p>`;
    const b = e.bomb && P(e.bomb);
    return `<div class="scene center elim">
      ${body}
      ${b ? `<div class="bombline late2">💣 Razem z nim/nią ginie: ${av(b, 'sm')} <b>${esc(b.name)}</b> ${e.bombRole ? roleTag(e.bombRole) : ''}</div>` : ''}
      ${(e.notes || []).map(n => `<div class="mnote late2">${esc(n)}</div>`).join('')}
      ${MULTI() ? btn('toNight', '', 'Dalej ⏭', 'ghost sm', 'data-focus') : '<div class="footer"><span class="pulse">Host: dalej na telefonie</span></div>'}</div>`;
  },
  mount: () => {
    const e = S().elim || {};
    if (e.out) { SFX('drum'); SFX(e.role === 'mafia' ? 'fanfare' : 'death', 2.6); say(`Miasto zdecydowało. Odpada: ${nm(e.out)}.${e.role ? ' Jej rola: ' + ROLES[e.role].name + '.' : ''} ${(e.notes || []).map(plain).join(' ')}`); }
    else { SFX('blip'); say((e.tie ? 'Remis. ' : '') + 'Nikt nie odpada. ' + (e.notes || []).map(plain).join(' ')); }
  },
});

/* ---------------- koniec partii ---------------- */
T.reg('ma-end', {
  html: () => {
    const s = S(), town = s.winner === 'town';
    const all = s.players.filter(p => s.roles && s.roles[p.id]);
    return `<div class="scene center mend ${town ? 'town' : 'maf'}">
      <div class="kicker">Koniec gry</div>
      <div class="title glitch" data-t="${town ? 'WYGRYWA MIASTO' : 'WYGRYWA MAFIA'}">${town ? '🏙️ WYGRYWA MIASTO' : '🕴️ WYGRYWA MAFIA'}</div>
      <div class="rolegrid">${all.map((p, i) => `<div class="rcard r-${s.roles[p.id]} ${p.alive ? '' : 'dead'}" style="animation-delay:${0.3 + i * 0.08}s">${av(p, 'md')}<b>${esc(p.name)}</b><span>${ROLES[s.roles[p.id]].emoji} ${ROLES[s.roles[p.id]].name}</span>${p.delta ? `<i>+${p.delta}</i>` : ''}</div>`).join('')}</div>
      ${MULTI() ? btn('scores', '', '🏆 Tabela wyników', 'primary', 'data-focus') : '<div class="footer"><span class="pulse">Host: tabela wyników</span></div>'}</div>`;
  },
  mount: () => { const town = S().winner === 'town'; H.confetti(140); SFX(town ? 'town_win' : 'mafia_win'); say(town ? 'Koniec gry. Mafia została rozbita. Wygrywa miasto!' : 'Koniec gry. Mafia przejęła miasto. Wygrywa mafia!'); },
});

// muzyka dla scen Mafii
T.mafiaMusic = k => ({ 'ma-mlobby': 'lobby', 'ma-lobby': 'lobby', 'ma-roles': 'menu', 'ma-night': 'night', 'ma-day': 'day', 'ma-vote': 'vote', scores: 'victory' })[k] || null;

// narrator czyta nowe ogłoszenia z kart (dzień i głosowanie)
let lastFeed = 0;
T.onDraw = (s, scene) => {
  if (!s || s.game !== 'mafia') return;
  const f = (s.feed || []).filter(x => x.at > lastFeed);
  if (f.length) {
    const newest = f[f.length - 1];
    if (lastFeed && (scene === 'ma-day' || scene === 'ma-vote')) { say(plain(newest.text), { queue: true }); SFX('pop'); }
    lastFeed = newest.at;
  }
};
})();
