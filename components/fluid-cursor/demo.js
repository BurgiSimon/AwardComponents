// Fluid wake — a festival poster as one material, alone on the stage: the wordmark, the disc and the dates. The
// poster (ground, a vermilion disc, signal rings and its type) is drawn into a texture from the real DOM, and a
// single full-frame pass distorts it by a velocity field and fringes its red and blue along the flow. The field is
// advected and dissipated each frame (no pressure solve: a wake, not water) and splatted where the pointer moves, up
// to eight splats a frame so a fast stroke stays continuous. The DOM text stays in place, transparent, as the
// mirror; the plate line sits above the canvas, undistorted. The loop stops once the wake has died away.
// Reduced motion, static or no WebGL: the same poster in the DOM over a drawn still, no simulation.
import './demo.css';
import * as THREE from 'three';
import { on, onFrame, html, readToken, observeResize, content } from '../../src/demo-kit/index.js';
import { useRenderer, webglAvailable } from '../../src/demo-kit/three.js';

const SIM = 128; // the velocity field, 128² whatever the screen
const MAX_SPLATS = 8;

const QUAD_VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
// Advection + dissipation + up to eight Gaussian splats, in one pass.
const SIM_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uVelocity; uniform vec4 uSplats[${MAX_SPLATS}]; uniform int uCount;
  uniform float uRadius; uniform float uDissipation; uniform float uAspect; uniform float uByteMode;
  varying vec2 vUv;
  vec2 decode(vec4 c) { return uByteMode > 0.5 ? (c.xy - 0.5) * 2.0 : c.xy; }
  vec4 encode(vec2 v) { return uByteMode > 0.5 ? vec4(v * 0.5 + 0.5, 0.0, 1.0) : vec4(v, 0.0, 1.0); }
  void main() {
    vec2 vel = decode(texture2D(uVelocity, vUv));
    vel = decode(texture2D(uVelocity, vUv - vel * 0.02)) * uDissipation; // advect: look upstream, then fade
    for (int i = 0; i < ${MAX_SPLATS}; i++) {
      if (i >= uCount) break;
      vec2 d = vUv - uSplats[i].xy; d.x *= uAspect;
      vel += uSplats[i].zw * exp(-dot(d, d) / uRadius);
    }
    vel = clamp(vel, -1.0, 1.0);
    if (uByteMode > 0.5 && length(vel) < 0.012) vel = vec2(0.0); // 8-bit storage cannot hold a true zero
    gl_FragColor = encode(vel);
  }`;
// The unifier: distort the poster by the velocity, fringe R and B along it.
const POST_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uScene; uniform sampler2D uVelocity; uniform float uDistortion; uniform float uChroma; uniform float uByteMode;
  varying vec2 vUv;
  vec2 decode(vec4 c) { return uByteMode > 0.5 ? (c.xy - 0.5) * 2.0 : c.xy; }
  void main() {
    vec2 vel = decode(texture2D(uVelocity, vUv));
    vec2 uv = vUv - vel * uDistortion;
    float r = texture2D(uScene, uv - vel * uChroma).r;
    float g = texture2D(uScene, uv).g;
    float b = texture2D(uScene, uv + vel * uChroma).b;
    gl_FragColor = vec4(r, g, b, 1.0);
    #include <colorspace_fragment>
  }`;

