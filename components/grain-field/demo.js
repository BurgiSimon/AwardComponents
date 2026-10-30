// Grain field — a project hero for an archive half buried in a dune: the sand, the plan under it and a small copy
// card (headline and reset), full-bleed with no page around it. Every grain of sand keeps its own displacement (RG)
// and velocity (BA), in CSS pixels, in one texel of a float render target that is read and rewritten each frame
// (ping-pong). The pointer brushes a capsule from its last position to the current one (falloff 1 − r³, delta
// clamped to 24 px a frame); a protect mask drawn from the copy card's and the plate line's rectangles scales the
// force to zero there. Two points passes draw the plan drawing under every grain that moved, then the grains at
// home + displacement, coloured from the sand image at their home. The loop leaves the ticker 150 frames after the
// last input. Reduced motion: no grain flies, the brush only uncovers the plan in place. Static: the sand, once.
import './demo.css';
import * as THREE from 'three';
import { on, ticker, later, html, readToken, content } from '../../src/demo-kit/index.js';
import { useRenderer, webglAvailable } from '../../src/demo-kit/three.js';

// Per-frame values are at 60 fps and scaled by dt. The brush radius, inertia and grain size come from the controls.
const P = { maxDelta: 24, impulse: 0.5, scatter: 0.35, part: 0.9, settle: 0.02, glideKeep: 0.88, glideMs: 1600, idleFrames: 150, maxGrains: 110000 };
const FORMATS = [THREE.FloatType, THREE.HalfFloatType, THREE.UnsignedByteType];

// Float targets hold (disp.xy, vel.xy) as is. RGBA8 packs disp.x and disp.y into 16 bits each (±2048 px, 1/16 px
// steps) and drops velocity: 8 bits per channel cannot integrate small steps.
const codec = /* glsl */ `
  uniform float uByte;
  float dec16(vec2 c) { vec2 b = floor(c * 255.0 + 0.5); return (b.x * 256.0 + b.y - 32768.0) / 32767.0 * 2048.0; }
  vec2 enc16(float v) { float u = floor(clamp(v / 2048.0, -1.0, 1.0) * 32767.0 + 32768.5); float hi = floor(u / 256.0); return vec2(hi, u - hi * 256.0) / 255.0; }
  vec4 decodeState(vec4 c) { return uByte > 0.5 ? vec4(dec16(c.rg), dec16(c.ba), 0.0, 0.0) : c; }
  vec4 encodeState(vec4 s) { return uByte > 0.5 ? vec4(enc16(s.x), enc16(s.y)) : s; }
`;
const quadVert = /* glsl */ 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const simFrag = /* glsl */ `
  precision highp float;
  ${codec}
  uniform sampler2D uState; uniform sampler2D uMask;
  uniform vec2 uSize; uniform vec2 uFrom; uniform vec2 uTo; uniform vec2 uDelta;
  uniform float uRadius, uActive, uKeep, uImpulse, uScatter, uPart, uSettle, uK, uGlide, uZero;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  vec2 segAway(vec2 p, vec2 a, vec2 b) { vec2 ab = b - a; float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0); return p - a - ab * t; }
  void main() {
    if (uZero > 0.5) { gl_FragColor = encodeState(vec4(0.0)); return; }
    vec4 s = decodeState(texture2D(uState, vUv));
    vec2 disp = s.xy; vec2 vel = s.zw;
    vec2 away = segAway(vUv * uSize + disp, uFrom, uTo);
    float d = length(away);
    float r = d / uRadius;
    float fall = r < 1.0 ? 1.0 - r * r * r : 0.0;
    float protect = 1.0 - smoothstep(0.25, 0.75, texture2D(uMask, vUv).r);
    vec2 n = vec2(hash(vUv), hash(vUv + 17.0)) * 2.0 - 1.0;
    // Along the stroke, plus a share outward from its axis: the brush parts the sand and banks it at the edges.
    vec2 side = d > 0.001 ? away / d : n;
    float amount = length(uDelta);
    vec2 push = (uDelta + side * amount * uPart + n * uScatter * amount) * fall * protect * uActive;
    if (uGlide < 1.0) { disp *= pow(uGlide, uK); vel = vec2(0.0); }
    else if (uByte > 0.5) { disp += push; }
    else {
      vel = vel * pow(uKeep, uK) + push * uImpulse;
      if (length(vel) < uSettle) vel = vec2(0.0);
      disp += vel * uK;
    }
    gl_FragColor = encodeState(vec4(disp, vel));
  }`;
