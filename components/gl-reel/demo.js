// Endless reel — Signal's past editions as a full-bleed reel that never ends, with a row of year labels under it.
// The document does not scroll: wheel, touch and keys move a virtual offset (in items, so a resize never loses the
// place), and one canvas draws every edition as a segmented sheet on a modulo-wrapped belt: d = mod(i − offset + N/2, N) − N/2, so 2019 follows 2026. A wheel burst
// (≥ 40 px after a 30 ms gap, 500 ms after the last) is doubled and released over frames; a trackpad stream moves the
// target directly. 200 ms after the last input the target rounds to an edition, the drawn offset follows by
// damp(k = 6), and its velocity drives one uniform, uBend = clamp(v / 4) · sin(π·p): the sheets twist and fold in
// transit and lie exactly flat at rest. The button list is the index, the keyboard path and the fallback.
// Reduced: flat sheets, one snapped step per input. Static or no WebGL: a plain page of the editions.
import './demo.css';
import * as THREE from 'three';
import { on, html, raw, damp, clamp, ticker, photo, allPhotos, loadImage, readToken, qualityTier, content } from '../../src/demo-kit/index.js';
import { useRenderer, webglAvailable, disposeScene } from '../../src/demo-kit/three.js';

const EDITIONS = [
  { year: 2026, title: 'Four stages for the first time', head: 'Marlow Ash', tags: ['night'] },
  { year: 2025, title: 'The Greenhouse opens', head: 'Kiri Tanaka', tags: ['people'] },
  { year: 2024, title: 'Hall 4, all night', head: 'The Low Tides', tags: ['city'] },
  { year: 2023, title: 'The heat-wave edition', head: 'Odessa Rae', tags: ['water'] },
  { year: 2022, title: 'Back on the quay', head: 'Nils & the Weather', tags: ['architecture'] },
  { year: 2021, title: 'Streamed from the crane', head: 'Juno Park', tags: ['sky'] },
  { year: 2020, title: 'A radio week instead', head: 'Vesper Choir', tags: ['interior'] },
  { year: 2019, title: 'The first summer, one stage', head: 'Sundial', tags: ['landscape'] },
];
const N = EDITIONS.length;
const GROUNDS = ['--plum', '--clay', '--night', '--sky', '--moss', '--sand', '--clay', '--plum'];

const WHEEL = 1.25;          // wheel px multiplier; deltaMode lines × 16
const BURST = { min: 40, gap: 30, cooldown: 500, gain: 2, k: 0.22, maxFrames: 4 };
const K_FOLLOW = 6;          // damping of the drawn offset toward the target
const VMAX = 4;              // items per second at which the bend saturates
const TWIST = 0.55, WAVE = 0.16;   // radians across half a sheet; fold depth as a share of half the sheet
const STEP_COOLDOWN = 350;   // reduced tier: one step per wheel gesture
const ASPECT = 1024 / 586;
const mod = (a, n) => ((a % n) + n) % n;
const pad = (n) => String(n).padStart(2, '0');

