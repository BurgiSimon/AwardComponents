// Line field hero — a speaker brand's first screen over a field of hairlines. Every point takes its angle from one
// drifting Perlin sample (angle = noise × 12 rad, offset cos × 32 / sin × 16 px), so neighbouring lines move together
// and never tangle. A fine pointer pushes the points it passes (radius max(175, pointer speed) px, (1 − d/R)²) and a
// spring of 0.005 with damping 0.925 per 60 Hz frame, scaled to real frame time, brings them home. Every line is a
// subpath of one <path>: one draw per frame. Reduced motion and static: the field drawn complete, held still.
import './demo.css';
import { on, onFrame, whileVisible, observeResize, html, raw, clamp, finePointer, colour, content, formatPrice } from '../../src/demo-kit/index.js';

const WAVE = { turns: 12, ax: 32, ay: 16, driftX: 0.0125, driftY: 0.005, scaleX: 0.002, scaleY: 0.0015 };
const PUSH = { radius: 175, maxRadius: 400, spring: 0.005, damping: 0.925, cap: 120 };
const INTRO = { duration: 3, spread: 0.5 };
const PAD = 48; // lines run past the edges so a displaced end never shows

// Seeded 2D Perlin noise (improved-Perlin gradients and fade), roughly −1..1.
function perlin2(seed) {
  const base = Array.from({ length: 256 }, (_, i) => i);
  let s = seed >>> 0;
  const rand = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [base[i], base[j]] = [base[j], base[i]]; }
  const p = new Uint8Array(512);
  for (let i = 0; i < 512; i++) p[i] = base[i & 255];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const mix = (a, b, t) => a + (b - a) * t;
  const grad = (h, x, y) => {
    switch (h & 7) {
      case 0: return x + y; case 1: return -x + y; case 2: return x - y; case 3: return -x - y;
      case 4: return x; case 5: return -x; case 6: return y; default: return -y;
    }
  };
  return (x, y) => {
    const xf = Math.floor(x); const yf = Math.floor(y);
    const X = xf & 255; const Y = yf & 255;
    x -= xf; y -= yf;
    const u = fade(x); const v = fade(y);
    const a = p[X] + Y; const b = p[X + 1] + Y;
    return mix(mix(grad(p[a], x, y), grad(p[b], x - 1, y), u), mix(grad(p[a + 1], x, y - 1), grad(p[b + 1], x - 1, y - 1), u), v);
  };
}
const noise = perlin2(7);
const expoOut = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

