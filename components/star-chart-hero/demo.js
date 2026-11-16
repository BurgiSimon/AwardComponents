// Star chart hero — Meridian's home hero: the whole first screen is a star chart you draw on. The sky is a
// planisphere: every star has a fixed place around a pole, and the chart turns about it, slowly on its own (sidereal
// drift) and by hand when dragged, with inertia. Rings, hour lines and their labels turn with the sky; the meridian
// through the pole stays put. A fine pointer pencils a constellation through the brightest stars within reach
// (a minimum spanning tree); a click inks it: the lines are drawn edge by edge in the accent, it gets a catalogue
// label, it turns with the sky from then on, and one shooting star crosses the chart. Six pins are kept; the oldest
// fades when a seventh arrives. One 2D canvas, every colour a page token. Reduced motion and static: no drift, no
// loop; a still chart redrawn on input, pins appear complete, a drag turns the chart 1:1 without inertia.
import './demo.css';
import { on, onFrame, whileVisible, observeResize, html, clamp, finePointer, readToken, content } from '../../src/demo-kit/index.js';

const TAU = Math.PI * 2;
const CAP = 6;                              // pinned constellations kept
const EASE = 200;                           // ms a pencilled line takes to fade in or out
const INK = { stagger: 90, grow: 260 };     // ms: a pinned constellation is inked edge by edge
const LEAVE = 1200;                         // ms the oldest pin takes to fade
const SHOT = 1000;                          // ms a shooting star lasts
const FLING = { decay: 2.2, max: 2.5 };     // after a drag: speed × e^(−2.2 t), at most 2.5 rad/s
const GAP = 5;                              // px an inked line stops short of its stars
const TINTS = ['--sky', '--plum']; // no clay: beside an accent pin it would read as one
const NAMES = content.observatory.constellations;   // invented catalogue names, kept with the cast
// Where the chart's first constellations sit, as shares of the hero (landscape, portrait).
const FIRST = { wide: [[0.2, 0.25], [0.87, 0.76], [0.47, 0.17]], tall: [[0.27, 0.13], [0.26, 0.47], [0.82, 0.66]] };

const rng = (a) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const cubicOut = (t) => 1 - (1 - t) ** 3;

