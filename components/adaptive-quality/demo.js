// Adaptive quality tiers — a speaker launch hero's generative "sound field" on a 2D canvas, full-bleed behind the
// device readout card that shows the budget it was given. The device is probed once (pixel ratio, memory, cores,
// GPU string, WebGL 2, 500 ms of frame timing) and scored into high, mid or low; every part of the field reads that
// profile: the DPR cap, an absolute pixel budget, the particle share and the effects. Nothing re-measures, so the
// tier cannot flicker. Low tier, reduced motion and static get a still drawn from the same field (a real <img> with
// alt text). The loop runs only while the stage is on screen.
import './demo.css';
import { on, ticker, whileVisible, observeResize, readToken, clamp, html, content } from '../../src/demo-kit/index.js';

const TRAIL = 18;   // points kept per particle (the high tier's trail)
const STEP = 0.07;  // seconds of field time between trail points, so a streak is as long at 30 fps as at 120
const TIERS = {
  high: { dpr: 2, maxPixels: 2560 * 1440, particles: 1, trails: 18, sparks: 0.14, effects: 'trails · accent sparks' },
  mid: { dpr: 1.5, maxPixels: 1920 * 1080, particles: 0.4, trails: 10, sparks: 0.06, effects: 'trails' },
  low: { dpr: 1, maxPixels: 1280 * 720, particles: 0, trails: 0, sparks: 0, effects: 'still image' },
};

// The probe: once per page, never per frame. Cached at module level so a re-mount reads the same profile.
let probed = null;
function probeDevice() {
  if (probed) return probed;
  probed = new Promise((resolve) => {
    const dpr = window.devicePixelRatio || 1;
    const memory = navigator.deviceMemory || 4;
    const cores = navigator.hardwareConcurrency || 4;
    let renderer = 'unknown';
    let webgl2 = false;
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      webgl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
      const info = gl && gl.getExtension('WEBGL_debug_renderer_info');
      if (gl) renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch { /* no GL: scored as low */ }
    let frames = 0;
    const start = performance.now();
    const tick = (t) => {
      frames++;
      if (t - start < 500) { requestAnimationFrame(tick); return; }
      const fps = Math.round((frames * 1000) / (t - start));
      let score = 0;
      score += memory >= 8 ? 2 : memory >= 4 ? 1 : 0;
      score += cores >= 8 ? 2 : cores >= 4 ? 1 : 0;
      score += /swiftshader|llvmpipe|software/i.test(renderer) ? -3 : /mali-4|adreno 3|adreno 4|powervr/i.test(renderer) ? -1 : 1;
      score += fps >= 55 ? 2 : fps >= 40 ? 1 : fps >= 25 ? 0 : -2;
      score += webgl2 ? 0 : -1;
      const tier = !webgl2 ? 'low' : score >= 5 ? 'high' : score >= 2 ? 'mid' : 'low';
      resolve({ tier, dpr, memory, cores, renderer, fps, webgl2, score });
    };
    requestAnimationFrame(tick);
  });
  return probed;
}
const gpuName = (s) => {
  if (/swiftshader/i.test(s)) return 'SwiftShader (software)';
  const inner = s.replace(/^ANGLE \(/, '').replace(/\)$/, '').split(',').map((p) => p.trim());
  return (inner[1] || inner[0] || 'unknown').replace(/\s*\(0x[0-9a-f]+\)/i, '').slice(0, 30);
};

// The flow: layered sines read as standing waves drifting to the right.
const flow = (x, y, t) => 0.85 * Math.sin(y * 0.0062 + t * 0.32) * Math.cos(x * 0.0041 - t * 0.21) + 0.45 * Math.sin((x + y) * 0.0029 + t * 0.17);

