// Koi pond footer — Halden's site close with a small pond seen from above. Each koi is a ten-point spine dragged
// behind its head (points 5.4 px apart) with a width profile, pectoral fins, a forked tail and a swimming wave that
// grows toward the tail. They wander, sidestep each other and head for the pond's middle line when a probe ahead of
// them leaves the safe box. A slow fine pointer draws them over and they loiter; a fast one scatters them for 0.7 s.
// A click (or the Feed button) drops a pellet with three ripple rings and each koi races for its nearest one.
// The loop runs only while the pond is on screen. Reduced and static: one settled still, re-posed after each feed.
import './demo.css';
import { on, onFrame, whileVisible, observeResize, html, clamp, finePointer, readToken, content } from '../../src/demo-kit/index.js';

const N = 10;      // spine points
const SEG = 5.4;   // their spacing, px at scale 1
const WID = [0.72, 0.95, 1, 0.97, 0.88, 0.72, 0.56, 0.42, 0.32, 0.26]; // half-width profile, nose to tail
const CRUISE = 24; // px/s
const PELLETS = 6; // most pellets in the water; the oldest goes first
// Where each koi starts: x and y as shares of the pond, and a heading in radians.
const START = [[0.2, 0.42, 0.3], [0.52, 0.64, 2.8], [0.8, 0.36, -0.4], [0.36, 0.28, 3.4], [0.66, 0.74, 0.2], [0.1, 0.7, -1.2]];
const TONES = ['clay', 'plum', 'sky', 'moss', 'sand', 'accent']; // after the lead koi, in this order
// Hash of an index, 0..1: the Feed button drops its pellets at the same spots on every visit.
const rnd = (i) => { let h = Math.imul(i + 1, 0x9e3779b9); h = Math.imul(h ^ (h >>> 15), h | 1); h ^= h + Math.imul(h ^ (h >>> 7), h | 61); return ((h ^ (h >>> 14)) >>> 0) / 4294967296; };

