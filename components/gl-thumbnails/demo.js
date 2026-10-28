// Many-canvas thumbnails — Ostra's shop grid. Every card is a link with its own 2D <canvas>; one WebGL renderer on a
// detached canvas draws each object in turn into a slice of its drawing buffer and drawImage()s that slice into the
// card's canvas in the same task. A card redraws only when it changed and sits within half a viewport of the screen,
// and one pixel budget sets the resolution for the whole set. Hover (mouse) or keyboard focus turns one object a
// revolution on a damped angle (k = 5). Reduced motion: hover shows the second glaze. No WebGL: drawn silhouettes.
import './demo.css';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { on, ticker, observeIntersection, observeResize, damp, html, raw, readToken, qualityTier, content, formatPrice } from '../../src/demo-kit/index.js';
import { webglAvailable, disposeScene } from '../../src/demo-kit/three.js';

const V = (x, y) => new THREE.Vector2(x, y);

// Colours are token mixes: [token, other token or 'white', share of the other]. The DOM swatches use the same mix.
const ITEMS = [
  { id: 'tide-vase', kind: 'Stoneware', badge: 'New', tones: [['Oat', ['--sand']], ['Iron', ['--night', '--clay', 0.12]], ['Celadon', ['--moss', 'white', 0.45]]] },
  { id: 'dune-bowl', kind: 'Stoneware', tones: [['Ash', ['--sand', '--night', 0.42]], ['Sand', ['--sand', '--clay', 0.18]]] },
  { id: 'luma-lamp', kind: 'Opal glass', tones: [['Opal', ['--sand', 'white', 0.72]], ['Smoke', ['--night', '--sky', 0.2]]] },
  { id: 'ember-cup', kind: 'Porcelain', tones: [['Rust', ['--clay']], ['Chalk', ['--sand', 'white', 0.6]], ['Moss', ['--moss']]] },
  { id: 'arc-chair', kind: 'Steam-bent ash', tones: [['Natural', ['--sand', '--clay', 0.38]], ['Smoked', ['--night', '--clay', 0.3]]] },
  { id: 'pebble-dish', kind: 'Porcelain', badge: 'Last few', tones: [['Celadon', ['--moss', 'white', 0.5]], ['Oat', ['--sand']]] },
  { id: 'strand-throw', kind: 'Lambswool', tones: [['Indigo', ['--sky', '--night', 0.55]], ['Undyed', ['--sand', 'white', 0.4]]] },
  { id: 'wick-candle', kind: 'Forged iron', tones: [['Iron', ['--night', '--clay', 0.1]], ['Brass', ['--sand', '--clay', 0.55]]] },
];
const cssTone = ([a, b, t]) => (b ? `color-mix(in oklab, var(${a}), ${b === 'white' ? 'white' : `var(${b})`} ${Math.round(t * 100)}%)` : `var(${a})`);

// Turned profiles: the outer wall from the foot up to the rim; the inner wall is offset from it.
const PROFILES = {
  'tide-vase': [V(0.42, -1.1), V(0.6, -0.55), V(0.62, -0.2), V(0.45, 0.4), V(0.27, 0.78), V(0.28, 0.98), V(0.35, 1.1)],
  'dune-bowl': [V(0.42, -0.42), V(0.75, -0.3), V(1.05, -0.02), V(1.2, 0.3)],
  'ember-cup': [V(0.44, -0.62), V(0.52, -0.5), V(0.56, 0), V(0.6, 0.6)],
  'pebble-dish': [V(0.6, -0.16), V(0.82, -0.1), V(0.92, 0), V(0.95, 0.08)],
  'lamp-base': [V(0.48, -1.05), V(0.5, -0.98), V(0.2, -0.86), V(0.12, -0.55), V(0.1, -0.36)],
  'holder': [V(0.5, -1), V(0.52, -0.95), V(0.2, -0.88), V(0.1, -0.6), V(0.09, -0.25), V(0.26, -0.2), V(0.27, -0.05)],
};
const smooth = (pts, n = 40) => new THREE.SplineCurve(pts).getPoints(n);

function vessel(outer, wall = 0.06, floor = 0.06) {
  const pts = smooth(outer);
  const yb = pts[0].y;
  const inner = pts.filter((p) => p.y > yb + floor).reverse().map((p) => V(Math.max(0.001, p.x - wall), p.y));
  return [V(0, yb), ...pts, ...inner, V(0, yb + floor)];
}
function solid(outer) {
  const pts = smooth(outer);
  return [V(0, pts[0].y), ...pts, V(0, pts[pts.length - 1].y)];
}

