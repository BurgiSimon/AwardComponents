// Lawn footer — the close of Fieldnote's site with a strip of lawn between the statement and the links. A blade
// every 3 px in three depths, hashed by index so it is the same lawn on every load. Idle: a small ripple plus slow
// gusts that travel left to right. A fine pointer bends the blades away on a spring (0.012 stiffness, 0.1 damping
// per 60 Hz frame, reach 90 px) and its own speed counts as a gust. A click plants a flower that grows in 1.1 s;
// past the cap the oldest fades. Reduced motion and static: one still lawn, redrawn when a flower is planted.
import './demo.css';
import { on, onFrame, whileVisible, observeResize, html, clamp, finePointer, readToken, content } from '../../src/demo-kit/index.js';

const BAND = 112;                 // the height every size below is authored at; a taller band scales blades and flowers
const SPRING = { k: 0.012, damping: 0.1 };          // per 60 Hz frame
const GROW = 1100; const FADE = 600;                // ms a flower takes to grow, and to leave
const DEPTHS = [{ tone: 0, alpha: 0.5, width: 1 }, { tone: 1, alpha: 0.45, width: 1 }, { tone: 1, alpha: 0.8, width: 1.25 }];
const PETALS = { mixed: ['--clay', '--plum', '--sky'], accent: ['--accent'], ink: ['--ink'] };
const START = [0.17, 0.54, 0.82];                   // the three flowers already there, as shares of the width
const PLATE = [0.06, 0.29, 0.4, 0.71, 0.93];        // more for the captured frame
const HOLD = 9900;                // the wind's clock in the captured frame, in ms: a gust standing over the left third

