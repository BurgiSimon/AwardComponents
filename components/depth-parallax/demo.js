// Depth parallax — a magazine's cover photograph and masthead, alone, pinned while the page scrolls under it, with a
// shallow relief. One shader quad samples the picture and a greyscale depth map (bright near, dark far) and offsets
// each texel by (depth − focus) × the offset × strength, so near ground moves more than far sky. The offset follows a
// fine pointer, damped (k = 6), plus a vertical drift of 0.3 per viewport scrolled, which is all touch gets. No depth
// file ships: the map is made in the page from the picture itself. Frames render only while the offset settles.
// Reduced motion, static, no WebGL: the flat photograph.
import './demo.css';
import '../../src/demo-kit/serif.css';
import * as THREE from 'three';
import { on, onFrame, html, raw, clamp, smoothstep, damp, finePointer, photos, imageHTML, loadImage, content } from '../../src/demo-kit/index.js';
import { useRenderer, webglAvailable } from '../../src/demo-kit/three.js';

const vert = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const frag = /* glsl */ `
  uniform sampler2D uColor;
  uniform sampler2D uDepth;
  uniform vec4 uCover;
  uniform vec2 uOffset;
  uniform float uStrength;
  uniform float uFocus;
  uniform float uShowDepth;
  varying vec2 vUv;
  void main() {
    vec2 base = uCover.xy + vUv * uCover.zw;
    // Near texels (bright in the depth map) shift most; the focus depth holds still.
    float depth = texture2D(uDepth, base).r;
    vec2 uv = base + uOffset * uStrength * (depth - uFocus);
    vec3 col = texture2D(uColor, uv).rgb;
    gl_FragColor = vec4(mix(col, vec3(texture2D(uDepth, uv).r), uShowDepth), 1.0);
    #include <colorspace_fragment>
  }`;

// The depth map, made from the picture: far at the top, near at the bottom, a bump where the subject is, and a
// blurred luminance term (bright sky recedes, dark ground comes forward). Blurred so depth edges never tear.
function makeDepth(img, aspect, [fx, fy]) {
  const W = 192;
  const H = Math.max(2, Math.round(W / aspect));
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, W, H);
  const src = g.getImageData(0, 0, W, H);
  const lum = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) lum[i] = (src.data[i * 4] * 0.2126 + src.data[i * 4 + 1] * 0.7152 + src.data[i * 4 + 2] * 0.0722) / 255;
  const blur = (a, r) => {
    const t = new Float32Array(a.length);
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let s = 0; let n = 0;
        for (let k = -r; k <= r; k++) { const xx = pass ? x : clamp(x + k, 0, W - 1); const yy = pass ? clamp(y + k, 0, H - 1) : y; s += a[yy * W + xx]; n++; }
        t[y * W + x] = s / n;
      }
      a.set(t);
    }
    return a;
  };
  blur(lum, 6);
  const depth = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / (W - 1); const v = y / (H - 1);
    const bump = Math.exp(-(((u - fx) / 0.28) ** 2 + ((v - fy) / 0.34) ** 2));
    depth[y * W + x] = clamp(0.12 + 0.58 * smoothstep(clamp((v - 0.2) / 0.8, 0, 1)) + 0.22 * bump + 0.28 * (0.5 - lum[y * W + x]), 0, 1);
  }
  blur(depth, 4);
  const out = g.createImageData(W, H);
  for (let i = 0; i < W * H; i++) { const d = Math.round(depth[i] * 255); out.data[i * 4] = out.data[i * 4 + 1] = out.data[i * 4 + 2] = d; out.data[i * 4 + 3] = 255; }
  g.putImageData(out, 0, 0);
  return c;
}