// One speckle texture for every glaze and one weave for the throw: drawn once, shared by every item.
function speckle() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 256, 256);
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(40,30,20,${0.12 + rnd() * 0.3})`;
    g.beginPath();
    g.arc(rnd() * 256, rnd() * 256, 0.4 + rnd() * 1.1, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 2);
  return t;
}
function weave() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 128; i += 4) {
    g.fillStyle = `rgba(0,0,0,${i % 16 === 0 ? 0.22 : 0.08})`;
    g.fillRect(i, 0, 2, 128);
    g.fillStyle = 'rgba(0,0,0,0.06)';
    g.fillRect(0, i, 128, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 3);
  return t;
}
function softShadow() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(0,0,0,0.55)');
  r.addColorStop(0.55, 'rgba(0,0,0,0.18)');
  r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// Generated geometry only: each build returns a group around the item's main material (the glaze or the wood).
const BUILD = {
  'tide-vase': (m) => new THREE.Mesh(new THREE.LatheGeometry(vessel(PROFILES['tide-vase'], 0.05), 72), m),
  'dune-bowl': (m) => new THREE.Mesh(new THREE.LatheGeometry(vessel(PROFILES['dune-bowl'], 0.06, 0.05), 80), m),
  'pebble-dish': (m) => {
    const mesh = new THREE.Mesh(new THREE.LatheGeometry(vessel(PROFILES['pebble-dish'], 0.06, 0.05), 72), m);
    mesh.scale.set(1.15, 1, 0.88);
    return mesh;
  },
  'ember-cup': (m) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.LatheGeometry(vessel(PROFILES['ember-cup'], 0.05), 64), m));
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.065, 12, 40, Math.PI), m);
    handle.rotation.z = -Math.PI / 2;
    handle.position.set(0.56, 0.02, 0);
    g.add(handle);
    return g;
  },
  'luma-lamp': (m, x) => {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.LatheGeometry(solid(PROFILES['lamp-base']), 64), x.brass);
    const shade = new THREE.Mesh(new THREE.SphereGeometry(0.74, 48, 32), m);
    shade.position.y = 0.36;
    g.add(base, shade);
    return g;
  },
  'arc-chair': (m) => {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new RoundedBoxGeometry(1.15, 0.1, 1, 3, 0.04), m);
    seat.position.y = -0.05;
    g.add(seat);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1, 12), m);
      leg.position.set(sx * 0.47, -0.58, sz * 0.4);
      leg.rotation.set(sz * 0.06, 0, -sx * 0.06);
      g.add(leg);
    }
    const arc = new THREE.CatmullRomCurve3([[-0.55, 0, 0.42], [-0.57, 0.42, 0.12], [-0.46, 0.68, -0.36], [0, 0.78, -0.5], [0.46, 0.68, -0.36], [0.57, 0.42, 0.12], [0.55, 0, 0.42]].map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(arc, 80, 0.042, 10), m));
    for (const sx of [-0.28, 0, 0.28]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.74, 8), m);
      post.position.set(sx, 0.36, -0.44 + Math.abs(sx) * 0.12);
      g.add(post);
    }
    return g;
  },
  'strand-throw': (m) => {
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const slab = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.2, 1, 4, 0.09), m);
      slab.position.set((i % 2 ? 0.03 : -0.02), -0.3 + i * 0.19, (i % 2 ? -0.02 : 0.02));
      slab.rotation.y = (i - 1.5) * 0.025;
      g.add(slab);
    }
    return g;
  },
  'wick-candle': (m, x) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.LatheGeometry(solid(PROFILES.holder), 64), m));
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.05, 40), x.wax);
    candle.position.y = 0.44;
    const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 6), x.wick);
    wick.position.y = 1.0;
    g.add(candle, wick);
    return g;
  },
};

// The no-WebGL still: the same profiles as flat silhouettes, so the grid still reads as a grid of objects.
function stillSVG(id, fill) {
  const outline = (pts, sx = 1) => {
    const p = smooth(pts);
    const right = p.map((v) => `${(v.x * sx).toFixed(3)},${(-v.y).toFixed(3)}`);
    const left = p.slice().reverse().map((v) => `${(-v.x * sx).toFixed(3)},${(-v.y).toFixed(3)}`);
    return `<path d="M${right.join(' L')} L${left.join(' L')}Z"/>`;
  };
  const shapes = {
    'tide-vase': outline(PROFILES['tide-vase']),
    'dune-bowl': outline(PROFILES['dune-bowl']),
    'pebble-dish': outline(PROFILES['pebble-dish'], 1.15),
    'ember-cup': `${outline(PROFILES['ember-cup'])}<path d="M0.55,-0.3 a0.28,0.28 0 0 1 0,0.56" fill="none" stroke="currentColor" stroke-width="0.13"/>`,
    'luma-lamp': `${outline(PROFILES['lamp-base'])}<circle cx="0" cy="-0.36" r="0.74"/>`,
    'arc-chair': '<rect x="-0.58" y="0" width="1.16" height="0.1" rx="0.04"/><path d="M-0.5,0.1 V1.08 M0.5,0.1 V1.08 M-0.56,0 C-0.6,-0.6 0.6,-0.6 0.56,0 M0,-0.78 V0" fill="none" stroke="currentColor" stroke-width="0.07" stroke-linecap="round"/>',
    'strand-throw': [0, 1, 2, 3].map((i) => `<rect x="-0.75" y="${(0.3 - i * 0.19 - 0.1).toFixed(2)}" width="1.5" height="0.2" rx="0.09"/>`).join(''),
    'wick-candle': `${outline(PROFILES.holder)}<rect x="-0.16" y="-0.97" width="0.32" height="1.05"/>`,
  };
  return `<svg viewBox="-1.5 -1.45 3 2.9" aria-hidden="true" style="color:${fill}" fill="currentColor">${shapes[id]}</svg>`;
}

export default function mount(root, options, ctx) {
  const { shop } = content;
  let cfg = { ...options };
  const list = ITEMS.slice(0, cfg.count).map((it) => ({ ...it, product: shop.products.find((p) => p.id === it.id) }));
  root.className = 'gt';
  root.innerHTML = html`
    <header class="ac-bar gt__bar">
      <a class="ac-brand" href="#shop">${shop.name}</a>
      <nav aria-label="Shop"><a href="#shop" aria-current="page">Objects</a><a href="#shop">Lighting</a><a href="#shop">Textiles</a><a href="#shop">Journal</a></nav>
      <a class="gt__bag" href="#bag">Bag <span class="gt__count">0</span></a>
    </header>
    <section class="gt__shop ac-wrap" id="shop" aria-labelledby="gt-title">
      <div class="gt__head">
        <div class="gt__title">
          <p class="ac-label">Autumn run · ${list.length} objects</p>
          <h1 class="ac-h2" id="gt-title">${shop.tagline}</h1>
        </div>
        <p class="gt__readout ac-label" data-readout aria-hidden="true"><span class="gt__led"></span><span data-r="mode">1 WebGL context</span><span data-r="n"></span><span data-r="dpr"></span><span data-r="px"></span><span data-r="draws"></span></p>
      </div>
      <ul class="gt__grid" role="list">
        ${list.map((it) => html`
          <li>
            <a class="gt__card" href="#${it.id}" data-item="${it.id}" style="--tint:${raw(cssTone(it.tones[0][1]))}">
              <span class="gt__thumb">
                <canvas aria-hidden="true"></canvas>
                <span class="gt__still" data-still hidden>${raw(stillSVG(it.id, cssTone(it.tones[0][1])))}</span>
                ${it.badge ? html`<span class="gt__badge">${it.badge}</span>` : ''}
              </span>
              <span class="gt__row"><span class="gt__name">${it.product.name}</span><span class="gt__price ac-num">${formatPrice(it.product.price)}</span></span>
              <span class="gt__row gt__sub"><span data-glaze>${it.tones[0][0]}</span><span>${it.kind}</span>
                <span class="gt__dots" aria-hidden="true">${it.tones.map(([, t]) => html`<i style="background:${raw(cssTone(t))}"></i>`)}</span>
              </span>
            </a>
          </li>`)}
      </ul>
    </section>`;
  root.querySelectorAll('a[href^="#"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const readout = root.querySelector('[data-readout]');
  const led = readout.querySelector('.gt__led');
  const field = (k) => readout.querySelector(`[data-r="${k}"]`);
  const cards = [...root.querySelectorAll('[data-item]')];
  readout.hidden = !cfg.readout;

  if (!webglAvailable()) {
    root.classList.add('gt--still');
    root.querySelectorAll('[data-still]').forEach((s) => { s.hidden = false; });
    field('mode').textContent = 'No WebGL · drawn silhouettes';
    return { update(next, changed) { if (changed.includes('count')) return false; cfg = { ...next }; readout.hidden = !cfg.readout; return true; } };
  }

  // One renderer on a detached canvas: never in the DOM, only the cards' 2D canvases are.
  const tier = qualityTier();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); // the sizes below are already device pixels
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  const scene = new THREE.Scene();
  scene.environment = env;
  scene.environmentIntensity = 0.9;
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(3, 4, 5);
  scene.add(key);
  const camera = new THREE.PerspectiveCamera(30, 4 / 5, 0.1, 50);
  camera.position.set(0, 1.5, 6.8);
  camera.lookAt(0, -0.08, 0);

  const textures = { speckle: speckle(), weave: weave(), shadow: softShadow() };
  const extras = {
    brass: new THREE.MeshStandardMaterial({ metalness: 1, roughness: 0.32 }),
    wax: new THREE.MeshStandardMaterial({ roughness: 0.7 }),
    wick: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1 }),
  };
  const tone = ([a, b, t]) => {
    const c = new THREE.Color(readToken(a) || '#888888');
    if (b) c.lerp(b === 'white' ? new THREE.Color(1, 1, 1) : new THREE.Color(readToken(b) || '#888888'), t);
    return c;
  };

  const items = list.map((it, i) => {
    const card = cards[i];
    const canvas = card.querySelector('canvas');
    const ctx2d = canvas.getContext('2d');
    const glass = it.id === 'luma-lamp';
    const fabric = it.id === 'strand-throw';
    const wood = it.id === 'arc-chair';
    const material = new THREE.MeshPhysicalMaterial({
      roughness: glass ? 0.3 : fabric ? 0.95 : wood ? 0.55 : 0.42,
      clearcoat: glass || fabric || wood ? 0 : 0.7,
      clearcoatRoughness: 0.28,
      metalness: it.id === 'wick-candle' ? 0.6 : 0,
      map: fabric ? textures.weave : glass || wood ? null : textures.speckle,
      side: THREE.DoubleSide,
      emissive: glass ? new THREE.Color(1, 0.86, 0.62) : new THREE.Color(0, 0, 0),
      emissiveIntensity: glass ? 0.2 : 0,
    });
    const group = new THREE.Group();
    const object = BUILD[it.id](material, extras);
    group.add(object);
    // Normalise every object into the same frame, standing on a soft contact shadow.
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const s = Math.min(2.25 / size.y, 2.2 / Math.max(size.x, size.z));
    object.scale.multiplyScalar(s);
    box.setFromObject(object);
    const centre = box.getCenter(new THREE.Vector3());
    object.position.sub(new THREE.Vector3(centre.x, centre.y, centre.z));
    const turner = new THREE.Group();
    turner.add(object);
    const foot = (box.max.x - box.min.x) * 0.62;
    const shade = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: textures.shadow, transparent: true, depthWrite: false, opacity: 0.8 }));
    shade.rotation.x = -Math.PI / 2;
    shade.position.y = box.min.y - centre.y + 0.004;
    shade.scale.set(foot, foot * 0.8, 1);
    group.add(turner, shade);
    group.visible = false;
    scene.add(group);
    return { ...it, card, canvas, ctx2d, material, group, turner, glazeEl: card.querySelector('[data-glaze]'), glaze: 0, angle: -0.5, target: -0.5, near: false, dirty: true, renders: 0, w: 0, h: 0 };
  });
  ctx.onCleanup(() => { disposeScene(scene); Object.values(textures).forEach((t) => t.dispose()); env.dispose(); });

  const paint = () => {
    extras.brass.color.copy(tone(['--sand', '--clay', 0.4]));
    extras.wax.color.copy(tone(['--sand', 'white', 0.75]));
    for (const it of items) { it.material.color.copy(tone(it.tones[it.glaze][1])); it.dirty = true; }
  };
  paint();

  // One budget for the set: pixel ratio = min(device, tier, √(budget / Σ card area)). The drawing buffer is the
  // largest card; each card uses its top-left slice.
  const stats = { dpr: 0, pixels: 0, draws: 0 };
  const resize = () => {
    const boxes = items.map((it) => it.canvas.getBoundingClientRect());
    const area = boxes.reduce((n, r) => n + r.width * r.height, 0);
    stats.dpr = Math.min(window.devicePixelRatio || 1, tier.dpr, Math.sqrt((cfg.budget * 1e6) / Math.max(1, area)));
    let maxW = 1;
    let maxH = 1;
    stats.pixels = 0;
    items.forEach((it, i) => {
      it.w = Math.max(1, Math.floor(boxes[i].width * stats.dpr));
      it.h = Math.max(1, Math.floor(boxes[i].height * stats.dpr));
      if (it.canvas.width !== it.w || it.canvas.height !== it.h) { it.canvas.width = it.w; it.canvas.height = it.h; }
      maxW = Math.max(maxW, it.w);
      maxH = Math.max(maxH, it.h);
      stats.pixels += it.w * it.h;
      it.dirty = true;
    });
    renderer.setSize(maxW, maxH, false);
    report();
    wake();
  };

  const report = () => {
    field('n').textContent = `${items.length} canvases`;
    field('dpr').textContent = `DPR ${stats.dpr.toFixed(2)}`;
    field('px').textContent = `${(stats.pixels / 1e6).toFixed(2)} MP`;
    field('draws').textContent = `${stats.draws} draws`;
  };

  function draw(it) {
    const H = renderer.domElement.height;
    camera.aspect = it.w / it.h;
    camera.updateProjectionMatrix();
    for (const o of items) o.group.visible = o === it;
    it.turner.rotation.y = it.angle;
    // GL viewports start bottom-left and drawImage reads from the top-left: put the slice at the top of the buffer.
    renderer.setViewport(0, H - it.h, it.w, it.h);
    renderer.render(scene, camera);
    // Same task as the render, so the drawing buffer is still valid without preserveDrawingBuffer.
    it.ctx2d.clearRect(0, 0, it.w, it.h);
    it.ctx2d.drawImage(renderer.domElement, 0, 0, it.w, it.h, 0, 0, it.w, it.h);
    it.renders++;
    it.dirty = false;
    stats.draws++;
  }

  // The clock runs only while an object turns or a near card is dirty; a resting grid draws nothing.
  let running = false;
  let ledTimer = 0;
  const tick = (dt) => {
    let busy = false;
    let drew = false;
    for (const it of items) {
      if (it.angle !== it.target) {
        it.angle = damp(it.angle, it.target, cfg.settle, dt);
        if (Math.abs(it.target - it.angle) < 1e-3) it.angle = it.target; // settle exactly, so the card goes quiet
        it.dirty = true;
      }
      if (it.dirty && it.near) { draw(it); drew = true; }
      if (it.angle !== it.target) busy = true;
    }
    if (drew) {
      report();
      led.classList.add('is-on');
      clearTimeout(ledTimer);
      ledTimer = setTimeout(() => led.classList.remove('is-on'), 160);
    }
    if (!busy) stop();
  };
  const stop = () => { if (running) { ticker.remove(tick); running = false; } };
  function wake() { if (!running) { running = true; ticker.add(tick); } }
  ctx.onCleanup(() => { stop(); clearTimeout(ledTimer); });

  observeIntersection(ctx, items.map((it) => it.canvas), (entries) => {
    for (const e of entries) {
      const it = items.find((x) => x.canvas === e.target);
      it.near = e.isIntersecting;
      if (it.near && it.dirty) wake();
    }
  }, { rootMargin: '50% 0px' });
  observeResize(ctx, root.querySelector('.gt__grid'), resize);

  // Full: one revolution per hover (mouse) or keyboard focus, a tap turns it once. Reduced: the second glaze while
  // hovered or focused, one redraw per change. Static: drawn once.
  const glaze = (it, k) => {
    if (it.glaze === k) return;
    it.glaze = k;
    it.material.color.copy(tone(it.tones[k][1]));
    it.glazeEl.textContent = it.tones[k][0];
    it.dirty = true;
    wake();
  };
  const turn = (it) => {
    if (ctx.motion === 'full') { it.target += cfg.turns * Math.PI * 2; wake(); }
    else if (ctx.motion === 'reduced') glaze(it, 1);
  };
  const rest = (it) => { if (ctx.motion === 'reduced') glaze(it, 0); };
  let lastPointer = '';
  for (const it of items) {
    on(ctx, it.card, 'pointerdown', (e) => { lastPointer = e.pointerType; });
    on(ctx, it.card, 'pointerenter', (e) => { if (e.pointerType === 'mouse') turn(it); });
    on(ctx, it.card, 'pointerleave', (e) => { if (e.pointerType === 'mouse') rest(it); });
    on(ctx, it.card, 'focus', () => { if (it.card.matches(':focus-visible')) turn(it); });
    on(ctx, it.card, 'blur', () => rest(it));
    on(ctx, it.card, 'click', () => { if (lastPointer && lastPointer !== 'mouse') turn(it); lastPointer = ''; });
  }

  ctx.onTheme(() => { paint(); wake(); });
  ctx.onCleanup(() => {
    renderer.renderLists.dispose();
    renderer.dispose();
    renderer.forceContextLoss(); // release the context now instead of waiting for GC
  });
  root.classList.add('gt--gl');
  resize();

  return {
    update(next, changed) {
      if (changed.includes('count')) return false;
      cfg = { ...next };
      readout.hidden = !cfg.readout;
      if (changed.includes('budget')) resize();
      return true;
    },
  };
}