// The ground: the sand, with the plan drawn at full resolution wherever the reveal mask says grains have left.
const bgFrag = /* glsl */ `uniform sampler2D uTex; uniform sampler2D uPlan; uniform sampler2D uReveal; varying vec2 vUv;
void main() {
  float m = smoothstep(0.12, 0.8, texture2D(uReveal, vUv).r);
  gl_FragColor = vec4(mix(texture2D(uTex, vUv).rgb, texture2D(uPlan, vUv).rgb, m), 1.0);
  #include <colorspace_fragment>
}`;
// One points program, two passes: uHole 1 = the reveal mask at the home of moved grains (drawn into a half-size
// target, so the plan itself stays sharp), 0 = grains at home + displacement, in the sand's colour.
const pointVert = /* glsl */ `
  precision highp float;
  ${codec}
  attribute vec2 aRef;
  uniform sampler2D uState; uniform sampler2D uTex; uniform vec2 uSize; uniform float uPoint, uHole;
  varying vec3 vColor; varying float vAlpha;
  void main() {
    vec4 s = decodeState(texture2D(uState, aRef));
    float m = length(s.xy);
    vec2 p = aRef * uSize + s.xy * (1.0 - uHole);
    gl_Position = vec4(p / uSize * 2.0 - 1.0, 0.0, 1.0);
    vColor = texture2D(uTex, aRef).rgb;
    vAlpha = uHole > 0.5 ? smoothstep(2.0, 12.0, m) : step(1.5, m);
    gl_PointSize = vAlpha > 0.0 ? uPoint : 0.0;
  }`;
const pointFrag = /* glsl */ `
  uniform float uRound; varying vec3 vColor; varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    if (uRound > 0.5 && dot(c, c) > 0.25) discard;
    gl_FragColor = vec4(vColor, vAlpha);
    #include <colorspace_fragment>
  }`;
const maskFrag = /* glsl */ 'varying vec3 vColor; varying float vAlpha; void main() { gl_FragColor = vec4(1.0, 1.0, 1.0, vAlpha); }';

const makeCanvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
function texture(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}

