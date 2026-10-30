// Point-cloud morph — a speaker's four feature names and the cloud they drive. A tall section holds a sticky stage;
// five thousand points sampled from four SVG icons (rasterised once) are projected in JavaScript and drawn as squares
// on a 2D canvas, far to near in sixteen depth buckets. Scroll progress picks the pair of shapes and the blend: each
// holds for 18 % at both ends of its segment, a quadratic in-out between, a swirl weighted by sin²(πe) only
// mid-morph, a burst on each segment change, and the pointer parts the cloud. A settled cloud skips its paint; the
// loop stops off-screen. Reduced motion and static: the points never travel; the two settled shapes cross-fade by
// opacity on scroll.
import './demo.css';
import { on, onFrame, whileVisible, observeResize, html, readToken, clamp, lerp, content } from '../../src/demo-kit/index.js';

// One icon per feature, on 24 × 24 artboards, white where points may land.
const SHAPES = [
  // Room tuning: a speaker in the corner and three waves reaching across the room
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round"><path d="M4.5 12.2a7 7 0 0 1 7.3 7.3"/><path d="M4.5 6.6a12.6 12.6 0 0 1 12.9 12.9"/><path d="M4.5 1.2a18 18 0 0 1 18.3 18.3"/></g><circle cx="4.6" cy="19.4" r="3" fill="#fff"/></svg>',
  // Quiet hours: a crescent and two stars
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#fff" d="M14.2 2.2a9.8 9.8 0 1 0 7.6 14.6A8.2 8.2 0 0 1 14.2 2.2Z"/><circle cx="19" cy="4.5" r="1.3" fill="#fff"/><circle cx="21.4" cy="9.4" r="0.9" fill="#fff"/></svg>',
  // Stereo pair: two speakers, grilles cut out
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="#fff"><rect x="1.8" y="3.5" width="8.6" height="17" rx="4.3"/><rect x="13.6" y="3.5" width="8.6" height="17" rx="4.3"/></g><g fill="#000"><circle cx="6.1" cy="13.6" r="2.3"/><circle cx="17.9" cy="13.6" r="2.3"/><circle cx="6.1" cy="7.4" r="0.9"/><circle cx="17.9" cy="7.4" r="0.9"/></g></svg>',
  // Repairable: a screw head in a ring of eight screws
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="6.2" fill="#fff"/><g stroke="#000" stroke-width="1.5" stroke-linecap="round"><path d="M9 12h6M12 9v6"/></g><g fill="#fff">${Array.from({ length: 8 }, (_, i) => `<circle cx="${(12 + Math.cos((i / 8) * Math.PI * 2) * 10).toFixed(2)}" cy="${(12 + Math.sin((i / 8) * Math.PI * 2) * 10).toFixed(2)}" r="1.25"/>`).join('')}</g></svg>`,
];

export default async function mount(root, options, ctx) {
  const { product } = content;
  const features = product.features.slice(0, SHAPES.length);
  let cfg = { ...options };
  const coarse = matchMedia('(pointer: coarse)').matches;
  const P = {
    hold: 0.18,                 // each shape holds for the first and last 18 % of its segment
    follow: 2.45,               // scroll progress smoothing, per second
    stiffness: 42, damping: 8,  // the spring from each point to its target, per second
    burst: 520,                 // outward kick on a segment change, px/s, decaying over 260 ms
    radius: coarse ? 200 : 100, repel: 6000, tangential: 1.5,
    fov: coarse ? 40 : 45, cameraZ: coarse ? 600 : 800, depth: 60, buckets: 16,
  };
  const N = Math.round(coarse || innerWidth < 760 ? cfg.count / 2 : cfg.count);

  root.className = 'pcm';
  root.innerHTML = html`
    <section class="pcm__morph" style="--shapes:${SHAPES.length}" aria-labelledby="pcm-title" data-morph>
      <div class="pcm__stage" data-stage>
        <canvas class="pcm__canvas" aria-hidden="true" data-canvas></canvas>
        <div class="pcm__ui ac-wrap">
          <h2 class="sr-only" id="pcm-title">${product.name} features</h2>
          <ol class="pcm__list" role="list">
            ${features.map((f, i) => html`<li><button type="button" class="pcm__item" data-item="${i}"><span class="ac-label">0${i + 1}</span><span class="pcm__t">${f.title}</span></button></li>`)}
          </ol>
        </div>
      </div>
    </section>`;

  const section = root.querySelector('[data-morph]');
  const stage = root.querySelector('[data-stage]');
  const canvas = root.querySelector('[data-canvas]');
  const g = canvas.getContext('2d');
  const items = [...root.querySelectorAll('[data-item]')];

  // Sample each icon: opaque white pixels on a 2 px grid of a 512 px raster.
  const rasterise = (svg, size) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const x2 = c.getContext('2d', { willReadFrequently: true });
      x2.drawImage(img, 0, 0, size, size);
      const data = x2.getImageData(0, 0, size, size).data;
      const pts = [];
      for (let y = 0; y < size; y += 2) for (let x = 0; x < size; x += 2) if (data[(y * size + x) * 4 + 3] > 200 && data[(y * size + x) * 4] > 128) pts.push(x / size - 0.5, y / size - 0.5);
      resolve(pts.length ? pts : [0, 0]);
    };
    img.onerror = () => resolve([0, 0]);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
  const sampled = await Promise.all(SHAPES.map((s) => rasterise(s, 512)));
  if (ctx.signal.aborted) return {};

  // Per-point state in shape space (px from the cloud's centre), plus a target per shape. Seeded, so it is repeatable.
  let rnd = 7;
  const random = () => { rnd = (rnd * 16807) % 2147483647; return (rnd - 1) / 2147483646; };
  const pos = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3);
  const seed = new Float32Array(N);
  const targets = sampled.map((pts) => {
    const t = new Float32Array(N * 3);
    const n = pts.length / 2;
    for (let i = 0; i < N; i++) {
      const j = Math.floor(random() * n);
      t[i * 3] = pts[j * 2] + (random() - 0.5) * 0.004;
      t[i * 3 + 1] = pts[j * 2 + 1] + (random() - 0.5) * 0.004;
      t[i * 3 + 2] = (random() - 0.5) * 2;   // depth in units of P.depth
    }
    return t;
  });
  for (let i = 0; i < N; i++) seed[i] = random() * 1000;

  // Layout: the cloud sits centred above the feature list.
  let w = 1; let h = 1; let dpr = 1; let box = 1; let cx = 0; let cy = 0;
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    w = Math.max(1, r.width); h = Math.max(1, r.height);
    dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    cx = w * 0.5;
    if (w >= 700) { cy = h * 0.44; box = Math.min(w * 0.44, h * 0.9) * 0.7; }
    else { cy = h * 0.42; box = Math.min(w * 0.78, h * 0.3); }
  };

  const progress = () => {
    const r = section.getBoundingClientRect();
    return clamp(-r.top / Math.max(1, r.height - innerHeight), 0, 1);
  };
  const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const blend = (p) => {
    const f = p * (SHAPES.length - 1);
    const k = Math.min(SHAPES.length - 2, Math.floor(f));
    const u = f - k;
    const e = u < P.hold ? 0 : u > 1 - P.hold ? 1 : easeInOutQuad((u - P.hold) / (1 - 2 * P.hold));
    return { k, e };
  };
  const target = (i, k, e, out) => {
    const a = targets[k]; const b = targets[k + 1];
    out[0] = lerp(a[i * 3], b[i * 3], e) * box;
    out[1] = lerp(a[i * 3 + 1], b[i * 3 + 1], e) * box;
    out[2] = lerp(a[i * 3 + 2], b[i * 3 + 2], e) * P.depth;
    return out;
  };

  const state = { smooth: 0, segment: -1, e: 0, meanSpeed: 0 };
  const pointer = { x: 0, y: 0, inside: false };
  let lastSegment = 0; let burstT = 0; let time = 0; let force = true;
  const tmp = [0, 0, 0];

  const step = (dt) => {
    time += dt;
    const p = progress();
    state.smooth = lerp(state.smooth, p, 1 - Math.exp(-P.follow * dt));
    if (Math.abs(state.smooth - p) < 1e-4) state.smooth = p;
    const { k, e } = blend(state.smooth);
    const shown = e > 0.5 ? k + 1 : k;
    if (shown !== lastSegment) { burstT = 0.26; lastSegment = shown; }
    burstT = Math.max(0, burstT - dt);
    state.e = e;
    const wSwirl = Math.sin(Math.PI * e) ** 2;
    const spring = P.stiffness * dt; const keep = Math.exp(-P.damping * dt); const burst = (burstT / 0.26) * P.burst * dt;
    const swirl = cfg.swirl * wSwirl * dt;
    let speed = 0;
    for (let i = 0; i < N; i++) {
      const o = i * 3;
      target(i, k, e, tmp);
      let vx = vel[o]; let vy = vel[o + 1]; let vz = vel[o + 2];
      vx += (tmp[0] - pos[o]) * spring; vy += (tmp[1] - pos[o + 1]) * spring; vz += (tmp[2] - pos[o + 2]) * spring;
      if (swirl > 0) {
        const s = seed[i];
        vx += Math.cos(s * 0.9 + time * 1.3) * swirl;
        vy += Math.sin(s * 1.3 + time * 1.1) * swirl;
        vz += Math.sin(s * 0.7 + time * 0.9) * swirl * 0.5;
      }
      if (burst > 0) { const len = Math.hypot(pos[o], pos[o + 1]) || 1; vx += (pos[o] / len) * burst; vy += (pos[o + 1] / len) * burst; }
      if (pointer.inside) {
        const dx = pos[o] - pointer.x; const dy = pos[o + 1] - pointer.y; const d = Math.hypot(dx, dy);
        if (d < P.radius && d > 0.001) {
          const f = (1 - d / P.radius) ** 3 * P.repel * dt;
          vx += (dx / d) * f - (dy / d) * f * P.tangential * 0.5;
          vy += (dy / d) * f + (dx / d) * f * P.tangential * 0.5;
        }
      }
      vx *= keep; vy *= keep; vz *= keep;
      pos[o] += vx * dt; pos[o + 1] += vy * dt; pos[o + 2] += vz * dt;
      vel[o] = vx; vel[o + 1] = vy; vel[o + 2] = vz;
      speed += Math.abs(vx) + Math.abs(vy);
    }
    state.meanSpeed = speed / N;
  };

  // Draw: project with a horizontal fov, bucket by depth, paint far to near.
  const buckets = Array.from({ length: P.buckets }, () => []);
  let ink = '#121211';
  const readInk = () => { ink = cfg.tone.startsWith('#') ? cfg.tone : readToken(`--${cfg.tone}`) || readToken('--ink'); };
  const draw = (alphaA = 1, alphaB = 0, k = 0) => {
    const focal = (Math.min(w, 1400) * 0.5) / Math.tan((P.fov * Math.PI) / 360);
    const base = focal / P.cameraZ;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    g.fillStyle = ink;
    const live = [0, 0, 0];
    const drawSet = (get, alpha) => {
      for (const b of buckets) b.length = 0;
      for (let i = 0; i < N; i++) {
        const p = get(i);
        const zc = p[2] + P.cameraZ;
        const t = clamp(Math.floor(((p[2] + P.depth * 1.5) / (P.depth * 3)) * P.buckets), 0, P.buckets - 1);
        buckets[P.buckets - 1 - t].push(p[0], p[1], zc);
      }
      for (const b of buckets) {
        for (let j = 0; j < b.length; j += 3) {
          const s = focal / b[j + 2] / base;   // 1 at z = 0
          g.globalAlpha = alpha * clamp((s - 0.85) * 3.3, 0.25, 1);
          const size = cfg.size * s;
          g.fillRect(cx + b[j] * s - size / 2, cy + b[j + 1] * s - size / 2, size, size);
        }
      }
    };
    if (alphaB === 0 && ctx.motion === 'full') drawSet((i) => { live[0] = pos[i * 3]; live[1] = pos[i * 3 + 1]; live[2] = pos[i * 3 + 2]; return live; }, alphaA);
    else {
      if (alphaA > 0) drawSet((i) => target(i, k, 0, live), alphaA);
      if (alphaB > 0) drawSet((i) => target(i, k, 1, live), alphaB);
    }
    g.globalAlpha = 1;
  };

  const syncList = (segment) => {
    if (segment === state.segment) return;
    state.segment = segment;
    items.forEach((b, i) => (i === segment ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current')));
  };

  // A feature button scrolls to the middle of its shape's hold.
  items.forEach((b, i) => on(ctx, b, 'click', () => {
    const r = section.getBoundingClientRect();
    const top = scrollY + r.top + (i / (SHAPES.length - 1)) * (r.height - innerHeight);
    window.scrollTo({ top, behavior: ctx.motion === 'full' ? 'smooth' : 'auto' });
  }));

  readInk();
  resize();
  { const p = progress(); const { k, e } = blend(p); state.smooth = p; for (let i = 0; i < N; i++) { target(i, k, e, tmp); pos.set(tmp, i * 3); } }

  if (ctx.motion === 'full') {
    on(ctx, stage, 'pointermove', (ev) => {
      const r = canvas.getBoundingClientRect();
      pointer.x = ev.clientX - r.left - cx; pointer.y = ev.clientY - r.top - cy; pointer.inside = true;
    }, { passive: true });
    on(ctx, stage, 'pointerleave', () => { pointer.inside = false; });
    const frame = (dt) => {
      // Fixed 1/60 s steps of real time: a slow frame neither slows the cloud down nor destabilises the spring.
      const steps = Math.max(1, Math.min(6, Math.ceil(dt * 60)));
      for (let n = 0; n < steps; n++) step(dt / steps);
      syncList(state.e > 0.5 ? blend(state.smooth).k + 1 : blend(state.smooth).k);
      // Settled, unmoved and unpointed: skip the paint.
      if (!force && state.meanSpeed < 0.5 && (state.e === 0 || state.e === 1) && !pointer.inside && burstT === 0) return;
      force = false;
      draw();
    };
    let off = null;
    whileVisible(ctx, section, () => { force = true; off = onFrame(ctx, frame); }, () => { off?.(); off = null; }, { rootMargin: '0px' });
    observeResize(ctx, canvas, () => { resize(); force = true; });
    ctx.onTheme(() => { readInk(); force = true; });
    syncList(0);
    draw();
    return {
      update(next, changed) {
        if (changed.includes('count')) return false;
        cfg = { ...next };
        readInk();
        force = true;
        return undefined;
      },
    };
  }

  // Reduced motion and static: render on scroll only, as an opacity cross-fade between the two settled shapes.
  let queued = false;
  const render = () => {
    queued = false;
    const { k, e } = blend(progress());
    syncList(e > 0.5 ? k + 1 : k);
    draw(1 - e, e, k);
  };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(render); } };
  on(ctx, window, 'scroll', queue, { passive: true });
  observeResize(ctx, canvas, () => { resize(); queue(); });
  ctx.onTheme(() => { readInk(); queue(); });
  render();
  return {
    update(next, changed) {
      if (changed.includes('count')) return false;
      cfg = { ...next };
      readInk();
      queue();
      return undefined;
    },
  };
}
