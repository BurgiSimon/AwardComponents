// Turned object — a ceramics shop's "shape your vase" configurator. The vase is built, not downloaded: one profile
// (a foot, a belly, a neck and a lip, plus throwing rings as a cosine ripple faded by sin πt so the ends stay put)
// is spun by LatheGeometry with a wall thickness and an open top. Its normal and roughness maps come from one
// self-contained builder run in an inline Blob worker, with a same-thread fallback if the worker throws, errors or
// misses a 1.5 s deadline. After a 250 ms dwell a mouse gets exactly one quantised revolution, set to a whole turn
// on its last frame so repeated hovers never drift. Frames render only on change or during a turn.
// Reduced motion: the hover tints instead of turning. No WebGL: an SVG silhouette drawn from the same profile.
import './demo.css';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { on, onFrame, html, readToken, colour, finePointer, content, formatPrice } from '../../src/demo-kit/index.js';
import { useRenderer, webglAvailable, disposeScene } from '../../src/demo-kit/three.js';

const TAU = Math.PI * 2;
const POINTS = 64;
const WALL = 0.05; // wall thickness in scene units (1 unit = 10 cm)
const GLAZES = [
  { id: 'sand', name: 'Oat' },
  { id: 'clay', name: 'Rust' },
  { id: 'moss', name: 'Celadon' },
  { id: 'sky', name: 'Fjord' },
  { id: 'plum', name: 'Heather' },
];
const SHAPE = [
  { id: 'height', label: 'Height', min: 18, max: 40, step: 1, value: 32, unit: 'cm' },
  { id: 'belly', label: 'Belly', min: 10, max: 22, step: 0.5, value: 14, unit: 'cm' },
  { id: 'neck', label: 'Neck', min: 5, max: 12, step: 0.5, value: 7, unit: 'cm' },
  { id: 'lip', label: 'Lip flare', min: 0, max: 3, step: 0.1, value: 1, unit: 'cm' },
  { id: 'ripple', label: 'Throwing rings', min: 0, max: 6, step: 0.5, value: 2, unit: 'mm' },
];

