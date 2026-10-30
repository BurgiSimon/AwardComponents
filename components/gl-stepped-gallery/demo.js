// Stepped WebGL gallery — Fieldnote's back issues as a WebGL cover-flow with one caption line between two arrows,
// driven by one float index. A spring (frequency 9.5, damping 12, ζ ≈ .63) pulls the index to a whole issue in
// fixed 1/240 s substeps; every cover's depth, scale, lift, yaw and opacity are read from its distance to that
// index, so nothing else animates. Wheel,
// keys and buttons only move the spring's target; a drag writes the index, coasts with friction and hands over.
// A wheel step detector turns any gesture (a mouse notch or a long trackpad flick) into exactly one step, and at
// either end a wheel pointing outward is left to the page. The canvas only paints: the carousel is the DOM (a
// focusable stage, a list of slides, a caption, buttons and a polite announcer). No WebGL → a DOM cover.
import './demo.css';
import '../../src/demo-kit/serif.css';
import * as THREE from 'three';
import { on, html, clamp, ticker, photo, allPhotos, loadImage, readToken, content } from '../../src/demo-kit/index.js';
import { useRenderer, webglAvailable, disposeScene } from '../../src/demo-kit/three.js';

const ISSUES = [
  { n: 14, theme: 'Weather', line: 'How to read a sky', season: 'Winter 2026', pages: 164, tags: ['sky'], ground: '--sky' },
  { n: 13, theme: 'Salt', line: 'Boiling the sea on Læsø', season: 'Autumn 2026', pages: 156, tags: ['landscape'], ground: '--sand' },
  { n: 12, theme: 'Night', line: 'The bathers of the far north', season: 'Summer 2026', pages: 148, tags: ['night'], ground: '--night' },
  { n: 11, theme: 'Timber', line: 'A house that breathes', season: 'Spring 2026', pages: 160, tags: ['architecture'], ground: '--clay' },
  { n: 10, theme: 'Water', line: 'Harbour baths, Oslo to Ålesund', season: 'Winter 2025', pages: 152, tags: ['water'], ground: '--moss' },
  { n: 9, theme: 'Light', line: 'December in a reading room', season: 'Autumn 2025', pages: 144, tags: ['interior'], ground: '--plum' },
  { n: 8, theme: 'Stone', line: 'Quarries and who closes them', season: 'Summer 2025', pages: 140, tags: ['texture'], ground: '--sand' },
  { n: 7, theme: 'Glaze', line: 'Three kilns, three bad days', season: 'Spring 2025', pages: 136, tags: ['ceramic'], ground: '--clay' },
];
const N = ISSUES.length;

// Spring on the float index: a = ω²·(target − pos) − c·v, integrated in fixed substeps so 60 and 144 Hz feel alike.
const STEP = 1 / 240;
// Drag: items per projected plate spacing, velocity smoothing and cap, friction per 60 Hz frame while coasting.
const DRAG = { threshold: 6, sensitivity: 0.95, smoothing: 0.32, maxV: 30, friction: 0.89, handoff: 2, overshoot: 0.3 };
// Wheel step detector: noise floor, per-event cap, threshold; a quiet gap re-arms; a held, non-decaying gesture
// repeats after 480 ms; a trackpad's inertia tail decays under its own envelope (550 ms) and never steps twice.
const WHEEL = { floor: 0.3, cap: 24, threshold: 6, quiet: 130, sustain: 480, envelope: 550 };
const PLATE = { w: 1.5, h: 1.95 };

function pictures() {
  const pool = allPhotos();
  const taken = new Set();
  return ISSUES.map((it) => {
    const hit = pool.find((m) => it.tags.every((t) => m.tags?.includes(t)) && !taken.has(m.id));
    if (hit) { taken.add(hit.id); return photo(hit.id); }
    return null;
  });
}