// The sand: a warm wash with wind ripples and per-pixel speckle, so every grain has its own colour.
function sandImage(w, h) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, readToken('--sand') || '#e3d2b1');
  grad.addColorStop(1, readToken('--clay') || '#c9744b');
  g.fillStyle = readToken('--sand') || '#e3d2b1';
  g.fillRect(0, 0, w, h);
  g.globalAlpha = 0.38;
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  g.globalAlpha = 1;
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  let s = 11;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i += 4) {
      const bend = Math.sin(x * 0.004 + y * 0.0026) * 9 + Math.sin(x * 0.011 - y * 0.004) * 2.5;
      const r = Math.sin((x * 0.42 + y) * 0.33 + bend);
      const ridge = Math.max(0, r) ** 3 * 16 - Math.max(0, -r) * 7;
      const fleck = rnd() < 0.012 ? -70 : 0;
      const n = (rnd() - 0.5) * 30 + fleck;
      d[i] += ridge + n;
      d[i + 1] += ridge * 0.94 + n;
      d[i + 2] += ridge * 0.8 + n * 0.85;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

// The plan under the dune: contours, a survey grid, the archive's walls and stacks, its slot window, a title block.
// Drawn in field pixels (scaled into the image), placed in the part of the hero the copy card leaves free.
function planImage(w, h, scale, field, zone) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  const W = field.w;
  const H = field.h;
  const ink = readToken('--sand') || '#e3d2b1';
  const accent = readToken('--accent') || '#f94c16';
  const mono = '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, monospace';
  g.scale(scale, scale);
  g.fillStyle = readToken('--night') || '#1b1d24';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = ink;
  g.fillStyle = ink;

  // Survey grid crosses every 64 px.
  g.globalAlpha = 0.35;
  g.lineWidth = 1;
  for (let x = 32; x < W; x += 64) {
    for (let y = 32; y < H; y += 64) {
      g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x + 4, y); g.moveTo(x, y - 4); g.lineTo(x, y + 4); g.stroke();
    }
  }
  // Dune contours: wobbly closed loops around two crests, so a stroke anywhere finds lines.
  for (const [cx, cy, n, phase] of [[zone.x + zone.w * 0.72, zone.y + zone.h * 0.28, 22, 0.4], [W * 0.12, H * 0.9, 16, 2.1]]) {
    for (let i = 1; i <= n; i++) {
      const r0 = i * Math.max(W, H) * 0.035;
      g.globalAlpha = i % 5 === 0 ? 0.55 : 0.3;
      g.lineWidth = i % 5 === 0 ? 1.5 : 1;
      g.beginPath();
      for (let a = 0; a <= 96; a++) {
        const t = (a / 96) * Math.PI * 2;
        const r = r0 * (1 + 0.12 * Math.sin(3 * t + phase + i * 0.15) + 0.06 * Math.sin(5 * t - i * 0.3));
        const x = cx + Math.cos(t) * r * 1.35;
        const y = cy + Math.sin(t) * r * 0.8;
        if (a) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.stroke();
    }
  }

  // The archive: a long body set into the slope, rotated to the dune.
  const { x: zx, y: zy, w: zw, h: zh } = zone;
  const L = Math.min(zw * 0.86, 680);
  const B = Math.min(L * 0.3, zh * 0.42);
  g.save();
  g.translate(zx + zw / 2, zy + zh / 2);
  g.rotate(-0.12);
  g.globalAlpha = 0.95;
  g.lineWidth = 2.5;
  g.strokeRect(-L / 2, -B / 2, L, B);
  g.lineWidth = 1;
  g.strokeRect(-L / 2 + 8, -B / 2 + 8, L - 16, B - 16);
  // Stacks: rows of shelving in the west two thirds.
  g.globalAlpha = 0.6;
  for (let x = -L / 2 + 26; x < L * 0.12; x += 14) { g.beginPath(); g.moveTo(x, -B / 2 + 20); g.lineTo(x, B / 2 - 20); g.stroke(); }
  // Reading room: a wall, columns, a long table.
  g.globalAlpha = 0.9;
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(L * 0.16, -B / 2 + 8); g.lineTo(L * 0.16, B / 2 - 34); g.stroke();
  g.lineWidth = 1;
  for (let x = L * 0.24; x < L / 2 - 20; x += L * 0.08) for (const y of [-B * 0.22, B * 0.22]) { g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill(); }
  g.strokeRect(L * 0.24, -6, L * 0.2, 12);
  // Entrance ramp down the slope.
  g.globalAlpha = 0.7;
  for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(L / 2 - 70 + i * 6, B / 2); g.lineTo(L / 2 - 70 + i * 6, B / 2 + 46); g.stroke(); }
  g.strokeRect(L / 2 - 74, B / 2, 58, 46);
  // The slot window along the north wall, the one thing in colour.
  g.globalAlpha = 1;
  g.strokeStyle = accent;
  g.lineWidth = 4;
  g.beginPath(); g.moveTo(-L / 2 + 30, -B / 2); g.lineTo(L / 2 - 30, -B / 2); g.stroke();
  g.strokeStyle = ink;
  // Dimension line under the plan.
  g.globalAlpha = 0.75;
  g.lineWidth = 1;
  const dy = B / 2 + 70;
  g.beginPath(); g.moveTo(-L / 2, dy); g.lineTo(L / 2, dy);
  for (const x of [-L / 2, L / 2]) { g.moveTo(x, dy - 8); g.lineTo(x, dy + 8); g.moveTo(x - 5, dy + 5); g.lineTo(x + 5, dy - 5); }
  g.stroke();
  g.font = `500 11px ${mono}`;
  g.textAlign = 'center';
  g.fillText('48 600', 0, dy - 8);
  g.textAlign = 'left';
  g.fillText('ARCHIVE STACKS', -L / 2 + 26, -B / 2 - 14 + B + 46);
  g.fillText('READING ROOM', L * 0.2, -B / 2 + 26);
  g.fillStyle = accent;
  g.fillText('SLOT WINDOW  +1.20', -L / 2 + 30, -B / 2 - 12);
  g.restore();

  // Boiling house, dashed, down the slope; a north arrow; a title block in the corner.
  g.globalAlpha = 0.6;
  g.setLineDash([6, 5]);
  g.strokeRect(zx + zw * 0.08, zy + zh * 0.86, 70, 52);
  g.setLineDash([]);
  g.font = `500 10px ${mono}`;
  g.fillStyle = ink;
  g.fillText('BOILING HOUSE', zx + zw * 0.08, zy + zh * 0.86 - 8);
  g.globalAlpha = 0.85;
  const nx = zx + zw - 26;
  const ny = zy + 30;
  g.beginPath(); g.arc(nx, ny, 18, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(nx, ny - 14); g.lineTo(nx + 6, ny + 8); g.lineTo(nx, ny + 3); g.lineTo(nx - 6, ny + 8); g.closePath(); g.fill();
  g.font = `600 10px ${mono}`;
  g.textAlign = 'center';
  g.fillText('N', nx, ny - 24);
  g.textAlign = 'left';
  const tx = zx + zw - 222;
  const ty = zy + zh - 42;
  g.globalAlpha = 0.6;
  g.strokeRect(tx, ty, 222, 42);
  g.beginPath(); g.moveTo(tx, ty + 21); g.lineTo(tx + 222, ty + 21); g.stroke();
  g.globalAlpha = 0.85;
  g.fillText('SALTWORKS ARCHIVE · PLAN 1:200', tx + 8, ty + 14);
  g.fillText('HALDEN ARKITEKTER · SHEET A-101', tx + 8, ty + 35);
  return c;
}

