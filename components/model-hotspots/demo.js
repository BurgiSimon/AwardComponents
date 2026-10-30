// Model with hotspots — Halden's Granite Court as a white massing model beside its story card. A hand-written
// clamped orbit: input only writes a goal (polar 0.8–1.3 rad, distance per zoom range), and each frame the camera
// eases toward it by 1 − k^dt (k 0.0004 while dragging; a fly-to's k comes from the Fly time control). Every zone is
// a real <button aria-pressed> pinned to its projected point; pressing one flies the camera there and paints the
// zone in the accent, and the story card (aria-live) tells its story. Frames render only while something moves.
// Reduced: GL stays, moves land at once, no idle turn. Static or no WebGL: a drawn plan with the same buttons.
import './demo.css';
import * as THREE from 'three';
import { on, onFrame, whileVisible, later, html, clamp, lerp, readToken, colour, content } from '../../src/demo-kit/index.js';
import { useRenderer, webglAvailable, disposeScene } from '../../src/demo-kit/three.js';

const POLAR = [0.8, 1.3];
// Zoom ranges as multiples of the framing distance (the distance that fits the whole site in the stage).
const RANGES = { tight: [0.8, 1.1], normal: [0.6, 1.25], wide: [0.42, 1.5] };
const K_DRAG = 0.0004;
const HOME = { target: [0, 0.8, 0], theta: 0.5, phi: 1.02, r: 1 };
// Each zone: where its label pins, what the camera looks at, and the view to fly to.
const ZONES = [
  { id: 'hill', name: 'Hill block', figure: '26 flats', text: 'Six floors on the upper terrace. Every flat has one window to the fjord and one to the courtyard.', pin: [-1.3, 3.35, -2.7], target: [-0.6, 2.2, -2.6], theta: -0.3, phi: 1.02, r: 0.72 },
  { id: 'court', name: 'Courtyard', figure: '1,150 m²', text: 'Birch, moss and one long bench, cut from the hillside and open to the street on the south side.', pin: [-0.4, 0.05, 1.4], target: [-0.2, 0.2, 1.1], theta: 0.15, phi: 0.86, r: 0.62 },
  { id: 'row', name: 'Garden row', figure: '10 homes', text: 'Five gabled houses down the west edge, each split into two maisonettes with their own front gardens.', pin: [-4.1, 1.45, 1.3], target: [-3.6, 0.8, 1.3], theta: -0.95, phi: 1.1, r: 0.6 },
  { id: 'corner', name: 'Corner house', figure: '6 flats + café', text: 'Four floors on the street corner, with a café and a 120-place bike hall on the ground floor.', pin: [3.9, 2.45, 1.7], target: [3.6, 1.4, 1.6], theta: 0.95, phi: 1.08, r: 0.6 },
];
const SITE = { name: 'Whole site', figure: '6,800 m²', text: 'Choose a building, or drag to turn the model.' };

// The drawn plan for the static tier and for browsers without WebGL (classes carry the token colours).
const PLAN = `<svg class="mh__plan" viewBox="0 0 560 400" aria-hidden="true">
  <rect class="mh__p-ground" width="560" height="400"/>
  <rect class="mh__p-road" x="0" y="338" width="560" height="44"/>
  <rect class="mh__p-site" x="30" y="40" width="500" height="290" rx="4"/>
  <rect class="mh__p-terrace" x="30" y="40" width="500" height="94" rx="4"/>
  <rect class="mh__p-court" x="148" y="152" width="236" height="140" rx="3"/>
  <rect class="mh__p-bldg" data-p="hill" x="62" y="58" width="300" height="64"/><rect class="mh__p-bldg" data-p="hill" x="372" y="58" width="118" height="64"/>
  ${[0, 1, 2, 3, 4].map((i) => `<rect class="mh__p-bldg" data-p="row" x="50" y="${150 + i * 36}" width="72" height="31"/>`).join('')}
  <rect class="mh__p-bldg" data-p="corner" x="408" y="196" width="90" height="100"/>
  ${[[196, 186], [244, 262], [334, 236], [278, 170], [92, 318], [212, 318], [452, 318]].map(([x, y]) => `<circle class="mh__p-tree" cx="${x}" cy="${y}" r="11"/>`).join('')}
</svg>`;

