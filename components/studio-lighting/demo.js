// Studio lighting — a ceramics shop's product viewer on its own: the scene, its lighting switch, light slider and
// finish swatches. A forged candle holder and a glazed cup take every
// highlight from a studio built in code and baked once into a PMREM environment: a room of emissive panels
// (fromScene, half-float, so a strip at 8 stays a hard glint after the rough mips blur) or a window gradient
// painted on a canvas (fromEquirectangular, 8-bit, so the scene's environmentIntensity carries the punch).
// The scene has no lights at all. Lathed objects look the same from every side, so the light turns instead
// (scene.environmentRotation): it orbits slowly at rest, and a drag or the Light slider moves it.
// Reduced motion and static: lighting is not motion, so it still renders, held. No WebGL: a drawn still.
import './demo.css';
import * as THREE from 'three';
import { on, onFrame, whileVisible, html, raw, readToken, colour, content } from '../../src/demo-kit/index.js';
import { useRenderer, webglAvailable, disposeScene } from '../../src/demo-kit/three.js';

// [width, height, position, value, tint]: the lighting design, placed like a photo studio.
const PANELS = [
  [7, 3.5, [0, 6, 1], 2.4, [1, 1, 1]], // overhead softbox: the broad top highlight
  [0.7, 6, [-6, 0.5, 1.5], 6, [1, 0.96, 0.9]], // key strip, warm, camera left
  [0.35, 6, [5.5, 0.5, -2.5], 4.5, [0.85, 0.92, 1]], // rim strip, cool, behind right
  [0.08, 2.2, [-3, 2.5, 4], 9, [1, 1, 1]], // sparkle strips: thin and hot, they make the glints
  [0.08, 2.2, [3.5, -1, 4.5], 8, [1, 1, 1]],
  [5, 2.5, [0, -0.5, 7], 0.5, [0.8, 0.85, 1]], // front fill, low, so the faces toward the camera are not black
  [12, 12, [0, -5, 0], 0.015, [1, 1, 1]], // dark floor flag: metal needs black to read as metal
];

const FINISHES = {
  brass: { name: 'Brass', color: '#d2a865', roughness: 0.2, swatch: 'linear-gradient(135deg, #f0d39a, #a87b3b)' },
  iron: { name: 'Waxed iron', color: '#4a4a4f', roughness: 0.42, swatch: 'linear-gradient(135deg, #77777c, #232326)' },
  nickel: { name: 'Nickel', color: '#e4e4e2', roughness: 0.08, swatch: 'linear-gradient(135deg, #ffffff, #9a9a98)' },
};
const LIGHTS = { panels: 'Studio', painted: 'Window' };

function panelScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0.05, 0.052, 0.06); // the room's walls between the panels
  const geo = new THREE.PlaneGeometry(1, 1);
  for (const [w, h, pos, value, tint] of PANELS) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(...tint).multiplyScalar(value), side: THREE.DoubleSide }));
    m.scale.set(w, h, 1);
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    scene.add(m);
  }
  return scene;
}

