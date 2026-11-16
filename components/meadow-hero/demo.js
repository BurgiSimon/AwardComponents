// Meadow hero — the cover of Fieldnote's Weather issue: one very large word standing in a field of grass. The
// field has depth: fourteen rows from a horizon behind the letters down to the frame's foot, each blade placed,
// scaled and faded by its depth. Three canvases keep the word in the field instead of on top of it: far grass
// behind the type, near grass in front of it (stroked white under mix-blend-mode: difference, so it takes the
// page's ink and reverses where it crosses a letter), and the flower heads above both.
// Wind is the subject. A ripple and slow gusts cross the field on a slant and lift seeds into the sky; a fine
// pointer parts the grass on a spring (0.012 stiffness, 0.1 damping per 60 Hz frame) and its speed counts as a
// gust; a click plants a flower where it lands and a drag sows one every 44 px. Reduced motion and static: one
// still, upright field, redrawn on a click.
import './demo.css';
import '../../src/demo-kit/serif.css';
import { on, onFrame, whileVisible, observeResize, html, clamp, lerp, finePointer, qualityTier, readToken, content } from '../../src/demo-kit/index.js';

const ROWS = 14;                    // depth rows; each blade is nudged off its row so the rows never read as stripes
const CURVE = 1.5;                  // screen y = horizon + (foot − horizon) × depth^CURVE: rows bunch toward the horizon
const SPRING = { k: 0.012, damping: 0.1 };          // per 60 Hz frame
const GROW = 1100; const FADE = 600;                // ms a flower takes to grow, and to leave
const SOW = 44;                     // px of drag between two sown flowers
const HEAD = 0.021;                 // a flower head's unit as a share of the local tallest blade: ring 5 units, centre 2.2
const GUST = { speed: 900, width: 280, lean: 0.55 }; // the one-off gust: px/s, half-width in px, rad at its crest
const SEEDS = { rate: 0.5, cap: 60, perGust: 70 };   // seeds let go per second at a breeze, most in the air, px of gust travel per seed
const HOLD = 8500;                  // the wind's clock in the captured frame: a gust front standing left of centre
const PETALS = { mixed: ['--clay', '--plum', '--sky', '--clay', '--accent', '--plum', '--sky'], accent: ['--accent'] };
// Flowers there on load, as [share of the width, depth 0..1], and more for the captured frame.
const START = [[0.07, 0.8], [0.2, 0.44], [0.34, 0.92], [0.5, 0.62], [0.63, 0.34], [0.79, 0.86], [0.92, 0.52]];
const PLATE = [[0.13, 0.6], [0.27, 0.3], [0.42, 0.78], [0.57, 0.9], [0.71, 0.56], [0.86, 0.36], [0.96, 0.74], [0.03, 0.42]];