const RIPPLE_BG = 'repeating-linear-gradient(-22deg, transparent 0 14px, color-mix(in oklab, var(--clay) 14%, transparent) 14px 16px)';

export default function mount(root, options, ctx) {
  const { studio } = content;
  let cfg = { ...options };
  root.className = 'gf';
  root.innerHTML = html`
    <section class="gf__hero" data-field aria-labelledby="gf-title" style="--ripples:${RIPPLE_BG}">
      <div class="gf__canvas" data-stage></div>
      <div class="gf__copy ac-wrap">
        <div class="gf__card" data-protect>
          <h1 class="ac-h1" id="gf-title">Half buried, so the dune can keep moving.</h1>
          <button type="button" class="ac-btn" data-reset>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3.5 10a6.5 6.5 0 1 0 2-4.7"/><path d="M3.5 3.5v3.2h3.2"/></svg>
            Smooth the sand
          </button>
        </div>
      </div>
      <p class="ac-stage__note"><span data-protect>${studio.name} · project hero</span></p>
    </section>`;

  const hero = root.querySelector('[data-field]');
  const stage = root.querySelector('[data-stage]');
  const resetBtn = root.querySelector('[data-reset]');
  const protect = [...root.querySelectorAll('[data-protect]')]; // the card first (freeZone reads it), then the plate line
  // The part of the hero the copy card leaves free (top-down field px): right of the card on wide screens, above
  // it on narrow ones. The plan is drawn there and the scripted stroke sweeps it.
  const freeZone = () => {
    const field = hero.getBoundingClientRect();
    const r = protect[0].getBoundingClientRect();
    const right = r.right - field.left;
    if (right < field.width * 0.66) return { x: right + 36, y: 28, w: Math.max(160, field.width - right - 72), h: field.height - 56 };
    return { x: 16, y: 20, w: field.width - 32, h: Math.max(140, r.top - field.top - 40) };
  };

  if (!webglAvailable() || !document.createElement('canvas').getContext('webgl2')) {
    root.classList.add('gf--still');
    resetBtn.hidden = true;
    return { update(next) { cfg = { ...next }; } };
  }

  const { renderer, canvas, onResize } = useRenderer(ctx, stage, { alpha: false, antialias: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  canvas.style.touchAction = 'pan-y';
  const gl = renderer.getContext();
  gl.getExtension('EXT_color_buffer_float');
  gl.getExtension('EXT_color_buffer_half_float');

  // Storage: the first type whose framebuffer is complete.
  const rtOpts = (type) => ({ type, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, stencilBuffer: false, generateMipmaps: false });
  let format = null;
  for (const type of FORMATS) {
    const probe = new THREE.WebGLRenderTarget(1, 1, rtOpts(type));
    renderer.setRenderTarget(probe);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    renderer.setRenderTarget(null);
    probe.dispose();
    if (ok) { format = type; break; }
  }
  if (!format) { root.classList.add('gf--still'); return {}; }
  const byte = format === THREE.UnsignedByteType ? 1 : 0;

  const quadGeo = new THREE.PlaneGeometry(2, 2);
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const flat = { depthTest: false, depthWrite: false };
  const simMat = new THREE.ShaderMaterial({ ...flat, vertexShader: quadVert, fragmentShader: simFrag, uniforms: {
    uByte: { value: byte }, uState: { value: null }, uMask: { value: null }, uSize: { value: new THREE.Vector2() },
    uFrom: { value: new THREE.Vector2() }, uTo: { value: new THREE.Vector2() }, uDelta: { value: new THREE.Vector2() },
    uRadius: { value: cfg.brush }, uActive: { value: 0 }, uKeep: { value: cfg.inertia }, uImpulse: { value: P.impulse }, uScatter: { value: P.scatter }, uPart: { value: P.part },
    uSettle: { value: P.settle }, uK: { value: 1 }, uGlide: { value: 1 }, uZero: { value: 0 } } });
  const bgMat = new THREE.ShaderMaterial({ ...flat, vertexShader: quadVert, fragmentShader: bgFrag, uniforms: { uTex: { value: null }, uPlan: { value: null }, uReveal: { value: null } } });
  const pointMat = (hole) => new THREE.ShaderMaterial({ ...flat, transparent: true, vertexShader: pointVert, fragmentShader: hole ? maskFrag : pointFrag, uniforms: {
    uByte: { value: byte }, uState: { value: null }, uTex: { value: null }, uSize: { value: new THREE.Vector2() }, uPoint: { value: 1 }, uHole: { value: hole }, uRound: { value: 1 - hole } } });
  const holeMat = pointMat(1);
  const grainMat = pointMat(0);
  const quad = new THREE.Mesh(quadGeo, simMat);
  const simScene = new THREE.Scene();
  simScene.add(quad);
  const drawScene = new THREE.Scene();
  const maskScene = new THREE.Scene();
  const bg = new THREE.Mesh(quadGeo, bgMat);
  const holes = new THREE.Points(new THREE.BufferGeometry(), holeMat);
  const grains = new THREE.Points(new THREE.BufferGeometry(), grainMat);
  bg.renderOrder = 0; grains.renderOrder = 1;
  holes.frustumCulled = grains.frustumCulled = false;
  grains.visible = ctx.motion === 'full'; // reduced: the brush uncovers the plan in place, no grain flies
  drawScene.add(bg, grains);
  maskScene.add(holes);

  // Field-sized resources, rebuilt on resize and on a new grain size (the field resets with them).
  let f = null;
  let ptr = null;
  let last = null;
  const disposeField = () => { if (f) for (const t of [f.read, f.write, f.reveal, f.mask, f.surface, f.under]) t.dispose(); };
  ctx.onCleanup(() => {
    disposeField();
    for (const m of [simMat, bgMat, holeMat, grainMat]) m.dispose();
    quadGeo.dispose();
    grains.geometry.dispose();
  });

  // Protect mask at field resolution from the copy card's and plate line's rectangles (+12 px); white = no force.
  const drawMask = () => {
    const field = hero.getBoundingClientRect();
    const c = makeCanvas(f.cols, f.rows);
    const g = c.getContext('2d');
    g.fillStyle = '#000';
    g.fillRect(0, 0, f.cols, f.rows);
    g.fillStyle = '#fff';
    const sx = f.cols / field.width;
    const sy = f.rows / field.height;
    for (const el of protect) {
      const r = el.getBoundingClientRect();
      g.fillRect((r.left - field.left - 12) * sx, (r.top - field.top - 12) * sy, (r.width + 24) * sx, (r.height + 24) * sy);
    }
    f.mask?.dispose();
    f.mask = texture(c, false);
    simMat.uniforms.uMask.value = f.mask;
  };
  const paintImages = () => {
    const img = Math.min(1, 1024 / Math.max(f.w, f.h));
    const iw = Math.round(f.w * img);
    const ih = Math.round(f.h * img);
    f.surface?.dispose();
    f.under?.dispose();
    f.surface = texture(sandImage(iw, ih));
    f.under = texture(planImage(iw, ih, img, f, freeZone()));
    bgMat.uniforms.uTex.value = f.surface;
    bgMat.uniforms.uPlan.value = f.under;
    grainMat.uniforms.uTex.value = f.surface;
  };

  const simPass = (zero = false) => {
    simMat.uniforms.uZero.value = zero ? 1 : 0;
    simMat.uniforms.uState.value = f.read.texture;
    renderer.setRenderTarget(f.write);
    renderer.render(simScene, ortho);
    [f.read, f.write] = [f.write, f.read];
  };
  const clearField = () => { simPass(true); simPass(true); };
  const draw = () => {
    holeMat.uniforms.uState.value = f.read.texture;
    grainMat.uniforms.uState.value = f.read.texture;
    renderer.setRenderTarget(f.reveal);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    renderer.render(maskScene, ortho);
    renderer.setRenderTarget(null);
    renderer.render(drawScene, ortho);
  };

  const build = ({ width: w, height: h }) => {
    disposeField();
    // Grains on a grid that follows the canvas aspect: one per grain-size cell, capped by the grain budget.
    const cell = Math.max(cfg.grain, Math.sqrt((w * h) / P.maxGrains));
    const cols = Math.max(8, Math.round(w / cell));
    const rows = Math.max(8, Math.round(h / cell));
    const dpr = renderer.getPixelRatio();
    f = {
      w, h, cols, rows,
      read: new THREE.WebGLRenderTarget(cols, rows, rtOpts(format)),
      write: new THREE.WebGLRenderTarget(cols, rows, rtOpts(format)),
      reveal: new THREE.WebGLRenderTarget(Math.ceil(w * dpr * 0.5), Math.ceil(h * dpr * 0.5), { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, generateMipmaps: false }),
    };
    bgMat.uniforms.uReveal.value = f.reveal.texture;
    const ref = new Float32Array(cols * rows * 2);
    for (let j = 0, k = 0; j < rows; j++) for (let i = 0; i < cols; i++) { ref[k++] = (i + 0.5) / cols; ref[k++] = (j + 0.5) / rows; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cols * rows * 3), 3));
    geo.setAttribute('aRef', new THREE.BufferAttribute(ref, 2));
    grains.geometry.dispose();
    holes.geometry = geo;
    grains.geometry = geo;
    const px = (w / cols) * dpr;
    holeMat.uniforms.uPoint.value = px * 1.15 * 0.5;
    grainMat.uniforms.uPoint.value = px * 1.3;
    for (const m of [simMat, holeMat, grainMat]) m.uniforms.uSize.value.set(w, h);
    paintImages();
    drawMask();
    ptr = last = null;
    clearField();
    draw();
  };

  // Pointer → a capsule brush from the last applied position to the current one (y up, field pixels).
  const toField = (clientX, clientY) => {
    const r = canvas.getBoundingClientRect();
    const x = clientX - r.left;
    const y = r.bottom - clientY;
    return x < 0 || y < 0 || x > r.width || y > r.height ? null : { x, y };
  };
  const onMove = (e) => {
    if (stroke) return;
    const p = toField(e.clientX, e.clientY);
    if (!p) { ptr = last = null; return; }
    touched = true;
    ptr = p;
    if (!last) last = { ...p };
    wake();
  };
  if (ctx.motion !== 'static') {
    on(ctx, window, 'pointermove', onMove, { passive: true });
    on(ctx, window, 'pointercancel', () => { ptr = last = null; });
  }

  // A scripted stroke (on load, and the "Draw a stroke" action): four sweeps over the plan, through the same brush.
  let stroke = null;
  let touched = false;
  const strokeAt = (u) => {
    const z = stroke.zone;
    const x0 = z.x + z.w * 0.08;
    const x1 = z.x + z.w * 0.92;
    const y0 = f.h - (z.y + z.h * 0.22);
    const y1 = f.h - (z.y + z.h * 0.78);
    const tri = 1 - Math.abs(((u * 4) % 2) - 1); // four sweeps, back and forth, easing at each turn
    return { x: x0 + (x1 - x0) * (0.5 - 0.5 * Math.cos(tri * Math.PI)), y: y0 + (y1 - y0) * u };
  };
  // One brush pass from the last applied position to p (field px, y up): the capsule covers the whole segment.
  const brushTo = (p) => {
    let dx = p.x - last.x;
    let dy = p.y - last.y;
    const len = Math.hypot(dx, dy);
    if (len > P.maxDelta) { dx *= P.maxDelta / len; dy *= P.maxDelta / len; }
    simMat.uniforms.uFrom.value.set(last.x, last.y);
    simMat.uniforms.uTo.value.set(p.x, p.y);
    simMat.uniforms.uDelta.value.set(dx, dy);
    simMat.uniforms.uActive.value = len > 0 ? 1 : 0;
    last = { ...p };
    quiet = 0;
  };

  let quiet = 0;
  let gliding = false;
  let glideStart = 0;
  let glideLeftPrev = 1;
  let running = false;
  // The glide's remaining fraction is a function of elapsed time, not of frames, so it lands on zero at any rate.
  const glideK = (60 * P.glideMs) / 1000;
  const glideFloor = P.glideKeep ** glideK;
  const glideLeft = (u) => Math.max(0, (P.glideKeep ** (glideK * u) - glideFloor) / (1 - glideFloor));
  const frame = (dt) => {
    if (!f) return;
    const k = Math.min(3, dt * 60);
    simMat.uniforms.uK.value = k;
    simMat.uniforms.uActive.value = 0;
    if (gliding) {
      const u = Math.min(1, (performance.now() - glideStart) / P.glideMs);
      const left = glideLeft(u);
      simMat.uniforms.uGlide.value = Math.min(0.999999, glideLeftPrev > 0 ? left / glideLeftPrev : 0);
      simMat.uniforms.uK.value = 1;
      glideLeftPrev = left;
      simPass();
      if (u >= 1) {
        simMat.uniforms.uGlide.value = 1;
        clearField();
        gliding = false;
        quiet = 0;
      }
    } else if (stroke) {
      // The scripted stroke is sub-stepped, so it keeps its shape at any frame rate: short segments, one cheap
      // simulation pass each, the frame's decay shared between them, and one draw at the end.
      const u = Math.min(1, (performance.now() - stroke.start) / stroke.ms);
      if (!last) last = strokeAt(stroke.u);
      const steps = Math.max(1, Math.ceil((u - stroke.u) / 0.01));
      simMat.uniforms.uK.value = k / steps;
      for (let i = 1; i <= steps; i++) { brushTo(strokeAt(stroke.u + ((u - stroke.u) * i) / steps)); simPass(); }
      stroke.u = u;
      if (u >= 1) { stroke = null; last = null; }
    } else {
      if (ptr && last && (ptr.x !== last.x || ptr.y !== last.y)) brushTo(ptr);
      simPass();
    }
    draw();
    // Idle gate: velocities settle well inside 150 frames; then the loop leaves the ticker until the next input.
    if (!gliding && !stroke && ++quiet > P.idleFrames) sleep();
  };
  const sleep = () => { if (running) { ticker.remove(frame); running = false; } };
  const wake = () => { quiet = 0; if (!running && ctx.motion !== 'static') { running = true; ticker.add(frame); } };
  ctx.onCleanup(sleep);

  const reset = () => {
    if (!f || ctx.motion === 'static') return;
    stroke = null;
    gliding = true;
    glideStart = performance.now();
    glideLeftPrev = 1;
    ptr = last = null;
    wake();
  };
  const drawStroke = () => {
    if (!f || ctx.motion === 'static') return;
    gliding = false;
    simMat.uniforms.uGlide.value = 1;
    clearField(); // a replay starts from smooth sand
    last = null;
    stroke = { start: performance.now(), ms: 2400, u: 0, zone: freeZone() };
    wake();
  };
  on(ctx, resetBtn, 'click', reset);
  if (ctx.motion === 'static') resetBtn.hidden = true;

  let resizeTimer = 0;
  onResize((size) => {
    if (!f) { build(size); return; }
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => build(size), 200);
  });
  ctx.onCleanup(() => clearTimeout(resizeTimer));
  // The card's size settles with the fonts, and the plan's labels need the mono face: redraw both once they load.
  document.fonts?.ready.then(() => { if (!ctx.signal.aborted && f) { drawMask(); paintImages(); draw(); } });
  ctx.onTheme(() => { if (f) { paintImages(); draw(); } });
  // Full motion: one scripted stroke shortly after load shows what the sand hides, unless the visitor got there first.
  if (ctx.motion === 'full') later(ctx, () => { if (!touched) drawStroke(); }, 700);

  return {
    update(next, changed) {
      cfg = { ...next };
      simMat.uniforms.uRadius.value = cfg.brush;
      simMat.uniforms.uKeep.value = cfg.inertia;
      if (changed.includes('grain') && f) build({ width: f.w, height: f.h });
      return true;
    },
    action(id) {
      if (id === 'reset') reset();
      if (id === 'stroke') drawStroke();
    },
  };
}
