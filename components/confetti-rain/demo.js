// Sprite rain — Signal's ticket and its Celebrate button. One full-viewport canvas (aria-hidden, pointer-events: none): every
// shape × colour is drawn once to an offscreen bitmap at the canvas DPR, then stamped with setTransform + rotate +
// drawImage. Each sprite has gravity, drift and spin, all per-frame values at 60 fps scaled by f = dt × 60. The live
// count is capped by the quality tier, sprites leave the array as they leave the screen, and the ticker subscription
// is released when the last one is gone. Reduced/static: nothing spawns; the status line says so.
import './demo.css';
import { on, onFrame, later, html, raw, qualityTier, readToken, content } from '../../src/demo-kit/index.js';

const BUDGET = { high: 240, mid: 140, low: 56 }; // live-sprite ceiling per tier
const DRIFT = 3;                                  // |vx| ≤ 3 px/frame
const SPIN = (10 * Math.PI) / 180;                // ±10° per frame
const EMIT_MS = { top: 1200, burst: 160 };
const SIZE = [14, 28];                            // CSS px
const COLOURS = ['--accent', '--clay', '--moss', '--sky', '--sand', '--plum'];
const SETS = { shapes: ['circle', 'ring', 'triangle', 'squiggle', 'star', 'half'], paper: ['strip', 'square'], sparks: ['spark'] };

// A deterministic QR-like grid for the ticket (decorative: the code is printed beside it).
function qr(seed, n = 25) {
  let h = 2166136261;
  for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000) / 1000; };
  const finder = (x, y) => [[0, 0], [n - 7, 0], [0, n - 7]].some(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7);
  let cells = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!finder(x, y) && rnd() > 0.52) cells += `M${x} ${y}h1v1h-1z`;
  const ring = ([fx, fy]) => `M${fx} ${fy}h7v7h-7zM${fx + 1} ${fy + 1}v5h5v-5zM${fx + 2} ${fy + 2}h3v3h-3z`;
  return `<svg viewBox="-1 -1 ${n + 2} ${n + 2}" aria-hidden="true"><path fill-rule="evenodd" d="${[[0, 0], [n - 7, 0], [0, n - 7]].map(ring).join('')}${cells}"/></svg>`;
}

