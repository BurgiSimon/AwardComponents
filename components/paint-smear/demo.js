// Paint smear — a magazine's weather issue cover, alone on the stage, smeared by the pointer like a hand across wet
// glass. No fluid solver: the pointer paints a capsule stroke into a quarter-resolution field (velocity around 0.5
// in xy, a slow and a fast weight in zw), the field advects itself along a blurred sixteenth-resolution copy of its
// own velocity and curls through gradient noise, and one post pass smears the cover along it with an oil-film
// fringe where the stroke thins out. Everything is scaled per second; the loop sleeps once the field has decayed to
// exactly zero. Coarse pointers paint only while a finger is down. Reduced motion and no WebGL: the cover as a
// still picture.
import './demo.css';
import '../../src/demo-kit/serif.css';
import * as THREE from 'three';
import { on, ticker, whileVisible, later, html, readToken, photos, loadImage, content } from '../../src/demo-kit/index.js';
import { useRenderer, webglAvailable } from '../../src/demo-kit/three.js';

// The recipe's field constants; brush, trail, curl and fringe come from the controls.
const P = { radiusRange: 100, push: 25, curlScale: 0.06, velocityKeep: 0.985, weightFastKeep: 0.75, accelKeep: 0.8, speedScale: 0.0006, amount: 20, multiplier: 5, rgbShift: 0.5, shade: 1.25, maxTap: 8, sleepAfter: 4.5 };

const vert = /* glsl */ 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const paintFrag = /* glsl */ `
  precision highp float;
  uniform sampler2D uPrev; uniform sampler2D uLow; uniform vec2 uTexel;
  uniform vec4 uFrom; uniform vec4 uTo; uniform vec2 uVel; uniform vec3 uKeep;
  uniform float uPush; uniform float uCurlScale; uniform float uCurlStrength; uniform float uFrames;
  varying vec2 vUv;
  vec2 sdSegment(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0); return vec2(length(pa - ba * h), h); }
  vec2 hash2(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy) * 2.0 - 1.0; }
  // Gradient noise with its analytic derivative (value in x, gradient in yz): the gradient is the curl source.
  vec3 noised(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
    vec2 ga = hash2(i), gb = hash2(i + vec2(1.0, 0.0)), gc = hash2(i + vec2(0.0, 1.0)), gd = hash2(i + vec2(1.0, 1.0));
    float va = dot(ga, f), vb = dot(gb, f - vec2(1.0, 0.0)), vc = dot(gc, f - vec2(0.0, 1.0)), vd = dot(gd, f - vec2(1.0, 1.0));
    return vec3(va + u.x * (vb - va) + u.y * (vc - va) + u.x * u.y * (va - vb - vc + vd),
      ga + u.x * (gb - ga) + u.y * (gc - ga) + u.x * u.y * (ga - gb - gc + gd) + du * (u.yx * (va - vb - vc + vd) + vec2(vb, vc) - va));
  }
  void main() {
    vec2 seg = sdSegment(gl_FragCoord.xy, uFrom.xy, uTo.xy);
    vec2 rw = mix(uFrom.zw, uTo.zw, seg.y);
    float inside = 1.0 - smoothstep(-0.01, rw.x, seg.x);
    vec4 low = texture2D(uLow, vUv);
    vec2 back = (0.5 - low.xy) * uPush * uFrames;
    vec3 n1 = noised(gl_FragCoord.xy * uCurlScale * (1.0 - low.xy));
    vec2 curl = noised(gl_FragCoord.xy * uCurlScale * (2.0 - low.xy * (0.5 + n1.x)) + n1.yz * 0.1).yz;
    back += curl * (low.z + low.w) * uCurlStrength * uFrames;
    vec4 data = texture2D(uPrev, vUv + back * uTexel);
    data.xy -= 0.5;
    vec4 delta = (uKeep.xxyz - 1.0) * data;
    delta += vec4(uVel * inside, rw.yy * inside);
    delta.zw = sign(delta.zw) * max(vec2(0.004 * uFrames), abs(delta.zw)); // 8-bit storage: never stall a hair above zero
    data += delta;
    data.xy += 0.5;
    gl_FragColor = clamp(data, 0.0, 1.0);
  }`;
