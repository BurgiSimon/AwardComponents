// WebGL headline — a festival hero whose headline is drawn by three.js from a signed-distance atlas built in the
// page: the glyphs this string uses are rasterised from the heading's own font, a Felzenszwalb distance transform
// measures every pixel, and the shader reads median(r,g,b) with an fwidth edge (floored at 1e-5). Each glyph quad
// sits on the rect the browser gave that character (Range rects), so the GL text lands on the DOM text at any
// width. The pointer leaves expanding rings that displace the atlas lookup inside each glyph cell; frames render
// only while the reveal runs or a ring is alive. No WebGL or static tier: the DOM heading. Reduced: drawn settled.
import './demo.css';
import * as THREE from 'three';
import { on, onFrame, html, finePointer, readToken, clamp, content, formatPrice } from '../../src/demo-kit/index.js';
import { useRenderer, webglAvailable } from '../../src/demo-kit/three.js';

const SIZE = 96;   // the glyph em box inside the atlas, in px
const PAD = 24;    // room around each glyph for the distance ramp and the ripple's displacement
const SPREAD = 16; // px of signed distance across the 0..1 channel range
const INF = 1e20;
const RINGS = 10;

// ---- Felzenszwalb exact Euclidean distance transform, one dimension at a time ----
function edt1d(f, d, v, z, n) {
  v[0] = 0; z[0] = -INF; z[1] = INF;
  for (let q = 1, k = 0, s = 0; q < n; q++) {
    do {
      const r = v[k];
      s = (f[q] - f[r] + q * q - r * r) / (2 * q - 2 * r);
    } while (s <= z[k] && --k > -1);
    k++;
    v[k] = q; z[k] = s; z[k + 1] = INF;
  }
  for (let q = 0, k = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const r = v[k];
    d[q] = (q - r) * (q - r) + f[r];
  }
}
function edt(grid, w, h, f, d, v, z) {
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
    edt1d(f, d, v, z, h);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
    edt1d(f, d, v, z, w);
    for (let x = 0; x < w; x++) grid[y * w + x] = Math.sqrt(d[x]);
  }
}

// ---- The atlas: the glyphs this heading uses, at SIZE px, measured into one channel of signed distance ----
function buildAtlas(chars, font, stretch) {
  const c = document.createElement('canvas');
  let g = c.getContext('2d', { willReadFrequently: true });
  const setFont = () => {
    g.font = font;
    if ('fontStretch' in g) g.fontStretch = stretch;
    g.textBaseline = 'alphabetic';
    g.fillStyle = '#fff';
  };
  setFont();
  // Cells fit the widest glyph of this (expanded, heavy) face plus the padding on every side.
  const m = g.measureText('Hg');
  const ascent = m.fontBoundingBoxAscent || m.actualBoundingBoxAscent || SIZE * 0.8;
  const descent = m.fontBoundingBoxDescent || m.actualBoundingBoxDescent || SIZE * 0.2;
  const ink = Math.max(...chars.map((ch) => { const t = g.measureText(ch); return Math.max(t.width, t.actualBoundingBoxRight); }));
  const cw = Math.ceil(ink) + PAD * 2;
  const chh = Math.ceil(ascent + descent) + PAD * 2;
  const cols = Math.ceil(Math.sqrt(chars.length));
  const rows = Math.ceil(chars.length / cols);
  const w = cols * cw;
  const h = rows * chh;
  c.width = w; c.height = h;
  g = c.getContext('2d', { willReadFrequently: true });
  setFont();
  const cells = new Map();
  chars.forEach((ch, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    g.fillText(ch, col * cw + PAD, row * chh + PAD + ascent);
    cells.set(ch, { col, row });
  });
  const n = w * h;
  const px = g.getImageData(0, 0, w, h).data;
  const outer = new Float64Array(n);
  const inner = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = px[i * 4 + 3] / 255;
    outer[i] = a === 1 ? 0 : a === 0 ? INF : Math.max(0, 0.5 - a) ** 2;
    inner[i] = a === 1 ? INF : a === 0 ? 0 : Math.max(0, a - 0.5) ** 2;
  }
  const len = Math.max(w, h);
  const f = new Float64Array(len); const d = new Float64Array(len); const v = new Int32Array(len + 1); const z = new Float64Array(len + 1);
  edt(outer, w, h, f, d, v, z);
  edt(inner, w, h, f, d, v, z);
  // One channel copied to r, g and b: median(r,g,b) is then the field itself, so a real MSDF atlas drops in.
  const data = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const val = Math.round(255 * clamp(0.5 - (outer[i] - inner[i]) / (2 * SPREAD), 0, 1));
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = val;
    data[i * 4 + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return { texture, cells, ascent, w, h, cw, chh };
}