// One self-contained builder (no outer references): stringified into the worker, and called directly as the fallback.
// Height field: fine throwing grooves along the profile (v), optional flutes around it (u).
function buildMaps(w, h, flutes, grooves) {
  const height = (x, y) => {
    const u = (((x % w) + w) % w) / w;
    const v = Math.min(h - 1, Math.max(0, y)) / h;
    const groove = grooves ? 0.5 + 0.5 * Math.sin(v * Math.PI * 2 * 46) : 0.5;
    const flute = flutes ? Math.max(0, 1 - Math.abs(((u * flutes) % 1) - 0.5) * 6) : 0;
    return groove * 0.22 + flute * 0.9;
  };
  const normal = new Uint8Array(w * h * 4);
  const rough = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (height(x + 1, y) - height(x - 1, y)) * 2;
      const dy = (height(x, y + 1) - height(x, y - 1)) * 2;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      normal[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      normal[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      normal[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      normal[i + 3] = 255;
      const g = (0.42 - Math.min(1, height(x, y)) * 0.22) * 255; // glaze pools in the grooves: smoother on the ridges
      rough[i] = rough[i + 1] = rough[i + 2] = g;
      rough[i + 3] = 255;
    }
  }
  return { normal, rough };
}

function mapsInWorker(w, h, flutes, grooves) {
  return new Promise((resolve, reject) => {
    const src = `const buildMaps = ${buildMaps.toString()};\nonmessage = (e) => { const m = buildMaps(e.data.w, e.data.h, e.data.flutes, e.data.grooves); postMessage(m, [m.normal.buffer, m.rough.buffer]); };`;
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    let worker;
    let timer = 0;
    const done = (fn, arg) => { clearTimeout(timer); worker?.terminate(); URL.revokeObjectURL(url); fn(arg); };
    timer = setTimeout(() => done(reject, new Error('worker timeout')), 1500);
    try { worker = new Worker(url); } catch (e) { done(reject, e); return; }
    worker.onmessage = (e) => done(resolve, e.data);
    worker.onerror = (e) => { e.preventDefault(); done(reject, new Error('worker error')); };
    worker.postMessage({ w, h, flutes, grooves });
  });
}

// The profile in scene units (bottom to top) from the configurator's centimetres and the ring count.
const smooth = (a, b, t) => { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
function outline(s, rings) {
  const H = s.height / 10;
  const belly = s.belly / 20;
  const neck = s.neck / 20;
  const foot = belly * 0.62;
  const lip = s.lip / 10;
  const ripple = s.ripple / 100;
  return Array.from({ length: POINTS }, (_, i) => {
    const t = i / (POINTS - 1);
    let r = t < 0.36 ? foot + (belly - foot) * smooth(0, 0.36, t) : t < 0.8 ? belly + (neck - belly) * smooth(0.36, 0.8, t) : neck + lip * smooth(0.8, 1, t) ** 1.6;
    r += ripple * Math.cos(TAU * rings * t) * Math.sin(Math.PI * t);
    return [Math.max(0.05, r), t * H];
  });
}
// The full lathe profile: across the base, up the outside, over a rounded rim and down the inside to the floor.
function lathePoints(s, rings) {
  const out = outline(s, rings);
  const [rt, top] = out.at(-1);
  const pts = [[0, 0], [out[0][0] - 0.02, 0], ...out.map(([r, y], i) => (i === 0 ? [r, y + 0.02] : [r, y]))];
  for (let k = 1; k < 6; k++) { const a = (k / 6) * Math.PI; pts.push([rt - WALL / 2 + Math.cos(a) * (WALL / 2), top + Math.sin(a) * (WALL / 2)]); }
  for (let i = out.length - 1; i >= 4; i--) pts.push([Math.max(0.02, out[i][0] - WALL), out[i][1]]);
  pts.push([0, out[4][1]]);
  return pts.map(([r, y]) => new THREE.Vector2(r, y));
}
// The same outline as an SVG silhouette, for browsers without WebGL.
function silhouette(s, rings) {
  const out = outline(s, rings);
  const k = 100;
  const right = out.map(([r, y]) => `${(200 + r * k).toFixed(1)},${(420 - y * k).toFixed(1)}`);
  const left = out.slice().reverse().map(([r, y]) => `${(200 - r * k).toFixed(1)},${(420 - y * k).toFixed(1)}`);
  const [rt, top] = out.at(-1);
  return `<svg viewBox="0 0 400 440" aria-hidden="true"><defs><linearGradient id="lo-g" x1="0" x2="1"><stop offset="0" stop-color="var(--lo-glaze)" stop-opacity=".7"/><stop offset=".4" stop-color="var(--lo-glaze)"/><stop offset="1" stop-color="var(--lo-glaze)" stop-opacity=".55"/></linearGradient></defs><ellipse cx="200" cy="422" rx="${(out[0][0] * k * 1.3).toFixed(1)}" ry="8" fill="currentColor" opacity=".14"/><path d="M${right.join(' L')} L${left.join(' L')} Z" fill="url(#lo-g)"/><ellipse cx="200" cy="${(420 - top * k).toFixed(1)}" rx="${(rt * k).toFixed(1)}" ry="${(rt * k * 0.18).toFixed(1)}" fill="var(--lo-glaze)" opacity=".7"/></svg>`;
}

export default function mount(root, options, ctx) {
  const { shop } = content;
  const vase = shop.products.find((p) => p.id === 'tide-vase');
  let cfg = { ...options };
  const shape = Object.fromEntries(SHAPE.map((c) => [c.id, c.value]));
  const price = () => Math.max(98, Math.round(vase.price + (shape.height - 32) * 4 + (shape.belly - 14) * 3 + shape.lip * 6));

  root.className = 'lo';
  root.innerHTML = html`
    <section class="lo__wrap ac-wrap" aria-labelledby="lo-title">
      <figure class="lo__stage" data-stage>
        <div class="lo__still" data-still hidden></div>
        <figcaption class="lo__dims ac-label" data-dims></figcaption>
      </figure>
      <form class="lo__panel" data-form>
        <p class="ac-label">${shop.name} · Made to order</p>
        <h1 class="ac-h1" id="lo-title">Shape your ${vase.name.split(' ')[0]} vase</h1>
        <p class="ac-small lo__note">Thrown to your profile within ±3 mm in ${vase.material.split(',')[0].toLowerCase()}, then glazed and fired twice.</p>
        <div class="lo__sliders">
          ${SHAPE.map((c) => html`<label class="lo__row"><span class="lo__name">${c.label}</span><output class="ac-num" data-out="${c.id}"></output><input type="range" name="${c.id}" min="${c.min}" max="${c.max}" step="${c.step}" value="${c.value}"></label>`)}
        </div>
        <fieldset class="lo__glaze">
          <legend class="ac-label">Glaze — <span data-glaze-name></span></legend>
          ${GLAZES.map((g) => html`<label class="lo__sw" style="--sw:var(--${g.id})"><input type="radio" name="glaze" value="${g.id}"><span class="sr-only">${g.name}</span></label>`)}
        </fieldset>
        <div class="lo__buy"><button type="button" class="ac-btn ac-btn--lg" data-order>Order this shape · <span class="ac-num" data-price></span></button><span class="ac-small">Ready in three weeks</span></div>
      </form>
    </section>`;

  const stage = root.querySelector('[data-stage]');
  const still = root.querySelector('[data-still]');
  const dims = root.querySelector('[data-dims]');
  const priceEl = root.querySelector('[data-price]');
  const glazeName = root.querySelector('[data-glaze-name]');
  const radios = [...root.querySelectorAll('input[name="glaze"]')];
  const inputs = [...root.querySelectorAll('input[type="range"]')];
  const full = ctx.motion === 'full';
  let gl = null; // { shape(), glaze(), maps() } once WebGL runs

  const writeOut = () => {
    for (const c of SHAPE) root.querySelector(`[data-out="${c.id}"]`).textContent = `${shape[c.id]} ${c.unit}`;
    priceEl.textContent = formatPrice(price());
    dims.textContent = `${shape.height} × ${Math.max(shape.belly, shape.neck + shape.lip * 2)} cm`;
  };
  const setGlaze = (id) => {
    cfg.glaze = id;
    radios.forEach((r) => { r.checked = r.value === id; });
    glazeName.textContent = GLAZES.find((g) => g.id === id)?.name || id;
    root.style.setProperty('--lo-glaze', colour(id));
    gl?.glaze();
  };
  const drawStill = () => { still.innerHTML = silhouette(shape, cfg.ripples); };
  inputs.forEach((input) => on(ctx, input, 'input', () => {
    shape[input.name] = Number(input.value);
    writeOut();
    if (gl) gl.shape(); else drawStill();
  }));
  radios.forEach((r) => on(ctx, r, 'change', () => setGlaze(r.value)));
  on(ctx, root.querySelector('[data-form]'), 'submit', (e) => e.preventDefault());
  writeOut();
  setGlaze(cfg.glaze);

  if (!webglAvailable()) {
    still.hidden = false;
    root.classList.add('lo--still');
    drawStill();
    return { update(next) { cfg = { ...next }; setGlaze(cfg.glaze); drawStill(); } };
  }

  const { renderer, onResize, tier } = useRenderer(ctx, stage, { alpha: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);
  const segments = tier.name === 'high' ? 160 : tier.name === 'mid' ? 112 : 72;
  const mapSize = tier.name === 'high' ? 512 : 256;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = env;
  scene.environmentIntensity = 0.75;
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 5, 4);
  scene.add(key);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 60);

  const glaze = new THREE.MeshPhysicalMaterial({ roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.18, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), glaze);
  const turner = new THREE.Group();
  turner.add(mesh);
  scene.add(turner);
  // A soft contact shadow: a dark disc on the floor (one light, no shadow map needed).
  const sc = document.createElement('canvas');
  sc.width = sc.height = 128;
  const sg = sc.getContext('2d');
  const grad = sg.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.5)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  sg.fillStyle = grad;
  sg.fillRect(0, 0, 128, 128);
  const shadowTex = new THREE.CanvasTexture(sc);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.001;
  scene.add(shadow);
  let maps = null;
  ctx.onCleanup(() => { disposeScene(scene); env.dispose(); shadowTex.dispose(); maps?.normalMap.dispose(); maps?.roughnessMap.dispose(); });

  let dirty = true;
  let turns = 0;
  let turn = 0;
  let turning = null;
  let tinted = false;
  const tick = (dt, now) => {
    if (turning) {
      turning.t0 ||= now;
      const p = Math.min(1, (now - turning.t0) / cfg.turn);
      const ease = p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2;
      turn = (turns + ease) * TAU;
      if (p === 1) { turns++; turn = turns * TAU; turning = null; } // land exactly on a whole turn
      dirty = true;
    }
    if (!dirty) { off?.(); off = null; return; }
    turner.rotation.y = turn;
    renderer.render(scene, camera);
    dirty = false;
  };
  let off = null;
  const wake = () => { dirty = true; if (!off) off = onFrame(ctx, tick); };

  gl = {
    shape() {
      const old = mesh.geometry;
      mesh.geometry = new THREE.LatheGeometry(lathePoints(shape, cfg.ripples), segments);
      old.dispose();
      const foot = shape.belly / 20;
      shadow.scale.setScalar(foot * 2.6);
      wake();
    },
    glaze() {
      const c = new THREE.Color(readToken(`--${cfg.glaze}`) || cfg.glaze);
      glaze.color.copy(tinted ? c.clone().lerp(new THREE.Color(readToken('--ink') || '#121211'), 0.3) : c);
      wake();
    },
    async maps() {
      const flutes = cfg.texture === 'flutes' ? 24 : 0;
      const grooves = cfg.texture !== 'smooth';
      let m;
      try { m = await mapsInWorker(mapSize, mapSize, flutes, grooves); } catch { m = buildMaps(mapSize, mapSize, flutes, grooves); }
      if (ctx.signal.aborted) return;
      const tex = (data) => {
        const t = new THREE.DataTexture(data, mapSize, mapSize, THREE.RGBAFormat);
        t.wrapS = THREE.RepeatWrapping;
        t.generateMipmaps = true;
        t.minFilter = THREE.LinearMipmapLinearFilter;
        t.needsUpdate = true;
        return t;
      };
      maps?.normalMap.dispose();
      maps?.roughnessMap.dispose();
      maps = { normalMap: tex(m.normal), roughnessMap: tex(m.rough) };
      glaze.normalMap = maps.normalMap;
      glaze.roughnessMap = maps.roughnessMap;
      glaze.normalScale.set(0.5, 0.5);
      glaze.needsUpdate = true;
      wake();
    },
  };
  gl.shape();
  gl.glaze();
  gl.maps();
  ctx.onTheme(() => gl.glaze());

  // Framing is fixed to the largest vase the sliders allow, so a smaller vase reads as smaller.
  onResize(({ width, height }) => {
    camera.aspect = width / height;
    const fitH = 4.6;
    const dist = (fitH / 2) / Math.tan((camera.fov * Math.PI) / 360) / Math.min(1, camera.aspect * 1.05);
    camera.position.set(0, 4.6, dist); // above the tallest lip, so the open top reads
    camera.lookAt(0, 1.75, 0);
    camera.updateProjectionMatrix();
    wake();
  });

  // One quantised revolution after a dwell, for a mouse only; reduced motion tints instead.
  let dwell = 0;
  ctx.onCleanup(() => clearTimeout(dwell));
  on(ctx, stage, 'pointerenter', (e) => {
    if (e.pointerType !== 'mouse' || !finePointer() || ctx.motion === 'static') return;
    if (!full) { tinted = true; gl.glaze(); return; }
    clearTimeout(dwell);
    dwell = setTimeout(() => { if (!turning) { turning = { t0: 0 }; wake(); } }, cfg.dwell);
  });
  on(ctx, stage, 'pointerleave', () => {
    clearTimeout(dwell);
    if (tinted) { tinted = false; gl.glaze(); }
  });

  return {
    update(next, changed) {
      cfg = { ...next };
      if (changed.includes('glaze')) setGlaze(cfg.glaze);
      if (changed.includes('ripples')) gl.shape();
      if (changed.includes('texture')) gl.maps();
      wake();
    },
    action(id) { if (id === 'turn' && full && !turning) { turning = { t0: 0 }; wake(); } },
  };
}