// A window-lit room as an equirectangular 2:1 canvas (the top row is straight up): warm walls, a tall soft window
// at the left, a pale ceiling, a darker floor.
function paintedTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const g = c.getContext('2d');
  const room = g.createLinearGradient(0, 0, 0, 512);
  room.addColorStop(0, 'rgb(150,146,140)');
  room.addColorStop(0.48, 'rgb(70,64,58)');
  room.addColorStop(0.52, 'rgb(34,30,27)');
  room.addColorStop(1, 'rgb(12,11,10)');
  g.fillStyle = room;
  g.fillRect(0, 0, 1024, 512);
  const glow = (x, y, w, h, alpha, tint = '255,250,240') => {
    const grad = g.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, Math.max(w, h) / 1.4);
    grad.addColorStop(0, `rgba(${tint},${alpha})`);
    grad.addColorStop(0.55, `rgba(${tint},${alpha * 0.9})`);
    grad.addColorStop(1, `rgba(${tint},0)`);
    g.fillStyle = grad;
    g.fillRect(x - w * 0.3, y - h * 0.3, w * 1.6, h * 1.6);
  };
  glow(120, 110, 150, 230, 1); // the window
  glow(300, 120, 40, 200, 0.55, '255,236,210'); // its reflection on a pale wall
  glow(0, 0, 1024, 60, 0.5); // ceiling bounce
  glow(700, 150, 26, 160, 0.8, '220,232,255'); // a cool edge strip behind
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The holder: a forged dish, a stem with a collar and a drip cup, lathed from one profile.
const HOLDER = [[0, 0], [0.52, 0], [0.56, 0.02], [0.585, 0.085], [0.555, 0.105], [0.5, 0.062], [0.16, 0.052], [0.085, 0.1], [0.066, 0.68], [0.1, 0.78], [0.1, 0.84], [0.066, 0.92], [0.08, 1.04], [0.3, 1.09], [0.32, 1.3], [0.292, 1.318], [0.272, 1.12], [0, 1.11]];
// The cup: outer wall up to a rolled lip and back down the inside.
const CUP = [[0, 0], [0.48, 0], [0.53, 0.04], [0.58, 0.4], [0.62, 1.0], [0.64, 1.2], [0.625, 1.23], [0.59, 1.2], [0.56, 0.9], [0.5, 0.3], [0.4, 0.12], [0, 0.11]];
const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);

function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0.22)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

const STILL = `<svg viewBox="0 0 400 300" aria-hidden="true"><defs>
  <linearGradient id="sl-m" x1="0" x2="1"><stop offset="0" stop-color="#8a6a3a"/><stop offset=".35" stop-color="#f3d9a0"/><stop offset=".6" stop-color="#b08245"/><stop offset="1" stop-color="#5e4524"/></linearGradient>
  <linearGradient id="sl-c" x1="0" x2="1"><stop offset="0" stop-color="var(--sl-glaze)" stop-opacity=".7"/><stop offset=".4" stop-color="var(--sl-glaze)"/><stop offset="1" stop-color="var(--sl-glaze)" stop-opacity=".55"/></linearGradient></defs>
  <ellipse cx="140" cy="262" rx="92" ry="9" fill="#000" opacity=".25"/><ellipse cx="290" cy="262" rx="52" ry="7" fill="#000" opacity=".25"/>
  <path d="M52 258h176l-6-10H58z" fill="url(#sl-m)"/><rect x="134" y="168" width="12" height="82" fill="url(#sl-m)"/><path d="M112 168h56l-3-28h-50z" fill="url(#sl-m)"/>
  <rect x="117" y="70" width="46" height="72" rx="3" fill="#efe6d6"/><rect x="139" y="58" width="2" height="12" fill="#222"/>
  <path d="M252 258h76l8-84h-92z" fill="url(#sl-c)"/><path d="M336 196c22 0 22 40 -4 40" fill="none" stroke="var(--sl-glaze)" stroke-width="7"/></svg>`;