export default function mount(root, options, ctx) {
  const { studio } = content;
  let cfg = { ...options };
  const live = ctx.motion === 'full' && !ctx.capture;

  root.className = 'kpf';
  root.innerHTML = html`
    <footer class="kpf__foot" aria-labelledby="kpf-title">
      <div class="kpf__say ac-wrap">
        <p class="ac-label">${studio.address[0]} · ${studio.city}</p>
        <h2 class="kpf__title" id="kpf-title">${studio.signoff}</h2>
      </div>
      <div class="kpf__scene ac-wrap" data-pond><canvas aria-hidden="true"></canvas></div>
      <div class="kpf__row ac-wrap">
        <nav class="kpf__nav" aria-label="Footer">
          ${studio.nav.map((n) => html`<a href="#top">${n}</a>`)}
          <a href="mailto:${studio.email}">${studio.email}</a>
        </nav>
        <button class="kpf__cue" type="button" data-cue>Feed the koi</button>
      </div>
      <p class="kpf__legal ac-wrap">© 2026 ${studio.full} · ${studio.city}</p>
    </footer>`;
  root.querySelectorAll('a').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const pond = root.querySelector('[data-pond]');
  const cv = pond.firstElementChild;
  const g = cv.getContext('2d');
  let W = 0; let H = 0; let S = 1; let t = 0; let ink = '';
  let fish = []; let pellets = []; let rips = []; let ptr = null; let fed = 0; let off = null;

  const paint = () => {
    ink = readToken('--ink-2');
    const tones = [cfg.tone, ...TONES.filter((n) => n !== cfg.tone)];
    fish.forEach((f, i) => { f.c = readToken(`--${tones[i % tones.length]}`); });
  };
  const stock = () => {
    fish = START.slice(0, cfg.count).map((_, i) => ({ ph: i * 2.4, a: 0, v: 0, scare: 0, x: 0, y: 0, sp: [], c: '' }));
    paint();
  };
  const place = () => fish.forEach((f, i) => {
    const [u, v, a] = START[i];
    f.x = u * W; f.y = v * H; f.a = a; f.v = 0; f.scare = 0;
    f.sp = Array.from({ length: N }, (_, k) => ({ x: f.x - Math.cos(a) * k * SEG * S, y: f.y - Math.sin(a) * k * SEG * S }));
  });

  const step = (dt) => {
    t += dt;
    const m = 26 * S + 6;
    for (const f of fish) {
      let sx = Math.cos(f.a); let sy = Math.sin(f.a); let arc = 26;
      let speed = (CRUISE + 6 * Math.sin(t * 0.3 + f.ph)) * cfg.speed;
      const dist = (p) => Math.hypot(p.x - f.x, p.y - f.y) || 1;
      const pull = (p, k) => { const d = dist(p); sx += ((p.x - f.x) / d) * k; sy += ((p.y - f.y) / d) * k; };
      const wob = Math.sin(t * 0.45 + f.ph) * 0.5 + Math.sin(t * 0.19 + f.ph * 1.7) * 0.4; // wander: a slow pull to one side, then the other
      sx -= Math.sin(f.a) * wob; sy += Math.cos(f.a) * wob;
      for (const o of fish) { // sidestep another koi: steer across the heading, away from its side (to the right when it is dead ahead)
        const d = dist(o);
        const k = (Math.cos(f.a) * (o.y - f.y) - Math.sin(f.a) * (o.x - f.x) > 0 ? -2.2 : 2.2) * (1 - d / (70 * S));
        if (o !== f && d < 70 * S) { sx -= Math.sin(f.a) * k; sy += Math.cos(f.a) * k; }
      }
      const food = pellets.reduce((b, p) => (!b || dist(p) < dist(b) ? p : b), null);
      // Banks: probe ahead, and once the probe leaves the safe box head for the pond's middle line. Pulling toward a
      // fixed point (not pushing back along the heading) keeps the turn direction stable, so a koi never runs into a bank.
      const px = f.x + Math.cos(f.a) * 40 * S; const py = f.y + Math.sin(f.a) * 40 * S;
      const out = Math.max(m - px, px - (W - m), m - py, py - (H - m), 0);
      if (out && !food) pull({ x: clamp(f.x, H / 2, W - H / 2), y: H / 2 }, 3 * Math.min(1, out / (16 * S)));
      if (Math.min(f.x, f.y, W - f.x, H - f.y) < m) arc = 14; // already at a bank (after a pellet there): turn tightly
      if (food) { pull(food, 2.6); speed *= 2.2 + Math.min(3.3, dist(food) / 180); } // quicker from far away, so a pellet never waits long
      else if (ptr) {
        const d = dist(ptr);
        if (t < ptr.fast && d < 90) f.scare = 0.7; // a fast pointer startles nearby koi for a moment
        if (f.scare > 0) { pull(ptr, -3); speed *= 2.4; }
        else if (d < cfg.reach) { pull(ptr, d > 48 ? 2 : d < 34 ? -1.2 : 0); speed *= d < 70 ? 0.6 : 1.2; arc = 20; } // curious: come over, then loiter
      }
      f.scare = Math.max(0, f.scare - dt);
      let da = Math.atan2(sy, sx) - f.a; da = Math.atan2(Math.sin(da), Math.cos(da));
      const near = food && dist(food) < 45; // close to food: turn on the spot and slow in the turn, so a pellet is never orbited
      const turn = (near ? 3.2 : Math.max(f.v, 10) / (arc * S)) * dt; // otherwise a fixed turning circle keeps the body in a gentle arc
      f.a += clamp(da, -turn, turn);
      f.v += (speed * S * (near ? 1 - 0.6 * Math.min(1, Math.abs(da) / 1.5) : 1) - f.v) * Math.min(1, dt * 2.5);
      f.x = clamp(f.x + Math.cos(f.a) * f.v * dt, 6, W - 6); f.y = clamp(f.y + Math.sin(f.a) * f.v * dt, 6, H - 6);
      f.sp[0].x = f.x; f.sp[0].y = f.y;
      for (let k = 1; k < N; k++) {
        const p = f.sp[k]; const q = f.sp[k - 1]; const dx = p.x - q.x; const dy = p.y - q.y; const d = Math.hypot(dx, dy) || 1;
        p.x = q.x + (dx / d) * SEG * S; p.y = q.y + (dy / d) * SEG * S;
      }
      if (food && dist(food) < 8) { pellets.splice(pellets.indexOf(food), 1); rips.push({ x: food.x, y: food.y, t, small: true }); }
    }
    rips = rips.filter((r) => t - r.t < (r.small ? 0.7 : 1.8));
  };

  // A closed smooth shape: the points are control points, the curve runs through their midpoints.
  const blob = (P, alpha) => {
    g.globalAlpha = alpha; g.beginPath();
    P.forEach(([x, y], i) => { const [nx, ny] = P[(i + 1) % P.length]; const mx = (x + nx) / 2; const my = (y + ny) / 2; if (i) g.quadraticCurveTo(x, y, mx, my); else g.moveTo(mx, my); });
    g.quadraticCurveTo(P[0][0], P[0][1], (P[0][0] + P[1][0]) / 2, (P[0][1] + P[1][1]) / 2); g.fill();
  };
  const drawFish = (f) => {
    const R = 7 * S;
    const pts = f.sp.map((p, k) => {
      const a = f.sp[Math.max(k, 1) - 1]; const b = f.sp[Math.max(k, 1)];
      const dx = a.x - b.x; const dy = a.y - b.y; const d = Math.hypot(dx, dy) || 1; const ux = dx / d; const uy = dy / d;
      const wig = Math.sin(t * 6 - k * 0.7 + f.ph) * (k / N) ** 2 * (2.4 + f.v / 30) * S; // swimming wave, growing toward the tail
      return { x: p.x - uy * wig, y: p.y + ux * wig, ux, uy };
    });
    const at = (p, fwd, lat) => [p.x + p.ux * fwd - p.uy * lat, p.y + p.uy * fwd + p.ux * lat];
    const sh = pts[2]; const e = pts[N - 1];
    g.fillStyle = f.c;
    for (const s of [1, -1]) blob([at(sh, 4 * S, s * R * 0.7), at(sh, -4 * S, s * (R + 10 * S)), at(sh, -11 * S, s * (R + 6 * S)), at(sh, -7 * S, s * R * 0.6)], 0.45); // pectoral fins
    blob([at(e, 14 * S, 0), at(e, -21 * S, 9 * S), at(e, -14 * S, 0), at(e, -21 * S, -9 * S)], 0.65); // long tail fin with a shallow fork; its front reaches into the body
    blob([at(pts[0], R * 1.15, 0), ...pts.map((p, k) => at(p, 0, WID[k] * R)), at(e, -2 * S, 0), ...pts.map((_, k) => at(pts[N - 1 - k], 0, -WID[N - 1 - k] * R))], 1);
  };
  const draw = () => {
    g.clearRect(0, 0, W, H);
    g.strokeStyle = g.fillStyle = ink; g.lineWidth = 1;
    for (const r of rips) {
      const age = t - r.t; const life = r.small ? 0.7 : 1.8;
      for (let k = 0; k < (r.small ? 1 : 3); k++) {
        const rad = age * (r.small ? 18 : 42) - k * 9;
        if (rad > 0) { g.globalAlpha = (1 - age / life) * 0.45; g.beginPath(); g.arc(r.x, r.y, rad, 0, 7); g.stroke(); }
      }
    }
    g.globalAlpha = 0.75;
    for (const p of pellets) { g.beginPath(); g.arc(p.x, p.y, 2.2, 0, 7); g.fill(); }
    fish.forEach(drawFish);
    g.globalAlpha = 1;
  };

  const drop = (x, y, age = 0) => {
    const p = { x: clamp(x, 12, W - 12), y: clamp(y, 12, H - 12) };
    rips.push({ x: p.x, y: p.y, t: t - age });
    pellets.push(p); if (pellets.length > PELLETS) pellets.shift();
    return p;
  };
  // Without a loop a feed is one change of state: step ahead until the pellet is taken, leave its rings, hold.
  const feed = (x, y) => {
    const p = drop(x, y);
    if (live) return;
    for (let i = 0; i < 180 && pellets.length; i++) step(1 / 30);
    rips = [{ x: p.x, y: p.y, t: t - 0.5 }];
    draw();
  };
  const feedSeeded = () => { feed((0.14 + 0.72 * rnd(fed * 2)) * W, (0.24 + 0.52 * rnd(fed * 2 + 1)) * H); fed++; };

  // No loop (reduced, static, the thumbnail): step ahead into natural curved poses and hold them. The thumbnail
  // also gets a pellet in the clearest water, its rings half a second old and the koi already turning for it.
  const pose = () => {
    place(); t = 0; pellets = []; rips = [];
    for (let i = 0; i < (ctx.capture ? 110 : 20); i++) step(1 / 30);
    if (!ctx.capture) return;
    let best = null;
    for (let i = 0; i < 12; i++) {
      const p = { x: (0.2 + 0.6 * rnd(i * 2 + 40)) * W, y: (0.3 + 0.4 * rnd(i * 2 + 41)) * H };
      const d = Math.min(...fish.map((f) => Math.hypot(f.x - p.x, f.y - p.y)));
      if (!best || d > best.d) best = { ...p, d };
    }
    drop(best.x, best.y, 0.45);
    for (let i = 0; i < 8; i++) step(1 / 30);
  };

  const fit = () => {
    const first = !W;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = pond.clientWidth; H = pond.clientHeight;
    if (!W || !H) { W = 0; return; }
    S = clamp(Math.min(W / 900, H / 150), 0.72, 1.2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!live) pose(); else if (first) place();
    draw();
  };

  stock();
  fit();
  observeResize(ctx, pond, () => { if (pond.clientWidth !== W || pond.clientHeight !== H) fit(); });
  ctx.onTheme(() => { paint(); if (!off) draw(); });

  if (live) {
    const tick = (dt) => { if (!W) return; step(Math.min(dt, 0.05)); draw(); }; // clamped: no jump after a stalled frame
    whileVisible(ctx, pond, () => { off = onFrame(ctx, tick); }, () => { off?.(); off = null; });
    if (finePointer()) {
      const at = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
      on(ctx, pond, 'pointermove', (e) => {
        if (e.pointerType === 'touch') return;
        const p = at(e);
        p.ts = e.timeStamp;
        p.fast = ptr && Math.hypot(p.x - ptr.x, p.y - ptr.y) / Math.max(1, p.ts - ptr.ts) > 0.9 ? t + 0.2 : ptr ? ptr.fast : 0;
        ptr = p;
      });
      for (const type of ['pointerleave', 'pointercancel']) on(ctx, pond, type, () => { ptr = null; });
    }
  }
  // click, not pointerdown: a touch scroll that starts on the pond must not feed.
  on(ctx, pond, 'click', (e) => { const r = cv.getBoundingClientRect(); feed(e.clientX - r.left, e.clientY - r.top); });
  on(ctx, root.querySelector('[data-cue]'), 'click', feedSeeded);

  return {
    update(next, changed) {
      cfg = { ...next };
      if (changed.includes('count')) { stock(); if (live) place(); else pose(); }
      if (changed.includes('tone')) paint();
      if (!off) draw();
    },
    action(id) { if (id === 'feed') feedSeeded(); },
  };
}
