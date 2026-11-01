/* Kalambury – płótno: wspólny renderer (TV i telefon) + rysowanie palcem na telefonie.
   Kreska: { i, c: '#rrggbb' | 'erase', w: grubość przy szerokości 800, p: [[x,y]…] } (x,y w 0..1000) */
(function (root) {
'use strict';
const W = 800, H = 450;

function drawStroke(ctx, s, cw, ch, from = 0) {
  const p = s.p; if (!p.length) return;
  const k = cw / W;
  ctx.save();
  ctx.globalCompositeOperation = s.c === 'erase' ? 'destination-out' : 'source-over';
  ctx.strokeStyle = s.c === 'erase' ? '#000' : s.c; ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = s.w * k; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const X = q => q[0] / 1000 * cw, Y = q => q[1] / 1000 * ch;
  if (p.length === 1) { ctx.beginPath(); ctx.arc(X(p[0]), Y(p[0]), ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); ctx.restore(); return; }
  const start = Math.max(0, from - 1);
  ctx.beginPath(); ctx.moveTo(X(p[start]), Y(p[start]));
  for (let j = start + 1; j < p.length - 1; j++) {
    const mx = (X(p[j]) + X(p[j + 1])) / 2, my = (Y(p[j]) + Y(p[j + 1])) / 2;
    ctx.quadraticCurveTo(X(p[j]), Y(p[j]), mx, my);
  }
  ctx.lineTo(X(p[p.length - 1]), Y(p[p.length - 1]));
  ctx.stroke(); ctx.restore();
}
/** Pełne przerysowanie listy kresek na płótnie (tło = CSS kontenera, gumka = przezroczystość). */
function render(canvas, strokes) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  (strokes || []).forEach(s => drawStroke(ctx, s, canvas.width, canvas.height));
}
/** Dopasuj rozdzielczość płótna do rozmiaru na ekranie (ostre linie). */
function fit(canvas) {
  const r = canvas.getBoundingClientRect(), dpr = Math.min(2, root.devicePixelRatio || 1);
  const w = Math.max(160, Math.round(r.width * dpr)), h = Math.round(w * H / W);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; return true; }
  return false;
}

/** Płótno dotykowe dla rysującego. opts.onSend(msg) dostaje paczki {ops|undo|clear|bg} co ~60 ms. */
function mount(wrap, opts) {
  const state = { color: '#1a1a2e', width: 6, erase: false, strokes: [], cur: null, pending: {}, seq: Date.now() % 100000, bg: '#ffffff' };
  const COLORS = ['#1a1a2e', '#ff3b3b', '#ff9f1c', '#ffd60a', '#2ec4b6', '#3a86ff', '#8338ec', '#8d5524'];
  const SIZES = [[3, 'S'], [8, 'M'], [18, 'L']];
  wrap.innerHTML = `<div class="padbox" style="background:${state.bg}"><canvas class="pad"></canvas></div>
    <div class="tools">
      <div class="colors">${COLORS.map(c => `<button class="col ${c === state.color ? 'on' : ''}" data-c="${c}" style="--c:${c}"></button>`).join('')}<button class="col erase" data-c="erase" title="Gumka">🧽</button></div>
      <div class="row2">${SIZES.map(([w, t]) => `<button class="sz ${w === state.width ? 'on' : ''}" data-w="${w}"><i style="width:${w / 1.4 + 4}px;height:${w / 1.4 + 4}px"></i>${t}</button>`).join('')}
        <button class="tool" data-a="undo">↩️ Cofnij</button><button class="tool" data-a="clear">🗑️</button><button class="tool" data-a="bg">🪣 Tło</button></div>
    </div>`;
  const canvas = wrap.querySelector('canvas'), box = wrap.querySelector('.padbox');
  const redraw = () => { fit(canvas); render(canvas, state.strokes); };
  requestAnimationFrame(redraw);
  const ro = root.ResizeObserver ? new ResizeObserver(redraw) : null; if (ro) ro.observe(canvas);
  let flushT = null;
  const queue = (s, pts) => { (state.pending[s.i] = state.pending[s.i] || { i: s.i, c: s.c, w: s.w, p: [] }).p.push(...pts); if (!flushT) flushT = setTimeout(flush, 60); };
  function flush() { flushT = null; const ops = Object.values(state.pending); state.pending = {}; if (ops.length) opts.onSend({ ops }); }
  const pt = e => { const r = canvas.getBoundingClientRect(); return [Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * 1000), Math.round(Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) * 1000)]; };
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch (x) {}
    const s = { i: ++state.seq, c: state.erase ? 'erase' : state.color, w: state.erase ? Math.max(14, state.width * 2) : state.width, p: [pt(e)] };
    state.cur = s; state.strokes.push(s); queue(s, [s.p[0]]);
    drawStroke(canvas.getContext('2d'), s, canvas.width, canvas.height);
  });
  canvas.addEventListener('pointermove', e => {
    const s = state.cur; if (!s) return; e.preventDefault();
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    const add = [];
    evs.forEach(ev => { const q = pt(ev), l = s.p[s.p.length - 1]; if (Math.abs(q[0] - l[0]) + Math.abs(q[1] - l[1]) >= 4) { s.p.push(q); add.push(q); } });
    if (add.length) { drawStroke(canvas.getContext('2d'), s, canvas.width, canvas.height, s.p.length - add.length - 1); queue(s, add); }
  });
  const end = () => { state.cur = null; };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => canvas.addEventListener(ev, end));
  wrap.querySelector('.tools').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.c) {
      state.erase = b.dataset.c === 'erase'; if (!state.erase) state.color = b.dataset.c;
      wrap.querySelectorAll('.col').forEach(x => x.classList.toggle('on', x === b));
    } else if (b.dataset.w) {
      state.width = +b.dataset.w; wrap.querySelectorAll('.sz').forEach(x => x.classList.toggle('on', x === b));
    } else if (b.dataset.a === 'undo') { flush(); state.strokes.pop(); redraw(); opts.onSend({ undo: 1 }); }
    else if (b.dataset.a === 'clear') { flush(); state.strokes = []; redraw(); opts.onSend({ clear: 1 }); }
    else if (b.dataset.a === 'bg') { state.bg = state.erase ? '#ffffff' : state.color; box.style.background = state.bg; opts.onSend({ bg: state.bg }); }
    try { navigator.vibrate && navigator.vibrate(10); } catch (x) {}
  });
  return { destroy() { if (ro) ro.disconnect(); clearTimeout(flushT); }, get strokes() { return state.strokes; } };
}

root.DrawPad = { W, H, render, drawStroke, fit, mount };
})(typeof window !== 'undefined' ? window : globalThis);