// A cover drawn in 2D: the issue's picture (or its material colour), scrims, the masthead, the issue line and the
// cover line. Colours come from the tokens; the light ink is the sand material lifted toward paper white.
function drawCover(c, it, img) {
  const g = c.getContext('2d');
  const w = c.width, h = c.height;
  const night = new THREE.Color(readToken('--night') || '#1b1d24');
  const paper = new THREE.Color(readToken('--sand') || '#e3d2b1').lerp(new THREE.Color(1, 1, 1), 0.86);
  const accent = readToken('--accent') || '#ff5420';
  const rgba = (col, a) => `rgb(${Math.round(col.r * 255)} ${Math.round(col.g * 255)} ${Math.round(col.b * 255)} / ${a})`;
  g.clearRect(0, 0, w, h);
  g.save();
  g.beginPath(); g.roundRect(0, 0, w, h, w * 0.035); g.clip();
  g.fillStyle = readToken(it.ground) || '#8db1d6';
  g.fillRect(0, 0, w, h);
  if (img && img.naturalWidth) {
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    g.drawImage(img, (w - img.naturalWidth * s) / 2, (h - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
  } else {
    // No picture: a soft horizon in the issue's material, so a cover never reads as empty.
    const rg = g.createRadialGradient(w * 0.7, h * 0.62, 0, w * 0.7, h * 0.62, w * 0.9);
    rg.addColorStop(0, rgba(paper, 0.55)); rg.addColorStop(1, rgba(paper, 0));
    g.fillStyle = rg; g.fillRect(0, 0, w, h);
  }
  let sg = g.createLinearGradient(0, 0, 0, h * 0.42);
  sg.addColorStop(0, rgba(night, 0.62)); sg.addColorStop(1, rgba(night, 0));
  g.fillStyle = sg; g.fillRect(0, 0, w, h * 0.42);
  sg = g.createLinearGradient(0, h * 0.55, 0, h);
  sg.addColorStop(0, rgba(night, 0)); sg.addColorStop(1, rgba(night, 0.7));
  g.fillStyle = sg; g.fillRect(0, h * 0.55, w, h * 0.45);
  const x = w * 0.075;
  g.fillStyle = rgba(paper, 1);
  g.textBaseline = 'alphabetic';
  g.font = `italic 600 ${Math.round(w * 0.215)}px "Bodoni Moda Variable", "Bodoni Moda", Georgia, serif`;
  g.fillText('Fieldnote', x - w * 0.01, h * 0.19);
  g.font = `500 ${Math.round(w * 0.03)}px "JetBrains Mono Variable", ui-monospace, monospace`;
  if ('letterSpacing' in g) g.letterSpacing = `${(w * 0.004).toFixed(1)}px`;
  g.fillText(`ISSUE ${it.n} — ${it.theme.toUpperCase()}`, x, h * 0.245);
  g.fillText(it.season.toUpperCase(), x, h * 0.93);
  if ('letterSpacing' in g) g.letterSpacing = '0px';
  g.fillStyle = accent;
  g.fillRect(x, h * 0.715, w * 0.06, h * 0.006);
  g.fillStyle = rgba(paper, 1);
  g.font = `700 ${Math.round(w * 0.072)}px "Mona Sans Variable", system-ui, sans-serif`;
  if ('fontStretch' in g) g.fontStretch = 'semi-expanded';
  const words = it.line.split(' ');
  const lines = [''];
  for (const wd of words) { const t = lines.at(-1) ? `${lines.at(-1)} ${wd}` : wd; if (g.measureText(t).width > w * 0.8 && lines.at(-1)) lines.push(wd); else lines[lines.length - 1] = t; }
  lines.slice(0, 2).forEach((l, k) => g.fillText(l, x, h * 0.79 + k * w * 0.085));
  if ('fontStretch' in g) g.fontStretch = 'normal';
  g.restore();
}

export default function mount(root, options, ctx) {
  const { magazine } = content;
  let cfg = { ...options };
  const instant = () => ctx.motion !== 'full';
  const pics = pictures();

  root.className = 'sg';
  root.innerHTML = html`
    <section class="sg__gallery" aria-roledescription="carousel" aria-labelledby="sg-title">
      <h2 class="sr-only" id="sg-title">${magazine.name} back issues</h2>
      <div class="sg__stage" data-stage tabindex="0" role="group" aria-label="Back issues. Arrow keys move one issue; Home and End jump to the ends.">
        <figure class="sg__still" data-still aria-hidden="true" hidden></figure>
      </div>
      <ol class="sr-only">
        ${ISSUES.map((it, i) => html`<li aria-roledescription="slide" aria-label="${i + 1} of ${N}">Issue ${it.n}, ${it.theme}: ${it.line}. ${it.season}, ${it.pages} pages.</li>`)}
      </ol>
      <div class="sg__caption">
        <button type="button" class="sg__key" data-prev aria-label="Previous issue"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg></button>
        <p class="sg__title" data-title></p>
        <button type="button" class="sg__key" data-next aria-label="Next issue"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>
      </div>
      <p class="sr-only" aria-live="polite" aria-atomic="true" data-live></p>
      <p class="ac-stage__note"><span>${magazine.name} · back issues</span></p>
    </section>`;

  const stage = root.querySelector('[data-stage]');
  const still = root.querySelector('[data-still]');
  const live = root.querySelector('[data-live]');
  const title = root.querySelector('[data-title]');

  const S = { pos: 0, v: 0, target: 0, mode: 'rest' };
  let render = () => {};
  let pxPerItem = () => stage.clientWidth * 0.35;   // replaced by the projected plate spacing once the camera exists
  let tight = 1;                                     // portrait stages pull the neighbours in so they still peek
  let drag = null;

  // The caption, the DOM still and the announcer follow the target, never the in-between index.
  function announce(i, speak = true) {
    const it = ISSUES[i];
    title.textContent = `Issue ${it.n} — ${it.theme}`;
    if (!still.hidden) still.replaceChildren(stillCover(i));
    if (speak) live.textContent = `Issue ${i + 1} of ${N}: ${it.theme}`;
  }
  const stillCover = (i) => {
    const c = document.createElement('canvas');
    c.width = 600; c.height = 780;
    drawCover(c, ISSUES[i], images[i]);
    return c;
  };

  function go(i) {
    i = clamp(i, 0, N - 1);
    const changed = i !== S.target;
    S.target = i;
    if (changed) announce(i);
    if (instant()) { S.pos = i; S.v = 0; S.mode = 'rest'; render(); return; }
    S.mode = 'spring';
    start();
  }

  // One ticker: spring (fixed substeps, stable for any dt), coast (friction), then render. Leaves the ticker at rest.
  let ticking = false;
  const start = () => { if (!ticking) { ticking = true; ticker.add(tick); } };
  const stop = () => { if (ticking) { ticking = false; ticker.remove(tick); } };
  ctx.onCleanup(stop);
  function tick(dt) {
    if (S.mode === 'coast') {
      S.v *= DRAG.friction ** (dt * 60);
      S.pos = clamp(S.pos + S.v * dt, -DRAG.overshoot, N - 1 + DRAG.overshoot);
      if (Math.abs(S.v) < DRAG.handoff) go(Math.round(clamp(S.pos, 0, N - 1)));
    } else if (S.mode === 'spring') {
      const w2 = cfg.frequency ** 2;
      for (let t = dt; t > 1e-6; t -= STEP) {
        const h = Math.min(STEP, t);
        S.v += (w2 * (S.target - S.pos) - cfg.damping * S.v) * h;
        S.pos += S.v * h;
      }
      if (Math.abs(S.target - S.pos) < 1e-4 && Math.abs(S.v) < 1e-3) { S.pos = S.target; S.v = 0; S.mode = 'rest'; }
    }
    render();
    if (S.mode === 'rest' || S.mode === 'drag') stop();
  }

  // Wheel: one gesture, one step. At an end, a wheel pointing outward belongs to the page.
  const W = { acc: 0, last: 0, lastStep: 0, armed: true, env: 0 };
  on(ctx, stage, 'wheel', (e) => {
    if (e.ctrlKey) return;
    let d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (e.deltaMode === 1) d *= 16;
    const dir = Math.sign(d);
    if ((dir < 0 && S.target === 0) || (dir > 0 && S.target === N - 1)) return;
    e.preventDefault();
    const now = e.timeStamp, mag = Math.abs(d);
    if (mag < WHEEL.floor) return;
    if (now - W.last > WHEEL.quiet) { W.acc = 0; W.armed = true; W.env = 0; }   // a new gesture
    W.env = Math.max(mag, W.env * Math.exp(-(now - W.last) / WHEEL.envelope));
    W.last = now;
    if (!W.armed && now - W.lastStep >= WHEEL.sustain && mag >= W.env * 0.95) { W.armed = true; W.acc = 0; }
    if (!W.armed) return;
    W.acc += clamp(d, -WHEEL.cap, WHEEL.cap);
    if (Math.abs(W.acc) >= WHEEL.threshold) { W.armed = false; W.acc = 0; W.lastStep = now; go(S.target + dir); }
  }, { passive: false });

  on(ctx, stage, 'keydown', (e) => {
    const to = { ArrowRight: S.target + 1, ArrowDown: S.target + 1, ArrowLeft: S.target - 1, ArrowUp: S.target - 1, Home: 0, End: N - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    go(to);
  });
  on(ctx, root.querySelector('[data-prev]'), 'click', () => go(S.target - 1));
  on(ctx, root.querySelector('[data-next]'), 'click', () => go(S.target + 1));

  on(ctx, stage, 'pointerdown', (e) => {
    if (e.button !== 0 || drag) return;
    drag = { id: e.pointerId, x: e.clientX, t: e.timeStamp, start: S.pos, moved: false, v: 0 };
  });
  on(ctx, stage, 'pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved) {
      if (Math.abs(e.clientX - drag.x) < DRAG.threshold) return;
      drag.moved = true; drag.x0 = e.clientX; drag.start = S.pos;
      stage.setPointerCapture(e.pointerId);
      root.classList.add('is-dragging');
      S.mode = 'drag'; S.v = 0;
      stop();
    }
    // The row follows the pointer: pxPerItem is the on-screen spacing of two covers, so a cover stays under the finger.
    const moved = -((e.clientX - drag.x0) / pxPerItem()) * DRAG.sensitivity;
    const prev = S.pos;
    S.pos = clamp(drag.start + moved, -DRAG.overshoot, N - 1 + DRAG.overshoot);
    const dt = Math.max(1, e.timeStamp - drag.t) / 1000;
    drag.v += (clamp((S.pos - prev) / dt, -DRAG.maxV, DRAG.maxV) - drag.v) * DRAG.smoothing;
    drag.t = e.timeStamp;
    render();
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    root.classList.remove('is-dragging');
    if (!d.moved) return;
    if (instant()) { go(Math.round(clamp(S.pos, 0, N - 1))); return; }
    S.v = e.timeStamp - d.t > 100 ? 0 : d.v;   // a pointer that rested before release has no speed
    S.mode = 'coast';
    start();
  };
  on(ctx, stage, 'pointerup', endDrag);
  on(ctx, stage, 'pointercancel', endDrag);

  // Pictures load once; each cover is redrawn when its picture (or the masthead's font) arrives.
  const images = new Array(N).fill(null);
  const redrawers = [];
  const fontsReady = Promise.all([
    document.fonts?.load('italic 600 80px "Bodoni Moda Variable"'),
    document.fonts?.load('700 40px "Mona Sans Variable"'),
    document.fonts?.load('500 20px "JetBrains Mono Variable"'),
  ]).catch(() => {});
  pics.forEach((p, i) => {
    if (!p) return;
    loadImage(p, { small: true }).then((img) => { if (ctx.signal.aborted) return; images[i] = img; redrawers.forEach((fn) => fn(i)); });
  });
  fontsReady.then(() => { if (!ctx.signal.aborted) for (let i = 0; i < N; i++) redrawers.forEach((fn) => fn(i)); });

  announce(0, false);
  ctx.onTheme(() => { for (let i = 0; i < N; i++) redrawers.forEach((fn) => fn(i)); });
  const instance = {
    update(next) { cfg = { ...next }; render(); },
    action(id) {
      if (id !== 'next') return;
      go(S.target === N - 1 ? 0 : S.target + 1);
      // The frame: settle on the cover at once, since a headless clock may not finish the spring in the wait.
      if (ctx.capture) { S.pos = S.target; S.v = 0; S.mode = 'rest'; render(); }
    },
  };

  if (!webglAvailable()) {
    still.hidden = false;
    still.replaceChildren(stillCover(0));
    redrawers.push((i) => { if (i === S.target) still.replaceChildren(stillCover(i)); });
    return instance;
  }

  // --- WebGL row ---------------------------------------------------------------------------------------------
  const { renderer, onResize } = useRenderer(ctx, stage, { alpha: true });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.set(0, 0, 7);
  const row = new THREE.Group();
  row.rotation.set(0.1, -0.12, -0.05);   // a gentle tilt so depth reads
  scene.add(row);
  const geo = new THREE.PlaneGeometry(PLATE.w, PLATE.h);
  const plates = ISSUES.map((it, i) => {
    const c = document.createElement('canvas');
    c.width = 600; c.height = 780;
    drawCover(c, it, null);
    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map, transparent: true }));
    m.userData.canvas = c;
    row.add(m);
    return m;
  });
  redrawers.push((i) => {
    const m = plates[i];
    drawCover(m.userData.canvas, ISSUES[i], images[i]);
    m.material.map.needsUpdate = true;
    render();
  });
  ctx.onCleanup(() => disposeScene(scene));

  // Every cover's transform is a function of its distance to the float index; nothing else is animated.
  render = () => {
    plates.forEach((m, i) => {
      const d = i - S.pos;
      const a = Math.min(1, Math.abs(d));
      m.position.set(d * cfg.spacing * tight, 0.12 * (1 - a), -Math.abs(d) * cfg.depth);
      m.scale.setScalar(1 - 0.2 * a);
      m.rotation.y = -clamp(d, -2, 2) * cfg.yaw;
      m.material.opacity = 1 - 0.4 * Math.min(1, Math.max(0, Math.abs(d) - 1));
      m.renderOrder = -Math.round(Math.abs(d) * 10);
    });
    renderer.render(scene, camera);
  };
  onResize(({ width, height }) => {
    camera.aspect = width / height;
    // The camera backs off until the active cover fills at most 62 % of the stage's height and 56 % of its width.
    const fit = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.z = Math.max(PLATE.h / (0.62 * fit), PLATE.w / (0.56 * fit * camera.aspect));
    camera.updateProjectionMatrix();
    const visibleW = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    tight = camera.aspect < 1 ? 0.7 : 1;
    pxPerItem = () => ((cfg.spacing * tight) / visibleW) * stage.clientWidth;
    render();
  });
  return instance;
}