export default function mount(root, options, ctx) {
  const { product } = content;
  let cfg = { ...options };
  const fine = finePointer();
  root.className = 'lf';
  root.innerHTML = html`
    <section class="lf__hero" aria-labelledby="lf-title" data-hero>
      <svg class="lf__field" aria-hidden="true" focusable="false" data-field><path data-path/></svg>
      <header class="ac-bar lf__bar">
        <a class="ac-brand lf__tape" href="#top">${product.maker}</a>
        <nav aria-label="Kova">${['Speakers', 'Room tuning', 'Support'].map((n) => html`<a class="lf__tape" href="#top">${n}</a>`)}</nav>
      </header>
      <div class="lf__copy ac-wrap">
        <p class="ac-label lf__tape lf__kicker"><span class="lf__dot" aria-hidden="true"></span>${product.name} · ${product.kind}</p>
        <h1 class="lf__title" id="lf-title">The room is part of the speaker.</h1>
        <div class="lf__foot">
          <p class="lf__lede lf__tape">Kova One listens to the space it stands in, the walls, the sofa, the window, and shapes its sound to fit. Eight seconds, once.</p>
          <div class="lf__cta">
            <a class="ac-btn ac-btn--accent ac-btn--lg" href="#top">Buy — ${formatPrice(product.price)}</a>
            <a class="ac-btn ac-btn--ghost ac-btn--lg lf__ghost" href="#top">How tuning works</a>
          </div>
        </div>
      </div>
      <dl class="lf__specs ac-label" aria-label="Specifications">
        ${[product.specs[1], product.specs[2], product.specs[3]].map(([k, v]) => html`<div class="lf__tape"><dt>${k}</dt><dd>${raw(v.replace(/,/g, ',<br>'))}</dd></div>`)}
      </dl>
    </section>`;
  root.querySelectorAll('a[href="#top"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const hero = root.querySelector('[data-hero]');
  const svg = root.querySelector('[data-field]');
  const path = root.querySelector('[data-path]');

  let W = 0; let H = 0; let rows = 0; let cols = 0;
  let bx; let by; let cx; let cy; let vx; let vy; let lx; let ly;
  let time = 0;
  let introTime = ctx.motion === 'full' && !ctx.capture ? 0 : INTRO.duration + INTRO.spread;
  let active = false;
  const pointer = { x: 0, y: 0, lastX: 0, lastY: 0, seen: false };

  // Coarse pointers get a sparser grid: fewer points to move, and no push to spend them on.
  const build = () => {
    const r = hero.getBoundingClientRect();
    W = Math.round(r.width); H = Math.round(r.height);
    const gapY = fine ? cfg.gap : Math.round(cfg.gap * 1.33);
    const stepX = Math.max(8, Math.round(gapY * 0.9));
    rows = Math.ceil((H + 2 * PAD) / gapY) + 1;
    cols = Math.ceil((W + 2 * PAD) / stepX) + 1;
    const n = rows * cols;
    bx = new Float32Array(n); by = new Float32Array(n);
    cx = new Float32Array(n); cy = new Float32Array(n); vx = new Float32Array(n); vy = new Float32Array(n);
    lx = new Float32Array(cols); ly = new Float32Array(cols);
    for (let i = 0; i < n; i++) { bx[i] = -PAD + (i % cols) * stepX; by[i] = -PAD + Math.floor(i / cols) * gapY; }
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    active = false;
    render();
  };

  // Share of line r drawn so far (0..1): outer lines first, .5 s spread to the centre.
  const reveal = (r) => {
    const edge = Math.min(r, rows - 1 - r) / Math.max(1, (rows - 1) / 2);
    return expoOut(clamp((introTime - edge * INTRO.spread) / INTRO.duration, 0, 1));
  };

  function render() {
    const { turns, ax, ay, driftX, driftY, scaleX, scaleY } = WAVE;
    const tx = time * driftX; const ty = time * driftY; const last = cols - 1;
    let d = '';
    for (let r = 0, k = 0; r < rows; r++, k += cols) {
      const shown = reveal(r);
      if (shown <= 0) continue;
      for (let c = 0; c < cols; c++) {
        const i = k + c; const a = noise((bx[i] + tx) * scaleX, (by[i] + ty) * scaleY) * turns;
        lx[c] = bx[i] + Math.cos(a) * ax + cx[i];
        ly[c] = by[i] + Math.sin(a) * ay + cy[i];
      }
      // Drawn from the line's end back towards its start.
      const start = (1 - shown) * last; const c0 = Math.floor(start); const f = start - c0;
      const c1 = Math.min(c0 + 1, last);
      d += `M${(lx[c0] + (lx[c1] - lx[c0]) * f).toFixed(1)} ${(ly[c0] + (ly[c1] - ly[c0]) * f).toFixed(1)}`;
      for (let c = c1; c <= last; c++) d += `L${lx[c].toFixed(1)} ${ly[c].toFixed(1)}`;
    }
    path.setAttribute('d', d);
  }

  // Semi-implicit spring scaled by n = dt × 60; the impulse is linear in the pointer's travel this frame.
  const spring = (dt) => {
    const n = dt * 60;
    let dx = 0; let dy = 0; let px = 0; let py = 0;
    if (pointer.seen) {
      dx = pointer.x - pointer.lastX; dy = pointer.y - pointer.lastY;
      pointer.lastX = pointer.x; pointer.lastY = pointer.y;
    }
    const moved = dx !== 0 || dy !== 0;
    if (!moved && !active) return;
    const R = clamp(Math.hypot(dx, dy) / n, PUSH.radius, PUSH.maxRadius);
    if (moved) { const rect = svg.getBoundingClientRect(); px = pointer.x - rect.left; py = pointer.y - rect.top; }
    const damping = PUSH.damping ** n; const k = PUSH.spring * n; const cap = PUSH.cap;
    let energy = 0;
    for (let i = 0; i < bx.length; i++) {
      if (moved) {
        const ex = bx[i] + cx[i] - px; const ey = by[i] + cy[i] - py; const d2 = ex * ex + ey * ey;
        if (d2 < R * R) { const s = 1 - Math.sqrt(d2) / R; const f = s * s * cfg.force; vx[i] += dx * f; vy[i] += dy * f; }
      }
      vx[i] = (vx[i] - cx[i] * k) * damping;
      vy[i] = (vy[i] - cy[i] * k) * damping;
      cx[i] = clamp(cx[i] + vx[i] * n, -cap, cap);
      cy[i] = clamp(cy[i] + vy[i] * n, -cap, cap);
      energy = Math.max(energy, Math.abs(cx[i]) + Math.abs(cy[i]) + Math.abs(vx[i]) + Math.abs(vy[i]));
    }
    active = energy > 0.01;
    if (!active) { cx.fill(0); cy.fill(0); vx.fill(0); vy.fill(0); }
  };

  const apply = () => {
    root.style.setProperty('--lf-stroke', String(cfg.stroke));
    root.style.setProperty('--lf-tone', colour(cfg.tone));
    root.style.setProperty('--lf-mix', cfg.tone === 'ink' ? '24%' : '58%');
  };
  apply();
  build();

  // Reduced and static: one still, fully drawn frame; no ticker, no push.
  if (ctx.motion !== 'full') {
    observeResize(ctx, hero, () => { if (Math.round(hero.getBoundingClientRect().width) !== W) build(); });
    return {
      update(next, changed) { cfg = { ...next }; apply(); if (changed.includes('gap')) build(); },
      action() {},
    };
  }

  const tick = (dt) => {
    time += dt * 1000 * cfg.drift;
    introTime += dt;
    spring(dt);
    render();
  };
  let off = null;
  whileVisible(ctx, hero, () => { off = onFrame(ctx, tick); }, () => { off?.(); off = null; }, { rootMargin: '0px' });
  if (fine) {
    on(ctx, window, 'pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      pointer.x = e.clientX; pointer.y = e.clientY;
      if (!pointer.seen) { pointer.lastX = pointer.x; pointer.lastY = pointer.y; pointer.seen = true; }
    }, { passive: true });
    on(ctx, document.documentElement, 'pointerleave', () => { pointer.seen = false; });
  }
  observeResize(ctx, hero, () => {
    const r = hero.getBoundingClientRect();
    if (Math.round(r.width) !== W || Math.abs(r.height - H) > 120) build();
  });

  return {
    update(next, changed) {
      cfg = { ...next };
      apply();
      if (changed.includes('gap')) build();
    },
    action(id) { if (id === 'replay') { introTime = 0; } },
  };
}
