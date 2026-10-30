// Glass lens — a magazine's "Weather" cover word and a hailstone of glass that reads it, alone on the stage, with two
// more words below for the glass to travel to. The words and hairlines around the glass are painted again into a
// square 2D canvas (only that square, snapped to 48 px, repainted at most every 30 ms); a back-face pass writes the
// glass's exit normals into a small target; the front face refracts in through its own normal and out through the
// back one at twelve wavelengths (six on touch), weighted into red, green and blue, then adds a Fresnel reflection
// of an analytic studio. Each word's stage names an anchor; the glass follows their weighted mean on a stiff spring
// (46, damped just under critical). Reduced motion: placed at the anchor, no travel or spin, still refracting.
// Static or no WebGL: no glass.
import './demo.css';
import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { on, onFrame, html, clamp, finePointer, observeResize, content } from '../../src/demo-kit/index.js';
import { useRenderer, webglAvailable } from '../../src/demo-kit/three.js';

const SPRING = 46;
const DAMP = 2 * Math.sqrt(SPRING) * 0.94; // stiff and just under critical: it arrives without drifting past
const BAND = [0.25, 0.75]; // sections weigh by their overlap with the middle half of the viewport
const SPIN = 0.25;

const VERT = /* glsl */ `
  varying vec3 vN; varying vec3 vViewPos;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mv.xyz; vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }`;
const BACK_FRAG = /* glsl */ `
  varying vec3 vN; varying vec3 vViewPos;
  void main() { gl_FragColor = vec4(normalize(vN) * 0.5 + 0.5, 1.0); }`;
const FRONT_FRAG = (taps) => /* glsl */ `
  #define TAPS ${taps}
  uniform sampler2D tBack; uniform sampler2D tBackN; uniform vec2 uBufInv; uniform vec2 uView; uniform float uDpr;
  uniform vec3 uReg; uniform float uIor; uniform float uSpread; uniform float uThick; uniform float uTime; uniform float uDark;
  varying vec3 vN; varying vec3 vViewPos;
  float softBox(vec3 R, vec3 dir, vec2 size, float soft) {
    float facing = dot(R, dir);
    if (facing <= 0.0) return 0.0;
    vec3 up = abs(dir.y) > 0.99 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
    vec3 u = normalize(cross(up, dir)), v = cross(dir, u);
    vec2 q = vec2(dot(R, u), dot(R, v)) / facing;
    vec2 d = abs(q) - size;
    return 1.0 - smoothstep(-soft, soft, length(max(d, 0.0)) + min(max(d.x, d.y), 0.0));
  }
  vec3 studio(vec3 R) {
    vec3 c = mix(vec3(0.08), vec3(0.97), smoothstep(-0.4, 0.9, R.y)) * mix(0.3, 0.12, uDark);
    // The key drifts slowly, so highlights travel over the facets even when the glass is still.
    c += 4.0 * softBox(R, normalize(vec3(-0.45 + 0.12 * sin(uTime * 0.21), 0.62, 0.65 + 0.1 * cos(uTime * 0.17))), vec2(0.3, 0.12), 0.05);
    c += 7.0 * softBox(R, normalize(vec3(0.7, 0.15, 0.7)), vec2(0.03, 0.85), 0.02);
    c += 4.0 * softBox(R, normalize(vec3(0.1, -0.6, 0.8)), vec2(0.4, 0.05), 0.04);
    return c;
  }
  void main() {
    vec3 N = normalize(vN);
    vec3 V = normalize(-vViewPos);
    float ndv = clamp(dot(N, V), 0.0, 1.0);
    vec2 css = vec2(gl_FragCoord.x / uDpr, uView.y - gl_FragCoord.y / uDpr);
    vec3 Nb = normalize(texture2D(tBackN, gl_FragCoord.xy * uBufInv).xyz * 2.0 - 1.0);
    vec3 acc = vec3(0.0), wsum = vec3(0.0);
    for (int i = 0; i < TAPS; i++) {
      float t = float(i) / float(TAPS - 1);
      float ior = uIor - (t - 0.5) * uSpread; // red (t high) bends least
      vec3 r1 = refract(-V, N, 1.0 / ior);
      vec3 r2 = refract(r1, -Nb, ior);
      if (dot(r2, r2) < 1e-4) r2 = r1; // total internal reflection: keep the entry bend
      vec2 bend = r2.xy + V.xy; // deviation from the straight-through ray
      vec2 p = css + vec2(bend.x, -bend.y) * uThick;
      vec2 uv = (p - uReg.xy) / uReg.z;
      vec3 s = texture2D(tBack, vec2(uv.x, 1.0 - uv.y)).rgb;
      vec3 wv = exp(-pow(vec3(t) - vec3(0.8, 0.5, 0.2), vec3(2.0)) / (2.0 * 0.19 * 0.19));
      acc += s * wv; wsum += wv;
    }
    vec3 refr = acc / wsum;
    refr = mix(refr, vec3(mix(0.96, 0.7, uDark)), 0.03 + 0.14 * pow(1.0 - ndv, 2.0)); // a little frost toward the rims
    float F = 0.06 + 0.94 * pow(1.0 - ndv, 4.0);
    gl_FragColor = vec4(mix(refr, studio(reflect(-V, N)), F), 1.0);
    #include <colorspace_fragment>
  }`;

