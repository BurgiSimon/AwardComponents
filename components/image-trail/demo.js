// Image trail — a photographer's portfolio hero: the open ground the pointer draws on, around her name. Travel
// accumulates along the mouse's path and a picture lands at every `spacing` px, placed on the segment between two
// events (distance, not time). A fixed pool of <img> slots is recycled oldest first; each grows in (.32 s expo-out
// from .6×), holds, then fades in arrival order (≥ 60 ms apart). Smoothed speed sets size (.8–1.25×) and tilt
// (6°/px·ms, clamped). Pictures that would touch the name or the plate line are skipped. Touch, reduced and static:
// three stills placed by the design, which are also the desktop rest frame. The preview frame lays one sweep at once.
import './demo.css';
import { onFrame, whileVisible, observeResize, finePointer, clamp, html, raw, photos, imageHTML } from '../../src/demo-kit/index.js';

const MAX_PER_EVENT = 4;
const IN = 0.32;
const SCALE_FROM = 0.6;
const FADE_IN = 0.12;
const STAGGER = 0.06;
const OUT = 0.45;
const SCALE_MIN = 0.8;
const SCALE_MAX = 1.25;
const V_REF = 2;
const ROT_K = 6;
const SWAY = [-3, 2, -1, 3];
const VEL_TAU = 50;
const PAD = 12;

// Twenty pictures from her kind of work, interleaved so neighbours in the trail differ.
function pictureSet() {
  const groups = [['architecture', 5], ['object', 4], ['landscape', 4], ['interior', 4], ['still-life', 3]].map(([tag, count]) => photos({ tags: [tag], count, seed: `it-${tag}` }));
  const seen = new Set();
  const out = [];
  for (let i = 0; out.length < 20 && i < 6; i++) {
    for (const g of groups) {
      const p = g[i];
      if (p && !seen.has(p.id)) { seen.add(p.id); out.push(p); }
    }
  }
  return out;
}