export default function mount(root, options, ctx) {
  const { festival } = content;
  let cfg = { ...options };
  root.className = 'fc';
  root.innerHTML = html`
    <section class="ac-stage fc__hero" aria-labelledby="fc-title" data-hero>
      <div class="fc__gl" data-gl aria-hidden="true"><canvas class="fc__still" data-still></canvas></div>
      <div class="fc__poster">
        <h1 class="fc__word" id="fc-title" data-draw="ink">${festival.name}</h1>
        <p class="fc__when" data-draw="ink">${festival.dates}</p>
      </div>
      <p class="ac-stage__note"><span>${festival.name} · festival hero</span></p>
    </section>`;

  const hero = root.querySelector('[data-hero]');
  const host = root.querySelector('[data-gl]');
  const still = root.querySelector('[data-still]');
  const drawn = [...root.querySelectorAll('[data-draw]')];
  const word = root.querySelector('.fc__word');
  const wrap = root.querySelector('.fc__poster');

  // The poster, painted from the DOM: ground and decoration always; the type too when it becomes a GL texture.
  const paint = (canvas, withText) => {
    const hr = hero.getBoundingClientRect();
    const w = Math.max(1, Math.round(hr.width));
    const h = Math.max(1, Math.round(hr.height));
    const scale = Math.min(Math.min(devicePixelRatio || 1, 2), 2048 / Math.max(w, h));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const g = canvas.getContext('2d');
    g.setTransform(scale, 0, 0, scale, 0, 0);
    const accentGround = cfg.ground === 'accent';
    const tone = {
      ground: readToken(accentGround ? '--accent' : '--bg'),
      disc: readToken(accentGround ? '--night' : '--accent'),
      ring: accentGround ? 'rgba(20, 8, 3, 0.22)' : readToken('--line-2'),
      ink: readToken(accentGround ? '--night' : '--ink'),
    };
    g.fillStyle = tone.ground;
    g.fillRect(0, 0, w, h);
    // The signal: a disc set after the wordmark like a full stop, as large as the room to its right allows,
    // with rings travelling out from it behind everything.
    const wr = word.getBoundingClientRect();
    const right = (wrap.getBoundingClientRect().right - hr.left) - (wr.right - hr.left);
    const R = Math.max(14, Math.min(wr.height * 0.92, right / 2 - 12));
    const cx = wr.right - hr.left + 12 + R;
    const cy = wr.top - hr.top + wr.height * 0.5;
    g.strokeStyle = tone.ring;
    g.lineWidth = 1.5;
    for (let i = 1; i <= 14; i++) {
      g.beginPath();
      g.arc(cx, cy, R + i * Math.max(22, R * 0.2), 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = tone.disc;
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.fill();
    if (!withText) return;
    for (const el of drawn) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const size = parseFloat(cs.fontSize);
      const stretch = parseFloat(cs.fontStretch) >= 120 ? 'expanded' : 'normal';
      g.font = `${cs.fontStyle} ${cs.fontWeight} ${size}px ${cs.fontFamily}`;
      g.fontStretch = stretch;
      g.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
      g.fillStyle = tone[el.dataset.draw] || tone.ink;
      g.textBaseline = 'alphabetic';
      const text = cs.textTransform === 'uppercase' ? el.textContent.toUpperCase() : el.textContent;
      const m = g.measureText(text);
      const lh = cs.lineHeight === 'normal' ? size * 1.2 : parseFloat(cs.lineHeight);
      const asc = m.fontBoundingBoxAscent;
      const desc = m.fontBoundingBoxDescent;
      const y = r.top - hr.top + (lh - (asc + desc)) / 2 + asc;
      g.fillText(text, r.left - hr.left, y);
    }
  };

  root.dataset.ground = cfg.ground;
  const stillPath = ctx.motion !== 'full' || !webglAvailable();
  if (stillPath) {
    root.classList.add('fc--dom');
    const redraw = () => paint(still, false);
    redraw();
    // The disc is placed from the wordmark's box, so redraw when the type settles as well as on resize.
    observeResize(ctx, [hero, ...drawn], redraw);
    document.fonts?.ready.then(() => { if (!ctx.signal.aborted) redraw(); });
    ctx.onTheme(redraw);
    return { update(next) { cfg = { ...next }; root.dataset.ground = cfg.ground; redraw(); } };
  }

  still.remove();
  const { renderer, onResize } = useRenderer(ctx, host, { alpha: false, antialias: false });
  const gl = renderer.getContext();
  const halfFloat = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
  const byteMode = halfFloat ? 0 : 1;
  const rtOpts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false, type: halfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType };
  let read = new THREE.WebGLRenderTarget(SIM, SIM, rtOpts);
  let write = new THREE.WebGLRenderTarget(SIM, SIM, rtOpts);
  const splats = Array.from({ length: MAX_SPLATS }, () => new THREE.Vector4());
  const simMat = new THREE.ShaderMaterial({ vertexShader: QUAD_VERT, fragmentShader: SIM_FRAG, depthTest: false, depthWrite: false, uniforms: { uVelocity: { value: null }, uSplats: { value: splats }, uCount: { value: 0 }, uRadius: { value: cfg.radius }, uDissipation: { value: cfg.dissipation }, uAspect: { value: 1 }, uByteMode: { value: byteMode } } });
  const postMat = new THREE.ShaderMaterial({ vertexShader: QUAD_VERT, fragmentShader: POST_FRAG, depthTest: false, depthWrite: false, uniforms: { uScene: { value: null }, uVelocity: { value: null }, uDistortion: { value: cfg.distortion }, uChroma: { value: cfg.chroma }, uByteMode: { value: byteMode } } });
  const quadGeo = new THREE.PlaneGeometry(2, 2);
  const quad = new THREE.Mesh(quadGeo, simMat);
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene();
  quadScene.add(quad);
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  // Start from a still field: clear both targets to zero velocity (0.5 in byte storage).
  renderer.setClearColor(byteMode ? new THREE.Color(0.5, 0.5, 0) : 0x000000, 1);
  for (const rt of [read, write]) { renderer.setRenderTarget(rt); renderer.clear(); }
  renderer.setRenderTarget(null);
  renderer.setClearColor(0x000000, 1);

  const posterCanvas = document.createElement('canvas');
  const sceneTex = new THREE.CanvasTexture(posterCanvas);
  sceneTex.colorSpace = THREE.SRGBColorSpace;
  sceneTex.minFilter = THREE.LinearFilter;
  sceneTex.generateMipmaps = false;
  postMat.uniforms.uScene.value = sceneTex;
  ctx.onCleanup(() => { read.dispose(); write.dispose(); quadGeo.dispose(); simMat.dispose(); postMat.dispose(); sceneTex.dispose(); });

  const repaint = () => {
    paint(posterCanvas, true);
    sceneTex.image = posterCanvas;
    sceneTex.needsUpdate = true;
    wake();
  };

  // Pointer → splats. Force is the delta in UV units × 10 (clamped ±1); moves between frames queue up.
  const queue = [];
  let last = null;
  let energy = 0;
  const pushSplat = (x, y, fx, fy) => {
    if (queue.length >= MAX_SPLATS) queue.shift();
    queue.push([x, y, Math.max(-1, Math.min(1, fx)), Math.max(-1, Math.min(1, fy))]);
    wake();
  };
  const onMove = (e) => {
    const r = host.getBoundingClientRect();
    if (e.clientY < r.top || e.clientY > r.bottom) { last = null; return; }
    const x = (e.clientX - r.left) / r.width;
    const y = 1 - (e.clientY - r.top) / r.height;
    if (last) pushSplat(x, y, (x - last.x) * 10, (y - last.y) * 10);
    last = { x, y };
  };
  on(ctx, window, 'pointermove', onMove, { passive: true });
  on(ctx, window, 'pointerdown', (e) => { last = null; onMove(e); }, { passive: true });
  on(ctx, document, 'pointerleave', () => { last = null; });

  // A scripted stroke through the wordmark (the Stir action, and the thumbnail): time-based, so slow frames
  // still draw the whole path.
  let stroke = null;
  const stir = () => { stroke = { t0: performance.now(), dur: 700, lastU: 0 }; wake(); };
  const strokeAt = (u) => [0.06 + u * 0.88, 0.58 + Math.sin(u * Math.PI * 2.2) * 0.13];

  let off = null;
  function frame(dt) {
    if (stroke) {
      const u = Math.min(1, (performance.now() - stroke.t0) / stroke.dur);
      const n = Math.max(1, Math.min(MAX_SPLATS - queue.length, Math.ceil((u - stroke.lastU) * 24)));
      // Force as a pointer would give it: the delta per 60 Hz frame × 10, whatever the real frame time.
      const perFrame = 1 / (60 * (((u - stroke.lastU) * stroke.dur) / 1000 / n) || 1);
      for (let i = 1; i <= n; i++) {
        const a = strokeAt(stroke.lastU + ((u - stroke.lastU) * (i - 1)) / n);
        const b = strokeAt(stroke.lastU + ((u - stroke.lastU) * i) / n);
        pushSplat(b[0], b[1], (b[0] - a[0]) * 16 * perFrame, (b[1] - a[1]) * 16 * perFrame);
      }
      stroke.lastU = u;
      if (u >= 1) stroke = null;
    }
    // Dissipation is per 60 Hz frame; scale it so the wake lasts as long at any refresh rate.
    const fade = Math.pow(cfg.dissipation, dt * 60);
    simMat.uniforms.uDissipation.value = fade;
    simMat.uniforms.uCount.value = queue.length;
    queue.forEach((s, i) => { splats[i].set(...s); energy += Math.hypot(s[2], s[3]); });
    queue.length = 0;
    simMat.uniforms.uVelocity.value = read.texture;
    quad.material = simMat;
    renderer.setRenderTarget(write);
    renderer.render(quadScene, ortho);
    [read, write] = [write, read];
    postMat.uniforms.uVelocity.value = read.texture;
    quad.material = postMat;
    renderer.setRenderTarget(null);
    renderer.render(quadScene, ortho);
    energy *= fade;
    // Asleep once the wake is gone; one more frame has already drawn the poster at rest.
    if (energy < 0.002 && !stroke) { energy = 0; off?.(); off = null; }
  }
  function wake() { if (!off) off = onFrame(ctx, frame); }

  onResize(({ width, height }) => {
    simMat.uniforms.uAspect.value = width / height;
    repaint();
  });
  observeResize(ctx, drawn, repaint);
  document.fonts?.ready.then(() => { if (!ctx.signal.aborted) repaint(); });
  ctx.onTheme(repaint);
  root.classList.add('fc--gl');

  return {
    update(next, changed) {
      cfg = { ...next };
      simMat.uniforms.uRadius.value = cfg.radius;
      postMat.uniforms.uDistortion.value = cfg.distortion;
      postMat.uniforms.uChroma.value = cfg.chroma;
      root.dataset.ground = cfg.ground;
      if (changed.includes('ground')) repaint();
      wake();
    },
    action(id) { if (id === 'stir') stir(); },
  };
}
