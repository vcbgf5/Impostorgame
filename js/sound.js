/* Impostor – dźwięki i muzyka: pliki mp3 z folderu sounds/ (zrobione przez tools/make_sounds.py),
   a gdy plik się nie wczyta – zapasowe dźwięki generowane w przeglądarce (Web Audio) */
(() => {
'use strict';
let ctx = null, master = null, musicGain = null, musicT = null, step = 0, nextAt = 0, musicWanted = null;
let muted = false;
try { muted = localStorage.getItem('imp_mute') === '1'; } catch (e) {}
const listeners = [];

function ensure() {
  if (!ctx) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.7; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.5; musicGain.connect(master);
    } catch (e) { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume().then(notify).catch(() => {});
  return ctx;
}
const ready = () => !!(ensure() && ctx.state === 'running');

/* ---------- pliki mp3 ---------- */
const FILES = ['pop', 'join', 'ding', 'tick', 'tock', 'blip', 'whoosh', 'drumroll', 'stamp', 'fanfare', 'win', 'wah', 'clown', 'reveal', 'react', 'buzzer', 'start', 'music_lobby', 'music_tension'];
const ALIAS = { drum: 'drumroll' };
const VOL = { music_lobby: 0.55, music_tension: 0.38, tick: 0.6, react: 0.55, whoosh: 0.7, buzzer: 0.6 };
const BUF = {};
function decode(ab) {
  return new Promise((res, rej) => { try { const p = ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); } catch (e) { rej(e); } });
}
function loadAll() {
  if (!ensure()) return;
  FILES.forEach(f => {
    fetch('sounds/' + f + '.mp3').then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(decode).then(b => { BUF[f] = b; if (f.startsWith('music_') && musicWanted && !musicT && !musicSrc) startLoop(); })
      .catch(() => {});
  });
}
function notify() { listeners.forEach(fn => { try { fn(); } catch (e) {} }); if (musicWanted) startLoop(); }
['keydown', 'pointerdown', 'click', 'touchstart'].forEach(ev => document.addEventListener(ev, () => { ensure(); setTimeout(notify, 50); }, { passive: true }));

function tone(freq, t0, dur, type = 'sine', vol = 0.2, slideTo = 0, out = master) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + dur + 0.05);
}
let noiseBuf = null;
function noise(t0, dur, vol = 0.2, freq = 1000, type = 'highpass', out = master) {
  if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(out); s.start(t0); s.stop(t0 + dur + 0.05);
}
const N = n => 440 * Math.pow(2, (n - 69) / 12); // numer MIDI → Hz

const FX = {
  pop(t) { tone(520, t, 0.14, 'sine', 0.3, 1100); },
  ding(t) { tone(N(84), t, 0.35, 'triangle', 0.22); tone(N(91), t + 0.07, 0.45, 'triangle', 0.16); },
  tick(t) { tone(1400, t, 0.04, 'square', 0.06); },
  tock(t) { tone(900, t, 0.06, 'square', 0.09); },
  blip(t) { tone(440, t, 0.09, 'square', 0.07, 660); },
  whoosh(t) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    noise(t, 0.01, 0.0001); s.buffer = noiseBuf; f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(3500, t + 0.35);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + 0.5);
  },
  drum(t) { // werbel 2,3 s + talerz
    for (let i = 0; i < 26; i++) noise(t + i * 0.088, 0.07, 0.05 + i * 0.006, 1800);
    noise(t + 2.35, 1.4, 0.35, 4000); tone(70, t + 2.35, 0.5, 'sine', 0.5, 40);
  },
  stamp(t) { tone(140, t, 0.3, 'square', 0.25, 50); noise(t, 0.2, 0.35, 300, 'lowpass'); },
  fanfare(t) {
    [[72, 0], [76, 0.13], [79, 0.26], [84, 0.42]].forEach(([n, d]) => tone(N(n), t + d, 0.3, 'triangle', 0.22));
    [72, 76, 79, 84].forEach(n => tone(N(n), t + 0.62, 1.1, 'triangle', 0.12));
    [60, 64, 67].forEach(n => tone(N(n), t + 0.62, 1.1, 'sawtooth', 0.04));
  },
  wah(t) { // „wah wah wah wahhh”
    [[67, 66, 0], [66, 65, 0.42], [65, 64, 0.84]].forEach(([a, b, d]) => tone(N(a), t + d, 0.38, 'sawtooth', 0.12, N(b)));
    const o = ctx.createOscillator(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = N(63); l.frequency.value = 6; lg.gain.value = 8;
    l.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t + 1.26); g.gain.exponentialRampToValueAtTime(0.13, t + 1.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    o.connect(g); g.connect(master); o.start(t + 1.26); l.start(t + 1.26); o.stop(t + 2.7); l.stop(t + 2.7);
  },
  clown(t) { [0, 0.25, 0.5].forEach((d, i) => tone(300 + i * 80, t + d, 0.3, 'sine', 0.3, 900 + i * 200)); tone(N(84), t + 0.8, 0.5, 'square', 0.08, N(60)); },
  reveal(t) { [60, 64, 67, 72, 76].forEach((n, i) => tone(N(n), t + i * 0.07, 0.4, 'triangle', 0.14)); },
  win(t) {
    FX.fanfare(t);
    [[79, 1.9], [81, 2.05], [83, 2.2], [84, 2.4]].forEach(([n, d]) => tone(N(n), t + d, 0.35, 'triangle', 0.2));
    [72, 76, 79, 84, 88].forEach(n => tone(N(n), t + 2.65, 1.6, 'triangle', 0.1));
    noise(t + 2.65, 1.2, 0.15, 5000);
  },
  react(t) { tone(700 + Math.random() * 500, t, 0.1, 'sine', 0.12, 1400); },
};