export default function mount(root, options, ctx) {
  const { shop } = content;
  const holder = shop.products.find((p) => p.id === 'wick-candle');
  const cup = shop.products.find((p) => p.id === 'ember-cup');
  let cfg = { ...options };
  root.className = 'sl';
  root.innerHTML = html`
    <section class="ac-stage sl__ground" aria-label="${holder.name} with the ${cup.name}">
      <div class="sl__stage" data-stage><div class="sl__still" data-still hidden>${raw(STILL)}</div></div>
      <div class="sl__bar">
        <div class="sl__lights" role="group" aria-label="Lighting">
          ${Object.entries(LIGHTS).map(([id, name]) => html`<button type="button" class="sl__light" data-light="${id}" aria-pressed="false">${name}</button>`)}
        </div>
        <fieldset class="sl__finish">
          <legend class="sr-only">Holder finish</legend>
          ${Object.entries(FINISHES).map(([id, f]) => html`<label class="sl__sw" style="--sw:${f.swatch}"><input type="radio" name="sl-finish" value="${id}"><span class="sr-only">${f.name}</span></label>`)}
          <span class="ac-label sl__finish-name" aria-hidden="true" data-finish-name></span>
        </fieldset>
        <label class="sl__angle"><span class="ac-label">Light</span><input type="range" min="0" max="360" step="1" value="0" data-angle aria-label="Light angle in degrees"></label>
      </div>
      <p class="ac-stage__note"><span>${shop.name} · product viewer</span></p>
    </section>`;

  const stage = root.querySelector('[data-stage]');
  const still = root.querySelector('[data-still]');
  const finishName = root.querySelector('[data-finish-name]');
  const radios = [...root.querySelectorAll('input[name="sl-finish"]')];
  const lightButtons = [...root.querySelectorAll('[data-light]')];
  const angleInput = root.querySelector('[data-angle]');
  const full = ctx.motion === 'full';

  let gl = null; // { finish(), light(), glaze(), intensity(), angle(), render() } once WebGL runs
  const ui = {
    finish(id) {
      cfg.finish = id;
      radios.forEach((r) => { r.checked = r.value === id; });
      finishName.textContent = FINISHES[id].name;
      gl?.finish();
    },
    light(id) {
      cfg.environment = id;
      lightButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.light === id)));
      gl?.light();
    },
  };
  radios.forEach((r) => on(ctx, r, 'change', () => ui.finish(r.value)));
  lightButtons.forEach((b) => on(ctx, b, 'click', () => ui.light(b.dataset.light)));
  root.style.setProperty('--sl-glaze', colour(cfg.glaze));

  if (!webglAvailable()) {
    still.hidden = false;
    root.classList.add('sl--still');
    ui.finish(cfg.finish);
    ui.light(cfg.environment);
    return { update(next) { cfg = { ...next }; root.style.setProperty('--sl-glaze', colour(cfg.glaze)); ui.finish(cfg.finish); ui.light(cfg.environment); } };
  }

  const { renderer, onResize, tier } = useRenderer(ctx, stage, { alpha: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 60);
  const target = new THREE.Vector3(0.05, 1.02, 0);

  // No lights: the environment is the only source. Materials take every highlight from it.
  const seg = tier.name === 'high' ? 128 : tier.name === 'mid' ? 96 : 64;
  const metal = new THREE.MeshPhysicalMaterial({ metalness: 1, roughness: 0.2, clearcoat: 0.2, clearcoatRoughness: 0.3 });
  // Wax glows a little from inside: a faint warm emissive stands in for subsurface scattering.
  const wax = new THREE.MeshPhysicalMaterial({ color: '#f3ead9', roughness: 0.55, sheen: 0.5, sheenRoughness: 0.7, sheenColor: new THREE.Color('#fff4e0'), emissive: new THREE.Color('#e9dcc4'), emissiveIntensity: 0.22 });
  const glaze = new THREE.MeshPhysicalMaterial({ metalness: 0, roughness: 0.5, clearcoat: 1, clearcoatRoughness: 0.04, side: THREE.DoubleSide });
  const holderGroup = new THREE.Group();
  holderGroup.add(new THREE.Mesh(lathe(HOLDER, seg), metal));
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.24, 1.2, seg), wax);
  candle.position.y = 1.12 + 0.6;
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.1, 8), new THREE.MeshStandardMaterial({ color: '#1a1714', roughness: 0.9 }));
  wick.position.y = 1.12 + 1.2 + 0.04;
  holderGroup.add(candle, wick);
  holderGroup.position.set(-0.68, 0, 0);
  const cupGroup = new THREE.Group();
  cupGroup.add(new THREE.Mesh(lathe(CUP, seg), glaze));
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.055, 16, 48, Math.PI * 1.15), glaze);
  handle.rotation.z = -Math.PI * 0.575;
  handle.position.set(0.6, 0.66, 0);
  cupGroup.add(handle);
  cupGroup.position.set(0.78, 0, 0.35);
  cupGroup.rotation.y = -0.55;
  scene.add(holderGroup, cupGroup);
  // Contact shadows: a soft dark disc under each object (there are no lights to cast real ones).
  const shadowTex = shadowTexture();
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false });
  for (const [x, z, s] of [[-0.68, 0, 1.6], [0.78, 0.35, 1.8]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), shadowMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.002, z);
    scene.add(m);
  }

  // Bake on first use, once per variant, then keep it. One PMREMGenerator per bake, disposed straight after.
  const size = tier.name === 'high' ? 512 : 256;
  const baked = {};
  const BAKES = {
    panels: () => {
      const room = panelScene();
      const pm = new THREE.PMREMGenerator(renderer);
      const rt = pm.fromScene(room, 0.02, 0.1, 50, { size });
      pm.dispose();
      disposeScene(room);
      return { rt, intensity: 1 };
    },
    painted: () => {
      const t = paintedTexture();
      const pm = new THREE.PMREMGenerator(renderer);
      const rt = pm.fromEquirectangular(t);
      pm.dispose();
      t.dispose();
      return { rt, intensity: 2.2 };
    },
  };
  ctx.onCleanup(() => { Object.values(baked).forEach((b) => b.rt.dispose()); disposeScene(scene); shadowTex.dispose(); });

  let dirty = true;
  let angle = 0; // the light's turn, radians
  let userAngle = false;
  gl = {
    finish() { const f = FINISHES[cfg.finish]; metal.color.set(f.color); metal.roughness = f.roughness; dirty = true; },
    light() {
      const name = cfg.environment;
      baked[name] ||= BAKES[name]();
      scene.environment = baked[name].rt.texture;
      scene.environmentIntensity = baked[name].intensity * cfg.intensity;
      dirty = true;
    },
    glaze() { glaze.color.set(readToken(`--${cfg.glaze}`) || cfg.glaze); root.style.setProperty('--sl-glaze', colour(cfg.glaze)); dirty = true; },
    angle(rad) { angle = rad; scene.environmentRotation.y = angle; angleInput.value = String(Math.round((((angle * 180) / Math.PI) % 360 + 360) % 360)); dirty = true; },
  };
  ui.finish(cfg.finish);
  ui.light(cfg.environment);
  gl.glaze();
  gl.angle(0.5);
  ctx.onTheme(() => gl.glaze());

  onResize(({ width, height }) => {
    camera.aspect = width / height;
    const portrait = width / height < 1;
    const wide = width / height > 1.6; // a wide stage: step in so the pair fills its height
    camera.position.set(0, portrait ? 2.4 : 2, portrait ? 13 : wide ? 8.6 : 9.6);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    dirty = true;
  });

  // The light moves, not the objects: a drag across the stage or the slider turns the environment.
  on(ctx, angleInput, 'input', () => { userAngle = true; gl.angle((Number(angleInput.value) * Math.PI) / 180); });
  let drag = null;
  on(ctx, stage, 'pointerdown', (e) => { drag = { x: e.clientX, a: angle }; userAngle = true; stage.setPointerCapture(e.pointerId); });
  on(ctx, stage, 'pointermove', (e) => { if (drag) gl.angle(drag.a + ((e.clientX - drag.x) / stage.clientWidth) * Math.PI * 1.5); });
  const end = () => { drag = null; };
  on(ctx, stage, 'pointerup', end);
  on(ctx, stage, 'pointercancel', end);

  let off = null;
  whileVisible(ctx, stage, () => {
    off = onFrame(ctx, (dt) => {
      if (full && cfg.orbit && !userAngle && !drag) gl.angle(angle + dt * 0.22);
      if (!dirty) return;
      renderer.render(scene, camera);
      dirty = false;
    });
  }, () => { off?.(); off = null; });

  return {
    update(next, changed) {
      cfg = { ...next };
      if (changed.includes('finish')) ui.finish(cfg.finish);
      if (changed.includes('environment') || changed.includes('intensity')) ui.light(cfg.environment);
      if (changed.includes('glaze')) gl.glaze();
      if (changed.includes('orbit') && cfg.orbit) userAngle = false;
      dirty = true;
    },
  };
}