const vertexShader = /* glsl */ `
  attribute float aDelay;
  attribute vec4 aCell;
  uniform float uProgress;
  uniform float uRise;
  varying vec2 vUv;
  varying vec2 vPos;
  varying vec4 vCell;
  varying float vReveal;
  void main() {
    vUv = uv;
    vPos = position.xy;
    vCell = aCell;
    vReveal = clamp((uProgress - aDelay) / 0.35, 0.0, 1.0);
    vec3 p = position;
    p.y -= uRise * (1.0 - vReveal) * (1.0 - vReveal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;

const fragmentShader = /* glsl */ `
  #define RINGS ${RINGS}
  uniform sampler2D uAtlas;
  uniform vec3 uColor;
  uniform vec3 uHi;
  uniform float uShimmer;
  uniform float uTime;
  uniform float uAmp;
  uniform float uSpeed;
  uniform float uLife;
  uniform vec2 uTexel;
  uniform float uMaxDisp;
  uniform vec4 uRings[RINGS];
  varying vec2 vUv;
  varying vec2 vPos;
  varying vec4 vCell;
  varying float vReveal;
  float median(float r, float g, float b) { return max(min(r, g), min(max(r, g), b)); }
  void main() {
    // Rings: a wave packet travelling out from each source at uSpeed, fading over uLife, pushing the lookup radially.
    vec2 disp = vec2(0.0);
    for (int i = 0; i < RINGS; i++) {
      vec4 r = uRings[i];
      if (r.w <= 0.0) continue;
      float age = uTime - r.z;
      if (age < 0.0 || age > uLife) continue;
      vec2 dv = vPos - r.xy;
      float d = length(dv);
      float x = d - age * uSpeed;
      float fade = 1.0 - age / uLife;
      float wave = sin(x * 0.1) * exp(-x * x / 5000.0) * fade * r.w * smoothstep(0.0, 48.0, d);
      disp += dv / max(d, 1.0) * wave;
    }
    // Superposed rings never push a glyph past its cell's padding (uMaxDisp is the padding in screen px).
    float L = length(disp);
    float tint = smoothstep(0.45, 0.8, L) * uShimmer;
    disp *= uAmp;
    if (L * uAmp > uMaxDisp) disp *= uMaxDisp / (L * uAmp);
    vec2 uv = clamp(vUv + vec2(-disp.x, disp.y) * uTexel, vCell.xy, vCell.zw);
    vec3 s = texture2D(uAtlas, uv).rgb;
    float d = median(s.r, s.g, s.b) - 0.5;
    // fwidth is exactly zero where the padded field has saturated; the floor keeps the quad from going opaque.
    float alpha = clamp(d / max(fwidth(d), 1e-5) + 0.5, 0.0, 1.0) * vReveal;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(mix(uColor, uHi, tint), alpha);
    #include <colorspace_fragment>
  }`;

// The water: thin rings at each packet's front and two trailing crests, behind the glyphs, faded at the edges.
const ringVertex = /* glsl */ `
  varying vec2 vPos;
  void main() {
    vPos = (modelMatrix * vec4(position, 1.0)).xy;
    gl_Position = projectionMatrix * viewMatrix * vec4(vPos, 0.0, 1.0);
  }`;
const ringFragment = /* glsl */ `
  #define RINGS ${RINGS}
  uniform vec3 uLine;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uLife;
  uniform vec2 uSize;
  uniform vec4 uRings[RINGS];
  varying vec2 vPos;
  void main() {
    float a = 0.0;
    for (int i = 0; i < RINGS; i++) {
      vec4 r = uRings[i];
      if (r.w <= 0.0) continue;
      float age = uTime - r.z;
      if (age < 0.0 || age > uLife) continue;
      float x = length(vPos - r.xy) - age * uSpeed;
      float fade = 1.0 - age / uLife;
      a += (exp(-x * x / 5.0) + 0.5 * exp(-(x + 63.0) * (x + 63.0) / 5.0) + 0.22 * exp(-(x + 126.0) * (x + 126.0) / 5.0)) * fade * r.w;
    }
    vec2 p = vec2(vPos.x, -vPos.y);
    float edge = smoothstep(0.0, 120.0, min(min(p.x, uSize.x - p.x), min(p.y, uSize.y - p.y)));
    a = clamp(a, 0.0, 1.0) * 0.22 * edge;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uLine, a);
    #include <colorspace_fragment>
  }`;

export default async function mount(root, options, ctx) {
  const { festival } = content;
  let cfg = { ...options };
  root.className = 'gt';
  root.innerHTML = html`
    <header class="ac-bar gt__bar">
      <a class="ac-brand gt__brand" href="#top"><span class="gt__mark" aria-hidden="true"></span>${festival.name}</a>
      <nav aria-label="Festival">${['Line-up', 'Programme', 'Venue', 'Info'].map((n) => html`<a href="#top">${n}</a>`)}</nav>
      <a class="ac-btn ac-btn--sm" href="#top">Tickets</a>
    </header>
    <section class="gt__hero" aria-labelledby="gt-title">
      <div class="gt__gl" data-gl></div>
      <div class="gt__inner ac-wrap">
        <p class="gt__meta ac-label"><span>${festival.dates}</span><span>${festival.place}</span><span>Edition 06</span></p>
        <h1 class="gt__title" id="gt-title">Sound carries over water.</h1>
        <div class="gt__foot">
          <p class="ac-lede">Three days, four stages and twelve acts on the old shipyard at the mouth of the harbour.</p>
          <div class="gt__cta">
            <a class="ac-btn ac-btn--accent ac-btn--lg" href="#top">Tickets from ${formatPrice(festival.tickets[0].price)}</a>
            <a class="ac-btn ac-btn--ghost ac-btn--lg" href="#top">See the line-up</a>
          </div>
        </div>
        <ul class="gt__lineup ac-label" role="list" aria-label="Line-up">${festival.lineup.slice(0, 8).map((n) => html`<li>${n}</li>`)}</ul>
      </div>
    </section>`;
  root.querySelectorAll('a[href="#top"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const title = root.querySelector('#gt-title');
  const host = root.querySelector('[data-gl]');
  const hero = root.querySelector('.gt__hero');

  // No WebGL, the static tier or the WebGL toggle off: the DOM heading is the headline.
  if (!cfg.gl || ctx.motion === 'static' || !webglAvailable()) {
    host.remove();
    return { update(next, changed) { cfg = { ...next }; return changed.includes('gl') && cfg.gl && ctx.motion !== 'static' && webglAvailable() ? false : undefined; } };
  }

  // Fonts first: the atlas rasterises the heading's own face.
  const cs = getComputedStyle(title);
  const family = cs.fontFamily;
  const weight = cs.fontWeight;
  const font = `${weight} ${SIZE}px ${family}`;
  await Promise.all([document.fonts?.load(`${weight} expanded ${SIZE}px ${family}`), document.fonts?.ready].map((p) => p?.catch?.(() => {})));
  if (ctx.signal.aborted) return {};

  const chars = [...new Set([...title.textContent])].filter((ch) => ch.trim());
  const atlas = buildAtlas(chars, font, 'expanded');

  const { renderer, onResize } = useRenderer(ctx, host, { alpha: true, antialias: false });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 1, 0, -1, -1, 1);
  const uniforms = {
    uAtlas: { value: atlas.texture },
    uColor: { value: new THREE.Color() },
    uHi: { value: new THREE.Color() },
    uShimmer: { value: cfg.shimmer ? 1 : 0 },
    uProgress: { value: ctx.motion === 'full' ? 0 : 1 },
    uRise: { value: ctx.motion === 'full' ? 28 : 0 },
    uTime: { value: 0 },
    uAmp: { value: cfg.distortion },
    uSpeed: { value: cfg.speed },
    uLife: { value: cfg.life },
    uTexel: { value: new THREE.Vector2() },
    uMaxDisp: { value: 10 },
    uRings: { value: Array.from({ length: RINGS }, () => new THREE.Vector4(0, 0, -99, 0)) },
  };
  const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, transparent: true, depthTest: false, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  const ringUniforms = { uLine: { value: new THREE.Color() }, uTime: uniforms.uTime, uSpeed: uniforms.uSpeed, uLife: uniforms.uLife, uRings: uniforms.uRings, uSize: { value: new THREE.Vector2(1, 1) } };
  const ringMaterial = new THREE.ShaderMaterial({ vertexShader: ringVertex, fragmentShader: ringFragment, uniforms: ringUniforms, transparent: true, depthTest: false, depthWrite: false });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), ringMaterial);
  water.frustumCulled = false;
  scene.add(water, mesh);
  ctx.onCleanup(() => { mesh.geometry.dispose(); material.dispose(); water.geometry.dispose(); ringMaterial.dispose(); atlas.texture.dispose(); });

  // Lay each glyph on the rect the browser gave its character: wrapping, kerning and tracking come for free.
  const layout = () => {
    const box = host.getBoundingClientRect();
    const s = parseFloat(getComputedStyle(title).fontSize) / SIZE;
    const range = document.createRange();
    const pos = []; const uvs = []; const cell = []; const delay = []; const idx = [];
    const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
    const total = title.textContent.length;
    const ht = 0.5 / atlas.w;
    const vt = 0.5 / atlas.h;
    let k = 0; let drawn = 0;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      for (let i = 0; i < node.data.length; i++, k++) {
        const c = atlas.cells.get(node.data[i]);
        if (!c) continue;
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const r = range.getClientRects()[0];
        if (!r || !r.width) continue;
        const x0 = r.left - box.left - PAD * s;
        const x1 = x0 + atlas.cw * s;
        const yTop = -(r.top - box.top - PAD * s);
        const yBot = yTop - atlas.chh * s;
        const u0 = (c.col * atlas.cw) / atlas.w; const u1 = u0 + atlas.cw / atlas.w;
        const v0 = (c.row * atlas.chh) / atlas.h; const v1 = v0 + atlas.chh / atlas.h;
        pos.push(x0, yTop, 0, x1, yTop, 0, x1, yBot, 0, x0, yBot, 0);
        uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
        for (let q = 0; q < 4; q++) { cell.push(u0 + ht, v0 + vt, u1 - ht, v1 - vt); delay.push((k / total) * 0.6); }
        const o = drawn * 4;
        idx.push(o, o + 2, o + 1, o, o + 3, o + 2);
        drawn++;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setAttribute('aCell', new THREE.Float32BufferAttribute(cell, 4));
    g.setAttribute('aDelay', new THREE.Float32BufferAttribute(delay, 1));
    g.setIndex(idx);
    mesh.geometry.dispose();
    mesh.geometry = g;
    uniforms.uTexel.value.set(1 / (s * atlas.w), 1 / (s * atlas.h));
    uniforms.uMaxDisp.value = (PAD - 4) * s;
  };

  const readColours = () => {
    uniforms.uColor.value.setStyle(cfg.tone.startsWith('#') ? cfg.tone : readToken(`--${cfg.tone}`) || readToken('--ink'));
    uniforms.uHi.value.setStyle(readToken(cfg.tone === 'accent' ? '--ink' : '--accent'));
    ringUniforms.uLine.value.setStyle(readToken('--ink'));
  };
  readColours();

  // Frames only while something moves: the reveal or a live ring. The clock subscribes on demand.
  const t0 = performance.now();
  const now = ctx.capture ? () => 10 : () => (performance.now() - t0) / 1000;
  const revealFrom = now();
  let off = null;
  let dirty = true;
  const frame = () => {
    const t = now();
    uniforms.uTime.value = t;
    let live = false;
    if (uniforms.uProgress.value < 1) {
      uniforms.uProgress.value = Math.min(1, (t - revealFrom) / 1.4);
      live = true;
    }
    for (const r of uniforms.uRings.value) if (r.w > 0 && t - r.z < cfg.life) live = true;
    renderer.render(scene, camera);
    dirty = false;
    if (!live || ctx.capture) { off?.(); off = null; }
  };
  const wake = () => { dirty = true; if (!off) off = onFrame(ctx, frame); };

  onResize(({ width, height }) => {
    camera.right = width;
    camera.bottom = -height;
    camera.updateProjectionMatrix();
    water.scale.set(width, height, 1);
    water.position.set(width / 2, -height / 2, 0);
    ringUniforms.uSize.value.set(width, height);
    layout();
    wake();
  });
  title.dataset.glOn = '';
  if (ctx.capture && ctx.motion === 'full') {
    // The thumbnail: a fixed moment (three rings of different ages off the first line) instead of a timed path.
    const box = host.getBoundingClientRect();
    const t = title.getBoundingClientRect();
    const x = t.left - box.left + t.width * 0.42;
    const y = -(t.top - box.top + t.height * 0.42);
    uniforms.uProgress.value = 1;
    [[0, 0.42, 0.8], [-220, 1.05, 0.5]].forEach(([dx, age, w], i) => uniforms.uRings.value[i].set(x + dx, y + dx * 0.2, 10 - age, w));
  }
  wake();

  // Rings: the pointer's wake (fine pointers) and one ring per press or tap (every pointer).
  let ringIndex = 0;
  let last = null;
  const local = (e) => {
    const box = host.getBoundingClientRect();
    return { x: e.clientX - box.left, y: -(e.clientY - box.top), t: performance.now() };
  };
  const emit = (p, strength) => {
    uniforms.uRings.value[ringIndex].set(p.x, p.y, now(), strength);
    ringIndex = (ringIndex + 1) % RINGS;
    wake();
  };
  if (ctx.motion === 'full' && !ctx.capture) {
    if (finePointer()) {
      on(ctx, hero, 'pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        const p = local(e);
        if (!last) { last = p; return; }
        const dist = Math.hypot(p.x - last.x, p.y - last.y);
        if (dist < 38) return;
        const speed = dist / Math.max(16, p.t - last.t) * 1000;
        emit(p, clamp(speed / 1600, 0.3, 1));
        last = p;
      }, { passive: true });
      on(ctx, hero, 'pointerleave', () => { last = null; });
    }
    on(ctx, hero, 'pointerdown', (e) => emit(local(e), 1), { passive: true });
  }
  ctx.onTheme(() => { readColours(); wake(); });
  document.fonts?.ready.then(() => { if (!ctx.signal.aborted) { layout(); wake(); } });

  return {
    update(next, changed) {
      if (changed.includes('gl')) return false;
      cfg = { ...next };
      uniforms.uAmp.value = cfg.distortion;
      uniforms.uSpeed.value = cfg.speed;
      uniforms.uLife.value = cfg.life;
      uniforms.uShimmer.value = cfg.shimmer ? 1 : 0;
      readColours();
      wake();
      return undefined;
    },
  };
}