/* ---------- muzyka w lobby: luźny loop (Am – F – C – G) ---------- */
const BPM = 104, EIGHTH = 60 / BPM / 2;
const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
function scheduleMusic() {
  if (!ctx || !musicWanted) return;
  while (nextAt < ctx.currentTime + 0.25) {
    const bar = Math.floor(step / 8) % 4, s = step % 8, ch = CHORDS[bar], t = nextAt;
    if (s === 0 || s === 3 || s === 6) tone(N(ch[0] - 12), t, EIGHTH * 1.8, 'triangle', 0.16, 0, musicGain);
    const arp = [0, 1, 2, 1, 2, 0, 1, 2][s];
    tone(N(ch[arp] + 12), t, EIGHTH * 0.9, 'sine', 0.07, 0, musicGain);
    if (s % 2 === 0) noise(t, 0.03, s % 4 === 0 ? 0.05 : 0.025, 7000, 'highpass', musicGain);
    if (s === 4) noise(t, 0.12, 0.04, 1500, 'bandpass', musicGain);
    nextAt += EIGHTH; step++;
  }
}
let musicSrc = null, musicSrcGain = null;
function startLoop() {
  if (!ready() || musicT || musicSrc || !musicWanted) return;
  const b = BUF['music_' + musicWanted];
  if (b) {
    musicSrc = ctx.createBufferSource(); musicSrcGain = ctx.createGain();
    musicSrc.buffer = b; musicSrc.loop = true;
    const v = VOL['music_' + musicWanted] || 0.5;
    musicSrcGain.gain.setValueAtTime(0.0001, ctx.currentTime); musicSrcGain.gain.exponentialRampToValueAtTime(v, ctx.currentTime + 1.2);
    musicSrc.connect(musicSrcGain); musicSrcGain.connect(master); musicSrc.start();
    return;
  }
  if (musicWanted !== 'lobby') return; // zapasowa muzyka syntezatora tylko w lobby
  nextAt = ctx.currentTime + 0.1;
  musicGain.gain.cancelScheduledValues(ctx.currentTime);
  musicGain.gain.setValueAtTime(0.0001, ctx.currentTime); musicGain.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 1.5);
  musicT = setInterval(scheduleMusic, 100);
}
function stopLoop() {
  if (musicSrc) {
    const s = musicSrc, g = musicSrcGain; musicSrc = null; musicSrcGain = null;
    try { g.gain.cancelScheduledValues(ctx.currentTime); g.gain.setValueAtTime(g.gain.value, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.7); s.stop(ctx.currentTime + 0.75); } catch (e) {}
  }
  if (!musicT) return;
  clearInterval(musicT); musicT = null;
  if (ctx) { musicGain.gain.cancelScheduledValues(ctx.currentTime); musicGain.gain.setValueAtTime(musicGain.gain.value, ctx.currentTime); musicGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6); }
}

function playBuf(name, t, rate = 1) {
  const b = BUF[name]; if (!b) return false;
  const src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = b; src.playbackRate.value = rate; g.gain.value = VOL[name] || 1;
  src.connect(g); g.connect(master); src.start(t);
  return true;
}
window.Sfx = {
  play(name, delay = 0) {
    if (muted || !ready()) return;
    const f = ALIAS[name] || name, t = ctx.currentTime + 0.02 + delay;
    try {
      if (playBuf(f, t, f === 'react' ? 0.8 + Math.random() * 0.6 : 1)) return;
      if (FX[name]) FX[name](t);
    } catch (e) {}
  },
  // track: 'lobby' | 'tension' | null (true = 'lobby')
  music(track) {
    const want = track === true ? 'lobby' : track || null;
    if (want === musicWanted) return;
    stopLoop(); musicWanted = want;
    if (want && !muted) startLoop();
  },
  toggle() {
    muted = !muted;
    try { localStorage.setItem('imp_mute', muted ? '1' : '0'); } catch (e) {}
    ensure();
    if (master) master.gain.value = muted ? 0 : 0.7;
    if (muted) stopLoop(); else if (musicWanted) startLoop();
    notify();
  },
  get muted() { return muted; },
  get loaded() { return Object.keys(BUF); },
  get locked() { return !ctx || ctx.state !== 'running'; },
  onChange(fn) { listeners.push(fn); },
};
loadAll();
})();
