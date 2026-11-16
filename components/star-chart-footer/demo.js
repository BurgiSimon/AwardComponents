// Star chart footer — Meridian's site close: a statement, a band of sky, the links. The band is a star chart on a
// faint graticule: one star per cell of a jittered grid (a quarter left empty), seeded so it is the same sky on
// every load. Stars twinkle on their own 3–9 s periods. A fine pointer joins the nearest few within reach as a
// minimum spanning tree, so the shape branches like a constellation and its lines ease in and out over 200 ms. A
// click sets that constellation for a few seconds and sends one shooting star; the cue button does the same at a
// seeded spot. Reduced motion and static: no loop, one still chart, redrawn on input.
import './demo.css';
import { on, onFrame, whileVisible, observeResize, later, html, clamp, finePointer, readToken, content } from '../../src/demo-kit/index.js';

const EASE = 200;   // ms a pointed line takes to fade in or out
const FADE = 2000;  // ms a set constellation takes to fade once its hold is over
const SHOT = 900;   // ms a shooting star lasts
const TINTS = ['--clay', '--sky', '--plum']; // the few stars that are not ink

// mulberry32: a seeded 0..1 stream.
const rng = (a) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export default function mount(root, options, ctx) {
  const { observatory } = content;
  let cfg = { ...options };
  const still = ctx.motion !== 'full';

  root.className = 'scf';
  root.innerHTML = html`
    <footer class="scf__foot" aria-labelledby="scf-title">
      <div class="scf__say ac-wrap">
        <p class="ac-label">Visit</p>
        <h2 class="scf__title" id="scf-title">${observatory.signoff}</h2>
      </div>
      <div class="scf__scene ac-wrap"><canvas aria-hidden="true"></canvas></div>
      <div class="scf__row ac-wrap">
        <nav class="scf__nav" aria-label="Footer">${observatory.nav.map((l) => html`<a href="#top">${l}</a>`)}</nav>
        <button type="button" class="scf__cue" data-cue>${still ? 'Join a constellation' : 'Send a shooting star'}</button>
      </div>
      <p class="scf__legal ac-wrap">© 2026 ${observatory.full} · ${observatory.place.split(',')[0]}</p>
    </footer>`;
  root.querySelectorAll('a[href="#top"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const cv = root.querySelector('canvas');
  const g = cv.getContext('2d');
  let tok = {};
  const readTokens = () => {
    tok = { ink: readToken('--ink', root), line: /^(#|rgb|hsl|oklch)/.test(cfg.tone) ? cfg.tone : readToken(cfg.tone === 'ink' ? '--ink-2' : `--${cfg.tone}`, root), grid: readToken('--line-2', root), tints: TINTS.map((t) => readToken(t, root)) };
  };

  let W = 0; let H = 0; let stars = []; let last = 0; let ptr = null; let shoot = null; let timer = 0;
  const edges = new Map(); // "i-j" → strength, follows the pointer
  const sets = [];         // clicked constellations: { keys, t0 }
  const spots = rng(5);    // where the cue button and the toolbar action land

  // The up to `join` stars nearest the point, joined as a minimum spanning tree.
  const near = (p) => {
    if (!p) return [];
    const pick = stars.map((s, i) => [Math.hypot(s.x - p.x, s.y - p.y), i]).filter(([d]) => d < cfg.reach).sort((a, b) => a[0] - b[0]).slice(0, cfg.join).map(([, i]) => i);
    const keys = []; const tree = pick.slice(0, 1);
    while (tree.length < pick.length) {
      let best;
      for (const a of tree) for (const b of pick) if (!tree.includes(b)) { const d = Math.hypot(stars[a].x - stars[b].x, stars[a].y - stars[b].y); if (!best || d < best[0]) best = [d, a, b]; }
      keys.push(`${Math.min(best[1], best[2])}-${Math.max(best[1], best[2])}`); tree.push(best[2]);
    }
    return keys;
  };

  // The thumbnail's moment: two set constellations and one shooting star, held mid-flight.
  const hold = () => {
    const p = { x: W * 0.5, y: H * 0.5 }; const len = Math.min(360, W * 0.5);
    sets.push({ keys: near(p), t0: Infinity }, { keys: near({ x: W * 0.8, y: H * 0.42 }), t0: Infinity });
    if (!still) shoot = { x: p.x - 14, y: Math.max(6, p.y - 28), dx: -len, dy: len * 0.2, t0: 0, at: 0.3 };
  };

  // Same seed every time: one star per cell of a jittered grid, a quarter of the cells left empty.
  const seed = () => {
    const r = rng(11); const cols = Math.max(1, Math.round(W / cfg.cell)); const rows = Math.max(1, Math.round(H / cfg.cell));
    stars = [];
    for (let i = 0; i < cols * rows; i++) {
      const m = r() ** 3; const keep = r() > 0.25; const tint = r() < 0.07;
      const s = { x: ((i % cols) + 0.08 + r() * 0.84) * (W / cols), y: (Math.floor(i / cols) + 0.08 + r() * 0.84) * (H / rows), r: 0.7 + m * 1.8, a: 0.4 + m * 0.55, per: 3000 + r() * 6000, ph: r() * 6.283, c: tint ? i % 3 : -1 };
      if (keep) stars.push(s);
    }
    edges.clear(); sets.length = 0; shoot = null;
    if (ctx.capture) hold();
  };

  const draw = (now) => {
    const k = still ? 1 : clamp((now - last) / EASE, 0, 1); last = now; // easing step: lines fade, never snap
    const want = new Set(near(ptr)); const glow = new Map();
    for (const key of want) if (!edges.has(key)) edges.set(key, 0);
    g.clearRect(0, 0, W, H);
    // Graticule: three arcs and a fan of meridians around a pole far above the band, so it reads as a chart.
    const py = -2.5 * W; const step = 120 / (H / 2 - py);
    g.lineWidth = 1; g.strokeStyle = tok.grid; g.beginPath();
    for (const f of [0.2, 0.55, 0.9]) { g.moveTo(W / 2 + f * H - py, py); g.arc(W / 2, py, f * H - py, 0, Math.PI); }
    for (let n = -Math.ceil(W / 240); n <= W / 240; n++) { g.moveTo(W / 2 + n * step * -py, 0); g.lineTo(W / 2 + n * step * (H - py), H); }
    g.stroke();
    g.strokeStyle = tok.line;
    const strength = cfg.tone === 'ink' ? 0.5 : 0.85;
    const seg = (key, a) => {
      const [i, j] = key.split('-'); const p = stars[i]; const q = stars[j];
      g.globalAlpha = a * strength; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke();
      for (const n of [+i, +j]) glow.set(n, Math.max(glow.get(n) || 0, a));
    };
    for (const [key, a] of edges) {
      const v = a + ((want.has(key) ? 1 : 0) - a) * k;
      if (v < 0.01) edges.delete(key); else { edges.set(key, v); seg(key, v); }
    }
    const linger = cfg.linger * 1000;
    for (let n = sets.length; n--;) {
      const age = now - sets[n].t0;
      const a = still ? (age < linger ? 1 : 0) : Math.min(1, (linger + FADE - age) / FADE); // without motion a set is there, then gone
      if (a <= 0) sets.splice(n, 1); else for (const key of sets[n].keys) seg(key, a);
    }
    stars.forEach((s, i) => {
      const lit = glow.get(i) || 0; const tw = still ? 0.85 : 0.78 + 0.22 * Math.sin((now / s.per) * 6.283 + s.ph);
      g.globalAlpha = Math.min(1, s.a * tw + lit * 0.45); g.fillStyle = s.c < 0 ? tok.ink : tok.tints[s.c];
      g.beginPath(); g.arc(s.x, s.y, s.r + lit * 0.5, 0, 7); g.fill();
    });
    if (shoot) {
      const p = shoot.at ?? (now - shoot.t0) / SHOT;
      if (p >= 1) shoot = null;
      else {
        const e = 1 - (1 - p) ** 3; const tail = 0.2 * (1 - p) + 0.03;
        const hx = shoot.x + shoot.dx * e; const hy = shoot.y + shoot.dy * e; const tx = hx - shoot.dx * tail; const ty = hy - shoot.dy * tail;
        const fade = g.createLinearGradient(tx, ty, hx, hy);
        fade.addColorStop(0, 'transparent'); fade.addColorStop(1, tok.ink);
        g.globalAlpha = 0.9 * (1 - p); g.strokeStyle = fade; g.lineWidth = 1.4; g.lineCap = 'round';
        g.beginPath(); g.moveTo(tx, ty); g.lineTo(hx, hy); g.stroke(); g.lineCap = 'butt';
      }
    }
    g.globalAlpha = 1;
  };
  const once = () => { if (still) draw(performance.now()); }; // without motion there is no loop, so redraw on input

  // A click (or the cue) sets the constellation under it and sends one shooting star towards the wider side.
  const fire = (p) => {
    const now = performance.now(); const keys = near(p);
    if (keys.length) { sets.push({ keys, t0: now }); if (sets.length > 4) sets.shift(); }
    if (still) { draw(now); clearTimeout(timer); timer = later(ctx, once, cfg.linger * 1000 + 50); return; }
    const dir = p.x < W / 2 ? 1 : -1; const len = Math.min(360, W * 0.5);
    shoot = { x: p.x + dir * 14, y: Math.max(6, p.y - 28), dx: dir * len, dy: len * 0.2, t0: now };
  };
  const fireAtSpot = () => fire({ x: (0.12 + spots() * 0.76) * W, y: (0.3 + spots() * 0.4) * H });

  const size = () => {
    const w = cv.clientWidth; const h = cv.clientHeight;
    if (!w || !h || (w === W && h === H)) return;
    const d = Math.min(2, devicePixelRatio || 1);
    W = w; H = h; cv.width = Math.round(W * d); cv.height = Math.round(H * d); g.setTransform(d, 0, 0, d, 0, 0);
    seed(); draw(performance.now());
  };
  readTokens();
  size();
  observeResize(ctx, cv, size);
  ctx.onTheme(() => { readTokens(); draw(performance.now()); });

  // Following the pointer is for fine pointers; a click, which is also a tap, works everywhere. Touch has already
  // left by the time the click arrives, so the position is read from the click itself.
  if (finePointer()) {
    on(ctx, cv, 'pointermove', (e) => { if (e.pointerType === 'touch') return; ptr = { x: e.offsetX, y: e.offsetY }; once(); });
    on(ctx, cv, 'pointerleave', () => { ptr = null; once(); });
  }
  on(ctx, cv, 'click', (e) => fire({ x: e.offsetX, y: e.offsetY }));
  on(ctx, root.querySelector('[data-cue]'), 'click', fireAtSpot);

  if (!still) {
    let off = null;
    whileVisible(ctx, cv, () => { off = onFrame(ctx, (dt, t) => draw(t)); }, () => { off?.(); off = null; });
  }

  return {
    update(next, changed) {
      cfg = { ...next };
      if (changed.includes('tone')) readTokens();
      if (changed.includes('cell')) seed();
      draw(performance.now());
    },
    action(id) { if (id === 'shoot') fireAtSpot(); },
  };
}