const blurFrag = /* glsl */ `
  precision highp float;
  uniform sampler2D uTex; uniform vec2 uDelta; varying vec2 vUv;
  void main() {
    vec4 c = texture2D(uTex, vUv) * 0.2270270270;
    c += (texture2D(uTex, vUv + uDelta * 1.3846153846) + texture2D(uTex, vUv - uDelta * 1.3846153846)) * 0.3162162162;
    c += (texture2D(uTex, vUv + uDelta * 3.2307692308) + texture2D(uTex, vUv - uDelta * 3.2307692308)) * 0.0702702703;
    gl_FragColor = c;
  }`;
const smearFrag = /* glsl */ `
  precision highp float;
  uniform sampler2D uScene; uniform sampler2D uPaint; uniform vec2 uPaintTexel; uniform vec2 uSize; uniform float uMaxTap;
  uniform float uAmount; uniform float uMultiplier; uniform float uRgbShift; uniform float uColorMul; uniform float uShade;
  varying vec2 vUv;
  void main() {
    vec4 data = texture2D(uPaint, vUv);
    float weight = (data.z + data.w) * 0.5;
    vec2 vel = (0.5 - data.xy - 0.001) * 2.0 * weight;
    vec2 step = vel * uAmount / 4.0 * uPaintTexel * uMultiplier;
    step *= min(1.0, uMaxTap / max(length(step * uSize), 1e-5));
    float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))); // interleaved gradient noise
    vec2 uv = vUv + jitter * step;
    vec4 color = vec4(0.0);
    for (int i = 0; i < 9; i++) { color += texture2D(uScene, uv); uv += step; }
    color /= 9.0;
    // An oil-film fringe where the stroke is thinning, scaled by how fast it moves there.
    color.rgb += sin(vec3(vel.x + vel.y) * 40.0 + vec3(0.0, 2.0, 4.0) * uRgbShift) * smoothstep(0.4, -0.9, weight) * uShade * max(abs(vel.x), abs(vel.y)) * uColorMul;
    gl_FragColor = vec4(max(color.rgb, 0.0), 1.0);
    #include <colorspace_fragment>
  }`;

// A token's hex with an alpha, for canvas gradients.
const rgba = (hex, a) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0x808080;
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

