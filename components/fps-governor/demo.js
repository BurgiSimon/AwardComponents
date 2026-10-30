// Frame-rate governor — an architecture studio's WebGL contour-map hero, full-bleed behind the governor card (one
// fragment shader: summed sines read as terrain, index contours every fifth line, a lens that follows the pointer, a
// survey ping). Two guards: a governor averages fps over 500 ms windows and steps the pixel ratio by .25 (down under
// 45, up over 57, hold in between) inside [floor, ceiling] from the one-time probe; an idle gate takes the loop off
// the ticker 1.5 s after the last input unless busy work (the ping, the lens easing) is running. The first frame after
// a wake is not measured. Reduced: still field, ping as a tint, same governor and gate. Static: one frame, no loop.
// No WebGL 2: a drawn still.
import './demo.css';
import { on, ticker, damp, clamp, readToken, qualityTier, webgl2Available, html, content } from '../../src/demo-kit/index.js';
import { THREE, useRenderer, disposeScene } from '../../src/demo-kit/three.js';

const WINDOW_MS = 500;
const SLOW_MS = 40; // "Simulate a slow device": 40 ms frames, 25 fps, fed to the governor only
const PING_S = 2.4;
const HISTORY = 36;

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const fragment = /* glsl */ `
  uniform vec2 uRes;
  uniform float uTime, uScroll, uPing, uReduced;
  uniform vec2 uLens, uPingAt;
  uniform vec3 uGround, uInk, uAccent;
  varying vec2 vUv;
  void main() {
    vec2 aspect = vec2(uRes.x / uRes.y, 1.0);
    vec2 c = (vUv - 0.5) * aspect;
    vec2 p = c * 2.6 + vec2(0.0, uScroll);
    float f = sin(p.x * 1.3 + uTime * 0.2) * sin(p.y * 1.7 - uTime * 0.15)
            + 0.5 * sin((p.x + p.y) * 2.1 + uTime * 0.3)
            + 0.35 * sin(length(p - vec2(1.0, -0.5)) * 3.0 - uTime * 0.25);
    float g = f * 5.0;
    float w = max(fwidth(g), 1e-5);
    // Line widths are in drawing-buffer pixels, so a lower pixel ratio really draws a coarser map.
    float line = 1.0 - smoothstep(0.0, 1.1, (0.5 - abs(fract(g) - 0.5)) / w);
    float index = 1.0 - smoothstep(0.0, 1.9, (0.5 - abs(fract(g / 5.0) - 0.5)) * 5.0 / w);
    float lens = smoothstep(0.42, 0.0, distance(c, (uLens - 0.5) * aspect));
    float r = distance(c, (uPingAt - 0.5) * aspect);
    float ring = uReduced > 0.5 ? sin(3.14159 * uPing) * 0.22
                                : smoothstep(0.06, 0.0, abs(r - uPing * 1.3)) * (1.0 - uPing);
    vec3 col = mix(uGround, uInk, (f * 0.5 + 0.5) * 0.035);
    col = mix(col, uInk, clamp(line * 0.13 + index * 0.24 + line * lens * 0.4, 0.0, 1.0));
    col = mix(col, uAccent, clamp(max(line, index) * lens * 0.85 + ring * step(0.001, uPing), 0.0, 1.0));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

export default function mount(root, options, ctx) {
  const { studio } = content;
  let cfg = { ...options };
  root.className = 'fg';
  root.innerHTML = html`
    <section class="ac-stage fg__hero" aria-label="${studio.name} project hero">
      <div class="fg__stage" data-stage aria-hidden="true"><div class="fg__still" data-still hidden></div></div>
      <aside class="fg__card" aria-labelledby="fg-card-title" data-card>
        <div class="fg__card-head">
          <h2 class="ac-label" id="fg-card-title">Frame-rate governor</h2>
          <p class="fg__state" data-state><i></i><span data-r="loop">Starting</span></p>
        </div>
        <figure class="fg__graph" data-graph aria-hidden="true">
          <svg viewBox="0 0 280 92" preserveAspectRatio="none">
            <rect class="fg__band" data-band x="0" width="280"/>
            <line class="fg__base" x1="0" y1="91.5" x2="280" y2="91.5"/>
            <path class="fg__dpr" data-dpr-line/>
            <path class="fg__fps" data-fps-line/>
          </svg>
          <figcaption class="fg__legend"><span class="fg__key fg__key--fps">fps</span><span class="fg__key fg__key--dpr">pixel ratio</span><span class="fg__band-label" data-band-label></span></figcaption>
        </figure>
        <dl class="fg__rows">
          <div><dt>Pixel ratio</dt><dd data-r="dpr">—</dd></div>
          <div><dt>Frame rate</dt><dd data-r="fps">…</dd></div>
          <div><dt>Frames drawn</dt><dd data-r="renders">0</dd></div>
        </dl>
        <div class="fg__actions">
          <button class="ac-btn ac-btn--sm ac-btn--ghost" type="button" aria-pressed="false" data-slow>Simulate a slow device</button>
          <button class="ac-btn ac-btn--sm" type="button" data-pulse>Survey pulse</button>
        </div>
      </aside>
      <p class="ac-stage__note"><span>${studio.name} · project hero</span></p>
    </section>`;

  const $ = (s) => root.querySelector(s);
  const stage = $('[data-stage]');
  const slowBtn = $('[data-slow]');
  const pulseBtn = $('[data-pulse]');
  const out = Object.fromEntries([...root.querySelectorAll('[data-r]')].map((el) => [el.dataset.r, el]));
  const state = { gl: false, dpr: 0, cap: 1, floor: 0.5, fps: null, renders: 0, looping: false, busy: false, simulate: null };
  const history = [];
  const band = () => cfg.band.split('-').map(Number);

  // The graph: fps against the band, and the pixel ratio as a step line on its own scale (floor at the bottom).
  const drawGraph = () => {
    const [lo, hi] = band();
    const y = (fps) => 90 - clamp(fps / 80, 0, 1) * 86;
    const bandEl = $('[data-band]');
    bandEl.setAttribute('y', y(hi));
    bandEl.setAttribute('height', Math.max(1, y(lo) - y(hi)));
    $('[data-band-label]').textContent = `band ${lo}–${hi}`;
    // Until the history is full, the samples are spread across the whole width, so the first windows read at once.
    const samples = history.length === 1 ? [history[0], history[0]] : history;
    const dx = 280 / Math.max(1, samples.length - 1);
    let f = '';
    let d = '';
    let pen = false;
    samples.forEach((s, i) => {
      const x = (i * dx).toFixed(1);
      if (!s) { pen = false; return; }
      const dy = (90 - ((s.dpr - state.floor) / Math.max(0.01, state.cap - state.floor)) * 70 - 8).toFixed(1);
      f += `${pen ? 'L' : 'M'}${x} ${y(s.fps).toFixed(1)}`;
      d += pen ? `H${x}V${dy}` : `M${x} ${dy}`;
      pen = true;
    });
    $('[data-fps-line]').setAttribute('d', f);
    $('[data-dpr-line]').setAttribute('d', d);
  };
  const readout = () => {
    out.dpr.textContent = state.gl ? `${state.dpr.toFixed(2)} · ${state.floor.toFixed(2)}–${state.cap.toFixed(2)}` : '—';
    out.fps.textContent = state.fps == null ? '…' : `${state.fps}${state.simulate ? ' (simulated)' : ''}`;
    out.renders.textContent = state.renders.toLocaleString('en-GB');
    out.loop.textContent = !state.gl ? 'No WebGL 2' : ctx.motion === 'static' ? 'Static · one frame' : state.looping ? (state.busy ? 'Drawing · busy' : 'Drawing') : 'Asleep';
    $('[data-state]').dataset.on = String(state.looping);
  };
  const applyLook = () => { $('[data-graph]').hidden = !cfg.graph; drawGraph(); };
  applyLook();

  if (!webgl2Available()) {
    $('[data-still]').hidden = false;
    slowBtn.disabled = true;
    pulseBtn.disabled = true;
    readout();
    return { update(next) { cfg = { ...next }; applyLook(); } };
  }

  // 1. Renderer and the one material. antialias off: the pixel ratio carries the quality.
  const { renderer, size, onResize } = useRenderer(ctx, stage, { antialias: false, alpha: false });
  const uniforms = {
    uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 }, uScroll: { value: 0 }, uPing: { value: 0 }, uReduced: { value: ctx.motion === 'full' ? 0 : 1 },
    uLens: { value: new THREE.Vector2(0.5, 0.5) }, uPingAt: { value: new THREE.Vector2(0.62, 0.5) },
    uGround: { value: new THREE.Color() }, uInk: { value: new THREE.Color() }, uAccent: { value: new THREE.Color() },
  };
  const readColours = () => {
    uniforms.uGround.value.set(readToken('--bg'));
    uniforms.uInk.value.set(readToken('--ink'));
    uniforms.uAccent.value.set(readToken('--accent'));
  };
  readColours();
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms, depthTest: false })));
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  ctx.onCleanup(() => disposeScene(scene));
  state.gl = true;

  // 2. The clamp: ceiling from the probe (its DPR cap and absolute pixel budget), floor half of it, never under .5.
  const tier = qualityTier();
  const setDpr = (v) => { state.dpr = v; renderer.setPixelRatio(v); renderer.setSize(size.width, size.height, false); };
  const draw = () => { renderer.render(scene, camera); state.renders++; };

  // 3. Governor: frame times fill a half-second window; its average steps the ratio, with a dead band between.
  let acc = 0;
  let frames = 0;
  let fresh = true;
  const govern = (ms) => {
    acc += state.simulate ?? ms;
    frames++;
    if (acc < WINDOW_MS) return;
    const fps = (frames * 1000) / acc;
    acc = 0; frames = 0;
    state.fps = Math.round(fps);
    const [lo, hi] = band();
    const next = clamp(fps < lo ? state.dpr - cfg.step : fps > hi ? state.dpr + cfg.step : state.dpr, state.floor, state.cap);
    if (next !== state.dpr) setDpr(Math.round(next * 1000) / 1000);
    history.push({ fps: state.fps, dpr: state.dpr });
    if (history.length > HISTORY) history.shift();
    drawGraph();
    readout();
  };

  // 4. Idle gate: on the ticker only while something changes. The ticker itself stops on hidden tabs.
  const pointer = { x: 0.5, y: 0.5 };
  const lens = { x: 0.5, y: 0.5 };
  const ping = { t: 0, on: false };
  let lastActive = performance.now();
  let time = 0;
  const tick = (dt) => {
    const now = performance.now();
    if (fresh) fresh = false; else govern(dt * 1000);
    if (ctx.motion === 'full') {
      time += dt;
      lens.x = damp(lens.x, pointer.x, 8, dt);
      lens.y = damp(lens.y, pointer.y, 8, dt);
    }
    if (ping.on) { ping.t = Math.min(1, ping.t + dt / PING_S); if (ping.t === 1) { ping.on = false; ping.t = 0; } }
    uniforms.uTime.value = time;
    uniforms.uScroll.value = ctx.motion === 'full' ? window.scrollY / Math.max(1, size.height) : 0;
    uniforms.uLens.value.set(lens.x, lens.y);
    uniforms.uPing.value = ping.t;
    draw();
    // Busy work holds the gate open: a running ping, or the lens still easing toward the pointer.
    state.busy = ping.on || (ctx.motion === 'full' && Math.abs(lens.x - pointer.x) + Math.abs(lens.y - pointer.y) > 1e-3);
    if (state.busy) lastActive = now;
    else if (now - lastActive > cfg.idle * 1000) sleep();
    if (state.renders % 15 === 0) readout();
  };
  function wake() {
    lastActive = performance.now();
    if (state.looping || ctx.motion === 'static') return;
    state.looping = true;
    fresh = true; acc = 0; frames = 0;
    ticker.add(tick);
    readout();
  }
  function sleep() {
    if (!state.looping) return;
    ticker.remove(tick);
    state.looping = false;
    state.busy = false;
    if (history.length && history.at(-1)) { history.push(null); if (history.length > HISTORY) history.shift(); drawGraph(); }
    readout();
  }
  ctx.onCleanup(() => ticker.remove(tick));

  // The clamp follows the stage's size; a resize redraws (one frame under static).
  onResize(({ width, height }) => {
    state.cap = Math.min(window.devicePixelRatio || 1, tier.dpr, Math.floor(Math.sqrt(tier.pixels / (width * height)) * 1000) / 1000);
    state.floor = Math.max(0.5, state.cap / 2);
    setDpr(clamp(state.dpr || state.cap, state.floor, state.cap));
    uniforms.uRes.value.set(width, height);
    if (ctx.motion === 'static') draw(); else wake();
    readout();
  });

  const onInput = (e) => {
    if (e.type === 'pointermove') {
      const r = stage.getBoundingClientRect();
      pointer.x = (e.clientX - r.left) / r.width;
      pointer.y = 1 - (e.clientY - r.top) / r.height;
    }
    wake();
  };
  for (const type of ['pointermove', 'pointerdown', 'wheel', 'scroll', 'keydown', 'touchstart']) on(ctx, window, type, onInput, { passive: true });

  const simulate = (on) => {
    state.simulate = on ? SLOW_MS : null;
    slowBtn.setAttribute('aria-pressed', String(on));
    acc = 0; frames = 0;
    wake();
  };
  const pulse = () => {
    if (ctx.motion === 'static') return;
    ping.on = true; ping.t = 0;
    wake();
  };
  on(ctx, slowBtn, 'click', () => simulate(state.simulate == null));
  on(ctx, pulseBtn, 'click', pulse);
  pulseBtn.disabled = ctx.motion === 'static';

  ctx.onTheme(() => { readColours(); if (ctx.motion === 'static') draw(); else wake(); });
  if (ctx.motion === 'static') draw();
  readout();

  return {
    update(next) {
      cfg = { ...next };
      applyLook();
      wake();
    },
    action(id) {
      if (id === 'slow') simulate(state.simulate == null);
      if (id === 'pulse') pulse();
    },
  };
}