export default async function mount(root, options, ctx) {
  const { magazine } = content;
  const [cover] = photos({ tags: ['landscape'], orientation: 'landscape', count: 1, seed: 'dp-cover' });
  let cfg = { ...options };
  root.className = 'dp';
  root.innerHTML = html`
    <section class="dp__track" aria-labelledby="dp-title">
      <div class="dp__hero" data-hero>
        <div class="dp__frame" data-frame>${raw(imageHTML(cover, { eager: true, sizes: '100vw', alt: cover.alt || 'A northern coastline under a pale autumn sky', className: 'dp__still' }))}</div>
        <div class="dp__scrim" aria-hidden="true"></div>
        <h1 class="dp__mast" id="dp-title">${magazine.name}</h1>
        <p class="ac-stage__note ac-stage__note--media"><span>${magazine.name} · cover</span></p>
      </div>
    </section>`;

  const frame = root.querySelector('[data-frame]');
  const focus = String(cover.focus || '50% 50%').split(' ').map((v) => parseFloat(v) / 100);
  const img = await loadImage(cover);
  if (ctx.signal.aborted) return {};
  const pw = Math.min(1800, cover.width || img.naturalWidth || 1200);
  const ph = Math.round(pw * ((cover.height || img.naturalHeight || 800) / (cover.width || img.naturalWidth || 1200)));
  let depthCanvas = null;
  const depthMap = () => (depthCanvas ||= makeDepth(img, pw / ph, focus));

  // Flat photograph: reduced motion, static, no WebGL. The depth aid still shows the map over it.
  if (ctx.motion !== 'full' || !webglAvailable()) {
    const showDepth = () => {
      frame.querySelector('.dp__depth')?.remove();
      if (!cfg.depth) return;
      const c = depthMap();
      const view = document.createElement('img');
      view.className = 'dp__depth';
      view.alt = '';
      view.src = c.toDataURL();
      frame.append(view);
    };
    showDepth();
    return { update(next) { cfg = { ...next }; showDepth(); } };
  }

  const { renderer, onResize } = useRenderer(ctx, frame, { alpha: false, antialias: false });
  // The picture goes through a 2D canvas: drawn stand-ins are SVG, which texImage2D will not take directly.
  const still = document.createElement('canvas');
  still.width = pw; still.height = ph;
  still.getContext('2d').drawImage(img, 0, 0, pw, ph);
  const color = new THREE.CanvasTexture(still);
  color.colorSpace = THREE.SRGBColorSpace;
  color.minFilter = THREE.LinearFilter;
  color.generateMipmaps = false;
  const depth = new THREE.CanvasTexture(depthMap());
  depth.minFilter = THREE.LinearFilter;
  depth.generateMipmaps = false;
  const material = new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, depthTest: false, depthWrite: false,
    uniforms: { uColor: { value: color }, uDepth: { value: depth }, uCover: { value: new THREE.Vector4(0, 0, 1, 1) }, uOffset: { value: new THREE.Vector2() }, uStrength: { value: cfg.strength }, uFocus: { value: cfg.focus }, uShowDepth: { value: cfg.depth ? 1 : 0 } },
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  ctx.onCleanup(() => { color.dispose(); depth.dispose(); material.dispose(); quad.geometry.dispose(); });
  root.classList.add('dp--gl');

  // object-fit: cover at the picture's focus, zoomed in by the largest offset so the edges never smear.
  const fit = () => {
    const { width: w, height: h } = renderer.getSize(new THREE.Vector2());
    const zoom = 1 - cfg.strength * 0.9;
    const ia = pw / ph; const ca = w / h;
    let sx = 1; let sy = 1;
    if (ca > ia) sy = ia / ca; else sx = ca / ia;
    sx *= zoom; sy *= zoom;
    // Texture v runs bottom-up (flipY); CSS y runs top-down.
    material.uniforms.uCover.value.set((1 - sx) * focus[0], (1 - sy) * (1 - focus[1]), sx, sy);
    frame.style.setProperty('--dp-zoom', String(1 / zoom));
  };

  const target = { x: 0, y: 0 };
  let off = null;
  const frameTick = (dt) => {
    const u = material.uniforms.uOffset.value;
    const scroll = cfg.input !== 'pointer' ? (scrollY / Math.max(1, innerHeight)) * 0.3 : 0;
    const tx = cfg.input !== 'scroll' ? target.x : 0;
    const ty = (cfg.input !== 'scroll' ? target.y : 0) + scroll;
    u.x = damp(u.x, tx, cfg.damping, dt);
    u.y = damp(u.y, ty, cfg.damping, dt);
    const settled = Math.abs(u.x - tx) < 1e-4 && Math.abs(u.y - ty) < 1e-4;
    if (settled) u.set(tx, ty);
    renderer.render(scene, camera);
    if (settled) { off?.(); off = null; }
  };
  const wake = () => { if (!off) off = onFrame(ctx, frameTick); };

  onResize(() => { fit(); wake(); });
  if (finePointer()) {
    on(ctx, window, 'pointermove', (e) => {
      target.x = (e.clientX / innerWidth - 0.5) * 2;
      target.y = -(e.clientY / innerHeight - 0.5) * 2;
      wake();
    }, { passive: true });
    on(ctx, document, 'pointerleave', () => { target.x = 0; target.y = 0; wake(); });
  }
  on(ctx, window, 'scroll', wake, { passive: true });
  fit();
  wake();

  return {
    update(next, changed) {
      cfg = { ...next };
      material.uniforms.uStrength.value = cfg.strength;
      material.uniforms.uFocus.value = cfg.focus;
      material.uniforms.uShowDepth.value = cfg.depth ? 1 : 0;
      if (changed.includes('strength')) fit();
      renderer.render(scene, camera);
      wake();
    },
  };
}
