/* Mafia – przebieg partii (fazy, zegary, automaty, karty mocy). Wspólny dla:
   - telewizora w trybie „każdy swój telefon” (js/mafiagame.js) – z kartami mocy
   - telefonu hosta w trybie jednego telefonu (js/mafia-host.js) – bez kart */
(function (root) {
'use strict';
const M = root.MafiaCore;
const KC = () => root.MafiaCards;
const pickR = a => a[Math.floor(Math.random() * a.length)];

function create(opts) {
  const mode = opts.mode; // 'multi' | 'single'
  const E = {
    mode,
    players: [],
    settings: Object.assign({}, M.DEFAULTS, opts.settings || {}),
    phase: 'setup', st: null, timer: null, auto: null, msg: '',
    morning: null, elim: null, games: 0,
    pass: null,
    deck: [], hands: {}, offers: {}, feed: [], played: {}, nightCards: [], voteCards: [], gagged: {}, priv: {}, privFx: {},
    poisoned: {}, flags: {}, secretVote: false, spotlight: null,
  };
  if (mode === 'single') E.settings.cards = 0;
  else if (E.settings.cards === undefined) E.settings.cards = 2;
  const changed = () => opts.render && opts.render();
  const player = id => E.players.find(p => p.id === id);
  const inGame = id => !!(E.st && E.st.roles && E.st.roles[id]);
  const online = id => { const p = player(id); return mode === 'single' || !!(p && p.online); };
  const nameOf = id => { const p = player(id); return p ? p.name : '?'; };
  const aliveP = id => !!(E.st && E.st.players.find(q => q.id === id && q.alive));
  const team = id => M.ROLES[E.st.roles[id]].team;

  /* ---------- zegar ---------- */
  E.timerLeft = () => { const t = E.timer; if (!t) return 0; return t.running ? Math.max(0, t.endsAt - Date.now()) : t.left; };
  const mkTimer = (sec, onEnd) => ({ total: sec, endsAt: Date.now() + sec * 1000, left: sec * 1000, running: true, done: false, onEnd });
  const tick = setInterval(() => {
    const t = E.timer;
    if (!t || !t.running || t.done || E.timerLeft() > 0) return;
    t.done = true; t.running = false; t.left = 0;
    if (t.onEnd) t.onEnd(); else changed();
  }, 250);
  E.pause = () => { const t = E.timer; if (t && t.running) { t.left = E.timerLeft(); t.running = false; changed(); } };
  E.resume = () => { const t = E.timer; if (t && !t.running && !t.done) { t.endsAt = Date.now() + t.left; t.running = true; changed(); } };
  function addTime(sec) {
    const t = E.timer; if (!t) return;
    t.left = Math.max(3000, E.timerLeft() + sec * 1000); t.total = Math.max(t.total + sec, 5); t.done = false;
    if (t.running) t.endsAt = Date.now() + t.left;
  }
  E.plus30 = () => { addTime(30); changed(); };
  function later(ms, fn) { clearTimeout(E.auto); E.auto = setTimeout(() => { E.auto = null; fn(); }, ms); }
  function cancel() { clearTimeout(E.auto); E.auto = null; }
  E.destroy = () => { clearInterval(tick); cancel(); };
  E.toast = t => { E.msg = t; changed(); setTimeout(() => { if (E.msg === t) { E.msg = ''; changed(); } }, 4000); };

  E.addPlayer = p => { E.players.push(Object.assign({ score: 0, delta: 0, online: true }, p)); changed(); };
  E.removePlayer = id => { E.players = E.players.filter(p => p.id !== id); changed(); };

  /* ---------- karty: narzędzia ---------- */
  const cardsOn = () => mode === 'multi' && E.settings.cards > 0 && !!KC();
  const C = k => KC().CARDS[k];
  function announce(text) { E.feed.push({ text, at: Date.now() }); if (E.feed.length > 30) E.feed.shift(); E.toast(text); }
  function privMsg(id, text) { (E.priv[id] = E.priv[id] || []).push(text); }
  // dane do animacji na telefonie (śledztwo, ocalenie, alarm…)
  function privFx(id, fx) { (E.privFx[id] = E.privFx[id] || []).push(fx); }
  const hand = id => (E.hands[id] = E.hands[id] || []);
  const inPlay = () => [...Object.values(E.hands).flat(), ...Object.values(E.offers).flat()];
  function drawFor(t) { return KC().drawFor(E.deck, t, inPlay()); }
  function giveCard(id, k, why) {
    if (!k || hand(id).length >= KC().HAND_MAX) return false;
    hand(id).push(k); if (why) privMsg(id, `${why}: ${C(k).emoji} ${C(k).name}`);
    return true;
  }
  const passive = (id, op) => hand(id).find(k => C(k).when === 'passive' && KC().has(k, op));
  function usePassive(id, op) { const k = passive(id, op); if (k) { hand(id).splice(hand(id).indexOf(k), 1); return k; } return null; }
  const cardName = k => `${C(k).emoji} ${C(k).name}`;

  function onDeath(id) {
    if (!cardsOn()) return;
    if (usePassive(id, 'insurance')) {
      const left = hand(id).splice(0);
      left.forEach(k => { const al = M.alive(E.st).filter(q => hand(q.id).length < KC().HAND_MAX); if (al.length) giveCard(pickR(al).id, k, '📄 Dostajesz kartę z polisy zmarłego'); });
      if (left.length) announce(`📄 Polisa! Karty gracza ${nameOf(id)} trafiły do innych.`);
    }
  }

  /* ---------- przebieg ---------- */
  E.start = () => {
    const ps = E.players.filter(p => mode === 'single' || p.online);
    if (ps.length < 5) return E.toast('Mafia potrzebuje minimum 5 graczy');
    E.st = { settings: E.settings, players: ps };
    M.newGame(E.st);
    E.games++; E.morning = null; E.elim = null;
    E.hands = {}; E.offers = {}; E.feed = []; E.priv = {}; E.played = {}; E.poisoned = {}; E.flags = {};
    E.deck = cardsOn() ? KC().makeDeck() : [];
    E.timer = null; cancel();
    E.phase = 'roles'; E.st.seen = {};
    E.pass = mode === 'single' ? { order: ps.map(p => p.id), idx: 0, stage: 'pass' } : null;
    changed();
  };
  E.seen = id => {
    if (E.phase !== 'roles' || !inGame(id) || E.st.seen[id]) return;
    E.st.seen[id] = true; changed();
    if (E.st.players.filter(p => online(p.id)).every(p => E.st.seen[p.id])) later(2500, goNight);
  };
  E.skipWait = () => { if (E.phase === 'roles') goNight(); else if (E.phase === 'night') endNight(); };

  function goNight() {
    cancel(); M.startNight(E.st); E.phase = 'night'; E.nightCards = []; E.priv = {}; E.privFx = {}; E.spotlight = null;
    E.timer = mode === 'multi' ? mkTimer(E.settings.night, endNight) : null;
    E.pass = mode === 'single' ? { order: M.alive(E.st).map(p => p.id), idx: 0, stage: 'pass' } : null;
    changed();
  }
  E.night = (id, target) => {
    if (E.phase !== 'night' || !inGame(id)) return { ok: false };
    const r = M.nightAction(E.st, id, target);
    changed();
    if (mode === 'multi') checkNight();
    return r;
  };
  function checkNight() {
    const pend = M.nightPending(E.st).filter(online);
    const mafia = M.alive(E.st).filter(p => M.isMafia(E.st, p.id)).map(p => p.id);
    if (!pend.length && M.mafiaAgreed(E.st.night.mafia, mafia.filter(online))) later(2500, endNight);
    else if (!pend.length) later(7000, endNight);
    else cancel();
  }

  /* ---------- rozstrzygnięcie nocy (role + karty) ---------- */
  function endNight() {
    cancel(); E.timer = null; E.pass = null;
    const st = E.st, N = st.night, recs = E.nightCards;
    const fx = op => recs.flatMap(r => C(r.card).fx.filter(f => f.op === op).map(f => Object.assign({ by: r.by, target: r.target, card: r.card }, f)));
    // 1) blokady
    const blocked = new Set();
    fx('block').forEach(f => { if (!passive(f.target, 'unblockable')) blocked.add(f.target); });
    fx('selfblock').forEach(f => blocked.add(f.by));
    const ok = f => !blocked.has(f.by) || f.op === 'block' || f.op === 'protect' && f.who === 'self';
    blocked.forEach(id => {
      if (!aliveP(id)) return;
      const r0 = st.roles[id];
      delete N.mafia[id]; delete N.suspect[id];
      if (r0 === 'doctor') N.heal = null;
      if (r0 === 'cop') N.check = null;
      if (!fx('selfblock').some(f => f.by === id)) privMsg(id, '⛓️ Ktoś cię zablokował – tej nocy twój ruch i karty przepadły.');
    });
    // 2) wygląd przy śledztwach
    const look = {};
    fx('look').filter(ok).forEach(f => { look[f.who === 'self' ? f.by : f.target] = f.as; });
    st.players.forEach(p => { if (p.alive && passive(p.id, 'camo')) look[p.id] = look[p.id] || 'town'; });
    const seemsMafia = id => { const real = M.isMafia(st, id), l = look[id]; return l === 'town' ? false : l === 'mafia' ? true : l === 'flip' ? !real : real; };
    const seemsSpecial = id => { const real = st.roles[id] !== 'citizen', l = look[id]; return l === 'flip' ? !real : l === 'mafia' ? true : real; };
    const seemsRole = id => { const l = look[id]; if (l === 'town') return M.isMafia(st, id) ? 'citizen' : st.roles[id]; if (l === 'mafia') return 'mafia'; if (l === 'flip') return M.isMafia(st, id) ? 'citizen' : 'mafia'; return st.roles[id]; };
    // 3) ochrona
    const protect = new Set();
    fx('protect').filter(ok).forEach(f => protect.add(f.who === 'self' ? f.by : f.target));
    fx('cure').filter(ok).forEach(f => { delete E.poisoned[f.target]; });
    const doc = M.alive(st).find(p => st.roles[p.id] === 'doctor');
    const sabotaged = fx('sabotage').some(ok);
    const heal = doc && !blocked.has(doc.id) && !sabotaged ? N.heal : null;
    if (heal) protect.add(heal);
    st.lastHeal = doc && !blocked.has(doc.id) ? N.heal : null;
    // 4) ataki
    const attacks = [];
    const mafiaAlive = M.alive(st).filter(p => M.isMafia(st, p.id)).map(p => p.id);
    const main = E.flags.truce ? null : M.resolveMafiaTarget(N.mafia, mafiaAlive.filter(id => !blocked.has(id)));
    const notes = [];
    if (E.flags.truce) { notes.push('🤝 Rozejm – tej nocy mafia nie zaatakowała.'); E.flags.truce = false; }
    if (main) attacks.push({ target: main, by: mafiaAlive.filter(id => N.mafia[id] === main), main: true });
    fx('kill').filter(ok).forEach(f => { if (aliveP(f.target)) attacks.push({ target: f.target, by: [f.by] }); });
    Object.entries(E.poisoned).forEach(([id, d]) => { if (d <= st.day && aliveP(id)) { attacks.push({ target: id, by: [], poison: true }); delete E.poisoned[id]; } });
    fx('poison').filter(ok).forEach(f => { if (aliveP(f.target)) E.poisoned[f.target] = st.day + 1; });
    const victims = [];
    let saved = false, dove = false;
    const silent = fx('silent').some(ok);
    attacks.forEach(a => {
      const t = a.target;
      if (!aliveP(t)) return;
      if ((fx('alarm').some(f => f.by === t && ok(f)) || passive(t, 'alarmp')) && a.by.length) { const at = pickR(a.by); privMsg(t, `🚨 Alarm! Zaatakował cię: ${nameOf(at)}`); privFx(t, { k: 'alarm', t: at }); }
      if (a.main && fx('trap').some(f => f.by === t && ok(f))) { const m = pickR(mafiaAlive); if (m) notes.push(`🪤 Pułapka! ${nameOf(m)} należy do mafii!`); }
      if (protect.has(t)) { saved = true; privFx(t, { k: 'shield' }); return; }
      if (usePassive(t, 'dove')) { dove = true; privMsg(t, '🕊️ Karta uratowała ci życie tej nocy!'); privFx(t, { k: 'dove' }); return; }
      const p = st.players.find(q => q.id === t); p.alive = false; p.diedNight = st.day;
      victims.push({ id: t, role: E.settings.reveal && !(a.main && silent) ? st.roles[t] : null, poison: !!a.poison });
      if (cardsOn() && usePassive(t, 'revenge')) {
        if (Math.random() < 0.5) {
          const m = pickR(M.alive(st).filter(q => M.isMafia(st, q.id)));
          if (m) { m.alive = false; victims.push({ id: m.id, role: E.settings.reveal ? 'mafia' : null, revenge: true }); notes.push(`👊 Zemsta zza grobu! Ginie też ${m.name}.`); onDeath(m.id); }
        } else notes.push('👊 Zemsta nie wyszła…');
      }
      onDeath(t);
    });
    // 5) śledztwa i obserwacje (wyniki prywatne)
    const cop = st.players.find(p => st.roles[p.id] === 'cop' && (p.alive || p.diedNight === st.day));
    if (cop && N.check) { privMsg(cop.id, `🕵️ Śledztwo: ${nameOf(N.check)} ${seemsMafia(N.check) ? 'JEST w mafii!' : 'nie jest w mafii.'}`); privFx(cop.id, { k: 'check', t: N.check, m: seemsMafia(N.check), src: '🕵️ Śledztwo' }); }
    fx('inv').filter(ok).forEach(f => {
      const ic = cardName(f.card);
      if (f.kind === 'mafia') { privMsg(f.by, `${ic}: ${nameOf(f.target)} ${seemsMafia(f.target) ? 'JEST w mafii!' : 'nie jest w mafii.'}`); privFx(f.by, { k: 'check', t: f.target, m: seemsMafia(f.target), src: ic }); }
      if (f.kind === 'special') privMsg(f.by, `${ic}: ${nameOf(f.target)} ${seemsSpecial(f.target) ? 'ma specjalną rolę.' : 'nie ma specjalnej roli.'}`);
      if (f.kind === 'role') { const R = M.ROLES[seemsRole(f.target)]; privMsg(f.by, `${ic}: ${nameOf(f.target)} to ${R.emoji} ${R.name}.`); privFx(f.by, { k: 'role', t: f.target, r: seemsRole(f.target), src: ic }); }
    });
    const visits = id => {
      const v = new Set();
      Object.entries(N.mafia).forEach(([m, t]) => { if (t === id) v.add(m); });
      if (heal === id && doc) v.add(doc.id);
      if (N.check === id && cop) v.add(cop.id);
      recs.filter(r => r.target === id && !blocked.has(r.by)).forEach(r => v.add(r.by));
      return [...v];
    };
    fx('watch').filter(ok).forEach(f => { const v = visits(f.target).filter(x => x !== f.by); privMsg(f.by, `${cardName(f.card)}: u ${nameOf(f.target)} byli: ${v.length ? v.map(nameOf).join(', ') : 'nikt'}.`); });
    fx('track').filter(ok).forEach(f => {
      const t = f.target, where = new Set();
      if (N.mafia[t]) where.add(N.mafia[t]);
      if (st.roles[t] === 'doctor' && N.heal) where.add(N.heal);
      if (st.roles[t] === 'cop' && N.check) where.add(N.check);
      recs.filter(r => r.by === t && r.target).forEach(r => where.add(r.target));
      privMsg(f.by, `${cardName(f.card)}: ${nameOf(t)} odwiedził(a): ${where.size ? [...where].map(nameOf).join(', ') : 'nikogo'}.`);
    });
    fx('autopsy').filter(ok).forEach(f => { const R = M.ROLES[st.roles[f.target]]; if (R) privMsg(f.by, `${cardName(f.card)}: ${nameOf(f.target)} to był(a) ${R.emoji} ${R.name}.`); });
    fx('peek').filter(ok).forEach(f => {
      const hidden = fx('hidehand').some(h => h.by === f.target && ok(h));
      privMsg(f.by, hidden ? `${cardName(f.card)}: karty ${nameOf(f.target)} są w sejfie 🔐` : `${cardName(f.card)}: ${nameOf(f.target)} ma: ${hand(f.target).map(cardName).join(', ') || 'brak kart'}.`);
    });
    const cnt = {}; Object.values(N.suspect || {}).forEach(t => { cnt[t] = (cnt[t] || 0) + 1; });
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
    E.morning = { day: st.day, victims, saved, dove, notes, suspect: top && top[1] >= 2 ? top[0] : null, poison: victims.some(v => v.poison) };
    if (main) mafiaAlive.forEach(m => privFx(m, { k: 'hit', t: main, ok: victims.some(v => v.id === main) }));
    victims.forEach(v => privFx(v.id, { k: 'dead' }));
    notes.forEach(n => E.feed.push({ text: n, at: Date.now() }));
    dealCards();
    E.phase = 'morning'; changed();
    if (mode === 'multi') later(11000, afterMorning);
  }
  /** Rano: telewizor losowo rozdaje karty żywym, a duchy dostają po 2 karty do rozdania. */
  function dealCards() {
    if (!cardsOn()) return;
    const al = M.shuffle(M.alive(E.st).filter(p => hand(p.id).length < KC().HAND_MAX));
    const n = Math.min(al.length, E.settings.cards);
    al.slice(0, n).forEach(p => giveCard(p.id, drawFor(team(p.id)), '📺 Telewizor dał ci kartę'));
    if (n) E.feed.push({ text: `📺 Telewizor rozdał karty (${n}).`, at: Date.now() });
    E.st.players.filter(p => !p.alive).forEach(p => { E.offers[p.id] = [drawFor(team(p.id)), drawFor(team(p.id))].filter(Boolean); });
  }
  function afterMorning() { const w = M.checkWin(E.st); if (w) return finish(w); goDay(); }
  E.toDay = () => { if (E.phase === 'morning') afterMorning(); };
  function goDay() { cancel(); E.phase = 'day'; E.timer = E.settings.discuss ? mkTimer(E.settings.discuss, goVote) : null; changed(); }
  function goVote() { cancel(); E.phase = 'vote'; E.st.ballots = {}; E.voteCards = []; E.gagged = {}; E.secretVote = false; E.timer = mkTimer(E.settings.vote, endVote); changed(); }
  E.voteNow = () => { if (E.phase === 'day') goVote(); };
  E.vote = (id, target) => {
    if (E.phase !== 'vote' || !inGame(id)) return;
    if (!aliveP(id) || E.gagged[id]) return;
    if (target !== 'skip' && (!aliveP(target) || target === id)) return;
    if (E.st.ballots[id] === target) delete E.st.ballots[id]; else E.st.ballots[id] = target;
    changed();
    if (mode === 'multi') {
      const need = M.alive(E.st).filter(q => online(q.id) && !E.gagged[q.id]);
      if (need.length && need.every(q => E.st.ballots[q.id])) later(2500, endVote); else cancel();
    }
  };

  /* ---------- rozstrzygnięcie głosowania (z kartami) ---------- */
  function endVote() {
    cancel(); E.timer = null;
    const st = E.st, B = Object.assign({}, st.ballots), recs = E.voteCards;
    const fx = op => recs.flatMap(r => C(r.card).fx.filter(f => f.op === op).map(f => Object.assign({ by: r.by, target: r.target }, f)));
    fx('bribe').forEach(f => { if (B[f.by] && !E.gagged[f.target]) B[f.target] = B[f.by] === f.target ? 'skip' : B[f.by]; });
    const weight = {}; fx('weight').forEach(f => { weight[f.by] = Math.max(weight[f.by] || 1, f.n); });
    const magnet = {}; fx('magnet').forEach(f => { magnet[f.by] = f.target; });
    const counts = {}, voters = {};
    Object.entries(B).forEach(([v, t0]) => {
      if (E.gagged[v]) return;
      const t = t0 !== 'skip' && magnet[t0] ? magnet[t0] : t0;
      counts[t] = (counts[t] || 0) + (weight[v] || 1);
      (voters[t0] = voters[t0] || []).push(v);
    });
    fx('push').forEach(f => { counts[f.target] = (counts[f.target] || 0) + f.n; });
    fx('skipbonus').forEach(f => { counts.skip = (counts.skip || 0) + f.n; });
    fx('shield').forEach(f => { if (counts[f.by]) counts[f.by] = Math.max(0, counts[f.by] - f.n); });
    const el = { out: null, tie: false, counts, notes: [] };
    const reverse = fx('reverse').length > 0;
    const ents = Object.entries(counts).filter(([k, v]) => v > 0 && (!reverse || k !== 'skip'));
    if (ents.length) {
      const best = reverse ? Math.min(...ents.map(([, v]) => v)) : Math.max(...ents.map(([, v]) => v));
      let top = ents.filter(([, v]) => v === best).map(([k]) => k);
      if (top.length > 1) {
        const tb = fx('tiebreak').find(f => top.includes(B[f.by]));
        if (tb) { top = [B[tb.by]]; el.notes.push(`🔨 Remis rozstrzygnął ${nameOf(tb.by)}!`); }
      }
      if (top.length > 1) el.tie = true;
      else el.out = top[0] === 'skip' ? null : top[0];
      if (reverse) el.notes.push('🔃 Odwrócenie! Odpada osoba z najmniejszą liczbą głosów.');
    }
    if (Object.keys(magnet).length) el.notes.push('🧲 Magnes! Część głosów zmieniła adresata.');
    if (fx('push').length) el.notes.push('📢 Nagonka dorzuciła głosy!');
    if (el.out && (fx('veto').length || E.flags.vetoNext)) { el.notes.push(E.flags.vetoNext ? '🏳️ Amnestia – dziś nikt nie odpada.' : '🛑 WETO! Ktoś zablokował wyrok.'); el.out = null; el.vetoed = true; }
    E.flags.vetoNext = false;
    if (el.out && fx('immune').some(f => (f.who === 'self' ? f.by : f.target) === el.out)) { el.notes.push(`🛡️ ${nameOf(el.out)} ma Immunitet – nikt nie odpada.`); el.out = null; el.immune = true; }
    if (el.out && cardsOn() && usePassive(el.out, 'lynchsave')) { el.notes.push(`🪂 ${nameOf(el.out)} uniknął wyrzucenia dzięki karcie!`); el.out = null; el.immune = true; }
    if (el.out) {
      const p = st.players.find(q => q.id === el.out); p.alive = false;
      el.role = E.settings.reveal ? st.roles[el.out] : null;
      if (cardsOn() && usePassive(el.out, 'bomb')) {
        const cand = (voters[el.out] || []).filter(v => v !== el.out && aliveP(v));
        if (cand.length) {
          const b = pickR(cand); st.players.find(q => q.id === b).alive = false;
          el.bomb = b; el.bombRole = E.settings.reveal ? st.roles[b] : null;
          el.notes.push(`💣 BOMBA! ${nameOf(el.out)} zabiera ze sobą: ${nameOf(b)}!`);
          onDeath(b);
        }
      }
      onDeath(el.out);
    }
    el.secret = E.secretVote;
    E.elim = el;
    el.notes.forEach(n => E.feed.push({ text: n, at: Date.now() }));
    E.phase = 'elim'; changed();
    if (mode === 'multi') later(10000, afterElim);
  }
  E.endVote = () => { if (E.phase === 'vote') endVote(); };
  function afterElim() { const w = M.checkWin(E.st); if (w) return finish(w); goNight(); }
  E.toNight = () => { if (E.phase === 'elim') afterElim(); };
  function finish(w) { cancel(); E.timer = null; E.st.winner = w; M.applyScores(E.st, w); E.phase = 'end'; changed(); }
  E.scores = () => { cancel(); E.phase = 'scores'; changed(); };
  E.lobby = () => { cancel(); E.timer = null; E.st = null; E.phase = 'setup'; E.pass = null; changed(); };
  E.resetScores = () => { E.players.forEach(p => { p.score = 0; p.delta = 0; }); changed(); };

  /* ---------- zagrywanie kart ---------- */
  E.playCard = (id, idx, target) => {
    if (!cardsOn() || !inGame(id)) return { ok: false };
    const h = hand(id), k = h[idx], c = k && C(k);
    if (!c || !aliveP(id)) return { ok: false, msg: 'Nie możesz teraz zagrać.' };
    if (c.when === 'passive') return { ok: false, msg: 'Ta karta działa sama – wystarczy ją mieć.' };
    if (c.when !== E.phase) return { ok: false, msg: `Tę kartę zagrywa się ${{ night: 'w nocy', day: 'w trakcie dyskusji', vote: 'w głosowaniu' }[c.when]}.` };
    const key = E.phase + E.st.day;
    if ((E.played[key] = E.played[key] || {})[id]) return { ok: false, msg: 'W tej fazie zagrałeś już kartę.' };
    if (c.target === 'other' && (!aliveP(target) || target === id)) return { ok: false, msg: 'Wybierz żywą osobę.' };
    if (c.target === 'dead' && (!inGame(target) || aliveP(target))) return { ok: false, msg: 'Wybierz martwą osobę.' };
    h.splice(idx, 1); E.played[key][id] = true;
    const rec = { by: id, card: k, target: c.target === 'none' ? null : target };
    if (c.when === 'night') { E.nightCards.push(rec); privMsg(id, `✅ Zagrano ${cardName(k)} – efekt rano.`); }
    else if (c.when === 'vote') playVote(rec);
    else playDay(rec);
    changed();
    return { ok: true };
  };
  function playVote(rec) {
    E.voteCards.push(rec);
    C(rec.card).fx.forEach(f => {
      if (f.op === 'weight') announce(`${cardName(rec.card)}! Czyjś głos liczy się ${f.n === 3 ? 'potrójnie' : 'podwójnie'}.`);
      if (f.op === 'gag') {
        let victim = rec.target;
        if (cardsOn() && usePassive(victim, 'reflect')) { victim = rec.by; announce(`🔊 Echo! Knebel odbił się na ${nameOf(victim)}.`); }
        else announce(`${cardName(rec.card)}! ${nameOf(victim)} nie głosuje.`);
        E.gagged[victim] = true; delete E.st.ballots[victim];
      }
      if (f.op === 'votetime') { addTime(f.sec); announce(`💬 Ostatnie słowo: +${f.sec} s głosowania.`); }
      if (f.op === 'secret') { E.secretVote = true; announce('🗳️ Tajna urna – głosy są ukryte!'); }
    });
  }
  function playDay(rec) {
    const st = E.st, by = rec.by, t = rec.target;
    const run = f => {
      const al = M.alive(st), maf = al.filter(q => M.isMafia(st, q.id)), inn = al.filter(q => !M.isMafia(st, q.id));
      switch (f.op) {
        case 'time': addTime(f.sec); announce(`${cardName(rec.card)}: ${f.sec > 0 ? '+' : ''}${f.sec} s dyskusji.`); break;
        case 'spotlight': E.spotlight = t; announce(`${cardName(rec.card)}: ${nameOf(t)} ma głos – niech się tłumaczy!`); break;
        case 'count': announce(`📰 Gazeta: w mieście żyje ${maf.length} ${maf.length === 1 ? 'mafioso' : 'mafiozów'}.`); break;
        case 'fakecount': { const n = Math.max(0, maf.length + (Math.random() < 0.5 || maf.length === 0 ? 1 : -1)); announce(`📰 Gazeta: w mieście żyje ${n} ${n === 1 ? 'mafioso' : 'mafiozów'}.`); break; }
        case 'specialcount': { const n = al.filter(q => ['cop', 'doctor'].includes(st.roles[q.id])).length; announce(`📊 Statystyka: żyje ${n} ${n === 1 ? 'specjalna rola' : 'specjalne role'} miasta.`); break; }
        case 'crystal': {
          const one = pickR(maf); const others = M.shuffle(al.filter(q => q !== one)).slice(0, f.n - 1);
          const names = M.shuffle([one, ...others].filter(Boolean)).map(q => q.name);
          announce(`${cardName(rec.card)}: wśród ${names.join(', ')} jest mafia!`); break;
        }
        case 'clear': { const c = pickR(inn.filter(q => q.id !== by)) || pickR(inn); if (c) announce(`${cardName(rec.card)}: ${c.name} NIE jest w mafii.`); break; }
        case 'rumor': { const c = pickR(inn.filter(q => q.id !== by)); if (c) announce(`🗣️ Plotka głosi, że ${c.name} coś ukrywa…`); break; }
        case 'deadroles': { const d = st.players.filter(q => !q.alive); announce(d.length ? `🪦 Cmentarz: ${d.map(q => `${q.name} – ${M.ROLES[st.roles[q.id]].name}`).join(', ')}` : '🪦 Cmentarz jest pusty.'); break; }
        case 'peek': privMsg(by, `${cardName(rec.card)}: ${nameOf(t)} ma: ${hand(t).map(cardName).join(', ') || 'brak kart'}.`); break;
        case 'steal': {
          const th = hand(t);
          if (!th.length) announce(`${cardName(rec.card)}… ale kieszeń ${nameOf(t)} była pusta.`);
          else if (hand(by).length >= KC().HAND_MAX) privMsg(by, 'Masz pełną rękę – kradzież nieudana.');
          else { const got = th.splice(Math.floor(Math.random() * th.length), 1)[0]; giveCard(by, got, '🧤 Zdobyłeś kartę'); privMsg(t, '🧤 Ktoś ukradł ci kartę!'); if (!f.quiet) announce(`${cardName(rec.card)}! ${nameOf(t)} traci kartę.`); }
          break;
        }
        case 'destroy': { const th = hand(t); if (th.length) { const k = th.splice(Math.floor(Math.random() * th.length), 1)[0]; announce(`🗑️ Niszczarka! ${nameOf(t)} traci kartę ${cardName(k)}.`); } else announce('🗑️ Niszczarka… nic do zniszczenia.'); break; }
        case 'swap': { const a = hand(by).splice(0), b = hand(t).splice(0); E.hands[by] = b; E.hands[t] = a; privMsg(t, '🔄 Ktoś zamienił się z tobą kartami!'); announce(`🔄 Wymiana kart z ${nameOf(t)}!`); break; }
        case 'draw': { for (let i = 0; i < f.n; i++) giveCard(by, drawFor(team(by)), '🍀 Dobierasz kartę'); announce(`${cardName(rec.card)}: ktoś dobiera ${f.n === 1 ? 'kartę' : f.n + ' karty'}.`); break; }
        case 'random': run(pickR([{ op: 'time', sec: 30 }, { op: 'count' }, { op: 'crystal', n: 3 }, { op: 'draw', n: 1 }, { op: 'clear' }])); break;
        case 'vetonext': E.flags.vetoNext = true; announce('🏳️ Amnestia! Dziś nikt nie odpadnie w głosowaniu.'); break;
        case 'truce': E.flags.truce = true; announce('🤝 Rozejm! Najbliższej nocy mafia nie zaatakuje.'); break;
      }
    };
    C(rec.card).fx.forEach(run);
  }
  /** Duch przekazuje jedną ze swoich kart żywemu graczowi. */
  E.gift = (ghost, i, target) => {
    const o = E.offers[ghost], g = player(ghost);
    if (!o || !g || aliveP(ghost) || !aliveP(target) || !o[i]) return { ok: false };
    if (hand(target).length >= KC().HAND_MAX) return { ok: false, msg: 'Ta osoba ma już pełną rękę (3 karty).' };
    const k = o.splice(i, 1)[0];
    giveCard(target, k, `👻 ${g.name} przysyła ci kartę z zaświatów`);
    if (!o.length) delete E.offers[ghost];
    announce('👻 Duch przekazał komuś kartę…');
    changed(); return { ok: true };
  };
  E.skipGift = ghost => { delete E.offers[ghost]; changed(); };

  /* ---------- tryb jednego telefonu: podawanie telefonu ---------- */
  E.iam = () => { if (E.pass) { E.pass.stage = 'act'; changed(); } };
  E.passNext = () => {
    const P = E.pass; if (!P) return;
    P.idx++; P.stage = 'pass';
    if (P.idx >= P.order.length) { E.pass = null; if (E.phase === 'roles') goNight(); else if (E.phase === 'night') endNight(); return; }
    changed();
  };
  E.passCurrent = () => E.pass ? E.pass.order[E.pass.idx] : null;

  /* ---------- widoki stanu ---------- */
  const pubPlayer = p => {
    const o = { id: p.id, name: p.name, color: p.color, emoji: p.emoji, score: p.score || 0, delta: p.delta || 0, online: mode === 'single' || p.online };
    if (inGame(p.id)) {
      o.alive = !!p.alive;
      if (E.phase === 'end' || E.phase === 'scores') o.role = E.st.roles[p.id];
      if (cardsOn()) o.cards = hand(p.id).length;
    }
    return o;
  };
  const shownRoles = () => {
    const out = {};
    if (!E.st || !E.settings.reveal) return out;
    const hidden = new Set((E.morning ? E.morning.victims : []).filter(v => !v.role).map(v => v.id));
    E.st.players.forEach(p => { if (!p.alive && !hidden.has(p.id)) out[p.id] = E.st.roles[p.id]; });
    return out;
  };
  E.pub = () => {
    const s = E.settings, st = E.st;
    const o = {
      game: 'mafia', mode, phase: E.phase, msg: E.msg, games: E.games,
      players: E.players.map(pubPlayer),
      settings: { mafia: s.mafia, autoMafia: M.autoMafia(Math.max(5, E.players.length)), cop: s.cop, doctor: s.doctor, reveal: s.reveal, discuss: s.discuss, vote: s.vote, voice: s.voice, cards: s.cards },
      timer: E.timer ? { total: E.timer.total, left: E.timerLeft(), running: E.timer.running } : null,
      feed: E.feed.slice(-4), cardsOn: cardsOn(),
    };
    if (st) {
      o.day = st.day; o.ids = st.players.map(p => p.id); o.seen = Object.keys(st.seen || {});
      o.dead = shownRoles();
      o.counts = { mafia: Object.values(st.roles).filter(r => r === 'mafia').length, cop: Object.values(st.roles).includes('cop'), doctor: Object.values(st.roles).includes('doctor') };
      if (E.phase === 'night') { o.nightDone = Object.keys(st.night.done).length; o.nightTotal = M.alive(st).length; }
      if (E.pass) o.pass = { cur: E.passCurrent(), idx: E.pass.idx, total: E.pass.order.length, stage: E.pass.stage, order: E.pass.order };
      if (E.morning && ['morning', 'day', 'vote', 'elim'].includes(E.phase)) o.morning = E.morning;
      if (E.phase === 'day') o.spotlight = E.spotlight;
      if (E.phase === 'vote' || E.phase === 'elim') {
        o.secret = E.phase === 'vote' && E.secretVote;
        o.ballots = o.secret ? {} : st.ballots; o.votes = o.secret ? {} : M.tally(st.ballots).counts;
        o.voteCount = Object.keys(st.ballots).length; o.voteTotal = M.alive(st).filter(q => !E.gagged[q.id]).length;
        o.gagged = Object.keys(E.gagged);
      }
      if (E.phase === 'elim') o.elim = E.elim;
      if (E.phase === 'end' || E.phase === 'scores') { o.winner = st.winner; o.roles = st.roles; }
      if (cardsOn()) o.ghosts = Object.keys(E.offers).length;
    }
    return o;
  };
  E.pstate = id => {
    const p = player(id), st = E.st, pub = E.pub();
    const o = { type: 'p', game: 'mafia', phase: E.phase, me: pubPlayer(p), players: E.players.map(pubPlayer), timer: pub.timer, feed: pub.feed, dead: pub.dead || {} };
    if (!st || !inGame(id)) return o;
    const role = st.roles[id];
    o.inRound = true; o.alive = !!p.alive; o.role = role; o.mates = M.teammates(st, id);
    o.seenRole = !!(st.seen && st.seen[id]);
    o.day = st.day; o.ids = pub.ids;
    if (E.phase === 'night' && p.alive) {
      const N = st.night;
      o.targets = M.nightTargets(st, id);
      o.done = !!N.done[id];
      o.myPick = role === 'mafia' ? N.mafia[id] : role === 'cop' ? N.check : role === 'doctor' ? N.heal : N.suspect[id];
      if (role === 'mafia') o.matePicks = Object.fromEntries(o.mates.map(m => [m, N.mafia[m] || null]));
      if (role === 'doctor') o.lastHeal = st.lastHeal;
    }
    if (E.phase === 'vote' && p.alive) { o.myVote = st.ballots[id] || null; o.voteTargets = M.alive(st).filter(q => q.id !== id).map(q => q.id); o.voteCount = pub.voteCount; o.voteTotal = pub.voteTotal; o.gagged = !!E.gagged[id]; }
    if (E.morning) o.morning = E.morning;
    if (E.phase === 'elim') o.elim = E.elim;
    if (E.phase === 'end' || E.phase === 'scores') { o.winner = st.winner; o.roles = st.roles; }
    if (cardsOn()) {
      o.cardsOn = true;
      o.hand = hand(id).map(k => C(k));
      o.cardPlayed = !!((E.played[E.phase + st.day] || {})[id]);
      if (E.offers[id]) o.offer = E.offers[id].map(k => C(k));
      o.alivePlayers = M.alive(st).map(q => q.id);
      o.deadPlayers = st.players.filter(q => !q.alive).map(q => q.id);
    }
    o.priv = E.priv[id] || [];
    o.fx = E.privFx[id] || [];
    return o;
  };
  return E;
}
root.MafiaEngine = { create };
})(typeof window !== 'undefined' ? window : globalThis);