// Hash of an index, 0..1: the same field on every load and after every resize.
const rnd = (i) => {
  let t = Math.imul(i + 1, 0x9e3779b9);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export default function mount(root, options, ctx) {
  let cfg = { ...options };
  const windy = ctx.motion === 'full';   // the weather leans the grass (the captured frame holds one moment of it)
  const live = windy && !ctx.capture;    // there is a loop: things grow, fade, spring and drift
  const fine = finePointer();
  const tier = qualityTier();
  const { magazine } = content;
  const [issue, theme] = magazine.issue.split(' — ');   // "Issue 14", "Weather"
  root.className = 'mdh';
  root.innerHTML = html`
    <section class="ac-stage mdh__hero" aria-labelledby="mdh-title" data-hero>
      <canvas class="mdh__canvas" aria-hidden="true"></canvas>
      <h1 class="mdh__title" id="mdh-title">${theme}<i class="mdh__base" aria-hidden="true" data-base></i></h1>
      <canvas class="mdh__canvas mdh__canvas--near" aria-hidden="true"></canvas>
      <canvas class="mdh__canvas" aria-hidden="true"></canvas>
      <button type="button" class="mdh__cue" data-sow>Sow a flower</button>
      <p class="ac-stage__note"><span class="mdh__tape">${magazine.name} · issue cover</span><span class="mdh__tape">${issue}</span></p>
      <p class="sr-only" role="status" data-status></p>
    </section>`;

  const hero = root.querySelector('[data-hero]');
  const title = root.querySelector('.mdh__title');
  const probe = root.querySelector('[data-base]'); // an empty inline-block sits on the baseline: its bottom is the type's feet
  const status = root.querySelector('[data-status]');
  const canvases = [...root.querySelectorAll('canvas')];
  const [gFar, gNear, gTop] = canvases.map((c) => c.getContext('2d'));
  if (ctx.capture) root.querySelector('[data-sow]').hidden = true;

  let W = 0; let H = 0; let base = 0; let horizon = 0; let foot = 0; let tall = 0; let pBase = 0;
  let blades = []; let groups = []; let tone = null; let off = null;
  let wt = ctx.capture ? HOLD : 0;                     // the wind's own clock in ms, so its speed can change live
  let burst = null; let sprung = false; let settled = false;
  let thin = 1; let frames = 0; let load = 0;          // the share of blades kept, and the frame-time window that decides it
  const ptr = { x: null, y: 0, t: 0, v: 0 };          // v: horizontal speed in px per ms, eased
  const seeds = []; let seedDue = 0; let seedNo = 0;   // fluff the wind lifts off the field and carries through the sky
  const depthY = (p) => horizon + (foot - horizon) * p ** CURVE;
  const depthS = (p) => 0.24 + 0.76 * p ** 0.9;
  const flower = ([u, p], n, born) => ({ u, p, n, k: 0.95 + rnd(n * 7) * 0.45, ph: rnd(n * 7 + 1) * 6.283, born, o: 0, v: 0, x: 0, y: 0, s: 1, h: 0, far: false });
  const flowers = [...START, ...(ctx.capture ? PLATE : [])].map((at, n) => flower(at, n, -1e9)).sort((a, b) => a.p - b.p); // far to near
  let planted = flowers.length;
  // A flower's place and size on screen follow its depth; its stem is k × the tallest blade around it, so the head clears the grass.
  const place = (f) => { f.x = f.u * W; f.y = depthY(f.p); f.s = depthS(f.p); f.h = f.k * f.s * tall; f.far = f.p < pBase; };

  const retone = () => {
    tone = { far: readToken('--ink-2'), line: readToken('--line-2'), page: readToken('--bg'), petals: PETALS[cfg.petals].map((name) => readToken(name)) };
  };

  // Lean from the weather at x and depth p: a ripple, gusts that travel left to right and reach the far grass later
  // (so a front crosses the field on a slant), a steady lean above a breeze, and the one-off gust.
  const weather = (x, p, ph) => {
    if (!windy) return 0;
    const w = cfg.wind; const u = x - p * 420;
    let a = w * (0.06 * Math.sin(u * 0.02 - wt * 0.0013 + ph) + 0.2 * Math.max(0, Math.sin(u * 0.0042 - wt * 0.0007)) ** 3) + 0.07 * Math.max(0, w - 1);
    if (burst) { const d = (u - burst.x) / GUST.width; if (d > -1 && d < 1) a += GUST.lean * (1 - d * d) ** 2; }
    return a;
  };

  // Where the pointer wants a stem to lean: away from it, plus the pointer's own speed as a gust. Nearer grass is
  // bigger, so the reach grows with it.
  const want = (b) => {
    if (ptr.x === null) return 0;
    const d = Math.hypot(b.x - ptr.x, b.y - b.h * 0.5 - ptr.y) / (cfg.reach * (0.4 + 0.6 * b.s));
    return d >= 1 ? 0 : (1 - d) ** 2 * clamp((Math.sign(b.x - ptr.x) || 1) * 0.6 + ptr.v * 0.4, -1, 1);
  };
  const spring = (b, f) => {
    b.v += ((want(b) - b.o) * SPRING.k - b.v * SPRING.damping) * f; b.o += b.v * f;
    return Math.abs(b.o) + Math.abs(b.v);
  };

  // A seed leaves the grass tops at depth p and is carried off; it lives 14–26 s or until it leaves the frame.
  const seed = (x, p, age = 0) => {
    if (seeds.length >= SEEDS.cap || x < -20 || x > W) return;
    const n = seedNo++;
    seeds.push({ x, y: depthY(p) - tall * depthS(p) * 0.8, vx: 0, vy: -10, age, life: 14 + rnd(n * 3) * 12, ph: rnd(n * 3 + 1) * 6.283, r: 0.8 + rnd(n * 3 + 2) * 0.5 });
  };

  // Caps stay butt: a round cap on every blade costs several times the stroke in software raster and cannot be
  // seen at hairline width.
  const stem = (g, x, y, h, a) => { const sx = Math.sin(a) * h; g.moveTo(x, y); g.quadraticCurveTo(x + sx * 0.15, y - h * 0.6, x + sx, y - Math.cos(a) * h); };
  const draw = (t) => {
    for (const g of [gFar, gNear, gTop]) { g.clearRect(0, 0, W, H); g.globalAlpha = 1; }
    gFar.strokeStyle = tone.line; gFar.lineWidth = 1;
    gFar.beginPath(); gFar.moveTo(0, Math.round(horizon) + 0.5); gFar.lineTo(W, Math.round(horizon) + 0.5); gFar.stroke();
    for (const grp of groups) { // far to near, one path per depth band and layer
      const g = grp.far ? gFar : gNear;
      g.globalAlpha = grp.alpha; g.lineWidth = grp.width; g.strokeStyle = grp.far ? tone.far : '#fff';
      g.beginPath();
      for (const b of grp.blades) stem(g, b.x, b.y, b.h, b.rest + b.o + weather(b.x, b.p, b.ph));
      g.stroke();
    }
    gFar.strokeStyle = gFar.fillStyle = tone.far; gFar.lineWidth = 0.75;
    for (const s of seeds) { // a tuft of five hairs with the seed hanging under it, tilted into its travel; behind the type
      const tilt = clamp(s.vx / 260, 0, 0.9); const sx = s.x - Math.sin(tilt) * 7 * s.r; const sy = s.y + Math.cos(tilt) * 7 * s.r;
      gFar.globalAlpha = clamp(Math.min(s.age / 1.5, (s.life - s.age) / 2), 0, 1) * 0.7;
      gFar.beginPath();
      for (let k = -2; k <= 2; k++) { gFar.moveTo(s.x, s.y); gFar.lineTo(s.x + Math.sin(tilt + k * 0.42) * 6 * s.r, s.y - Math.cos(tilt + k * 0.42) * 6 * s.r); }
      gFar.moveTo(s.x, s.y); gFar.lineTo(sx, sy); gFar.stroke();
      gFar.beginPath(); gFar.arc(sx, sy, 1.1 * s.r, 0, 7); gFar.fill();
    }
    for (const f of flowers) { // far to near; the stem is grass (it reverses over a letter), the head keeps its colour
      const age = Math.min(1, (t - f.born) / GROW);
      const up = 1 - (1 - Math.min(1, age / 0.7)) ** 3; const open = 1 - (1 - Math.max(0, (age - 0.6) / 0.4)) ** 2;
      const fade = f.gone ? Math.max(0, 1 - (t - f.gone) / FADE) : 1;
      const a = (f.o + weather(f.x, f.p, f.ph)) * 0.6; const h = f.h * up; const u = f.s * tall * HEAD;
      const hx = f.x + Math.sin(a) * h; const hy = f.y - Math.cos(a) * h;
      const gs = f.far ? gFar : gNear;
      gs.globalAlpha = (f.far ? 0.6 : 0.8) * fade; gs.strokeStyle = f.far ? tone.far : '#fff'; gs.lineWidth = lerp(0.9, 1.5, f.p);
      gs.beginPath(); stem(gs, f.x, f.y, h, a); gs.stroke();
      if (!open) continue;
      const gh = f.far ? gFar : gTop; const n = 5 + (f.n % 3); const turn = 6.283 / n; const ring = 5 * u * open;
      gh.globalAlpha = fade; gh.fillStyle = tone.petals[f.n % tone.petals.length];
      for (let i = 0; i < n; i++) { gh.beginPath(); gh.arc(hx + Math.cos(i * turn + a) * ring, hy + Math.sin(i * turn + a) * ring, ring * Math.sin(Math.PI / n) * 1.04, 0, 7); gh.fill(); }
      gh.fillStyle = tone.page; gh.beginPath(); gh.arc(hx, hy, 2.2 * u * open, 0, 7); gh.fill();
    }
  };

  const build = () => {
    const density = cfg.density * (tier.name === 'low' ? 0.6 : 1) * (fine ? 1 : 0.8);
    blades = [];
    for (let r = 0; r < ROWS; r++) {
      const row = r / (ROWS - 1); const gap = lerp(2.6, 11, row) / density; const n = Math.ceil((W + 24) / gap);
      for (let i = 0; i < n; i++) {
        const id = r * 8192 + i;
        if (rnd(id * 5 + 5) > thin) continue; // thinned by the governor in tick(): the blades that stay keep their places
        const p = clamp(row + (rnd(id * 5 + 4) - 0.5) / (ROWS - 1), 0, 1); const s = depthS(p);
        const x = -12 + (i + rnd(id * 5)) * gap;
        const tuft = 0.75 + 0.25 * Math.sin(x * 0.021 + p * 9) * Math.sin(x * 0.0063 + p * 4 + 1.3); // taller and shorter patches
        blades.push({ x, y: depthY(p), h: tall * s * (0.3 + 0.7 * rnd(id * 5 + 1) ** 1.7 * tuft), rest: (rnd(id * 5 + 2) - 0.5) * 0.24, p, s, ph: rnd(id * 5 + 3) * 6.283, o: 0, v: 0 });
      }
    }
    // Six depth bands, each split at the type's own depth into the layer behind it and the layer in front.
    groups = [];
    for (let k = 0; k < 6; k++) {
      for (const far of [true, false]) {
        const set = blades.filter((b) => Math.min(5, Math.floor(b.p * 6)) === k && (b.p < pBase) === far);
        if (set.length) groups.push({ far, alpha: lerp(0.3, 0.72, k / 5), width: lerp(0.75, 1.25, k / 5), blades: set });
      }
    }
    flowers.forEach(place);
    if (ctx.capture) { // the frame: the grass held apart where a pointer would be, a dozen seeds on their way across the sky
      ptr.x = W * 0.7; ptr.y = depthY(0.62) - tall * 0.3;
      for (const b of blades) b.o = want(b);
      seeds.length = 0;
      for (let i = 0; i < 12; i++) { seed(W * (0.05 + 0.9 * rnd(i * 3 + 90)), 0.3, 4); const s = seeds[i]; s.y = lerp(H * 0.1, horizon - 24, rnd(i * 3 + 91)); s.vx = 70; }
    }
    settled = false;
  };

  const tick = (dt, t) => {
    const f = Math.min(2, dt * 60); // in 60 Hz frames, clamped so a stalled tab does not fling the grass
    // A device that cannot hold 40 fps thins its own field: a third of the blades go, twice at most.
    load += dt;
    if (++frames === 40) { if (load > 1 && thin > 0.5) { thin *= 0.67; build(); } frames = 0; load = 0; }
    wt += dt * 1000 * (0.55 + 0.45 * cfg.wind);
    seedDue += dt * cfg.wind * SEEDS.rate;
    if (burst) { burst.x += dt * GUST.speed; seedDue += dt * GUST.speed / SEEDS.perGust; if (burst.x > W + GUST.width) burst = null; }
    for (; seedDue >= 1; seedDue--) { // the wind lets go of one: anywhere at a breeze, along the front during a gust
      const p = 0.1 + 0.8 * rnd(seedNo * 3 + 7);
      seed(burst ? burst.x + p * 420 : (rnd(seedNo * 3 + 8) - 0.05) * W * 0.85, p);
    }
    for (let i = seeds.length; i--;) { // each seed eases to the wind where it is: along with it, lifted by it, bobbing
      const s = seeds[i]; const push = Math.max(0, weather(s.x, 0.5, s.ph)); const ease = Math.min(1, dt * 1.5);
      s.age += dt;
      s.vx += (18 + 420 * push - s.vx) * ease; s.vy += (-6 - 60 * push + 10 * Math.sin(s.ph + s.age * 1.7) - s.vy) * ease;
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.age > s.life || s.x > W + 30 || s.y < -30) seeds.splice(i, 1);
    }
    ptr.v *= 0.9 ** f;
    let growing = false;
    for (let i = flowers.length; i--;) {
      const fl = flowers[i];
      if (fl.gone && t - fl.gone > FADE) flowers.splice(i, 1); else growing ||= !!fl.gone || t - fl.born < GROW;
    }
    if (ptr.x !== null || sprung) { // the springs rest until a pointer is in the field
      let energy = 0;
      for (const b of blades) energy = Math.max(energy, spring(b, f));
      for (const fl of flowers) energy = Math.max(energy, spring(fl, f));
      sprung = energy > 0.002;
    }
    // Calm, nothing sprung, nothing growing: the field is a still picture, so skip the paint until that changes.
    const rest = cfg.wind === 0 && !burst && !seeds.length && ptr.x === null && !sprung && !growing;
    if (rest && settled) return;
    settled = rest;
    draw(t);
  };

  const layout = () => {
    const r = hero.getBoundingClientRect(); const w = Math.round(r.width); const h = Math.round(r.height);
    const b = Math.round(probe.getBoundingClientRect().bottom - r.top);
    if (!w || !h || (w === W && h === H && b === base)) return;
    W = w; H = h; base = b;
    const type = parseFloat(getComputedStyle(title).fontSize);
    horizon = base - type * 0.1;                               // behind the letters, a tenth of the type size above their feet
    foot = H + 24;                                             // the nearest row roots just below the frame
    tall = clamp(H * 0.08 + type * 0.25, 64, 150);             // its tallest blade: from the frame and the type, so a phone's small word is not dwarfed
    pBase = ((base - horizon) / (foot - horizon)) ** (1 / CURVE); // the depth the type stands at
    const dpr = Math.min(window.devicePixelRatio || 1, tier.dpr, Math.sqrt(8e6 / (W * H))); // three layers: hold each under 8 MP
    for (const c of canvases) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    for (const g of [gFar, gNear, gTop]) g.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
    if (!off) draw(performance.now());
  };

  const say = () => { status.textContent = `${flowers.filter((f) => !f.gone).length} flowers in the field.`; };
  // Past the cap the oldest goes: it fades in the loop, or is simply gone when nothing moves.
  const trim = (t) => {
    for (let rest = flowers.filter((f) => !f.gone).sort((a, b) => a.born - b.born || a.n - b.n); rest.length > cfg.cap; rest.shift()) {
      if (live) rest[0].gone = t; else flowers.splice(flowers.indexOf(rest[0]), 1);
    }
  };
  const plant = (u, p) => {
    const t = performance.now(); const f = flower([clamp(u, 0.01, 0.99), clamp(p, 0.05, 0.97)], planted++, live ? t : -1e9);
    place(f);
    flowers.push(f); flowers.sort((a, b) => a.p - b.p); // far to near, so nearer heads overlap farther ones
    trim(t); say();
    settled = false;
    if (!off) draw(t);
  };
  // A click plants where it lands: its y is a depth. Above the horizon it lands at the field's far edge.
  const plantAt = (x, y) => plant(x / W, clamp((y - horizon) / (foot - horizon), 0, 1) ** (1 / CURVE));
  const plantSeeded = () => plant(0.05 + 0.9 * rnd(planted * 13 + 5), 0.14 + 0.78 * rnd(planted * 13 + 6));
  const gust = () => { if (live && !burst) { burst = { x: -420 - GUST.width }; settled = false; } };

  retone();
  layout();
  observeResize(ctx, hero, layout);
  on(ctx, document.fonts, 'loadingdone', layout); // the serif arriving moves the baseline
  ctx.onTheme(() => { retone(); settled = false; if (!off) draw(performance.now()); });

  // Pointer: hover parts the grass (fine pointers), a click plants, a mouse or pen drag sows a trail.
  let sowing = null; let skipClick = false;
  const at = (e) => { const r = hero.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  on(ctx, hero, 'pointerdown', (e) => {
    skipClick = false;
    if (e.pointerType !== 'touch' && e.button === 0 && !e.target.closest('button')) sowing = { ...at(e), moved: false };
  });
  on(ctx, hero, 'pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const p = at(e);
    if (fine && live) {
      if (ptr.x !== null && e.timeStamp > ptr.t) ptr.v = 0.7 * ptr.v + 0.3 * clamp((p.x - ptr.x) / (e.timeStamp - ptr.t), -3, 3);
      ptr.x = p.x; ptr.y = p.y; ptr.t = e.timeStamp;
    }
    if (sowing && Math.hypot(p.x - sowing.x, p.y - sowing.y) >= SOW) { plantAt(p.x, p.y); sowing = { ...p, moved: true }; }
  });
  on(ctx, window, 'pointerup', () => { skipClick = !!sowing?.moved; sowing = null; });
  on(ctx, window, 'pointercancel', () => { sowing = null; });
  if (live) on(ctx, hero, 'pointerleave', () => { ptr.x = null; });
  on(ctx, hero, 'click', (e) => { // click, not pointerdown, so a touch scroll over the field plants nothing
    if (e.target.closest('button')) return;
    if (skipClick) { skipClick = false; return; } // the click that ends a sowing drag
    const p = at(e); plantAt(p.x, p.y);
  });
  on(ctx, root.querySelector('[data-sow]'), 'click', plantSeeded);

  if (live) whileVisible(ctx, hero, () => { settled = false; frames = 0; load = 0; off = onFrame(ctx, tick); }, () => { off?.(); off = null; }, { rootMargin: '0px' });

  return {
    update(next, changed) {
      cfg = { ...next };
      if (changed.includes('petals')) retone();
      if (changed.includes('density')) build();
      trim(performance.now());
      settled = false;
      if (!off) draw(performance.now());
    },
    action(id) {
      if (id === 'sow') plantSeeded();
      if (id === 'gust') gust();
    },
  };
}
