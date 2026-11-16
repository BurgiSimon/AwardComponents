// Koi pond hero — the first screen of Halden's Stillwater Pavilion page is the pavilion's water seen from above,
// drawn on one 2D canvas under the headline. Koi of several sizes swim beneath the type: each is a ten-point spine
// dragged behind its head with a width profile, fins, a forked tail and a swimming wave, some with patches clipped
// to the body. Their shadows and the lily pads' are drawn to a fifth-size layer and scaled up, which leaves the
// edges soft. The pads float above the koi and drift and turn when a ripple reaches them. A slow fine pointer
// draws koi over to loiter, a fast one scatters them and leaves small rings; a click (or the Feed button) drops a
// pellet with four wide rings and each koi races for its nearest one. The loop runs only while the hero is on
// screen. Reduced and static: one settled still, re-posed after each feed.
import './demo.css';
import { on, onFrame, whileVisible, observeResize, html, clamp, finePointer, readToken, content } from '../../src/demo-kit/index.js';

const N = 10;       // spine points
const SEG = 5.4;    // their spacing, px at scale 1
const WID = [0.72, 0.95, 1, 0.97, 0.88, 0.72, 0.56, 0.42, 0.32, 0.26]; // half-width profile, nose to tail
const CRUISE = 24;  // px/s at scale 1
const PELLETS = 8;  // most pellets in the water; the oldest goes first
const WAVE = 80;    // px/s a click's rings travel
const STARTLE = 130; // px around a fast pointer
const SOFT = 5;     // the shadow layer is drawn at 1/5 size
// Koi: body colour, patch colour (or none), size.
const KOI = [['accent', 'on-media', 2], ['sand', 'accent', 1.6], ['plum', null, 1.8], ['clay', 'on-media', 1.35], ['sand', 'plum', 1.15], ['accent', null, 1], ['clay', null, 1.5], ['plum', 'sand', 1.25]];
// Where each koi starts: x and y as shares of the water, and a heading in radians.
const START = [[0.2, 0.34, 0.5], [0.74, 0.26, 2.7], [0.82, 0.64, -2.3], [0.3, 0.76, -0.4], [0.5, 0.15, 0.1], [0.6, 0.86, 3.3], [0.1, 0.58, 1.2], [0.92, 0.42, -1.5]];
// Lily pads: home as shares of the water, radius in px at scale 1. They keep to the edges, clear of the headline.
const PADS = [[0.095, 0.2, 54], [0.185, 0.34, 30], [0.885, 0.15, 42], [0.9, 0.72, 58], [0.795, 0.87, 32], [0.06, 0.8, 38], [0.6, 0.05, 28]];
const NOTCH = 0.16; // half the pad's wedge, radians
// Hash of an index, 0..1: the same patches, pads and Feed-button spots on every visit.
const rnd = (i) => { let h = Math.imul(i + 1, 0x9e3779b9); h = Math.imul(h ^ (h >>> 15), h | 1); h ^= h + Math.imul(h ^ (h >>> 7), h | 61); return ((h ^ (h >>> 14)) >>> 0) / 4294967296; };