export default function mount(root, options, ctx) {
  const pics = pictureSet();
  let cfg = { ...options };
  root.className = 'it';
  root.innerHTML = html`
    <section class="ac-stage it__hero" aria-labelledby="it-title" data-hero>
      <div class="it__stills" aria-hidden="true">
        ${[0, 3, 6].map((i, n) => html`<span class="it__pic it__still it__still--${n}">${raw(imageHTML(pics[i], { sizes: '220px', alt: '', eager: true }))}</span>`)}
      </div>
      <h1 class="ac-display it__title" id="it-title" data-protect>Mira Lund</h1>
      <div class="it__trail" aria-hidden="true" inert data-trail></div>
      <p class="ac-stage__note"><span data-protect>Mira Lund · portfolio hero</span></p>
    </section>`;

  const hero = root.querySelector('[data-hero]');
  const layer = root.querySelector('[data-trail]');
  const protectEls = [...root.querySelectorAll('[data-protect]')];
  const apply = () => root.style.setProperty('--pic-w', `${cfg.size}px`);
  apply();

  // Touch, pens without hover, reduced and static: the stills are the whole hero.
  if (!finePointer() || ctx.motion !== 'full') {
    root.classList.add('it--still');
    return { update(next) { cfg = { ...next }; apply(); } };
  }

  // The pool: one <img> per slot, written once; a spawn only moves a slot with transform and opacity.
  let pool = [];
  const build = () => {
    layer.innerHTML = Array.from({ length: cfg.pool }, (_, i) => `<span class="it__pic it__item">${imageHTML(pics[i % pics.length], { sizes: '240px', alt: '' }).replace(' loading="lazy"', '')}</span>`).join('');
    pool = [...layer.children].map((el) => ({ el, alive: false, x: 0, y: 0, s: 1, rot: 0, born: 0, fadeAt: 0 }));
    pool.forEach((it) => it.el.querySelector('img').decode?.().catch(() => {}));
  };

  let clock = 0;
  let lastFade = -1;
  let z = 0;
  let spawns = 0;
  let last = null;
  let travel = 0;
  const vel = { x: 0, y: 0 };
  let protects = [];
  let pic = { w: 0, h: 0 };
  let origin = { x: 0, y: 0 };
  let stop = null;

  // Protected rectangles in hero coordinates: the name's text box (a Range, so a short last line does not guard the
  // full width) and the plate line, each padded. Measured on arm, on resize and after fonts load.
  const measure = () => {
    const hr = hero.getBoundingClientRect();
    origin = { x: hr.left + scrollX, y: hr.top + scrollY };
    protects = protectEls.map((el) => {
      let r = el.getBoundingClientRect();
      if (/^H[1-6]$/.test(el.tagName)) { const range = document.createRange(); range.selectNodeContents(el); r = range.getBoundingClientRect(); }
      return { l: r.left - hr.left - PAD, t: r.top - hr.top - PAD, r: r.right - hr.left + PAD, b: r.bottom - hr.top + PAD };
    });
    pic = { w: pool[0]?.el.offsetWidth || cfg.size, h: pool[0]?.el.offsetHeight || cfg.size * 1.25 };
  };

  const hide = (it) => { it.alive = false; it.el.style.visibility = 'hidden'; it.el.style.opacity = '0'; };
  const setTrailing = (v) => hero.classList.toggle('is-trailing', v);
  const frame = (dt) => {
    clock += dt;
    let live = 0;
    for (const it of pool) {
      if (!it.alive) continue;
      if (clock >= it.fadeAt + OUT) { hide(it); continue; }
      const age = clock - it.born;
      const p = clamp(age / IN, 0, 1);
      let scale = it.s * (SCALE_FROM + (1 - SCALE_FROM) * (p === 1 ? 1 : 1 - 2 ** (-10 * p)));
      let opacity = clamp(age / FADE_IN, 0, 1);
      if (clock > it.fadeAt) {
        const q = clamp((clock - it.fadeAt) / OUT, 0, 1);
        const e = q * q;
        opacity *= 1 - e;
        scale *= 1 - 0.14 * e;
      }
      it.el.style.opacity = opacity.toFixed(3);
      it.el.style.transform = `translate3d(${it.x.toFixed(1)}px, ${it.y.toFixed(1)}px, 0) translate(-50%, -50%) rotate(${it.rot.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
      live++;
    }
    if (!live) { setTrailing(false); stop?.(); stop = null; }
  };

  const spawn = (x, y) => {
    const speed = Math.hypot(vel.x, vel.y);
    const s = SCALE_MIN + (SCALE_MAX - SCALE_MIN) * clamp(speed / V_REF, 0, 1);
    const rot = clamp(vel.x * ROT_K, -cfg.tilt, cfg.tilt) + (cfg.tilt ? SWAY[spawns % SWAY.length] * Math.min(1, cfg.tilt / 8) : 0);
    // The picture's full-size box, widened for the tilt: if it would touch a protected area, this mark is skipped.
    const hw = (pic.w * s) / 2 + 8;
    const hh = (pic.h * s) / 2 + 8;
    if (protects.some((p) => x + hw > p.l && x - hw < p.r && y + hh > p.t && y - hh < p.b)) return;
    const it = pool[spawns % pool.length];
    Object.assign(it, { alive: true, x, y, s, rot, born: clock });
    it.fadeAt = Math.max(clock + cfg.hold, lastFade + STAGGER);
    lastFade = it.fadeAt;
    it.el.style.zIndex = String(++z);
    it.el.style.visibility = 'visible';
    it.el.style.opacity = '0';
    it.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) rotate(${rot.toFixed(2)}deg) scale(${(s * SCALE_FROM).toFixed(4)})`;
    spawns++;
    setTrailing(true);
    if (!stop) stop = onFrame(ctx, frame);
  };

  const onMove = (e) => {
    if (e.pointerType === 'touch') return;
    const x = e.pageX - origin.x;
    const y = e.pageY - origin.y;
    if (!last) { last = { x, y, t: e.timeStamp }; return; }
    const dx = x - last.x;
    const dy = y - last.y;
    const d = Math.hypot(dx, dy);
    const dt = Math.max(1, e.timeStamp - last.t);
    const k = 1 - Math.exp(-dt / VEL_TAU);
    vel.x += (dx / dt - vel.x) * k;
    vel.y += (dy / dt - vel.y) * k;
    last = { x, y, t: e.timeStamp };
    if (!d) return;
    travel += d;
    let n = 0;
    while (travel >= cfg.spacing && n < MAX_PER_EVENT) {
      travel -= cfg.spacing;
      const back = travel / d; // the mark lies `travel` px behind the current point on this segment
      spawn(x - dx * back, y - dy * back);
      n++;
    }
    if (travel >= cfg.spacing) travel %= cfg.spacing;
  };
  const onLeave = () => { last = null; travel = 0; vel.x = 0; vel.y = 0; };
  const releaseAll = () => { pool.forEach(hide); setTrailing(false); stop?.(); stop = null; onLeave(); };

  // The preview frame: one sweep from the lower left, over the name, down to the right (a quadratic curve), laid at
  // once through the same path code and held (a headless pointer is too slow to leave a trail that lasts to the shot).
  const layCaptureTrail = () => {
    releaseAll();
    measure();
    const w = hero.offsetWidth;
    const h = hero.offsetHeight;
    const curve = (a, c, b, u) => (1 - u) ** 2 * a + 2 * u * (1 - u) * c + u ** 2 * b;
    const steps = 60;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      onMove({ pointerType: 'mouse', pageX: origin.x + w * curve(0.1, 0.45, 0.9, u), pageY: origin.y + h * curve(0.82, -0.15, 0.42, u), timeStamp: i * 16 });
    }
    pool.forEach((it) => { if (it.alive) it.fadeAt = Infinity; });
    clock += IN;
    frame(0);
    stop?.();
    stop = null;
  };

  // Armed only while the hero is on screen; leaving it returns every picture to the pool and stops the ticker.
  let armed = null;
  build();
  whileVisible(ctx, hero, () => {
    measure();
    armed = new AbortController();
    hero.addEventListener('pointermove', onMove, { passive: true, signal: armed.signal });
    hero.addEventListener('pointerleave', onLeave, { signal: armed.signal });
    if (ctx.capture) (document.fonts?.ready || Promise.resolve()).then(() => { if (armed) layCaptureTrail(); });
  }, () => { armed?.abort(); armed = null; releaseAll(); }, { rootMargin: '0px' });
  observeResize(ctx, hero, () => { if (armed) measure(); });
  document.fonts?.ready.then(() => { if (armed) measure(); });

  return {
    update(next, changed) {
      cfg = { ...next };
      apply();
      if (changed.includes('pool')) { releaseAll(); build(); }
      if (armed) requestAnimationFrame(measure);
    },
  };
}