export default function mount(root, options, ctx) {
  const { studio } = content;
  const project = studio.projects.find((p) => p.slug === 'granite-court');
  let cfg = { ...options };

  root.className = 'mh';
  root.innerHTML = html`
    <section class="ac-stage mh__wrap" aria-label="${project.title}">
      <div class="mh__page">
        <div class="mh__stage" data-stage tabindex="0" role="group" aria-label="${project.title} model. Drag or use the arrow keys to turn it." aria-describedby="mh-hint">
          <div class="mh__gl" data-gl></div>
          <ul class="mh__spots" role="list" data-spots>
            ${ZONES.map((z, i) => html`<li><button class="mh__spot" type="button" data-zone="${z.id}" aria-pressed="false"><span class="mh__dot" aria-hidden="true">${i + 1}</span><span class="mh__name">${z.name}</span></button></li>`)}
          </ul>
          <div class="mh__tools">
            <button class="mh__tool" type="button" data-reset>Reset view</button>
          </div>
          <p class="mh__toast" data-toast aria-hidden="true">Hold <span class="ac-kbd">⌘</span> or <span class="ac-kbd">Ctrl</span> to zoom</p>
          <p class="sr-only" id="mh-hint">Drag to turn. Hold Command or Ctrl and scroll to zoom. With the model focused, arrows turn, plus and minus zoom, Home resets.</p>
        </div>
        <div class="mh__detail" aria-live="polite">
          <p class="ac-label" data-d-name>${SITE.name}</p>
          <p class="mh__figure" data-d-figure>${SITE.figure}</p>
          <p class="ac-body" data-d-text>${SITE.text}</p>
        </div>
      </div>
      <p class="ac-stage__note"><span>${studio.name} · project page</span></p>
    </section>`;

  const stage = root.querySelector('[data-stage]');
  const host = root.querySelector('[data-gl]');
  const buttons = [...root.querySelectorAll('[data-zone]')];
  const toast = root.querySelector('[data-toast]');
  const detail = { name: root.querySelector('[data-d-name]'), figure: root.querySelector('[data-d-figure]'), text: root.querySelector('[data-d-text]') };
  const state = { zone: null, mode: 'gl' };
  let site = SITE;
  let onSelect = () => {};

  const select = (id) => {
    state.zone = id;
    const z = ZONES.find((x) => x.id === id);
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.zone === id)));
    root.querySelectorAll('[data-p]').forEach((el) => el.classList.toggle('is-on', el.dataset.p === id));
    const d = z || site;
    detail.name.textContent = d.name;
    detail.figure.textContent = d.figure;
    detail.text.textContent = d.text;
    onSelect(z);
  };
  buttons.forEach((b) => on(ctx, b, 'click', () => select(state.zone === b.dataset.zone ? null : b.dataset.zone)));
  on(ctx, root.querySelector('[data-reset]'), 'click', () => select(null));

  const apply = () => {
    root.dataset.spots = cfg.hotspots;
    root.style.setProperty('--mh-accent', colour(cfg.accent));
  };
  apply();
  const instance = {
    update(next) { cfg = { ...next }; apply(); return true; },
    action(id) {
      if (id === 'reset') select(null);
      if (id === 'next') select(ZONES[(ZONES.findIndex((z) => z.id === state.zone) + 1) % ZONES.length].id);
      if (ZONES.some((z) => z.id === id)) select(id); // a zone by id (the frame capture opens on the corner house)
    },
  };

  // Static tier or no WebGL: the plan, with the same buttons as a plain list under it.
  if (ctx.motion === 'static' || !webglAvailable()) {
    state.mode = 'plan';
    root.dataset.mode = 'plan';
    host.innerHTML = PLAN;
    // Nothing turns here: only the buttons work, so the stage stops offering drag, keys and zoom.
    site = { ...SITE, text: 'Choose a building.' };
    detail.text.textContent = site.text;
    stage.removeAttribute('tabindex');
    stage.removeAttribute('aria-describedby');
    stage.setAttribute('aria-label', `${project.title} site plan`);
    root.querySelector('#mh-hint').remove();
    return instance;
  }
  root.dataset.mode = 'gl';

  // ---------- Scene: a white massing model on a terraced site, built from boxes, prisms and spheres.
  const { renderer, onResize } = useRenderer(ctx, host, { alpha: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 160);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8478, 1.5);
  const sun = new THREE.DirectionalLight(0xffffff, 2.1);
  sun.position.set(-6, 10, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 30 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  scene.add(hemi, sun);

  const mats = {
    shadow: new THREE.ShadowMaterial({ opacity: 0.14 }),
    site: new THREE.MeshLambertMaterial(),
    road: new THREE.MeshLambertMaterial(),
    line: new THREE.MeshLambertMaterial(),
    tree: new THREE.MeshLambertMaterial({ flatShading: true }),
    trunk: new THREE.MeshLambertMaterial(),
  };
  // Storey lines: a tiny canvas texture repeated once per floor on the walls; roofs stay plain.
  const lines = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 32, 32);
    g.fillStyle = 'rgba(40, 36, 30, 0.16)';
    g.fillRect(0, 0, 32, 2);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  })();
  ctx.onCleanup(() => lines.dispose());
  // Every material a zone owns, so selecting it can repaint them all.
  const zoneMats = { hill: [], row: [], corner: [], court: [new THREE.MeshLambertMaterial()] };
  const plain = (zone) => { const m = new THREE.MeshLambertMaterial({ flatShading: true }); zoneMats[zone].push(m); return m; };
  const building = (zone, floors) => {
    const map = lines.clone();
    map.repeat.set(1, floors);
    const side = new THREE.MeshLambertMaterial({ map, flatShading: true });
    zoneMats[zone].push(side);
    const top = plain(zone);
    return [side, side, top, top, side, side];
  };
  const box = new THREE.BoxGeometry(1, 1, 1);
  const plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const prism = new THREE.CylinderGeometry(1, 1, 1, 3, 1).rotateX(-Math.PI / 2).translate(0, 0.5, 0); // apex at y 1.5
  const crown = new THREE.IcosahedronGeometry(1, 1);
  const stem = new THREE.CylinderGeometry(0.04, 0.05, 1, 6).translate(0, 0.5, 0);
  const disc = new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2);
  const add = (geo, mat, [x, y, z], [sx, sy, sz], { cast = true, receive = true, ry = 0 } = {}) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.rotation.y = ry;
    m.castShadow = cast;
    m.receiveShadow = receive;
    scene.add(m);
    return m;
  };
  // The site slab, its upper terrace running back into the hill, and the street. The stage's own background
  // shows through: the ground plane only catches shadows.
  add(disc, mats.shadow, [0, -0.31, 0], [30, 1, 30], { cast: false });
  add(box, mats.site, [0, -0.15, 0], [11, 0.3, 8]);
  add(box, mats.site, [0, 0.25, -3.2], [11, 1.1, 3.6]);
  add(plane, mats.road, [0, -0.29, 5], [16, 1, 1.5], { cast: false });
  for (let x = -7; x <= 7; x += 1.4) add(plane, mats.line, [x, -0.285, 5], [0.6, 1, 0.06], { cast: false });
  // The hill block, in two heights on the terrace.
  add(box, building('hill', 6), [-1.3, 2.3, -2.7], [6.6, 3, 1.8]);
  add(box, building('hill', 4), [3.5, 1.8, -2.7], [2.6, 2, 1.8]);
  // The garden row: five gabled houses, ridges across the row.
  const rowWalls = building('row', 2);
  const roof = plain('row');
  for (let i = 0; i < 5; i++) {
    const z = -0.57 + i * 0.94;
    add(box, rowWalls, [-4.1, 0.45, z], [1.6, 0.9, 0.86]);
    add(prism, roof, [-4.1, 0.9, z], [0.86 / 1.732, 0.42 / 1.5, 1.6], { ry: Math.PI / 2 });
  }
  // The corner house and the courtyard.
  add(box, building('corner', 4), [3.9, 1.2, 1.7], [2, 2.4, 2.2]);
  add(plane, zoneMats.court[0], [-0.2, 0.012, 1.1], [5.2, 1, 3.8], { cast: false });
  add(plane, mats.site, [1.1, 0.02, 2.6], [0.55, 1, 2.9], { cast: false });
  // Trees: in the courtyard, along the street and on the terrace behind.
  const tree = (x, z, s = 1, y = 0) => {
    add(stem, mats.trunk, [x, y, z], [1, 0.55 * s, 1]);
    add(crown, mats.tree, [x, y + 0.55 * s + 0.3 * s, z], [0.36 * s, 0.42 * s, 0.36 * s]);
  };
  [[-1.6, 0.3], [-0.5, 2.3], [1.6, 1.4], [0.4, 0.1], [-2.2, 2.6]].forEach(([x, z]) => tree(x, z, 1.05));
  [[-2.6, 3.7], [-0.4, 3.7], [2.2, 3.7]].forEach(([x, z]) => tree(x, z, 0.9));
  [[-4.9, -4.35], [-3.1, -4.6], [-1.2, -4.3], [0.9, -4.6], [2.7, -4.35], [4.6, -4.6]].forEach(([x, z], i) => tree(x, z, 1 + (i % 3) * 0.12, 0.8));
  ctx.onCleanup(() => disposeScene(scene));

  const base = {};
  let dirty = true;
  // Token colours: a paper-white model in both themes, the ground and street from the theme, trees in moss.
  const readColours = () => {
    const t = (n) => new THREE.Color(readToken(n));
    const paper = t('--sand').lerp(new THREE.Color('#ffffff'), 0.78);
    const dark = document.documentElement.dataset.theme === 'dark';
    mats.site.color.copy(paper).lerp(t('--sand'), 0.25);
    mats.road.color.copy(t('--night')).lerp(t('--bg-2'), dark ? 0.35 : 0.55);
    mats.line.color.copy(paper);
    mats.tree.color.copy(t('--moss')).lerp(paper, 0.18);
    mats.trunk.color.copy(t('--moss')).lerp(t('--night'), 0.5);
    base.hill = paper.clone();
    base.row = paper.clone();
    base.corner = paper.clone();
    base.court = t('--moss').lerp(paper, 0.45);
    hemi.groundColor.copy(t('--sand')).multiplyScalar(0.7);
    paint();
  };
  const paint = () => {
    const accent = new THREE.Color(readToken('--mh-accent', root) || readToken('--accent'));
    for (const [id, list] of Object.entries(zoneMats)) for (const m of list) m.color.copy(id === state.zone ? accent : base[id]);
    dirty = true;
  };
  readColours();
  ctx.onTheme(() => readColours());

  // ---------- Camera: a goal and a current on spherical coordinates.
  let frameR = 21.5; // the framing distance; set from the stage's aspect on resize
  const range = () => RANGES[cfg.zoom].map((m) => m * frameR);
  const goal = { target: new THREE.Vector3(...HOME.target), theta: HOME.theta, phi: HOME.phi, radius: clamp(frameR, ...range()) };
  const cam = { target: goal.target.clone(), theta: goal.theta, phi: goal.phi, radius: goal.radius };
  let k = K_DRAG;
  const kFly = () => Math.pow(0.05, 1 / cfg.glide); // fraction of the gap left after 1 s, so 95 % is covered in `glide` s
  const instant = ctx.motion !== 'full';
  let lastInput = performance.now();

  const setGoal = ({ target, theta, phi, radius, r }, kk) => {
    if (r !== undefined) radius = r * frameR;
    if (target) goal.target.fromArray(target);
    // The short way round: the new azimuth is taken relative to the current goal.
    if (theta !== undefined) goal.theta += Math.atan2(Math.sin(theta - goal.theta), Math.cos(theta - goal.theta));
    if (phi !== undefined) goal.phi = clamp(phi, POLAR[0], POLAR[1]);
    if (radius !== undefined) goal.radius = clamp(radius, ...range());
    k = kk;
    if (instant) { cam.target.copy(goal.target); Object.assign(cam, { theta: goal.theta, phi: goal.phi, radius: goal.radius }); }
    dirty = true;
  };
  onSelect = (z) => { paint(); setGoal(z || HOME, kFly()); };
  // Full motion: the camera settles in from a little further out.
  if (!instant && !ctx.capture) cam.radius = goal.radius * 1.3;

  // ---------- Input: drag orbits (touch: sideways only, so the page still scrolls), modifier + wheel zooms, keys.
  let drag = null;
  on(ctx, host, 'pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, touch: e.pointerType !== 'mouse' };
    try { host.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    stage.classList.add('is-dragging');
    lastInput = performance.now();
  });
  on(ctx, host, 'pointermove', (e) => {
    if (!drag) return;
    const r = stage.getBoundingClientRect();
    const dy = drag.touch ? 0 : (e.clientY - drag.y) / r.height;
    setGoal({ theta: goal.theta - ((e.clientX - drag.x) / r.width) * Math.PI * 1.5, phi: goal.phi - dy * Math.PI }, K_DRAG);
    drag.x = e.clientX;
    drag.y = e.clientY;
    lastInput = performance.now();
  });
  const endDrag = () => { drag = null; stage.classList.remove('is-dragging'); };
  on(ctx, host, 'pointerup', endDrag);
  on(ctx, host, 'pointercancel', endDrag);
  on(ctx, host, 'lostpointercapture', endDrag);
  let toastTimer = 0;
  on(ctx, stage, 'wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey)) {
      toast.classList.add('is-on');
      clearTimeout(toastTimer);
      toastTimer = later(ctx, () => toast.classList.remove('is-on'), 1400);
      return;
    }
    e.preventDefault();
    setGoal({ radius: goal.radius * (1 + e.deltaY * 0.0015) }, K_DRAG);
    lastInput = performance.now();
  }, { passive: false });
  on(ctx, stage, 'keydown', (e) => {
    if (e.target !== stage) return;
    const step = { ArrowLeft: [0.2, 0, 1], ArrowRight: [-0.2, 0, 1], ArrowUp: [0, -0.1, 1], ArrowDown: [0, 0.1, 1], '+': [0, 0, 0.9], '=': [0, 0, 0.9], '-': [0, 0, 1.1] }[e.key];
    if (e.key === 'Home') { e.preventDefault(); select(null); return; }
    if (!step) return;
    e.preventDefault();
    setGoal({ theta: goal.theta + step[0], phi: goal.phi + step[1], radius: goal.radius * step[2] }, kFly());
    lastInput = performance.now();
  });

  // ---------- Render: camera from the spherical state; labels pinned to their projected points.
  const v = new THREE.Vector3();
  let size = { width: 1, height: 1 };
  let widths = [];
  const measure = () => { widths = buttons.map((b) => b.offsetWidth); };
  onResize((s) => {
    size = { ...s };
    camera.aspect = s.width / s.height;
    camera.fov = camera.aspect < 0.9 ? 40 : 36;
    camera.updateProjectionMatrix();
    // Frame the whole site: a narrower stage stands further back; any zoom the visitor chose scales along.
    const next = 21.5 * Math.max(1, 1.1 / camera.aspect) * (camera.aspect < 0.9 ? 0.9 : 1);
    goal.radius *= next / frameR;
    cam.radius *= next / frameR;
    frameR = next;
    measure();
    dirty = true;
  });
  document.fonts?.ready.then(() => { measure(); dirty = true; });

  const render = () => {
    const s = Math.sin(cam.phi);
    camera.position.set(cam.target.x + cam.radius * s * Math.sin(cam.theta), cam.target.y + cam.radius * Math.cos(cam.phi), cam.target.z + cam.radius * s * Math.cos(cam.theta));
    camera.lookAt(cam.target);
    camera.updateMatrixWorld();
    renderer.render(scene, camera);
    const { width: w, height: h } = size;
    // A label that would leave the stage parks on its edge, so a focused button is always in view.
    buttons.forEach((b, i) => {
      v.fromArray(ZONES[i].pin).project(camera);
      const x = clamp(((v.x + 1) / 2) * w - 14, 6, w - (widths[i] || 0) - 6);
      const y = clamp(((1 - v.y) / 2) * h, 26, h - 64);
      b.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translateY(-50%)`;
    });
  };

  const frame = (dt) => {
    if (cfg.spin && !instant && !drag && performance.now() - lastInput > 3000) { goal.theta += dt * 0.12; k = kFly(); dirty = true; }
    const f = 1 - Math.pow(k, dt);
    const gap = Math.abs(goal.theta - cam.theta) + Math.abs(goal.phi - cam.phi) + Math.abs(goal.radius - cam.radius) + goal.target.distanceTo(cam.target);
    if (gap < 1e-4 && !dirty) return;
    cam.target.lerp(goal.target, f);
    cam.theta = lerp(cam.theta, goal.theta, f);
    cam.phi = lerp(cam.phi, goal.phi, f);
    cam.radius = lerp(cam.radius, goal.radius, f);
    render();
    dirty = false;
  };
  let off = null;
  whileVisible(ctx, stage, () => { dirty = true; off = onFrame(ctx, frame); }, () => { off?.(); off = null; });

  return {
    update(next, changed) {
      cfg = { ...next };
      apply();
      if (changed.includes('accent')) paint();
      if (changed.includes('zoom')) setGoal({ radius: goal.radius }, kFly());
      if (changed.includes('hotspots')) requestAnimationFrame(() => { measure(); dirty = true; });
      dirty = true;
    },
    action: instance.action,
  };
}