export default function mount(root, options, ctx) {
  const { studio } = content;
  const project = studio.projects.find((p) => p.slug === 'stillwater');
  let cfg = { ...options };
  const live = ctx.motion === 'full' && !ctx.capture;

  root.className = 'kph';
  root.innerHTML = html`
    <section class="ac-stage kph__hero" aria-labelledby="kph-title" data-hero>
      <canvas class="kph__canvas" aria-hidden="true"></canvas>
      <h1 class="kph__title" id="kph-title">${project.title}</h1>
      <button class="kph__cue" type="button" data-cue>Feed the koi</button>
      <p class="ac-stage__note"><span class="kph__tape">${studio.name} · project hero</span><span class="kph__tape">${project.place} · ${project.year}</span></p>
    </section>`;

  const hero = root.querySelector('[data-hero]');
  const cv = hero.querySelector('canvas');
  const g = cv.getContext('2d');
  const layer = document.createElement('canvas'); // shadows, at 1/SOFT size
  const sg = layer.getContext('2d');
  let W = 0; let H = 0; let S = 1; let t = 0; let wake = 0;
  let ink = ''; let shade = ''; let depth = 0.18; let leaf = ''; let vein = '';
  let fish = []; let pads = []; let pellets = []; let rips = []; let ptr = null; let fed = 0; let off = null;

  const paint = () => {
    ink = readToken('--ink-2'); shade = readToken('--night'); leaf = readToken('--moss'); vein = readToken('--on-media');
    depth = Number(readToken('--kph-shadow', root)) || 0.18;
    fish.forEach((f, i) => { f.c = readToken(`--${KOI[i][0]}`); f.pc = KOI[i][1] && readToken(`--${KOI[i][1]}`); });
  };
  // A phone gets fewer, so the water stays open.
  const stock = () => {
    const small = W && W < 560;
    fish = KOI.slice(0, small ? Math.min(cfg.count, 4) : cfg.count).map(([, , z], i) => ({
      z, ph: i * 2.4, a: 0, v: 0, scare: 0, x: 0, y: 0, sp: [], c: '', pc: '',
      spots: [1, 4, 6].map((k, j) => [k, rnd(i * 9 + j) * 1.6 - 0.8, 0.75 + rnd(i * 9 + j + 3) * 0.5]), // patches: spine point, sideways share of the half-width, radius share
    }));
    pads = PADS.slice(0, small ? Math.min(cfg.pads, 4) : cfg.pads).map(([u, v, r], i) => ({ u, v, r, a0: rnd(i + 70) * 6.283, a: 0, ph: i * 1.9, spin: i % 2 ? 1 : -1, ox: 0, oy: 0, vx: 0, vy: 0, va: 0, tw: 0 }));
    paint();
  };
  const place = () => {
    fish.forEach((f, i) => {
      const [u, v, a] = START[i]; const s = S * f.z;
      f.x = u * W; f.y = v * H; f.a = a; f.v = 0; f.scare = 0;
      f.sp = Array.from({ length: N }, (_, k) => ({ x: f.x - Math.cos(a) * k * SEG * s, y: f.y - Math.sin(a) * k * SEG * s }));
    });
    pads.forEach((p) => { p.ox = p.oy = p.vx = p.vy = p.va = p.tw = 0; p.a = p.a0; });
  };

  const step = (dt) => {
    t += dt;
    const life = cfg.ripple / WAVE; // a click's rings fade as they reach cfg.ripple px
    for (const f of fish) {
      const s = S * f.z; const m = 26 * s + 6;
      let sx = Math.cos(f.a); let sy = Math.sin(f.a); let arc = 26;
      let speed = (CRUISE + 6 * Math.sin(t * 0.3 + f.ph)) * cfg.speed;
      const dist = (p) => Math.hypot(p.x - f.x, p.y - f.y) || 1;
      const pull = (p, k) => { const d = dist(p); sx += ((p.x - f.x) / d) * k; sy += ((p.y - f.y) / d) * k; };
      const wob = Math.sin(t * 0.45 + f.ph) * 0.5 + Math.sin(t * 0.19 + f.ph * 1.7) * 0.4; // wander: a slow pull to one side, then the other
      sx -= Math.sin(f.a) * wob; sy += Math.cos(f.a) * wob;
      for (const o of fish) { // sidestep another koi: steer across the heading, away from its side (to the right when it is dead ahead)
        const d = dist(o); const room = 35 * S * (f.z + o.z);
        const k = (Math.cos(f.a) * (o.y - f.y) - Math.sin(f.a) * (o.x - f.x) > 0 ? -2.2 : 2.2) * (1 - d / room);
        if (o !== f && d < room) { sx -= Math.sin(f.a) * k; sy += Math.cos(f.a) * k; }
      }
      const food = pellets.reduce((b, p) => (!b || dist(p) < dist(b) ? p : b), null);
      // Banks: probe ahead, and once the probe leaves the safe box head for the water's middle line (along its
      // longer side). Pulling toward a fixed point keeps the turn direction stable, so a koi never runs into an edge.
      const px = f.x + Math.cos(f.a) * 40 * s; const py = f.y + Math.sin(f.a) * 40 * s;
      const out = Math.max(m - px, px - (W - m), m - py, py - (H - m), 0);
      if (out && !food) pull(W >= H ? { x: clamp(f.x, H / 2, W - H / 2), y: H / 2 } : { x: W / 2, y: clamp(f.y, W / 2, H - W / 2) }, 3 * Math.min(1, out / (16 * s)));
      if (Math.min(f.x, f.y, W - f.x, H - f.y) < m) arc = 14; // already at an edge (after a pellet there): turn tightly
      if (food) { pull(food, 2.6); speed *= 2.2 + Math.min(3.3, dist(food) / 180); } // quicker from far away, so a pellet never waits long
      else if (ptr) {
        const d = dist(ptr);
        if (t < ptr.fast && d < STARTLE) f.scare = 0.7; // a fast pointer startles nearby koi for a moment
        if (f.scare > 0) { pull(ptr, -3); speed *= 2.4; }
        else if (d < cfg.reach) { pull(ptr, d > 48 * f.z ? 2 : d < 34 * f.z ? -1.2 : 0); speed *= d < 70 * f.z ? 0.6 : 1.2; arc = 20; } // curious: come over, then loiter
      }
      f.scare = Math.max(0, f.scare - dt);
      let da = Math.atan2(sy, sx) - f.a; da = Math.atan2(Math.sin(da), Math.cos(da));
      const near = food && dist(food) < 45 * f.z; // close to food: turn on the spot and slow in the turn, so a pellet is never orbited
      const turn = (near ? 3.2 : Math.max(f.v, 10) / (arc * s)) * dt; // otherwise a fixed turning circle keeps the body in a gentle arc
      f.a += clamp(da, -turn, turn);
      f.v += (speed * s * (near ? 1 - 0.6 * Math.min(1, Math.abs(da) / 1.5) : 1) - f.v) * Math.min(1, dt * 2.5);
      f.x = clamp(f.x + Math.cos(f.a) * f.v * dt, 6, W - 6); f.y = clamp(f.y + Math.sin(f.a) * f.v * dt, 6, H - 6);
      f.sp[0].x = f.x; f.sp[0].y = f.y;
      for (let k = 1; k < N; k++) {
        const p = f.sp[k]; const q = f.sp[k - 1]; const dx = p.x - q.x; const dy = p.y - q.y; const d = Math.hypot(dx, dy) || 1;
        p.x = q.x + (dx / d) * SEG * s; p.y = q.y + (dy / d) * SEG * s;
      }
      if (food && dist(food) < 8 * f.z) { pellets.splice(pellets.indexOf(food), 1); rips.push({ x: food.x, y: food.y, t, small: true }); }
    }
    // Pads: a slow bob around home on a soft spring; the front of a wide ring pushes them outward and turns them.
    for (const p of pads) {
      let ax = (Math.sin(t * 0.21 + p.ph) * 5 - p.ox) * 1.4; let ay = (Math.cos(t * 0.17 + p.ph * 1.3) * 4 - p.oy) * 1.4;
      for (const r of rips) {
        if (r.small) continue;
        const age = t - r.t; const dx = p.u * W + p.ox - r.x; const dy = p.v * H + p.oy - r.y; const d = Math.hypot(dx, dy) || 1;
        if (d > age * WAVE || d < age * WAVE - 60) continue;
        const k = 1 - age / life;
        ax += (dx / d) * 60 * k; ay += (dy / d) * 60 * k; p.va += p.spin * 0.9 * k * dt;
      }
      const drag = Math.exp(-1.6 * dt);
      p.vx = (p.vx + ax * dt) * drag; p.vy = (p.vy + ay * dt) * drag; p.ox += p.vx * dt; p.oy += p.vy * dt;
      p.va *= Math.exp(-0.9 * dt); p.tw += p.va * dt;
      p.a = p.a0 + p.tw + Math.sin(t * 0.13 + p.ph) * 0.1;
    }
    rips = rips.filter((r) => t - r.t < (r.small ? 0.9 : life));
  };

  // A koi's outlines for this frame: two pectoral fins, the tail, the body, and the spine they hang on.
  const outline = (f) => {
    const s = S * f.z; const R = 7 * s;
    const pts = f.sp.map((p, k) => {
      const a = f.sp[Math.max(k, 1) - 1]; const b = f.sp[Math.max(k, 1)];
      const dx = a.x - b.x; const dy = a.y - b.y; const d = Math.hypot(dx, dy) || 1; const ux = dx / d; const uy = dy / d;
      const wig = Math.sin(t * 6 - k * 0.7 + f.ph) * (k / N) ** 2 * (2.4 + f.v / (30 * f.z)) * s; // swimming wave, growing toward the tail
      return { x: p.x - uy * wig, y: p.y + ux * wig, ux, uy };
    });
    const at = (p, fwd, lat) => [p.x + p.ux * fwd - p.uy * lat, p.y + p.uy * fwd + p.ux * lat];
    const sh = pts[2]; const e = pts[N - 1];
    return {
      pts, R,
      fins: [1, -1].map((d) => [at(sh, 4 * s, d * R * 0.7), at(sh, -4 * s, d * (R + 10 * s)), at(sh, -11 * s, d * (R + 6 * s)), at(sh, -7 * s, d * R * 0.6)]),
      tail: [at(e, 14 * s, 0), at(e, -21 * s, 9 * s), at(e, -14 * s, 0), at(e, -21 * s, -9 * s)], // a shallow fork; its front reaches into the body
      body: [at(pts[0], R * 1.15, 0), ...pts.map((p, k) => at(p, 0, WID[k] * R)), at(e, -2 * s, 0), ...pts.map((_, k) => at(pts[N - 1 - k], 0, -WID[N - 1 - k] * R))],
    };
  };
  // A closed smooth shape: the points are control points, the curve runs through their midpoints.
  const blob = (c, P, dx = 0, dy = 0) => {
    c.beginPath();
    P.forEach(([x, y], i) => { const [nx, ny] = P[(i + 1) % P.length]; const mx = (x + nx) / 2 + dx; const my = (y + ny) / 2 + dy; if (i) c.quadraticCurveTo(x + dx, y + dy, mx, my); else c.moveTo(mx, my); });
    c.quadraticCurveTo(P[0][0] + dx, P[0][1] + dy, (P[0][0] + P[1][0]) / 2 + dx, (P[0][1] + P[1][1]) / 2 + dy); c.fill();
  };
  const pad = (c, p, dx = 0, dy = 0) => {
    const x = p.u * W + p.ox + dx; const y = p.v * H + p.oy + dy;
    c.beginPath(); c.moveTo(x, y); c.arc(x, y, p.r * S, p.a + NOTCH, p.a + 6.283 - NOTCH); c.closePath(); c.fill();
  };

  const draw = () => {
    g.clearRect(0, 0, W, H);
    const outs = fish.map(outline);
    // Shadows on the pond floor: opaque shapes on the small layer (so overlaps never double), scaled up with one
    // alpha. Pads sit at the surface and throw theirs further than the koi below them.
    sg.clearRect(0, 0, W, H); sg.fillStyle = shade;
    for (const p of pads) pad(sg, p, 13 * S, 20 * S);
    outs.forEach((o, i) => { const d = (5 + 3 * fish[i].z) * S; for (const P of [...o.fins, o.tail, o.body]) blob(sg, P, d * 0.7, d); });
    g.globalAlpha = depth; g.drawImage(layer, 0, 0, layer.width * SOFT, layer.height * SOFT);

    outs.forEach((o, i) => {
      const f = fish[i];
      g.fillStyle = f.c;
      g.globalAlpha = 0.45; o.fins.forEach((P) => blob(g, P));
      g.globalAlpha = 0.65; blob(g, o.tail);
      g.globalAlpha = 1; blob(g, o.body);
      if (!f.pc) return;
      g.save(); g.clip(); g.fillStyle = f.pc; // the body is still the current path
      for (const [k, lat, r] of f.spots) { const p = o.pts[k]; g.beginPath(); g.arc(p.x - p.uy * lat * o.R, p.y + p.ux * lat * o.R, r * o.R, 0, 7); g.fill(); }
      g.restore();
    });

    g.strokeStyle = g.fillStyle = ink; g.lineWidth = 1;
    const life = cfg.ripple / WAVE;
    for (const r of rips) {
      const age = t - r.t;
      for (let k = 0; k < (r.small ? 1 : 4); k++) {
        const rad = age * (r.small ? 26 : WAVE) - k * 18;
        if (rad > 0) { g.globalAlpha = (1 - age / (r.small ? 0.9 : life)) * (r.small ? 0.34 : 0.42); g.beginPath(); g.arc(r.x, r.y, rad, 0, 7); g.stroke(); }
      }
    }
    g.globalAlpha = 0.75;
    for (const p of pellets) { g.beginPath(); g.arc(p.x, p.y, 2.6, 0, 7); g.fill(); }

    // Lily pads float above everything in the water: a disc with a wedge cut out and a fan of light veins.
    for (const p of pads) {
      const x = p.u * W + p.ox; const y = p.v * H + p.oy; const r = p.r * S;
      g.globalAlpha = 1; g.fillStyle = leaf; pad(g, p);
      g.globalAlpha = 0.2; g.strokeStyle = vein; g.beginPath();
      for (let i = 1; i < 8; i++) { const a = p.a + NOTCH + (i * (6.283 - 2 * NOTCH)) / 8; g.moveTo(x + Math.cos(a) * r * 0.14, y + Math.sin(a) * r * 0.14); g.lineTo(x + Math.cos(a) * r * 0.86, y + Math.sin(a) * r * 0.86); }
      g.stroke();
    }
    g.globalAlpha = 1;
  };

  const drop = (x, y, age = 0) => {
    const p = { x: clamp(x, 14, W - 14), y: clamp(y, 14, H - 14) };
    rips.push({ x: p.x, y: p.y, t: t - age });
    pellets.push(p); if (pellets.length > PELLETS) pellets.shift();
    return p;
  };
  // Without a loop a feed is one change of state: step ahead until the pellet is taken, leave its rings, hold.
  const feed = (x, y) => {
    const p = drop(x, y);
    if (live) return;
    for (let i = 0; i < 240 && pellets.length; i++) step(1 / 30);
    rips = [{ x: p.x, y: p.y, t: t - 1 }];
    draw();
  };
  // The Feed button and the toolbar action: seeded spots in the open water around the headline.
  const feedSeeded = () => { feed((0.16 + 0.68 * rnd(fed * 2 + 20)) * W, (0.2 + 0.6 * rnd(fed * 2 + 21)) * H); fed++; };

  // No loop (reduced, static, the thumbnail): step ahead into natural curved poses and hold them. The thumbnail
  // also gets a pellet in the clearest water, its rings a second old and the koi already turning for it.
  const pose = () => {
    place(); t = 0; pellets = []; rips = [];
    for (let i = 0; i < 150; i++) step(1 / 30);
    if (!ctx.capture) return;
    let best = null;
    for (let i = 0; i < 24; i++) {
      const u = 0.2 + 0.6 * rnd(i * 2 + 40); const v = 0.22 + 0.56 * rnd(i * 2 + 41);
      if (Math.abs(u - 0.5) < 0.24 && Math.abs(v - 0.48) < 0.2) continue; // not under the headline
      const p = { x: u * W, y: v * H };
      const d = Math.min(...fish.map((f) => Math.hypot(f.x - p.x, f.y - p.y)));
      if (!best || d > best.d) best = { ...p, d };
    }
    drop(best.x, best.y, 1);
    for (let i = 0; i < 8; i++) step(1 / 30);
  };

  const fit = () => {
    const first = !W;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const was = W && W < 560;
    W = hero.clientWidth; H = hero.clientHeight;
    if (!W || !H) { W = 0; return; }
    S = clamp(Math.min(W, H * 1.5) / 1100, 0.72, 1.2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    layer.width = Math.ceil(W / SOFT); layer.height = Math.ceil(H / SOFT); sg.setTransform(1 / SOFT, 0, 0, 1 / SOFT, 0, 0);
    const restock = first || was !== (W < 560);
    if (restock) stock();
    if (!live) pose(); else if (restock) place();
    draw();
  };

  fit();
  observeResize(ctx, hero, () => { if (hero.clientWidth !== W || hero.clientHeight !== H) fit(); });
  ctx.onTheme(() => { paint(); if (!off) draw(); });

  if (live) {
    const tick = (dt) => { if (!W) return; step(Math.min(dt, 0.05)); draw(); }; // clamped: no jump after a stalled frame
    whileVisible(ctx, hero, () => { off = onFrame(ctx, tick); }, () => { off?.(); off = null; }, { rootMargin: '0px' });
    if (finePointer()) {
      on(ctx, hero, 'pointermove', (e) => {
        if (e.pointerType === 'touch') return;
        const r = cv.getBoundingClientRect();
        const p = { x: e.clientX - r.left, y: e.clientY - r.top, ts: e.timeStamp };
        const fast = ptr && Math.hypot(p.x - ptr.x, p.y - ptr.y) / Math.max(1, p.ts - ptr.ts) > 0.9;
        p.fast = fast ? t + 0.2 : ptr ? ptr.fast : 0;
        if (fast && t - wake > 0.14) { rips.push({ x: p.x, y: p.y, t, small: true }); wake = t; } // a fast pointer skims the surface
        ptr = p;
      });
      for (const type of ['pointerleave', 'pointercancel']) on(ctx, hero, type, () => { ptr = null; });
    }
  }
  // click, not pointerdown: a touch scroll that starts on the water must not feed.
  on(ctx, hero, 'click', (e) => {
    if (e.target.closest('button')) return;
    const r = cv.getBoundingClientRect();
    feed(e.clientX - r.left, e.clientY - r.top);
  });
  on(ctx, root.querySelector('[data-cue]'), 'click', feedSeeded);

  return {
    update(next, changed) {
      cfg = { ...next };
      if (changed.includes('count') || changed.includes('pads')) { stock(); if (live) place(); else pose(); }
      if (!off) draw();
    },
    action(id) { if (id === 'feed') feedSeeded(); },
  };
}