export default function mount(root, options, ctx) {
  const { observatory } = content;
  let cfg = { ...options };
  const still = ctx.motion !== 'full';
  const fine = finePointer();

  root.className = 'sch';
  root.innerHTML = html`
    <section class="ac-stage sch__hero" aria-labelledby="sch-title" data-hero>
      <canvas class="sch__canvas" aria-hidden="true"></canvas>
      <h1 class="sch__title" id="sch-title">${observatory.claim}</h1>
      <button type="button" class="sch__cue" data-cue>Pin a constellation</button>
      <p class="sr-only" role="status" data-status></p>
      <p class="ac-stage__note"><span class="sch__tape">${observatory.name} · home hero</span><span class="sch__tape">69° north</span></p>
    </section>`;

  const hero = root.querySelector('[data-hero]');
  const cv = root.querySelector('canvas');
  const title = root.querySelector('.sch__title');
  const status = root.querySelector('[data-status]');
  const g = cv.getContext('2d');

  let tok = {};
  const readTokens = () => {
    const t = (name) => readToken(name, root);
    tok = {
      ink: t('--ink'), ink2: t('--ink-2'), muted: t('--muted'), grid: t('--line-2'), tints: TINTS.map(t), mono: t('--font-mono'),
      tone: /^(#|rgb|hsl|oklch)/.test(cfg.tone) ? cfg.tone : t(cfg.tone === 'ink' ? '--ink' : `--${cfg.tone}`),
    };
  };

  let W = 0; let H = 0; let R = 0; let ring = 100; let reach = 150; const pole = { x: 0, y: 0 };
  let stars = []; let px; let py; let clear; let lit; let inked; let vis = [];
  let rot = 0.35; let fling = 0; let last = 0;
  let ptr = null; let drag = null; let skipClick = false; let shoot = null; let count = 0;
  const pencil = new Map(); // "a-b" → strength: the constellation under the pointer
  const pins = [];          // { pick, tree, t0, out, n, name }
  const spots = rng(5);     // where the cue button and the toolbar action land
  const box = { l: 0, t: 0, r: 0, b: 0 }; // the headline's box: the sky stays quiet behind it

  // One star per cell of a jittered grid over the whole disc the hero can ever show, a quarter of the cells empty,
  // magnitudes cubed so most are faint and a few are bright; then a denser band of faint stars along an off-centre
  // circle, which gives the turning sky a shape to follow. Seeded: the same sky on every load at a given size.
  const seed = () => {
    const r = rng(11); const n = Math.ceil((2 * R) / cfg.cell);
    stars = [];
    for (let i = 0; i < n * n; i++) {
      const m = r() ** 3; const keep = r() > 0.25; const tint = r() < 0.07;
      const x = -R + ((i % n) + 0.08 + r() * 0.84) * cfg.cell; const y = -R + (Math.floor(i / n) + 0.08 + r() * 0.84) * cfg.cell;
      const per = 3000 + r() * 6000; const ph = r() * TAU; const d = Math.hypot(x, y);
      if (keep && d < R && d > 16) stars.push({ x, y, m, r: 0.6 + m * 2.6, a: 0.36 + m * 0.6, per, ph, c: tint ? i % 2 : -1, base: true });
    }
    const bandR = ring * 4.1; const spread = ring * 0.5; const bo = { x: ring * 1.1, y: -ring * 0.7 };
    const nb = Math.round((TAU * bandR * spread * 5) / (cfg.cell * cfg.cell));
    for (let i = 0; i < nb; i++) {
      const a = r() * TAU; const rad = bandR + (r() + r() + r() - 1.5) * spread; const m = r() ** 2 * 0.3;
      const x = bo.x + Math.cos(a) * rad; const y = bo.y + Math.sin(a) * rad;
      if (Math.hypot(x, y) < R) stars.push({ x, y, m, r: 0.55 + m * 1.6, a: 0.32 + m * 0.8, per: 3000 + r() * 6000, ph: r() * TAU, c: -1, base: false });
    }
    px = new Float32Array(stars.length); py = new Float32Array(stars.length); clear = new Float32Array(stars.length);
    lit = new Float32Array(stars.length); inked = new Float32Array(stars.length);
    pencil.clear(); pins.length = 0; shoot = null; count = 0;
  };

  // Sky to screen: rotate every star about the pole, keep the ones in view, and note how far each is from the headline.
  const project = () => {
    const c = Math.cos(rot); const s = Math.sin(rot);
    vis = [];
    for (let i = 0; i < stars.length; i++) {
      const st = stars[i]; const x = pole.x + st.x * c - st.y * s; const y = pole.y + st.x * s + st.y * c;
      px[i] = x; py[i] = y;
      if (x < -8 || y < -8 || x > W + 8 || y > H + 8) continue;
      const out = Math.max(box.l - x, x - box.r, box.t - y, y - box.b);
      clear[i] = clamp(out / 26, 0, 1);
      vis.push(i);
    }
  };

  // The brightest stars within reach of a point (distance counts a little), joined as a minimum spanning tree in
  // the order it grows from the first, so an inked constellation can be drawn edge by edge.
  const near = (p) => {
    const cand = [];
    for (const i of vis) {
      const st = stars[i];
      if (!st.base || clear[i] < 0.6) continue;
      const d = Math.hypot(px[i] - p.x, py[i] - p.y);
      if (d < reach) cand.push([st.m - 0.35 * (d / reach), i]);
    }
    const pick = cand.sort((a, b) => b[0] - a[0]).slice(0, cfg.join).map(([, i]) => i);
    const tree = []; const done = pick.slice(0, 1);
    while (done.length < pick.length) {
      let best;
      for (const a of done) for (const b of pick) if (!done.includes(b)) { const d = Math.hypot(px[a] - px[b], py[a] - py[b]); if (!best || d < best[0]) best = [d, a, b]; }
      tree.push([best[1], best[2]]); done.push(best[2]);
    }
    return { pick, tree };
  };

  const line = (a, b, share, gap) => {
    const dx = px[b] - px[a]; const dy = py[b] - py[a]; const d = Math.hypot(dx, dy) || 1; const cut = d > gap * 3 ? gap / d : 0;
    const from = cut; const to = cut + (1 - 2 * cut) * share;
    g.beginPath(); g.moveTo(px[a] + dx * from, py[a] + dy * from); g.lineTo(px[a] + dx * to, py[a] + dy * to); g.stroke();
  };

  const draw = (now) => {
    const k = still ? 1 : clamp((now - last) / EASE, 0, 1); last = now;
    project();
    lit.fill(0); inked.fill(0);
    g.clearRect(0, 0, W, H);
    g.lineCap = 'butt'; g.globalAlpha = 1;

    // The chart: rings every 15° of declination and 24 hour lines turn with the sky.
    g.lineWidth = 1; g.strokeStyle = tok.grid; g.beginPath();
    for (let n = 1; n * ring < R; n++) { g.moveTo(pole.x + n * ring, pole.y); g.arc(pole.x, pole.y, n * ring, 0, TAU); }
    for (let h = 0; h < 24; h++) {
      const a = rot + (h * TAU) / 24; const r0 = (h % 6 === 0 ? 0.3 : h % 2 ? 2 : 1) * ring;
      g.moveTo(pole.x + Math.cos(a) * r0, pole.y + Math.sin(a) * r0); g.lineTo(pole.x + Math.cos(a) * R, pole.y + Math.sin(a) * R);
    }
    // The meridian does not turn: the sky crosses it. A double weight, ticks and declinations where the rings meet it.
    g.moveTo(pole.x + 0.5, 0); g.lineTo(pole.x + 0.5, H);
    g.moveTo(pole.x - 5, pole.y + 0.5); g.lineTo(pole.x + 6, pole.y + 0.5);
    for (let n = 1; n * ring < R; n++) for (const dir of [-1, 1]) { const y = Math.round(pole.y + dir * n * ring) + 0.5; g.moveTo(pole.x - 4, y); g.lineTo(pole.x + 5, y); }
    g.stroke();
    g.font = `500 10px ${tok.mono}`; g.textBaseline = 'middle'; g.fillStyle = tok.muted;
    if ('letterSpacing' in g) g.letterSpacing = '0.6px';
    g.textAlign = 'left';
    for (let n = 1; n * ring < R; n++) {
      const dec = 90 - n * 15; const text = `${dec > 0 ? '+' : dec < 0 ? '−' : ''}${Math.abs(dec)}°`;
      for (const dir of [-1, 1]) {
        const y = pole.y + dir * n * ring - 9; const behind = pole.x + 40 > box.l && pole.x < box.r && y > box.t - 8 && y < box.b + 8;
        if (!behind && y > 28 && y < H - 40) g.fillText(text, pole.x + 8, y);
      }
    }
    g.fillText('MERIDIAN', pole.x + 8, 16);
    g.textAlign = 'center';
    for (let h = 0; h < 24; h += 2) {
      const a = rot + (h * TAU) / 24; const ca = Math.cos(a); const sa = Math.sin(a);
      for (const n of [3, 6]) {
        const rad = n * ring + 14; const x = pole.x + ca * rad - sa * 11; const y = pole.y + sa * rad + ca * 11;
        const behind = x > box.l - 14 && x < box.r + 14 && y > box.t - 8 && y < box.b + 8; // not behind the headline, not in the plate line
        if (!behind && x > 12 && y > 12 && x < W - 12 && y < H - 46 && Math.abs(x - pole.x) > 26) g.fillText(`${h}h`, x, y);
      }
    }

    // Pencil: the constellation under the pointer, in the secondary ink, easing in and out.
    const want = new Map();
    if (ptr && !drag?.moved) for (const [a, b] of near(ptr).tree) want.set(`${Math.min(a, b)}-${Math.max(a, b)}`, 1);
    for (const key of want.keys()) if (!pencil.has(key)) pencil.set(key, 0);
    g.strokeStyle = tok.ink2; g.lineWidth = 1;
    for (const [key, v0] of pencil) {
      const v = v0 + ((want.has(key) ? 1 : 0) - v0) * k;
      if (v < 0.01) { pencil.delete(key); continue; }
      pencil.set(key, v);
      const [a, b] = key.split('-').map(Number);
      g.globalAlpha = v * 0.55; line(a, b, 1, 0);
      lit[a] = Math.max(lit[a], v); lit[b] = Math.max(lit[b], v);
    }

    // Ink: pinned constellations, drawn edge by edge from the star nearest the click.
    g.strokeStyle = tok.tone; g.lineWidth = 1.25; g.lineCap = 'round';
    for (let n = pins.length; n--;) {
      const pin = pins[n]; const age = now - pin.t0;
      const alpha = pin.out === undefined ? 1 : 1 - (now - pin.out) / LEAVE;
      if (alpha <= 0) { pins.splice(n, 1); continue; }
      pin.alpha = alpha;
      if (age < 0) { pin.label = 0; continue; }
      inked[pin.pick[0]] = Math.max(inked[pin.pick[0]], alpha * clamp(age / 160, 0, 1));
      pin.tree.forEach(([a, b], e) => {
        const share = cubicOut(clamp((age - e * INK.stagger) / INK.grow, 0, 1));
        if (share <= 0) return;
        g.globalAlpha = alpha * 0.9; line(a, b, share, GAP);
        inked[b] = Math.max(inked[b], alpha * share ** 3);
      });
      pin.label = alpha * clamp((age - pin.tree.length * INK.stagger - INK.grow) / 300, 0, 1);
    }
    g.lineCap = 'butt';

    // Stars: ink, a few tinted, each on its own twinkle; quieter behind the headline; the inked ones take the accent.
    for (const i of vis) {
      const s = stars[i]; const tw = still ? 0.85 : 0.78 + 0.22 * Math.sin((now / s.per) * TAU + s.ph);
      g.globalAlpha = Math.min(1, s.a * tw + lit[i] * 0.45) * (0.1 + 0.9 * clear[i]); g.fillStyle = s.c < 0 ? tok.ink : tok.tints[s.c];
      g.beginPath(); g.arc(px[i], py[i], s.r + lit[i] * 0.5, 0, 7); g.fill();
      if (inked[i] > 0) { g.globalAlpha = inked[i]; g.fillStyle = tok.tone; g.beginPath(); g.arc(px[i], py[i], Math.max(s.r, 1.5) + 0.7, 0, 7); g.fill(); }
    }

    // Catalogue labels, centred under each pinned constellation.
    g.font = `500 10px ${tok.mono}`; g.textAlign = 'center'; g.fillStyle = tok.ink2;
    if ('letterSpacing' in g) g.letterSpacing = '0.9px';
    for (const pin of pins) {
      if (!(pin.label > 0)) continue;
      let cx = 0; let low = -1e9;
      for (const i of pin.pick) { cx += px[i]; low = Math.max(low, py[i]); }
      cx /= pin.pick.length; low += 18;
      if (cx > box.l - 40 && cx < box.r + 40 && low > box.t - 8 && low < box.b + 8) continue; // turned behind the headline
      g.globalAlpha = pin.label; g.fillText(`${String(pin.n).padStart(2, '0')}  ${pin.name.toUpperCase()}`, cx, low);
    }
    if ('letterSpacing' in g) g.letterSpacing = '0px';

    if (shoot) {
      const p = shoot.at ?? (now - shoot.t0) / SHOT;
      if (p >= 1) shoot = null;
      else {
        const e = cubicOut(p); const tail = 0.2 * (1 - p) + 0.03;
        const hx = shoot.x + shoot.dx * e; const hy = shoot.y + shoot.dy * e; const tx = hx - shoot.dx * tail; const ty = hy - shoot.dy * tail;
        const fade = g.createLinearGradient(tx, ty, hx, hy);
        fade.addColorStop(0, 'transparent'); fade.addColorStop(1, tok.ink);
        g.globalAlpha = 0.9 * (1 - p); g.strokeStyle = fade; g.lineWidth = 1.6; g.lineCap = 'round';
        g.beginPath(); g.moveTo(tx, ty); g.lineTo(hx, hy); g.stroke(); g.lineCap = 'butt';
      }
    }
    g.globalAlpha = 1;
  };
  const once = () => { if (still) draw(performance.now()); }; // without motion there is no loop, so redraw on input

  // Ink the constellation at a point. `delay` staggers the chart's first ones on load; `quiet` skips the shooting
  // star and the announcement for them.
  const pin = (p, { delay = 0, quiet = false } = {}) => {
    const now = performance.now(); const { pick, tree } = near(p);
    if (pick.length >= 2) {
      const live = pins.filter((q) => q.out === undefined);
      // Mostly the same stars as a pin that is already there: redraw that one under its own name, never a double.
      const twin = live.find((q) => q.pick.filter((i) => pick.includes(i)).length * 2 >= pick.length);
      if (twin) pins.splice(pins.indexOf(twin), 1);
      else {
        if (live.length >= CAP) { if (still) pins.splice(pins.indexOf(live[0]), 1); else live[0].out = now; }
        count += 1;
      }
      const n = twin ? twin.n : count; const name = twin ? twin.name : NAMES[(count - 1) % NAMES.length];
      pins.push({ pick, tree, t0: still || ctx.capture ? -1e9 : now + delay, n, name });
      if (!quiet) status.textContent = `Pinned ${name}, ${pick.length} stars.`;
    }
    if (still || quiet) { once(); return; }
    const dir = p.x < W / 2 ? 1 : -1; const len = Math.min(520, W * 0.45);
    shoot = { x: p.x + dir * 18, y: Math.max(8, p.y - 40), dx: dir * len, dy: len * 0.2, t0: now };
  };

  // A seeded spot with stars to join: clear of the headline, the pole, the edges and the pins already there.
  const spot = () => {
    let p;
    for (let n = 0; n < 24; n++) {
      p = { x: (0.08 + spots() * 0.84) * W, y: (0.12 + spots() * 0.72) * H };
      const inBox = p.x > box.l - 50 && p.x < box.r + 50 && p.y > box.t - 50 && p.y < box.b + 50;
      const { pick } = near(p); const taken = pins.some((q) => q.out === undefined && q.pick.some((i) => pick.includes(i)));
      if (!inBox && !taken && Math.hypot(p.x - pole.x, p.y - pole.y) > ring * 0.7 && pick.length >= 3) break;
    }
    return p;
  };

  // The chart opens with two constellations already inked, so the first screen says what the pointer is for; the
  // thumbnail holds a third, a pencilled one and a shooting star.
  const open = () => {
    project();
    const first = FIRST[W > H * 0.9 ? 'wide' : 'tall'].slice(0, ctx.capture ? 3 : 2);
    first.forEach(([u, v], n) => pin({ x: u * W, y: v * H }, { delay: 500 + n * 700, quiet: true }));
    if (ctx.capture) {
      ptr = { x: W * (W > H * 0.9 ? 0.58 : 0.7), y: H * (W > H * 0.9 ? 0.82 : 0.3) };
      if (!still) { const len = Math.min(520, W * 0.45); shoot = { x: W * 0.4, y: H * 0.34, dx: -len, dy: len * 0.2, t0: 0, at: 0.24 }; }
    }
  };

  const measure = () => {
    const h = cv.getBoundingClientRect(); const t = title.getBoundingClientRect();
    box.l = t.left - h.left - 6; box.t = t.top - h.top - 2; box.r = t.right - h.left + 6; box.b = t.bottom - h.top + 2;
  };
  const size = () => {
    const w = hero.clientWidth; const h = hero.clientHeight;
    if (!w || !h) return;
    const rebuild = w !== W || Math.abs(h - H) > 120 || !stars.length;
    const d = Math.min(2, devicePixelRatio || 1);
    W = w; H = h; cv.width = Math.round(W * d); cv.height = Math.round(H * d); g.setTransform(d, 0, 0, d, 0, 0);
    reach = cfg.reach * clamp(W / 900, 0.6, 1); // a phone's constellations stay phone-sized
    pole.x = Math.round(W * 0.68); pole.y = Math.round(H * (W > H * 0.9 ? 0.44 : 0.36));
    measure();
    if (rebuild) {
      ring = clamp(Math.min(W, H) * 0.16, 84, 150);
      R = Math.max(...[[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => Math.hypot(x - pole.x, y - pole.y))) + 60;
      seed(); open();
    }
    draw(performance.now());
  };
  readTokens();
  size();
  observeResize(ctx, hero, size);
  document.fonts?.ready.then(() => { if (!ctx.signal.aborted) { measure(); once(); } });
  ctx.onTheme(() => { readTokens(); draw(performance.now()); });

  // Pointer: moving pencils (fine pointers only), a press that travels 6 px becomes a turn of the chart about its
  // pole, and a click that was not a turn inks. pan-y on the canvas leaves vertical touch scrolling to the page.
  const at = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const angle = (p) => Math.atan2(p.y - pole.y, p.x - pole.x);
  on(ctx, cv, 'pointerdown', (e) => {
    if (e.button) return;
    skipClick = false; fling = 0;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, a: 0, t: 0, w: 0 };
  });
  on(ctx, cv, 'pointermove', (e) => {
    const p = at(e);
    if (drag && e.pointerId === drag.id) {
      if (!drag.moved) {
        if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
        drag.moved = true; drag.a = angle(p); drag.t = e.timeStamp;
        cv.setPointerCapture?.(e.pointerId); root.classList.add('is-turning');
        return;
      }
      let da = angle(p) - drag.a; da = clamp(Math.atan2(Math.sin(da), Math.cos(da)), -0.35, 0.35); // near the pole a small move is a big angle
      rot = (rot + da) % TAU;
      drag.w = drag.w * 0.6 + (da / Math.max(1, e.timeStamp - drag.t)) * 400; // rad/s, smoothed
      drag.a = angle(p); drag.t = e.timeStamp;
      once();
      return;
    }
    if (fine && e.pointerType !== 'touch') { ptr = p; once(); }
  });
  const release = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.moved) {
      skipClick = e.type === 'pointerup';
      if (!still && e.type === 'pointerup' && e.timeStamp - drag.t < 90) fling = clamp(drag.w, -FLING.max, FLING.max);
      root.classList.remove('is-turning');
    }
    drag = null;
  };
  on(ctx, cv, 'pointerup', release);
  on(ctx, cv, 'pointercancel', release);
  on(ctx, cv, 'pointerleave', () => { if (!drag?.moved) { ptr = null; once(); } });
  on(ctx, cv, 'click', (e) => { if (skipClick) { skipClick = false; return; } pin(at(e)); });
  on(ctx, root.querySelector('[data-cue]'), 'click', () => pin(spot()));

  if (!still) {
    const turn = (dt, t) => {
      if (!drag?.moved && !ctx.capture) {
        rot = (rot + ((cfg.drift * Math.PI) / 180 + fling) * dt) % TAU;
        fling = Math.abs(fling) < 0.002 ? 0 : fling * Math.exp(-FLING.decay * dt);
      }
      draw(t);
    };
    let off = null;
    whileVisible(ctx, hero, () => { off = onFrame(ctx, turn); }, () => { off?.(); off = null; }, { rootMargin: '0px' });
  }

  return {
    update(next, changed) {
      cfg = { ...next };
      reach = cfg.reach * clamp(W / 900, 0.6, 1);
      if (changed.includes('tone')) readTokens();
      if (changed.includes('cell')) { seed(); open(); }
      draw(performance.now());
    },
    action(id) {
      if (id === 'pin') pin(spot());
      if (id === 'clear') { const now = performance.now(); if (still) pins.length = 0; else for (const p of pins) p.out ??= now; status.textContent = 'Chart cleared.'; once(); }
    },
  };
}