// Hash of an index, 0..1: the same lawn on every load and after every resize.
const rnd = (i) => {
  let t = Math.imul(i + 1, 0x9e3779b9);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export default function mount(root, options, ctx) {
  const { magazine } = content;
  let cfg = { ...options };
  const windy = ctx.motion === 'full';   // the breeze leans the grass (the captured frame holds one moment of it)
  const live = windy && !ctx.capture;    // there is a loop: flowers grow and fade, blades spring
  const clock = () => (ctx.capture ? HOLD : performance.now());
  root.className = 'lwf';
  root.innerHTML = html`
    <footer class="lwf__foot" aria-labelledby="lwf-title">
      <div class="lwf__say ac-wrap">
        <p class="ac-label">Next issue</p>
        <h2 class="lwf__title" id="lwf-title">${magazine.signoff}</h2>
      </div>
      <div class="lwf__scene ac-wrap" data-scene><canvas aria-hidden="true"></canvas></div>
      <div class="lwf__row ac-wrap">
        <nav class="lwf__nav" aria-label="Footer">${magazine.nav.map((l) => html`<a href="#top">${l}</a>`)}</nav>
        <button type="button" class="lwf__cue" data-plant>Plant a flower</button>
      </div>
      <p class="lwf__legal ac-wrap"><span>© 2026 ${magazine.name}</span><span>${magazine.frequency}</span></p>
      <p class="sr-only" role="status" data-status></p>
    </footer>`;
  root.querySelectorAll('a[href="#top"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const scene = root.querySelector('[data-scene]');
  const status = root.querySelector('[data-status]');
  const cv = scene.firstElementChild;
  const g = cv.getContext('2d');
  let W = 0; let H = 0; let K = 1; let G = 0;        // band size, its scale against BAND, the ground line's y
  let blades = []; let tone = null; let off = null; let settled = false;
  const ptr = { x: null, y: 0, t: 0, v: 0 };         // v: horizontal speed in px per ms, eased
  const flower = (u, n, born) => ({ u, c: n, h: n < START.length ? 44 + n * 7 : 38 + rnd(n * 7) * 22, born, o: 0, v: 0 });
  const flowers = [...START, ...(ctx.capture ? PLATE : [])].map((u, n) => flower(u, n, -1e9));
  let planted = flowers.length;

  const retone = () => {
    tone = {
      grass: [readToken('--muted'), readToken('--ink-2')],
      ground: readToken('--line-2'),
      page: readToken('--bg'),
      petals: PETALS[cfg.petals].map((name) => readToken(name)),
    };
  };

  // b.o is the sprung lean from the pointer; the rest is wind: a small ripple plus slow gusts that travel left to right.
  const lean = (b, x, t) => b.o + (windy ? cfg.wind * (0.07 * Math.sin(x * 0.02 - t * 0.0012 + b.h) + 0.16 * Math.max(0, Math.sin(x * 0.005 - t * 0.0006)) ** 3) : 0);
  // Caps stay butt: a round cap on every blade costs several times the stroke in software raster and cannot be
  // seen at hairline width.
  const stem = (x, h, a) => { g.moveTo(x, G); g.quadraticCurveTo(x + Math.sin(a) * h * 0.15, G - h * 0.6, x + Math.sin(a) * h, G - Math.cos(a) * h); };

  const draw = (t) => {
    g.clearRect(0, 0, W, H);
    g.globalAlpha = 1; g.strokeStyle = tone.ground; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, G + 0.5); g.lineTo(W, G + 0.5); g.stroke();
    DEPTHS.forEach((d, k) => { // three depths of grass, one path each
      g.globalAlpha = d.alpha; g.strokeStyle = tone.grass[d.tone]; g.lineWidth = d.width;
      g.beginPath();
      for (const b of blades) if (b.k === k) stem(b.x, b.h * K, b.rest + lean(b, b.x, t));
      g.stroke();
    });
    for (const f of flowers) {
      const age = Math.min(1, (t - f.born) / GROW); const x = f.u * W; const a = lean(f, x, t) * 0.6;
      const up = 1 - (1 - Math.min(1, age / 0.7)) ** 3; const open = 1 - (1 - Math.max(0, (age - 0.6) / 0.4)) ** 2;
      const fade = f.gone ? Math.max(0, 1 - (t - f.gone) / FADE) : 1;
      const h = f.h * K * up; const hx = x + Math.sin(a) * h; const hy = G - Math.cos(a) * h;
      g.globalAlpha = 0.8 * fade; g.strokeStyle = tone.grass[1]; g.lineWidth = 1.25; g.beginPath(); stem(x, h, a); g.stroke();
      if (!open) continue;
      g.globalAlpha = fade; g.fillStyle = tone.petals[f.c % tone.petals.length];
      for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(hx + Math.cos(i * 1.047 + a) * 5 * K * open, hy + Math.sin(i * 1.047 + a) * 5 * K * open, 2.6 * K * open, 0, 7); g.fill(); }
      g.fillStyle = tone.page; g.beginPath(); g.arc(hx, hy, 2.2 * K * open, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
  };

  // Where the pointer wants a stem at x to lean: away from it, plus the pointer's own speed as a gust.
  const want = (x) => {
    if (ptr.x === null) return 0;
    const near = Math.max(0, 1 - Math.hypot(x - ptr.x, G - 14 * K - ptr.y) / cfg.reach) ** 2;
    return near * clamp((Math.sign(x - ptr.x) || 1) * 0.55 + ptr.v * 0.4, -0.9, 0.9);
  };
  const spring = (b, x, f) => {
    b.v += ((want(x) - b.o) * SPRING.k - b.v * SPRING.damping) * f; b.o += b.v * f;
    return Math.abs(b.o) + Math.abs(b.v);
  };
  const tick = (dt, t) => {
    const f = Math.min(2, dt * 60); // in 60 Hz frames, clamped so a stalled tab does not fling the grass
    ptr.v *= 0.9 ** f;
    let energy = 0; let growing = false;
    for (const b of blades) energy = Math.max(energy, spring(b, b.x, f));
    for (let i = flowers.length; i--;) {
      const fl = flowers[i];
      if (fl.gone && t - fl.gone > FADE) { flowers.splice(i, 1); continue; }
      energy = Math.max(energy, spring(fl, fl.u * W, f));
      growing ||= !!fl.gone || t - fl.born < GROW;
    }
    // No wind, nothing sprung, nothing growing: the lawn is a still picture, so skip the paint until that changes.
    const rest = cfg.wind === 0 && ptr.x === null && !growing && energy < 0.002;
    if (rest && settled) return;
    settled = rest;
    draw(t);
  };

  const build = () => {
    blades = Array.from({ length: Math.floor(W / cfg.gap) }, (_, i) => {
      const x = i * cfg.gap + rnd(i * 4) * 5;
      const tuft = 0.8 + 0.2 * Math.sin(x * 0.045 + 1.3) * Math.sin(x * 0.013 + 4); // taller and shorter patches
      return { x, h: 10 + 24 * rnd(i * 4 + 1) ** 1.7 * tuft, rest: (rnd(i * 4 + 2) - 0.5) * 0.5, k: Math.floor(rnd(i * 4 + 3) * 3), o: 0, v: 0 };
    });
    if (ctx.capture) { // the frame: the grass held apart where a pointer would be
      ptr.x = W * 0.63; ptr.y = G - 16 * K;
      for (const b of blades) b.o = want(b.x);
    }
    settled = false;
  };
  const size = () => {
    const r = scene.getBoundingClientRect();
    if (!r.width || !r.height || (Math.round(r.width) === W && Math.round(r.height) === H)) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.round(r.width); H = Math.round(r.height); K = H / BAND; G = H - 10 * K;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
    if (!off) draw(clock());
  };

  const say = () => { status.textContent = `${flowers.filter((f) => !f.gone).length} flowers on the lawn.`; };
  // Past the cap the oldest goes: it fades in the loop, or is simply gone when nothing moves.
  const trim = (t) => {
    for (let rest = flowers.filter((f) => !f.gone); rest.length > cfg.cap; rest.shift()) {
      if (live) rest[0].gone = t; else flowers.splice(flowers.indexOf(rest[0]), 1);
    }
  };
  const plant = (u) => {
    const t = clock();
    flowers.push(flower(clamp(u, 0.01, 0.99), planted++, live ? t : -1e9));
    trim(t); say();
    settled = false;
    if (!off) draw(t);
  };
  const plantSeeded = () => plant(0.05 + 0.9 * rnd(planted * 13 + 5));

  retone();
  size();
  observeResize(ctx, scene, size);
  ctx.onTheme(() => { retone(); settled = false; if (!off) draw(clock()); });

  on(ctx, cv, 'click', (e) => plant(e.offsetX / W)); // click, not pointerdown, so a touch scroll over the lawn plants nothing
  on(ctx, root.querySelector('[data-plant]'), 'click', plantSeeded);

  if (live) {
    whileVisible(ctx, scene, () => { settled = false; off = onFrame(ctx, tick); }, () => { off?.(); off = null; });
    if (finePointer()) {
      on(ctx, cv, 'pointermove', (e) => {
        if (e.pointerType === 'touch') return;
        if (ptr.x !== null && e.timeStamp > ptr.t) ptr.v = 0.7 * ptr.v + 0.3 * clamp((e.offsetX - ptr.x) / (e.timeStamp - ptr.t), -3, 3);
        ptr.x = e.offsetX; ptr.y = e.offsetY; ptr.t = e.timeStamp;
      });
      for (const type of ['pointerleave', 'pointercancel']) on(ctx, cv, type, () => { ptr.x = null; });
    }
  }

  return {
    update(next, changed) {
      cfg = { ...next };
      if (changed.includes('petals')) retone();
      if (changed.includes('gap')) build();
      trim(clock());
      settled = false;
      if (!off) draw(clock());
    },
    action(id) { if (id === 'plant') plantSeeded(); },
  };
}