const vertex = /* glsl */ `
  uniform vec2 uSize;      // sheet size in px
  uniform float uVertical; // 0: the reel runs along x, 1: along y
  uniform float uBend;     // signed; |velocity| / VMAX · sin(π·p), exactly zero at rest
  uniform float uTwist;
  uniform float uWave;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec2 q = position.xy * uSize;
    float along = mix(q.x, q.y, uVertical);
    float across = mix(q.y, q.x, uVertical);
    float half_ = mix(uSize.x, uSize.y, uVertical) * 0.5;
    float t = along / half_;                       // -1 … 1 along the direction of travel
    float a = uBend * uTwist * t;                  // twist about the travel axis, growing toward the ends
    float z = across * sin(a) + sin(t * 3.14159) * uBend * uWave * half_;   // plus one fold along the sheet
    across *= cos(a);
    vec3 p = vec3(mix(along, across, uVertical), mix(across, along, uVertical), z);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;
const fragment = /* glsl */ `
  uniform sampler2D uMap;
  varying vec2 vUv;
  void main() {
    gl_FragColor = texture2D(uMap, vUv);
    if (gl_FragColor.a < 0.01) discard;
    #include <colorspace_fragment>
  }`;

function pictures() {
  const pool = allPhotos();
  const taken = new Set();
  return EDITIONS.map((e) => {
    const hit = pool.find((m) => e.tags.every((t) => m.tags?.includes(t)) && !taken.has(m.id));
    if (hit) { taken.add(hit.id); return photo(hit.id); }
    return null;
  });
}

// A sheet drawn in 2D: the edition's picture (or its material field), a scrim, the year and a credit line. Rounded
// corners are transparent pixels. Colours come from the tokens; the light ink is sand lifted toward paper white.
function drawSheet(c, e, i, img) {
  const g = c.getContext('2d');
  const w = c.width, h = c.height;
  const night = new THREE.Color(readToken('--night') || '#1b1d24');
  const paper = new THREE.Color(readToken('--sand') || '#e3d2b1').lerp(new THREE.Color(1, 1, 1), 0.86);
  const rgba = (col, a) => `rgb(${Math.round(col.r * 255)} ${Math.round(col.g * 255)} ${Math.round(col.b * 255)} / ${a})`;
  g.clearRect(0, 0, w, h);
  g.save();
  g.beginPath(); g.roundRect(0, 0, w, h, 26); g.clip();
  g.fillStyle = readToken(GROUNDS[i]) || '#6b4968';
  g.fillRect(0, 0, w, h);
  if (img && img.naturalWidth) {
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    g.drawImage(img, (w - img.naturalWidth * s) / 2, (h - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
  } else {
    const rg = g.createRadialGradient(w * 0.72, h * 0.3, 0, w * 0.72, h * 0.3, w * 0.7);
    rg.addColorStop(0, rgba(paper, 0.5)); rg.addColorStop(1, rgba(paper, 0));
    g.fillStyle = rg; g.fillRect(0, 0, w, h);
  }
  const sg = g.createLinearGradient(0, h * 0.35, 0, h);
  sg.addColorStop(0, rgba(night, 0)); sg.addColorStop(1, rgba(night, 0.72));
  g.fillStyle = sg; g.fillRect(0, 0, w, h);
  g.fillStyle = rgba(paper, 1);
  g.font = `760 ${Math.round(h * 0.27)}px "Mona Sans Variable", system-ui, sans-serif`;
  if ('fontStretch' in g) g.fontStretch = 'expanded';
  if ('letterSpacing' in g) g.letterSpacing = `${-(h * 0.008).toFixed(1)}px`;
  g.textBaseline = 'alphabetic';
  g.fillText(String(e.year), w * 0.045, h * 0.9);
  if ('letterSpacing' in g) g.letterSpacing = `${(h * 0.005).toFixed(1)}px`;
  if ('fontStretch' in g) g.fontStretch = 'normal';
  g.font = `500 ${Math.round(h * 0.036)}px "JetBrains Mono Variable", ui-monospace, monospace`;
  g.textAlign = 'right';
  g.fillText(`SIGNAL ${e.year} · ${e.head.toUpperCase()}`, w * 0.955, h * 0.9);
  g.fillText(pad(i + 1), w * 0.955, h * 0.1);
  if ('letterSpacing' in g) g.letterSpacing = '0px';
  g.restore();
}

export default function mount(root, options, ctx) {
  const { festival } = content;
  let cfg = { ...options };
  const pics = pictures();
  const reel = ctx.motion !== 'static' && webglAvailable();
  const full = () => ctx.motion === 'full';

  root.className = `rl${reel ? ' rl--reel' : ' rl--list'}`;
  root.innerHTML = html`
    <section class="rl__reel" aria-labelledby="rl-title">
      <h2 class="sr-only" id="rl-title">${festival.name} editions, ${EDITIONS[N - 1].year}–${EDITIONS[0].year}</h2>
      <div class="rl__stage" data-stage></div>
      <p class="sr-only" aria-live="polite" data-counter></p>
      <nav class="rl__index ac-wrap" aria-label="Editions">
        <ol class="rl__works" role="list">
          ${EDITIONS.map((e, i) => (reel
    ? html`<li><button type="button" class="rl__work" data-work="${i}"><span class="rl__n ac-label">${e.year}</span><span class="rl__t">${e.title}</span></button></li>`
    : html`<li><a class="rl__work" href="#signal-${e.year}" data-work="${i}"><span class="rl__thumb ac-media" aria-hidden="true">${raw(pics[i] ? `<img src="${pics[i].srcSm || pics[i].src}" alt="" loading="lazy" decoding="async">` : '')}</span><span class="rl__n ac-label">${e.year} · ${e.head}</span><span class="rl__t">${e.title}</span></a></li>`))}
        </ol>
      </nav>
      <p class="ac-stage__note rl__note"><span>${festival.name} · archive</span></p>
    </section>`;
  root.querySelectorAll('a[href^="#"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));   // the demo has no routes

  const stage = root.querySelector('[data-stage]');
  const counter = root.querySelector('[data-counter]');
  const buttons = [...root.querySelectorAll('[data-work]')];
  let announced = -1;
  function announce(i) {
    buttons.forEach((b, j) => (j === i ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current')));
    counter.textContent = `${pad(i + 1)} / ${pad(N)} · ${EDITIONS[i].year} · ${EDITIONS[i].title}`;
    announced = i;
  }

  // Static or no WebGL: the editions as a plain page; nothing draws, nothing listens.
  if (!reel) {
    pics.forEach((p, i) => { if (!p) buttons[i].querySelector('.rl__thumb')?.style.setProperty('--g', `var(${GROUNDS[i]})`); });
    return { update(next) { cfg = { ...next }; } };
  }

  const S = { target: 0, offset: 0, pending: 0, velocity: 0, axis: 'x' };
  let lastInput = 0, lastWheel = 0, lastBurst = -1e9, lastStep = -1e9, touch = null;
  const moving = () => S.pending !== 0 || S.offset !== S.target || S.velocity !== 0;
  let pitch = () => 1;

  // Input only ever writes the target (or the burst reservoir); the frame loop wakes and follows.
  function step(dir) {
    S.pending = 0;
    S.target = Math.round(S.target) + dir;
    if (!full()) S.offset = S.target;   // reduced: the step lands now, no easing
    lastInput = performance.now();
    wake();
  }
  // Go to edition i by the shortest way round the loop.
  const goTo = (i) => step(mod(i - Math.round(S.target) + N / 2, N) - N / 2);

  on(ctx, window, 'wheel', (e) => {
    if (e.ctrlKey) return;
    e.preventDefault();
    let d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    d *= e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
    d *= WHEEL;
    const now = performance.now();
    lastInput = now;
    if (!full()) { if (Math.abs(d) >= 4 && now - lastStep > STEP_COOLDOWN) { lastStep = now; step(Math.sign(d)); } return; }
    // A burst is a discrete flick (a mouse notch after a pause), not a trackpad stream: amplify it, spread it over frames.
    const burst = Math.abs(d) >= BURST.min && now - lastWheel >= BURST.gap && now - lastBurst >= BURST.cooldown;
    lastWheel = now;
    if (burst) { lastBurst = now; S.pending += (d * BURST.gain) / pitch(); } else S.target += d / pitch();
    wake();
  }, { passive: false });
  const axisOf = (t) => t[S.axis === 'x' ? 'clientX' : 'clientY'];
  on(ctx, stage, 'touchstart', (e) => { touch = axisOf(e.touches[0]); }, { passive: true });
  on(ctx, stage, 'touchmove', (e) => {
    if (touch == null) return;
    const c = axisOf(e.touches[0]);
    if (full()) { S.target += ((touch - c) * 1.5) / pitch(); touch = c; wake(); }
    lastInput = performance.now();
  }, { passive: true });
  on(ctx, stage, 'touchend', (e) => {
    if (touch == null) return;
    const c = axisOf(e.changedTouches[0]);
    if (!full() && Math.abs(touch - c) > 40) step(Math.sign(touch - c));   // reduced: one swipe, one step
    touch = null;
  });
  on(ctx, window, 'keydown', (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey || e.target.closest?.('input, textarea, select')) return;
    const onControl = e.target.closest?.('button, a');
    if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); goTo(e.key === 'Home' ? 0 : N - 1); return; }
    const dir = { ArrowRight: 1, ArrowDown: 1, PageDown: 1, ArrowLeft: -1, ArrowUp: -1, PageUp: -1, ' ': e.shiftKey ? -1 : 1 }[e.key];
    if (dir === undefined || (e.key === ' ' && onControl)) return;   // Space on a button presses the button
    e.preventDefault();
    step(dir);
  });
  buttons.forEach((b, i) => {
    on(ctx, b, 'click', () => goTo(i));
    on(ctx, b, 'focus', () => { if (mod(Math.round(S.target), N) !== i) goTo(i); });
  });

  // --- WebGL ------------------------------------------------------------------------------------------------
  const tier = qualityTier();
  const { renderer, onResize } = useRenderer(ctx, stage, { alpha: false });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 10, 5000);
  const DIST = 1200;   // one world unit is one CSS pixel at z = 0
  const [sx, sy] = tier.name === 'high' ? [48, 24] : tier.name === 'mid' ? [32, 12] : [24, 8];
  const geometry = new THREE.PlaneGeometry(1, 1, sx, sy);
  const sheets = EDITIONS.map((e, i) => {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 586;
    drawSheet(c, e, i, null);
    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    const material = new THREE.ShaderMaterial({
      vertexShader: vertex, fragmentShader: fragment, side: THREE.DoubleSide,
      uniforms: { uMap: { value: map }, uSize: { value: new THREE.Vector2() }, uVertical: { value: 0 }, uBend: { value: 0 }, uTwist: { value: TWIST }, uWave: { value: WAVE } },
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    return { mesh, material, canvas: c, map };
  });
  ctx.onCleanup(() => disposeScene(scene));
  const clear = () => renderer.setClearColor(new THREE.Color(readToken('--bg') || '#f4f4f1'), 1);
  clear();

  const images = new Array(N).fill(null);
  const redraw = (i) => { drawSheet(sheets[i].canvas, EDITIONS[i], i, images[i]); sheets[i].map.needsUpdate = true; };
  pics.forEach((p, i) => { if (p) loadImage(p).then((img) => { if (ctx.signal.aborted) return; images[i] = img; redraw(i); draw(); }); });
  Promise.all([document.fonts?.load('760 80px "Mona Sans Variable"'), document.fonts?.load('500 20px "JetBrains Mono Variable"')]).catch(() => {})
    .then(() => { if (!ctx.signal.aborted) { sheets.forEach((_, i) => redraw(i)); draw(); } });

  const card = { w: 0, h: 0, pitch: 1, cy: 0 };
  let W = 1, H = 1;
  const layoutCard = () => {
    const top = 24;
    const bottom = root.querySelector('.rl__index').offsetHeight + 24;
    const room = Math.max(160, H - top - bottom);
    S.axis = cfg.orientation === 'auto' ? (W > H * 0.9 ? 'x' : 'y') : cfg.orientation === 'vertical' ? 'y' : 'x';
    if (S.axis === 'x') {
      card.h = Math.min(H * 0.435, room * 0.86, 880);
      card.w = card.h * ASPECT;
      card.pitch = card.w + Math.max(24, W * 0.03);
    } else {
      card.w = Math.min(W - 32, room * 0.9 * ASPECT);
      card.h = card.w / ASPECT;
      card.pitch = card.h + 24;
    }
    // The belt runs through the middle of the room between the chrome, not the middle of the canvas.
    card.cy = (bottom - top) / 2;
    for (const s of sheets) { s.material.uniforms.uSize.value.set(card.w, card.h); s.material.uniforms.uVertical.value = S.axis === 'y' ? 1 : 0; }
    root.dataset.axis = S.axis;
  };
  pitch = () => card.pitch;

  function layout() {
    const span = S.axis === 'x' ? W + card.w : H + card.h;   // one transit: enters at p = 0, centred at .5, gone at 1
    const vNorm = full() ? clamp(S.velocity / VMAX, -1, 1) : 0;
    sheets.forEach((s, i) => {
      // The modulo wrap: every sheet sits within half a loop of the offset, so the first follows the last.
      const pos = (mod(i - S.offset + N / 2, N) - N / 2) * card.pitch;
      const p = clamp((pos + span / 2) / span, 0, 1);
      s.mesh.visible = p > 0 && p < 1;
      s.mesh.position.set(S.axis === 'x' ? pos : 0, S.axis === 'x' ? card.cy : card.cy - pos, 0);
      s.material.uniforms.uBend.value = vNorm * Math.sin(Math.PI * p);
      s.material.uniforms.uTwist.value = TWIST * cfg.bend;
      s.material.uniforms.uWave.value = WAVE * cfg.bend;
    });
  }
  function draw() { layout(); renderer.render(scene, camera); }

  onResize(({ width, height }) => {
    W = width; H = height;
    camera.aspect = W / H;
    camera.fov = 2 * Math.atan(H / 2 / DIST) * (180 / Math.PI);
    camera.position.z = DIST;
    camera.updateProjectionMatrix();
    layoutCard();
    draw();
  });

  // One clock, subscribed only while the belt moves: bursts release, the target snaps, the offset follows.
  let ticking = false;
  function wake() { if (!ticking) { ticking = true; ticker.add(frame); } }
  const sleep = () => { if (ticking) { ticking = false; ticker.remove(frame); } };
  ctx.onCleanup(sleep);
  function frame(dt) {
    const now = performance.now();
    if (full()) {
      // 1. Release the burst reservoir at 1 − (1 − k)^frames, at most four frames' worth per tick.
      if (S.pending) {
        const r = S.pending * (1 - Math.pow(1 - BURST.k, Math.min(BURST.maxFrames, dt * 60)));
        S.target += r; S.pending -= r;
        if (Math.abs(S.pending) < 1e-4) { S.target += S.pending; S.pending = 0; }
        lastInput = now;
      }
      // 2. Snap to the nearest edition once input stops.
      if (!S.pending && now - lastInput > cfg.snap) S.target = Math.round(S.target);
      // 3. The drawn offset follows; its velocity (items / s) drives the bend.
      const prev = S.offset;
      S.offset = damp(S.offset, S.target, K_FOLLOW, dt);
      if (Math.abs(S.offset - S.target) < 1e-4) S.offset = S.target;
      S.velocity = damp(S.velocity, (S.offset - prev) / Math.max(dt, 1e-3), 12, dt);
      if (Math.abs(S.velocity) < 0.01 && S.offset === S.target) S.velocity = 0;
    } else { S.offset = S.target; S.velocity = 0; S.pending = 0; }
    draw();
    const index = mod(Math.round(S.offset), N);
    // The counter is a polite live region: it changes only when the reel comes to rest.
    const resting = !moving() && S.target === Math.round(S.target);
    if (resting && index !== announced) announce(index);
    if (resting) sleep();
  }

  announce(0);
  ctx.onTheme(() => { clear(); sheets.forEach((_, i) => redraw(i)); draw(); });

  return {
    update(next, changed) {
      cfg = { ...next };
      if (changed.includes('orientation')) layoutCard();
      draw();
    },
    action(id) {
      if (id !== 'next') return;
      step(1);
      // The thumbnail: hold the belt mid-transit, where the bend is easiest to read.
      if (ctx.capture && full()) {
        sleep();
        S.offset = Math.round(S.target) - 0.42; S.velocity = VMAX * 0.85; S.pending = 0;
        draw();
        announce(mod(Math.round(S.target), N));
      }
    },
  };
}