// The cover: the issue's photograph under a weather map (isobars, a low, two fronts), the masthead and cover lines.
// Drawn in a 2D canvas, used as the smear's scene texture and, without WebGL or under reduced motion, shown as is.
function drawCover(canvas, w, h, scale, img, issue) {
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const g = canvas.getContext('2d');
  g.setTransform(scale, 0, 0, scale, 0, 0);
  const sky = readToken('--sky') || '#8db1d6';
  const night = readToken('--night') || '#1b1d24';
  const accent = readToken('--accent') || '#f94c16';
  const serif = '"Bodoni Moda Variable", "Bodoni Moda", Didot, Georgia, serif';
  const mono = '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, monospace';
  const u = w / 100; // cover units: 1u = 1 % of the width

  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  if (img?.naturalWidth) {
    const k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const iw = img.naturalWidth * k;
    const ih = img.naturalHeight * k;
    g.globalAlpha = 0.85;
    g.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
    g.globalAlpha = 1;
  }
  // A rain-sky wash: sky at the top, night at the foot, so white type reads everywhere.
  const wash = g.createLinearGradient(0, 0, 0, h);
  wash.addColorStop(0, rgba(sky, 0.7));
  wash.addColorStop(0.55, rgba(night, 0.35));
  wash.addColorStop(1, rgba(night, 0.82));
  g.fillStyle = wash;
  g.fillRect(0, 0, w, h);

  // Isobars around a low, labelled every other line.
  const cx = w * 0.6;
  const cy = h * 0.5;
  g.strokeStyle = 'rgba(255,255,255,0.72)';
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.font = `500 ${2.3 * u}px ${mono}`;
  for (let i = 1; i <= 9; i++) {
    const r = i * 8.5 * u;
    g.lineWidth = i % 2 ? 0.25 * u : 0.4 * u;
    g.beginPath();
    for (let a = 0; a <= 120; a++) {
      const t = (a / 120) * Math.PI * 2;
      const rr = r * (1 + 0.16 * Math.sin(2 * t + i * 0.4) + 0.07 * Math.sin(5 * t - i));
      const x = cx + Math.cos(t) * rr * 1.18;
      const y = cy + Math.sin(t) * rr * 0.9;
      if (a) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.stroke();
    if (i % 2 === 0) g.fillText(String(988 + i * 4), cx + r * 1.18 * 0.72, cy - r * 0.9 * 0.62);
  }
  // Fronts: a cold front with triangles, a warm front with half-discs, both leaving the low.
  const front = (pts, kind, colour) => {
    g.strokeStyle = colour;
    g.fillStyle = colour;
    g.lineWidth = 0.7 * u;
    g.beginPath();
    pts.forEach(([x, y], k) => (k ? g.lineTo(x * w, y * h) : g.moveTo(x * w, y * h)));
    g.stroke();
    for (let k = 0; k < pts.length - 1; k++) {
      const [x0, y0] = pts[k];
      const [x1, y1] = pts[k + 1];
      const mx = ((x0 + x1) / 2) * w;
      const my = ((y0 + y1) / 2) * h;
      const ang = Math.atan2((y1 - y0) * h, (x1 - x0) * w);
      g.save();
      g.translate(mx, my);
      g.rotate(ang);
      g.beginPath();
      if (kind === 'cold') { g.moveTo(-1.6 * u, 0); g.lineTo(0, -2.6 * u); g.lineTo(1.6 * u, 0); } else g.arc(0, 0, 1.7 * u, Math.PI, 0);
      g.fill();
      g.restore();
    }
  };
  front([[0.6, 0.5], [0.5, 0.6], [0.41, 0.66], [0.3, 0.74], [0.2, 0.79]], 'cold', sky);
  front([[0.6, 0.5], [0.71, 0.58], [0.8, 0.62], [0.92, 0.63]], 'warm', accent);
  g.fillStyle = accent;
  g.font = `800 ${10 * u}px "Mona Sans Variable", "Mona Sans", system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('L', cx, cy);

  // Masthead, issue line, cover lines, a barcode.
  g.fillStyle = '#fff';
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.font = `600 ${19 * u}px ${serif}`;
  g.fillText(issue.name, 6 * u, 21 * u);
  g.font = `500 ${2.4 * u}px ${mono}`;
  g.fillText(issue.line.toUpperCase(), 6.4 * u, 27.5 * u);
  g.font = `italic 500 ${7.4 * u}px ${serif}`;
  g.fillText('Weather', 6 * u, h - 30 * u);
  g.font = `500 ${3.4 * u}px "Mona Sans Variable", "Mona Sans", system-ui, sans-serif`;
  issue.lines.forEach((line, k) => g.fillText(line, 6.4 * u, h - 22 * u + k * 5 * u));
  g.fillStyle = '#fff';
  g.fillRect(w - 20 * u, h - 13 * u, 14 * u, 7 * u);
  g.fillStyle = night;
  for (let k = 0, x = w - 19 * u; x < w - 7 * u; k++) { const bw = (k % 3 === 0 ? 0.6 : 0.3) * u; g.fillRect(x, h - 12 * u, bw, 5 * u); x += bw + (k % 2 ? 0.5 : 0.35) * u; }
  return canvas;
}

export default function mount(root, options, ctx) {
  const { magazine } = content;
  let cfg = { ...options };
  const stories = magazine.articles.filter((a) => ['salt-and-time', 'night-swimming', 'map-of-light'].includes(a.slug));
  const issue = { name: magazine.name, line: `${magazine.issue.replace(' — ', ' · ')} · Autumn 2026`, lines: [`${stories[0].title} — ${stories[0].author}`, `${stories[1].title}, after dark`, 'Charting December light'] };
  const pic = photos({ tags: ['sky'], count: 1, seed: 'ps-cover' })[0];
  root.className = 'pz';
  root.innerHTML = html`
    <section class="ac-stage" aria-label="${magazine.name} cover">
      <figure class="pz__cover" data-cover>
        <div class="pz__stage" data-stage></div>
        <figcaption class="sr-only">Cover of ${magazine.name}, ${magazine.issue}: a weather map with isobars around a low, over a rainy sky. Cover lines: ${issue.lines.join('; ')}.</figcaption>
      </figure>
      <p class="ac-stage__note"><span>${magazine.name} · cover</span></p>
    </section>`;

  const cover = root.querySelector('[data-cover]');
  const stage = root.querySelector('[data-stage]');
  const coverCanvas = document.createElement('canvas');
  let photo = null;
  const coverSize = () => {
    const r = stage.getBoundingClientRect();
    return { w: Math.max(1, Math.round(r.width)), h: Math.max(1, Math.round(r.height)) };
  };
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  // The masthead is drawn in Bodoni Moda, which no DOM text on the stage uses, so the browser would never fetch it:
  // ask for both faces, then redraw once they (and the rest of the type) are in.
  const fontsReady = document.fonts
    ? Promise.all([document.fonts.ready, ...['600 1em', 'italic 500 1em'].map((f) => document.fonts.load(`${f} "Bodoni Moda Variable"`))]).catch(() => {})
    : Promise.resolve();

  // The still: the cover canvas itself, shown in place of the field.
  if (!webglAvailable() || ctx.motion !== 'full') {
    coverCanvas.setAttribute('aria-hidden', 'true');
    coverCanvas.className = 'pz__still';
    stage.append(coverCanvas);
    const redraw = () => { const { w, h } = coverSize(); drawCover(coverCanvas, w, h, scale, photo, issue); };
    redraw();
    loadImage(pic).then((img) => { photo = img; if (!ctx.signal.aborted) redraw(); });
    fontsReady.then(() => { if (!ctx.signal.aborted) redraw(); });
    ctx.onTheme(redraw);
    let t = 0;
    on(ctx, window, 'resize', () => { clearTimeout(t); t = setTimeout(redraw, 150); });
    ctx.onCleanup(() => clearTimeout(t));
    return { update(next) { cfg = { ...next }; } };
  }

  const { renderer, canvas, onResize } = useRenderer(ctx, stage, { alpha: false, antialias: false });
  canvas.style.touchAction = 'pan-y';
  const byte = { type: THREE.UnsignedByteType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false, generateMipmaps: false };
  let paintA = new THREE.WebGLRenderTarget(1, 1, byte);
  let paintB = new THREE.WebGLRenderTarget(1, 1, byte);
  const lowA = new THREE.WebGLRenderTarget(1, 1, byte);
  const lowB = new THREE.WebGLRenderTarget(1, 1, byte);
  const flat = { vertexShader: vert, depthTest: false, depthWrite: false };
  const paintMat = new THREE.ShaderMaterial({ ...flat, fragmentShader: paintFrag, uniforms: {
    uPrev: { value: null }, uLow: { value: lowB.texture }, uTexel: { value: new THREE.Vector2() },
    uFrom: { value: new THREE.Vector4() }, uTo: { value: new THREE.Vector4() }, uVel: { value: new THREE.Vector2() },
    uKeep: { value: new THREE.Vector3() }, uPush: { value: P.push }, uCurlScale: { value: P.curlScale }, uCurlStrength: { value: cfg.curl }, uFrames: { value: 1 } } });
  const blurMat = new THREE.ShaderMaterial({ ...flat, fragmentShader: blurFrag, uniforms: { uTex: { value: null }, uDelta: { value: new THREE.Vector2() } } });
  const smearMat = new THREE.ShaderMaterial({ ...flat, fragmentShader: smearFrag, uniforms: {
    uScene: { value: null }, uPaint: { value: null }, uPaintTexel: { value: new THREE.Vector2() }, uSize: { value: new THREE.Vector2(1, 1) }, uMaxTap: { value: P.maxTap },
    uAmount: { value: P.amount }, uMultiplier: { value: P.multiplier }, uRgbShift: { value: P.rgbShift }, uColorMul: { value: cfg.fringe }, uShade: { value: P.shade } } });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), paintMat);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const pass = (mat, target) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(scene, cam); };
  const clearTo = (rt) => { renderer.setRenderTarget(rt); renderer.setClearColor(new THREE.Color(0.5, 0.5, 0), 0); renderer.clear(); };
  let coverTex = null;
  ctx.onCleanup(() => { for (const o of [paintA, paintB, lowA, lowB, quad.geometry, paintMat, blurMat, smearMat, coverTex]) o?.dispose(); });

  let w = 1;
  let h = 1;
  let idle = 0;
  let running = false;
  let visible = false;
  const paintCover = () => {
    drawCover(coverCanvas, w, h, scale, photo, issue);
    if (!coverTex) {
      coverTex = new THREE.CanvasTexture(coverCanvas);
      coverTex.colorSpace = THREE.SRGBColorSpace;
      coverTex.minFilter = THREE.LinearFilter;
      coverTex.generateMipmaps = false;
      smearMat.uniforms.uScene.value = coverTex;
    } else {
      coverTex.dispose(); // the canvas may have changed size; a fresh upload avoids a stale allocation
      coverTex.needsUpdate = true;
    }
    wake();
  };
  onResize(({ width, height }) => {
    w = width;
    h = height;
    const pw = Math.max(1, w >> 2);
    const ph = Math.max(1, h >> 2);
    for (const rt of [paintA, paintB]) rt.setSize(pw, ph);
    for (const rt of [lowA, lowB]) rt.setSize(Math.max(1, w >> 4), Math.max(1, h >> 4));
    for (const rt of [paintA, paintB, lowA, lowB]) clearTo(rt);
    renderer.setRenderTarget(null);
    paintMat.uniforms.uTexel.value.set(1 / pw, 1 / ph);
    smearMat.uniforms.uPaintTexel.value.set(1 / pw, 1 / ph);
    smearMat.uniforms.uSize.value.set(w, h);
    paintCover();
  });
  loadImage(pic).then((img) => { photo = img; if (!ctx.signal.aborted) paintCover(); });
  fontsReady.then(() => { if (!ctx.signal.aborted) paintCover(); });
  ctx.onTheme(paintCover);

  // Pointer, in cover-local CSS px. `moved` resets each frame so a resting pointer paints nothing.
  const coarse = matchMedia('(pointer: coarse)').matches;
  const ptr = { x: -1, y: -1, px: -1, py: -1, seen: false, moved: false, down: false };
  let touched = false;
  const onMove = (e) => {
    const r = stage.getBoundingClientRect();
    ptr.x = e.clientX - r.left;
    ptr.y = e.clientY - r.top;
    if (!ptr.seen) { ptr.px = ptr.x; ptr.py = ptr.y; ptr.seen = true; }
    ptr.moved = true;
    if (ptr.x > 0 && ptr.y > 0 && ptr.x < r.width && ptr.y < r.height) { touched = true; wake(); }
  };
  on(ctx, window, 'pointermove', onMove, { passive: true });
  on(ctx, window, 'pointerdown', (e) => { ptr.down = true; onMove(e); ptr.px = ptr.x; ptr.py = ptr.y; }, { passive: true });
  on(ctx, window, 'pointerup', () => { ptr.down = false; }, { passive: true });
  on(ctx, window, 'pointercancel', () => { ptr.down = false; }, { passive: true });

  // A scripted wipe (on load, and the "Smear the cover" action): a fast S across the cover, through the same brush.
  let script = null;
  const scriptAt = (u) => ({ x: w * (0.1 + 0.8 * u), y: h * (0.24 + 0.22 * u + Math.sin(u * Math.PI * 2) * 0.1) });

  const from = paintMat.uniforms.uFrom.value;
  const to = paintMat.uniforms.uTo.value;
  const vel = paintMat.uniforms.uVel.value;
  const push = new THREE.Vector2();
  // One field step: the stroke from the last applied position to `ptr`, then the paint pass and the two-pass blur.
  const step = (dt, radius) => {
    const pw = paintA.width;
    const ph = paintA.height;
    from.copy(to);
    to.set((ptr.x / w) * pw, (1 - ptr.y / h) * ph, (radius / h) * ph, 1);
    // Per second, not per frame: the velocity input is a speed and every keep is raised to this step's length.
    const frames = Math.min(Math.max(dt * 60, 0.05), 3);
    push.set(to.x - from.x, to.y - from.y).multiplyScalar(P.speedScale / Math.max(dt, 1 / 240));
    vel.lerp(push, 1 - P.accelKeep ** frames).clampLength(0, 0.45);
    paintMat.uniforms.uKeep.value.set(P.velocityKeep ** frames, cfg.trail ** frames, P.weightFastKeep ** frames);
    paintMat.uniforms.uFrames.value = frames;
    ptr.px = ptr.x;
    ptr.py = ptr.y;
    paintMat.uniforms.uPrev.value = paintA.texture;
    paintMat.uniforms.uLow.value = lowB.texture;
    pass(paintMat, paintB);
    [paintA, paintB] = [paintB, paintA];
    blurMat.uniforms.uTex.value = paintA.texture;
    blurMat.uniforms.uDelta.value.set((4 / lowA.width) * 0.25, 0);
    pass(blurMat, lowA);
    blurMat.uniforms.uTex.value = lowA.texture;
    blurMat.uniforms.uDelta.value.set(0, (4 / lowB.height) * 0.25);
    pass(blurMat, lowB);
  };
  const frame = (dt) => {
    let painted = false;
    if (script) {
      // The scripted stroke is sub-stepped (field passes are small), so it keeps its shape at any frame rate.
      const u = Math.min(1, (performance.now() - script.start) / script.ms);
      if (!script.seen) { const p0 = scriptAt(0); ptr.x = ptr.px = p0.x; ptr.y = ptr.py = p0.y; to.set((ptr.x / w) * paintA.width, (1 - ptr.y / h) * paintA.height, 0, 1); script.seen = true; }
      const steps = Math.min(12, Math.max(1, Math.ceil((u - script.u) / 0.025)));
      for (let k = 1; k <= steps; k++) {
        const p = scriptAt(script.u + ((u - script.u) * k) / steps);
        ptr.x = p.x;
        ptr.y = p.y;
        step(dt / steps, cfg.brush * 0.7);
      }
      script.u = u;
      painted = true;
      if (u >= 1) script = null;
    } else {
      let radius = 0;
      if (ptr.seen && ptr.moved && (!coarse || ptr.down)) {
        // Radius from the pointer's speed: 0 → brush as it moves 0 → 100 px per 60 Hz frame (6,000 px/s).
        const speed = Math.hypot(ptr.x - ptr.px, ptr.y - ptr.py) / Math.max(dt, 1 / 240);
        radius = Math.min(cfg.brush, (speed / (P.radiusRange * 60)) * cfg.brush);
      }
      step(dt, radius);
      painted = radius > 0;
    }
    ptr.moved = false;
    smearMat.uniforms.uPaint.value = paintA.texture;
    pass(smearMat, null);
    // Every weight falls by at least 0.004 per 60 Hz frame, so 4.5 s without a stroke means the field is exactly zero.
    idle = painted ? 0 : idle + dt;
    if (idle > P.sleepAfter) sleep();
  };
  const sleep = () => { if (running) { ticker.remove(frame); running = false; } };
  function wake() { idle = 0; if (!running && visible) { running = true; ticker.add(frame); } }
  whileVisible(ctx, cover, () => { visible = true; wake(); }, () => { visible = false; sleep(); });
  ctx.onCleanup(sleep);

  const smear = () => { script = { start: performance.now(), ms: 800, seen: false, u: 0 }; wake(); };
  later(ctx, () => { if (!touched) smear(); }, 900);

  return {
    update(next) {
      cfg = { ...next };
      paintMat.uniforms.uCurlStrength.value = cfg.curl;
      smearMat.uniforms.uColorMul.value = cfg.fringe;
      return true;
    },
    action(id) { if (id === 'smear') { touched = true; smear(); } },
  };
}