export default function mount(root, options, ctx) {
  const { festival, people } = content;
  let cfg = { ...options };
  const tier = qualityTier();
  const budget = BUDGET[tier.name];
  const live = ctx.motion === 'full';
  const pass = festival.tickets[2];
  const holder = people[2].name;

  root.className = 'cr';
  root.innerHTML = html`
    <section class="ac-stage cr__stage" aria-label="Order confirmed">
      <article class="cr__ticket" aria-label="${pass.name} ticket for ${holder}">
        <div class="cr__main">
          <div class="cr__top"><span class="cr__word">${festival.name}</span><span class="cr__year">2027</span></div>
          <p class="cr__pass">${pass.name}</p>
          <dl class="cr__facts">
            <div><dt>Name</dt><dd>${holder}</dd></div>
            <div><dt>Dates</dt><dd>12–14 Aug</dd></div>
            <div><dt>Gate</dt><dd>B · Harbour</dd></div>
            <div><dt>Camping</dt><dd>Field 3, pitch 41</dd></div>
          </dl>
          <p class="cr__place">${festival.place}</p>
        </div>
        <div class="cr__stub">
          <span class="cr__qr">${raw(qr('SG27-0418'))}</span>
          <span class="ac-label">SG27-0418</span>
        </div>
      </article>
      <div class="cr__act">
        <button class="cr__again" type="button" data-trigger aria-describedby="cr-status"><span aria-hidden="true">✶</span> Celebrate</button>
        <p class="ac-small cr__status" id="cr-status" role="status" data-status></p>
      </div>
      <p class="ac-stage__note"><span>${festival.name} · order confirmed</span></p>
    </section>
    <canvas class="cr__rain" aria-hidden="true" data-rain></canvas>`;

  const canvas = root.querySelector('[data-rain]');
  const g = canvas.getContext('2d');
  const trigger = root.querySelector('[data-trigger]');
  const status = root.querySelector('[data-status]');
  let dpr = 1;
  let stamps = [];
  let sprites = [];
  let emitUntil = 0;
  let toSpawn = 0;
  let carry = 0;
  let from = { x: 0, y: 0 };
  let off = null;

  // Size the canvas to the viewport within the tier's DPR cap and pixel budget.
  const resize = () => {
    const w = innerWidth;
    const h = innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, tier.dpr);
    const px = w * h * dpr * dpr;
    if (px > tier.pixels) dpr *= Math.sqrt(tier.pixels / px);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    drawStamps();
  };

  // Every shape × colour, drawn once at the largest sprite size.
  const drawStamps = () => {
    const s = Math.ceil(SIZE[1] * dpr);
    const shapes = SETS[cfg.sprites];
    const colours = COLOURS.map((c) => readToken(c));
    stamps = [];
    for (const shape of shapes) {
      for (const col of colours) {
        const c = document.createElement('canvas');
        c.width = c.height = s;
        const x = c.getContext('2d');
        const r = s / 2;
        x.fillStyle = col;
        x.strokeStyle = col;
        x.lineCap = 'round';
        x.lineJoin = 'round';
        x.beginPath();
        if (shape === 'circle') { x.arc(r, r, r * 0.62, 0, Math.PI * 2); x.fill(); }
        if (shape === 'ring') { x.lineWidth = s * 0.14; x.arc(r, r, r * 0.6, 0, Math.PI * 2); x.stroke(); }
        if (shape === 'half') { x.arc(r, r * 1.2, r * 0.75, Math.PI, 0); x.closePath(); x.fill(); }
        if (shape === 'triangle') { x.moveTo(r, s * 0.12); x.lineTo(s * 0.9, s * 0.84); x.lineTo(s * 0.1, s * 0.84); x.closePath(); x.fill(); }
        if (shape === 'squiggle') {
          x.lineWidth = s * 0.12;
          x.moveTo(s * 0.1, r);
          for (let i = 1; i <= 4; i++) x.quadraticCurveTo(s * (0.1 + (i - 0.5) * 0.2), r + (i % 2 ? -1 : 1) * s * 0.22, s * (0.1 + i * 0.2), r);
          x.stroke();
        }
        if (shape === 'star') {
          for (let i = 0; i < 10; i++) {
            const a = -Math.PI / 2 + (i * Math.PI) / 5;
            const rr = i % 2 ? r * 0.36 : r * 0.86;
            x.lineTo(r + Math.cos(a) * rr, r + Math.sin(a) * rr);
          }
          x.closePath();
          x.fill();
        }
        if (shape === 'strip') x.fillRect(s * 0.38, s * 0.08, s * 0.24, s * 0.84);
        if (shape === 'square') x.fillRect(s * 0.25, s * 0.25, s * 0.5, s * 0.5);
        if (shape === 'spark') {
          const k = r * 0.22;
          x.moveTo(r, 0);
          x.quadraticCurveTo(r + k, r - k, s, r);
          x.quadraticCurveTo(r + k, r + k, r, s);
          x.quadraticCurveTo(r - k, r + k, 0, r);
          x.quadraticCurveTo(r - k, r - k, r, 0);
          x.fill();
        }
        stamps.push(c);
      }
    }
  };

  const spawn = () => {
    const size = (SIZE[0] + Math.random() * (SIZE[1] - SIZE[0])) * dpr;
    const burst = cfg.origin === 'burst';
    sprites.push({
      size,
      stamp: stamps[(Math.random() * stamps.length) | 0],
      x: burst ? from.x + (Math.random() - 0.5) * 30 * dpr : Math.random() * canvas.width,
      y: burst ? from.y : -size,
      vx: (Math.random() * 2 - 1) * (burst ? DRIFT * 2.4 : DRIFT) * dpr,
      vy: burst ? -(9 + Math.random() * 9) * dpr : 0, // rain starts at rest: gravity alone makes it fall
      a: Math.random() * Math.PI * 2,
      va: (Math.random() * 2 - 1) * SPIN,
      flip: Math.random() * Math.PI * 2, // paper confetti turns over as it falls
      paper: cfg.sprites === 'paper',
    });
  };

  const tick = (dt, t) => {
    const f = dt * 60; // frames at 60 fps: the same fall at 30, 60 or 144 Hz
    if (toSpawn > 0) {
      carry += (cfg.count / EMIT_MS[cfg.origin]) * 1000 * dt;
      for (; carry >= 1 && toSpawn > 0; carry--, toSpawn--) if (sprites.length < budget) spawn();
    }
    const w = canvas.width;
    const h = canvas.height;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, w, h);
    const kept = [];
    for (const p of sprites) {
      p.vy += cfg.gravity * dpr * f;
      if (p.paper) { p.vy = Math.min(p.vy, 5 * dpr); p.vx *= Math.pow(0.985, f); p.flip += 0.14 * f; }
      p.x += p.vx * f;
      p.y += p.vy * f;
      p.a += p.va * f;
      const r = p.size / 2;
      if (p.y - r > h || p.x < -r * 4 || p.x > w + r * 4) continue; // off-screen: gone
      g.setTransform(1, 0, 0, 1, p.x, p.y);
      g.rotate(p.a);
      if (p.paper) g.scale(1, Math.cos(p.flip));
      g.drawImage(p.stamp, -r, -r, p.size, p.size);
      kept.push(p);
    }
    sprites = kept;
    // Nothing left and nothing coming: release the ticker so the page burns no frames.
    if (!sprites.length && toSpawn <= 0 && t >= emitUntil) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h); off?.(); off = null; }
  };

  const celebrate = () => {
    if (!live) { status.textContent = 'Reduced motion is on, so the confetti stays put. The ticket is yours either way.'; return; }
    const r = trigger.getBoundingClientRect();
    from = { x: (r.left + r.width / 2) * dpr, y: (r.top + r.height / 2) * dpr };
    toSpawn += cfg.count;
    emitUntil = performance.now() + EMIT_MS[cfg.origin];
    status.textContent = `Confetti for ${holder.split(' ')[0]}: see you on the harbour in August.`;
    // The frame capture wants one dependable moment: run 50 frames at once and leave that frame on the canvas.
    if (ctx.capture) { const t0 = performance.now(); for (let i = 0; i < 50; i++) tick(1 / 60, t0 + i * 16.7); return; }
    if (!off) off = onFrame(ctx, tick);
  };

  resize();
  on(ctx, window, 'resize', resize);
  on(ctx, trigger, 'click', celebrate);
  ctx.onTheme(() => drawStamps());
  // The page celebrates once on arrival (not in the frame capture, which presses Celebrate at its own moment).
  if (live && !ctx.capture) later(ctx, celebrate, 450);
  if (!live) status.textContent = 'Reduced motion is on, so there is no confetti on this page.';

  return {
    update(next, changed) {
      cfg = { ...next };
      if (changed.includes('sprites')) drawStamps();
    },
    action(id) { if (id === 'celebrate') celebrate(); },
  };
}