// Three bodies of glass: a carved crystal, a smooth drop and a dispersing prism.
function glassGeometry(shape) {
  if (shape === 'drop') {
    const g = new THREE.SphereGeometry(1, 48, 32);
    g.scale(0.82, 1.05, 0.7);
    return g;
  }
  if (shape === 'prism') {
    const g = new THREE.CylinderGeometry(0.95, 0.95, 1.9, 3, 1).toNonIndexed();
    g.computeVertexNormals();
    return g;
  }
  // Seeded points on an elongated ellipsoid plus two tips: an irregular gem with flat facets.
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const pts = [new THREE.Vector3(0, 1.3, 0.05), new THREE.Vector3(0.05, -1.25, -0.05)];
  for (let i = 0; i < 18; i++) {
    const u = rnd() * Math.PI * 2;
    const v = Math.acos(2 * rnd() - 1);
    pts.push(new THREE.Vector3(Math.sin(v) * Math.cos(u) * 0.8, Math.cos(v) * 1.05, Math.sin(v) * Math.sin(u) * 0.66).multiplyScalar(0.9 + rnd() * 0.15));
  }
  return new ConvexGeometry(pts);
}

export default function mount(root, options, ctx) {
  const { magazine } = content;
  let cfg = { ...options };
  root.className = 'gk';
  root.innerHTML = html`
    <div class="gk__cols" aria-hidden="true">${Array.from({ length: 12 }, () => html`<i></i>`)}</div>
    <section class="ac-stage gk__block" data-anchor="0.74,0.5,0.34" data-anchor-sm="0.72,0.5,0.3" aria-labelledby="gk-title">
      <h1 class="gk__display" id="gk-title" data-paint>Weather</h1>
      <p class="ac-stage__note"><span data-paint>${magazine.name} · issue cover</span></p>
    </section>
    <section class="ac-stage gk__block" data-anchor="0.37,0.5,0.24" data-anchor-sm="0.34,0.5,0.26">
      <h2 class="gk__display" data-paint>Salt</h2>
    </section>
    <section class="ac-stage gk__block" data-anchor="0.63,0.5,0.24" data-anchor-sm="0.66,0.5,0.26">
      <h2 class="gk__display" data-paint>Light</h2>
    </section>`;

  if (ctx.motion === 'static' || !webglAvailable()) {
    root.classList.add('gk--dom');
    return { update(next) { cfg = { ...next }; } };
  }

  const full = ctx.motion === 'full';
  const coarse = !finePointer();
  const taps = coarse ? 6 : 12;
  const host = document.createElement('div');
  host.className = 'gk__gl';
  host.setAttribute('aria-hidden', 'true');
  root.append(host);
  const { renderer, onResize } = useRenderer(ctx, host, { alpha: true });
  renderer.setClearColor(0x000000, 0);
  const sections = [...root.querySelectorAll('[data-anchor]')];

  // The back texture: a square 2D canvas repainted with the page around the glass.
  const BACK = coarse ? 512 : 1024;
  const back = document.createElement('canvas');
  back.width = back.height = BACK;
  const bctx = back.getContext('2d');
  const backTex = new THREE.CanvasTexture(back);
  backTex.colorSpace = THREE.SRGBColorSpace;
  backTex.minFilter = THREE.LinearFilter;
  backTex.generateMipmaps = false;
  const normalRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true, generateMipmaps: false });

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 5000);
  camera.position.z = 1600;
  let geo = glassGeometry(cfg.shape);
  const backMat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: BACK_FRAG, side: THREE.BackSide });
  const U = {
    tBack: { value: backTex }, tBackN: { value: normalRT.texture }, uBufInv: { value: new THREE.Vector2() }, uView: { value: new THREE.Vector2() },
    uDpr: { value: 1 }, uReg: { value: new THREE.Vector3() }, uIor: { value: cfg.ior }, uSpread: { value: cfg.dispersion },
    uThick: { value: 100 }, uTime: { value: 0 }, uDark: { value: 0 },
  };
  const frontMat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRONT_FRAG(taps), uniforms: U });
  const mesh = new THREE.Mesh(geo, frontMat);
  scene.add(mesh);
  ctx.onCleanup(() => { geo.dispose(); backMat.dispose(); frontMat.dispose(); backTex.dispose(); normalRT.dispose(); });

  // What the back texture needs from the page: every painted word's box (document coordinates) and the hairlines.
  let words = [];
  let cols = [];
  let ground = '#f4f4f1';
  let rule = 'rgba(18,18,17,0.1)';
  const stretchKeyword = (pct) => (pct >= 122 ? 'expanded' : pct >= 108 ? 'semi-expanded' : pct <= 80 ? 'condensed' : pct <= 92 ? 'semi-condensed' : 'normal');
  const measurePage = () => {
    words = [];
    const rcs = getComputedStyle(root);
    ground = getComputedStyle(document.body).backgroundColor;
    const firstCol = root.querySelector('.gk__cols i');
    rule = firstCol ? getComputedStyle(firstCol).borderLeftColor : rule;
    cols = [...root.querySelectorAll('.gk__cols i')].filter((i) => i.offsetParent !== null).flatMap((i, n, all) => {
      const r = i.getBoundingClientRect();
      return n === all.length - 1 ? [r.left, r.right - 1] : [r.left];
    });
    const range = document.createRange();
    for (const el of root.querySelectorAll('[data-paint]')) {
      const st = getComputedStyle(el);
      const upper = st.textTransform === 'uppercase';
      const font = `${st.fontStyle} ${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
      const stretch = stretchKeyword(parseFloat(st.fontStretch) || 100);
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const re = /\S+/g;
        let m;
        while ((m = re.exec(node.data))) {
          range.setStart(node, m.index);
          range.setEnd(node, m.index + m[0].length);
          const r = range.getBoundingClientRect();
          if (!r.width) continue;
          words.push({ text: upper ? m[0].toUpperCase() : m[0], x: r.left, y: r.top + scrollY, w: r.width, h: r.height, font, stretch, color: st.color, ls: st.letterSpacing });
        }
      }
    }
    U.uDark.value = rcs.colorScheme === 'dark' || document.documentElement.dataset.theme === 'dark' ? 1 : 0;
    lastPaint = '';
  };
  const paintBack = (rx, ry, rs) => {
    const k = BACK / rs;
    bctx.setTransform(k, 0, 0, k, -rx * k, -ry * k);
    bctx.fillStyle = ground;
    bctx.fillRect(rx, ry, rs, rs);
    bctx.fillStyle = rule;
    for (const x of cols) if (x >= rx - 1 && x <= rx + rs) bctx.fillRect(x, ry, 1, rs);
    bctx.textBaseline = 'middle';
    for (const wd of words) {
      const y = wd.y - scrollY;
      if (wd.x > rx + rs || wd.x + wd.w < rx || y > ry + rs || y + wd.h < ry) continue;
      bctx.font = wd.font;
      bctx.fontStretch = wd.stretch;
      bctx.fillStyle = wd.color;
      bctx.letterSpacing = wd.ls === 'normal' ? '0px' : wd.ls;
      bctx.fillText(wd.text, wd.x, y + wd.h / 2);
    }
    backTex.needsUpdate = true;
  };

  // The glass's state: position and radius in CSS px, their spring velocities, the spin and the pointer tilt.
  const st = { x: 0, y: 0, r: 0, tx: 0, ty: 0, tr: 0, rotY: 0.6 };
  const vel = { x: 0, y: 0, r: 0 };
  const pointer = { x: 0, y: 0, tiltX: 0, tiltY: 0 };
  let W = 1;
  let H = 1;
  let lastPaint = '';
  let lastPaintAt = 0;
  let lastScroll = scrollY;
  let scrollVel = 0;
  let time = 0;
  let off = null;

  const targetFromAnchors = () => {
    let sw = 0;
    let tx = 0;
    let ty = 0;
    let tr = 0;
    const lo = BAND[0] * H;
    const hi = BAND[1] * H;
    const short = Math.min(W, H);
    for (const s of sections) {
      const r = s.getBoundingClientRect();
      const wgt = Math.max(0, Math.min(r.bottom, hi) - Math.max(r.top, lo)) / (hi - lo);
      if (wgt <= 0) continue;
      const [ax, ay, as] = ((W < 760 && s.dataset.anchorSm) || s.dataset.anchor).split(',').map(Number);
      sw += wgt;
      tx += wgt * ax * W;
      ty += wgt * ay * H;
      tr += wgt * as * short * 0.5 * (W < 760 ? 1.35 : 1) * cfg.size;
    }
    if (sw > 0) { st.tx = tx / sw; st.ty = ty / sw; st.tr = tr / sw; }
  };

  onResize(({ width, height }) => {
    W = width;
    H = height;
    camera.aspect = W / H;
    camera.fov = (2 * Math.atan(H / 2 / camera.position.z) * 180) / Math.PI; // one unit is one CSS px at z = 0
    camera.updateProjectionMatrix();
    const pr = renderer.getPixelRatio();
    normalRT.setSize(Math.max(1, Math.round(W * pr * 0.6)), Math.max(1, Math.round(H * pr * 0.6)));
    U.uBufInv.value.set(1 / (W * pr), 1 / (H * pr));
    U.uView.value.set(W, H);
    U.uDpr.value = pr;
    measurePage();
    targetFromAnchors();
    wake();
  });
  observeResize(ctx, root, () => { measurePage(); wake(); });
  document.fonts?.ready.then(() => { if (!ctx.signal.aborted) { measurePage(); wake(); } });
  ctx.onTheme(() => { measurePage(); wake(); });
  if (full && !coarse) {
    on(ctx, window, 'pointermove', (e) => { pointer.x = e.clientX / W - 0.5; pointer.y = e.clientY / H - 0.5; wake(); }, { passive: true });
  }
  on(ctx, window, 'scroll', () => wake(), { passive: true });

  const render = (now) => {
    // Region: a square around the glass, big enough for the refracted offsets, snapped to 48 px steps.
    const rs = Math.min(0.75 * Math.max(W, H), Math.ceil((2 * (st.r * 2 + 8)) / 48) * 48);
    const rx = Math.round(st.x - rs / 2);
    const ry = Math.round(st.y - rs / 2);
    const key = `${rx},${ry},${rs},${Math.round(scrollY)}`;
    if (key !== lastPaint && now - lastPaintAt > (Math.abs(scrollVel) > 250 ? 12 : 30)) { paintBack(rx, ry, rs); lastPaint = key; lastPaintAt = now; }
    U.uReg.value.set(rx, ry, rs);
    U.uThick.value = st.r * 0.45;
    mesh.position.set(st.x - W / 2, H / 2 - st.y, 0);
    mesh.scale.setScalar(st.r);
    mesh.rotation.set(0.35 + pointer.tiltY, st.rotY, 0.12 + pointer.tiltX);
    mesh.material = backMat;
    renderer.setRenderTarget(normalRT);
    renderer.clear();
    renderer.render(scene, camera);
    mesh.material = frontMat;
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
    return key !== lastPaint; // a repaint still owed (throttled): keep the loop awake
  };

  targetFromAnchors();
  st.x = st.tx;
  st.y = st.ty;
  st.r = st.tr;

  function frame(dt, now) {
    time += dt;
    U.uTime.value = full ? time : 0;
    scrollVel = (scrollY - lastScroll) / Math.max(dt, 1e-3);
    lastScroll = scrollY;
    targetFromAnchors();
    let moving = false;
    if (full) {
      // The spring integrates real time in fixed 1/120 s steps: a slow frame neither slows it nor blows it up.
      const steps = Math.max(1, Math.ceil(dt * 120));
      const h = dt / steps;
      for (let n = 0; n < steps; n++) {
        for (const k of ['x', 'y', 'r']) {
          vel[k] += (SPRING * (st[`t${k}`] - st[k]) - DAMP * vel[k]) * h;
          st[k] += vel[k] * h;
        }
      }
      const spin = cfg.spin ? SPIN : 0;
      st.rotY += (spin + clamp(scrollVel * 8e-4, -1.6, 1.6)) * dt;
      pointer.tiltX += (pointer.x * 0.5 - pointer.tiltX) * (1 - Math.exp(-4 * dt));
      pointer.tiltY += (pointer.y * 0.45 - pointer.tiltY) * (1 - Math.exp(-4 * dt));
      const settled = Math.abs(vel.x) + Math.abs(vel.y) + Math.abs(vel.r) < 0.05 && Math.hypot(st.tx - st.x, st.ty - st.y) < 0.2;
      const tilting = Math.abs(pointer.x * 0.5 - pointer.tiltX) + Math.abs(pointer.y * 0.45 - pointer.tiltY) > 1e-3;
      moving = cfg.spin || !settled || tilting || Math.abs(scrollVel) > 1;
    } else {
      // Reduced motion: placed at its anchor, never travelling, never spinning.
      st.x = st.tx;
      st.y = st.ty;
      st.r = st.tr;
    }
    const owed = render(now);
    if (!moving && !owed) { off?.(); off = null; }
  }
  function wake() { if (!off) off = onFrame(ctx, frame); }
  wake();

  return {
    update(next, changed) {
      cfg = { ...next };
      U.uIor.value = cfg.ior;
      U.uSpread.value = cfg.dispersion;
      if (changed.includes('shape')) {
        geo.dispose();
        geo = glassGeometry(cfg.shape);
        mesh.geometry = geo;
      }
      wake();
    },
  };
}