export default async function mount(root, options, ctx) {
  const { product } = content;
  let cfg = { ...options };
  root.className = 'aq';
  root.innerHTML = html`
    <section class="ac-stage aq__stage" aria-label="${product.name} launch hero" data-hero>
      <div class="aq__field" data-field>
        <canvas aria-hidden="true" data-canvas></canvas>
        <img class="aq__still" alt="A field of fine flowing lines, like sound waves crossing a room." data-still hidden>
      </div>
      <aside class="aq__card" aria-labelledby="aq-card-title" data-card>
        <div class="aq__card-head">
          <div><h2 class="ac-label" id="aq-card-title">Device readout</h2><p class="aq__card-sub">Probed once, 500 ms after load</p></div>
          <span class="aq__tier" data-tier>…</span>
        </div>
        <dl class="aq__rows">
          <div><dt>Pixel ratio</dt><dd data-r="dpr">—</dd></div>
          <div><dt>Pixel budget</dt><dd data-r="budget">—</dd></div>
          <div><dt>Canvas</dt><dd data-r="canvas">—</dd></div>
          <div><dt>Particles</dt><dd data-r="particles">—</dd></div>
          <div><dt>Effects</dt><dd data-r="effects">—</dd></div>
        </dl>
        <p class="aq__probe" data-r="probe">Measuring frame times…</p>
        <div class="aq__force" role="group" aria-label="Force a quality tier">
          ${['auto', 'high', 'mid', 'low'].map((t) => html`<button type="button" data-force="${t}" aria-pressed="false">${t[0].toUpperCase() + t.slice(1)}</button>`)}
        </div>
      </aside>
      <p class="sr-only" aria-live="polite" data-announce></p>
      <p class="ac-stage__note"><span>${product.maker} · launch hero</span></p>
    </section>`;

  const $ = (s) => root.querySelector(s);
  const hero = $('[data-hero]');
  const host = $('[data-field]');
  const canvas = $('[data-canvas]');
  const still = $('[data-still]');
  const g = canvas.getContext('2d');
  const r = Object.fromEntries([...root.querySelectorAll('[data-r]')].map((el) => [el.dataset.r, el]));
  const buttons = [...root.querySelectorAll('[data-force]')];
  const urlTier = new URLSearchParams(location.search).get('tier'); // the frame capture forces one this way
  let forced = cfg.force;

  r.probe.textContent = 'Measuring frame times…';
  const probe = await probeDevice();
  if (ctx.signal.aborted) return {};

  // 1. The profile every effect reads: the tier, then its budgets, then this hero's canvas inside them.
  let colours = {};
  const readColours = () => { colours = { ink: readToken('--ink'), accent: readToken('--accent') }; };
  readColours();
  const state = { tier: 'low', dpr: 1, scale: 1, w: 0, h: 0, cssW: 0, cssH: 0, count: 0, budget: TIERS.low };
  let dots = [];
  let time = 0;

  const resolveTier = () => {
    if (forced !== 'auto') return forced;
    if (urlTier === 'low' || urlTier === 'mid' || urlTier === 'high') return urlTier;
    return probe.tier;
  };
  const moving = ctx.motion === 'full';

  const spawn = (d, anywhere) => {
    d.x = anywhere ? Math.random() * state.cssW : -10 - Math.random() * 40;
    d.y = Math.random() * state.cssH;
    d.hx ||= new Float32Array(TRAIL);
    d.hy ||= new Float32Array(TRAIL);
    d.hx.fill(d.x); d.hy.fill(d.y);
    d.i = 0; d.n = 1; d.acc = 0;
    d.life = 4 + Math.random() * 8;
    d.spark = Math.random() < state.budget.sparks;
    d.speed = 26 + Math.random() * 34;
    return d;
  };

  const layout = () => {
    const tier = resolveTier();
    const budget = TIERS[tier];
    const rect = host.getBoundingClientRect();
    const cssW = Math.max(1, Math.round(rect.width));
    const cssH = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(probe.dpr, budget.dpr);
    const px = cssW * cssH * dpr * dpr;
    const scale = px > budget.maxPixels ? Math.sqrt(budget.maxPixels / px) : 1;
    Object.assign(state, { tier, budget, dpr, scale, cssW, cssH });
    state.w = Math.round(cssW * dpr * scale);
    state.h = Math.round(cssH * dpr * scale);
    const area = (cssW * cssH) / (1280 * 800);
    state.count = moving ? Math.round(cfg.density * budget.particles * clamp(area, 0.25, 1.4)) : 0;
    canvas.width = state.w;
    canvas.height = state.h;
    dots = Array.from({ length: state.count }, () => spawn({}, true));
    for (let k = 0; k < 40; k++) advance(1 / 30); // warm the field so the first frame already has full streaks
    g.setTransform(state.w / cssW, 0, 0, state.h / cssH, 0, 0);
    const showStill = state.count === 0;
    canvas.hidden = showStill;
    still.hidden = !showStill;
    if (showStill) drawStill();
    readout();
  };

  // 2. The still: the same field, drawn once as streamlines and handed to an <img>.
  let stillURL = '';
  const drawStill = () => {
    const c = document.createElement('canvas');
    const w = Math.min(1600, state.cssW);
    const h = Math.round((w / state.cssW) * state.cssH);
    c.width = w; c.height = h;
    const s = c.getContext('2d');
    s.lineWidth = 1;
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 260; i++) {
      let x = rand() * w;
      let y = rand() * h;
      s.strokeStyle = i % 9 === 0 ? colours.accent : colours.ink;
      s.globalAlpha = i % 9 === 0 ? 0.55 : 0.16;
      s.beginPath();
      s.moveTo(x, y);
      for (let k = 0; k < 90; k++) {
        const a = flow(x * (state.cssW / w), y * (state.cssH / h), 3);
        x += Math.cos(a) * 3; y += Math.sin(a) * 3;
        s.lineTo(x, y);
      }
      s.stroke();
    }
    c.toBlob((blob) => {
      if (!blob || ctx.signal.aborted) return;
      if (stillURL) URL.revokeObjectURL(stillURL);
      stillURL = URL.createObjectURL(blob);
      still.src = stillURL;
    }, 'image/webp', 0.86);
  };
  ctx.onCleanup(() => { if (stillURL) URL.revokeObjectURL(stillURL); });

  const fmtMP = (n) => `${(n / 1e6).toFixed(1)} MP`;
  const readout = () => {
    const t = state.tier;
    r.dpr.textContent = `${state.dpr.toFixed(1)} of ${probe.dpr.toFixed(1)}`;
    r.budget.textContent = `${fmtMP(state.budget.maxPixels)} · DPR ≤ ${state.budget.dpr}`;
    r.canvas.textContent = state.count ? `${state.w} × ${state.h}${state.scale < 1 ? ` · ×${state.scale.toFixed(2)}` : ''}` : 'not drawn';
    r.particles.textContent = state.count.toLocaleString('en-GB');
    r.effects.textContent = moving ? state.budget.effects : 'still image · reduced motion';
    r.probe.textContent = `${probe.fps} fps · ${probe.cores} cores · ${probe.memory} GB · ${probe.webgl2 ? 'WebGL 2' : 'no WebGL 2'} · ${gpuName(probe.renderer)} → scored ${probe.score}, ${probe.tier}`;
    const tierEl = $('[data-tier]');
    tierEl.textContent = t;
    tierEl.dataset.tier = t;
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.force === forced)));
    root.dataset.tier = t;
  };

  // 3. The field: particles ride the flow and keep a short ring of past points; each frame clears and redraws every
  //    streak in one path per colour. Points are laid by field time (STEP), so a streak's length does not depend on
  //    the frame rate, and nothing is left behind on the canvas.
  function advance(dt) {
    time += dt;
    const { cssW, cssH } = state;
    for (const d of dots) {
      const a = flow(d.x, d.y, time);
      d.x += Math.cos(a) * d.speed * dt;
      d.y += Math.sin(a) * d.speed * dt;
      d.life -= dt;
      d.acc += dt;
      if (d.acc >= STEP) { d.acc = 0; d.i = (d.i + 1) % TRAIL; d.hx[d.i] = d.x; d.hy[d.i] = d.y; d.n = Math.min(d.n + 1, TRAIL); }
      if (d.life <= 0 || d.x > cssW + 10 || d.y < -10 || d.y > cssH + 10) spawn(d, false);
    }
  }
  const frame = (dt) => {
    advance(dt);
    const { cssW, cssH, budget } = state;
    const keep = cfg.trails && budget.trails ? budget.trails : 2;
    g.clearRect(0, 0, cssW, cssH);
    g.lineWidth = state.tier === 'high' ? 1.1 : 1;
    g.lineJoin = 'round';
    for (const pass of [false, true]) {
      g.strokeStyle = pass ? colours.accent : colours.ink;
      g.globalAlpha = pass ? 0.85 : 0.3;
      g.beginPath();
      for (const d of dots) {
        if (d.spark !== pass) continue;
        const n = Math.min(d.n, keep);
        let k = (d.i - n + 1 + TRAIL) % TRAIL;
        g.moveTo(d.hx[k], d.hy[k]);
        for (let j = 1; j < n; j++) { k = (k + 1) % TRAIL; g.lineTo(d.hx[k], d.hy[k]); }
        g.lineTo(d.x, d.y);
      }
      g.stroke();
    }
    g.globalAlpha = 1;
  };
  let running = false;
  const start = () => { if (!running && state.count) { running = true; ticker.add(frame); } };
  const stop = () => { if (running) { running = false; ticker.remove(frame); } };
  ctx.onCleanup(stop);
  let visible = false;
  whileVisible(ctx, hero, () => { visible = true; start(); }, () => { visible = false; stop(); });

  const relayout = () => { stop(); layout(); if (visible) start(); };
  layout();
  let resizeTimer = 0;
  observeResize(ctx, host, () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(relayout, 120); });
  ctx.onCleanup(() => clearTimeout(resizeTimer));
  ctx.onTheme(() => { readColours(); g.clearRect(0, 0, state.cssW, state.cssH); if (!state.count) drawStill(); });

  const announce = $('[data-announce]');
  const setForced = (t) => {
    forced = t;
    relayout();
    announce.textContent = `Quality tier: ${state.tier}${t === 'auto' ? ', from the probe' : ', forced'}.`;
  };
  buttons.forEach((b) => on(ctx, b, 'click', () => setForced(b.dataset.force)));
  const applyReadout = () => { $('[data-card]').hidden = !cfg.readout; };
  applyReadout();

  return {
    update(next, changed) {
      cfg = { ...next };
      applyReadout();
      if (changed.includes('force')) setForced(cfg.force);
      else if (changed.includes('density')) relayout();
    },
  };
}
