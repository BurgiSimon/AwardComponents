// Lit swarm footer — a ceramics shop's footer, on its own. Behind the footer's copy a swarm of small glazed pebbles
// drifts along a spiral path, lit by a point light that rides the pointer and shaded by a coarse voxel grid of
// where the swarm is: every pebble splats one pixel into a 32 × 16 × 16 grid (a sliced 2D atlas, MAX blending),
// one pass blurs and eases it, and the pebble shader reads AO one voxel along its normal and shadow one and two
// voxels toward the light. The simulation runs on the CPU into two float textures read by one instanced draw.
// three.js is a dynamic import fetched only when the footer is within a screen; the loop runs only while the
// footer is visible. Reduced motion: one settled frame, the light parked. Static or no WebGL 2: a drawn still.
import './demo.css';
import { on, onFrame, whileVisible, observeIntersection, observeResize, html, readToken, qualityTier, finePointer, webgl2Available, content } from '../../src/demo-kit/index.js';

// The world, in scene units (the footer is about 3.2 × 2 units at 16:10). The recipe's own values.
const SEED = 0.022; // pebble half-length
const CONTACT = SEED * 2 * 0.7; // pebbles may overlap 30 % before the contact pass separates them
const SPIRAL_RADIUS = 0.2;
const SPIRAL_FREQ = 8;
const CURVE_AMP = 0.1;
const CURVE_FREQ = 8;
const CURVE_SPEED = 0.25;
const DRIFT_SPEED = 0.2;
const DRIFT_RATE = 2;
const ATTRACTION_RATE = 0.5;
const DAMPING_RATE = 1;
const POINTER_RADIUS = 0.2;
const POINTER_CARRY = 6;
const LIGHT_LIFT = 0.3; // the light floats this far in front of the swarm plane

const SHOP = {
  Shop: ['Vases', 'Bowls', 'Cups', 'Lamps', 'Textiles'],
  Help: ['Delivery', 'Returns', 'Care guide', 'Contact'],
};

const TAN = Math.tan((17.5 * Math.PI) / 180); // half the camera's 35° vertical field of view

// Path geometry shared by the GL swarm and the drawn still. The world keeps one scale (300–400 px a unit, so a
// pebble reads the same size everywhere) and the path runs corner to corner through the footer's open band, the
// empty row between the headline and the links, so the densest part of the swarm never sits behind a word.
function pathFor(W, H, band) {
  const ppu = Math.min(400, Math.max(300, W / 3.2));
  const toY = (py) => (H / 2 - py) / ppu;
  const top = toY(band.top);
  const bottom = toY(band.bottom);
  const cy = (top + bottom) / 2;
  const half = (top - bottom) / 2;
  const halfW = W / 2 / ppu;
  const wide = W >= 700;
  const ext = wide ? 0.15 : -0.04; // wide footers: the swarm enters and leaves past the edges
  const rise = wide ? Math.min(0.36, Math.max(0.12, half - 0.1)) : Math.max(0.1, half - 0.12);
  return { start: [-halfW - ext, cy + rise], end: [halfW + ext, cy - rise], cameraZ: H / (2 * TAN * ppu), ppu, cy, halfW };
}

// A colour control's value (a token name or a hex) as a colour string the GL and canvas code can parse.
const cssColour = (v) => (/^#/.test(v) ? v : readToken(`--${v}`) || '#c9744b');

export default function mount(root, options, ctx) {
  const { shop } = content;
  let cfg = { ...options };
  root.className = 'sf';
  root.innerHTML = html`
    <footer class="sf__foot" data-footer>
      <div class="sf__gl" data-gl aria-hidden="true"><canvas class="sf__still" data-still hidden></canvas></div>
      <div class="sf__grid ac-wrap">
        <h2 class="sf__head">The next kiln opens on 6&nbsp;November.</h2>
        <div class="sf__band" data-band aria-hidden="true"></div>
        <form class="sf__form" data-form novalidate>
          <label class="ac-label" for="sf-email">Kiln letters · one a month</label>
          <div class="sf__field">
            <input class="sf__input" id="sf-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required>
            <button class="ac-btn ac-btn--accent" type="submit">Subscribe</button>
          </div>
          <p class="ac-small sf__msg" data-msg aria-live="polite"></p>
        </form>
        <nav class="sf__cols" aria-label="${shop.name}">
          ${Object.entries(SHOP).map(([title, links]) => html`<div><p class="ac-label">${title}</p><ul role="list">${links.map((l) => html`<li><a href="#top">${l}</a></li>`)}</ul></div>`)}
        </nav>
      </div>
    </footer>`;
  root.querySelectorAll('a[href="#top"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  // The newsletter: native validity, the page's own words.
  const form = root.querySelector('[data-form]');
  const input = form.querySelector('input');
  const msg = root.querySelector('[data-msg]');
  on(ctx, form, 'submit', (e) => {
    e.preventDefault();
    if (!input.checkValidity()) {
      input.setAttribute('aria-invalid', 'true');
      msg.textContent = input.value ? 'That address is missing something — check the part after the @.' : 'Add your email address first.';
      input.focus();
      return;
    }
    input.removeAttribute('aria-invalid');
    msg.textContent = 'Thanks. The next letter goes out on 5 November.';
    form.reset();
  });

  const footer = root.querySelector('[data-footer]');
  const host = root.querySelector('[data-gl]');
  const still = root.querySelector('[data-still]');
  const bandEl = root.querySelector('[data-band]');
  const measure = () => {
    const f = footer.getBoundingClientRect();
    const b = bandEl.getBoundingClientRect();
    return { W: Math.max(1, f.width), H: Math.max(1, f.height), band: { top: b.top - f.top, bottom: b.bottom - f.top } };
  };
  const gl2 = webgl2Available();

  // The drawn still for the static tier and browsers without WebGL 2: the same path, pebbles as shaded ellipses.
  const drawStill = () => {
    still.hidden = false;
    const { W, H, band } = measure();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    still.width = Math.round(W * dpr);
    still.height = Math.round(H * dpr);
    const g = still.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const p = pathFor(W, H, band);
    const toScreen = (x, y) => [W / 2 + x * p.ppu, H / 2 - y * p.ppu];
    let s = 7;
    const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const base = cssColour(cfg.glaze);
    const lightCol = readToken('--sand');
    const n = 520;
    const scale = p.ppu;
    const dx = p.end[0] - p.start[0];
    const dy = p.end[1] - p.start[1];
    const len = Math.hypot(dx, dy);
    const ux = -dy / len;
    const uy = dx / len;
    for (let i = 0; i < n; i++) {
      const t = rand();
      const a = CURVE_FREQ * t * len;
      const rad = rand() * SPIRAL_RADIUS;
      const ph = rand() * Math.PI * 2 + SPIRAL_FREQ * rand() * 2 * t * len;
      const off = CURVE_AMP * Math.sin(a) + rad * Math.cos(ph);
      const [x, y] = toScreen(p.start[0] + dx * t + ux * off, p.start[1] + dy * t + uy * off);
      const size = SEED * scale * (0.85 + Math.sin(ph) * 0.15);
      const angle = Math.atan2(-dy, dx) + (rand() - 0.5) * 1.6;
      g.save();
      g.translate(x, y);
      g.rotate(angle);
      const grad = g.createRadialGradient(-size * 0.4, -size * 0.5, size * 0.1, 0, 0, size * 1.1);
      grad.addColorStop(0, lightCol);
      grad.addColorStop(0.35, base);
      grad.addColorStop(1, readToken('--night'));
      g.fillStyle = grad;
      g.globalAlpha = 0.6 + rand() * 0.4;
      g.beginPath();
      g.ellipse(0, 0, size, size * 0.66, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  };

  let gl = null; // the running swarm: { set(cfg, changed) }
  if (ctx.motion === 'static' || !gl2) {
    let raf = 0;
    const redraw = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(drawStill); };
    drawStill();
    observeResize(ctx, [footer, bandEl], redraw);
    document.fonts?.ready.then(() => { if (!ctx.signal.aborted) redraw(); });
    ctx.onTheme(drawStill);
    ctx.onCleanup(() => cancelAnimationFrame(raf));
  } else {
    // Fetch three.js and start only when the footer is within a screen of the viewport.
    let started = false;
    const near = observeIntersection(ctx, footer, async ([entry]) => {
      if (!entry.isIntersecting || started) return;
      started = true;
      near.disconnect();
      try {
        const kit = await import('../../src/demo-kit/three.js');
        if (ctx.signal.aborted) return;
        gl = startSwarm(kit);
      } catch (error) {
        console.warn('swarm-footer: WebGL failed, showing the still', error);
        drawStill();
      }
    }, { rootMargin: '100% 0px' });
  }

  function startSwarm({ THREE, useRenderer }) {
    const tier = qualityTier();
    const coarse = !finePointer();
    const side = Math.min(Number(cfg.count), coarse || innerWidth < 760 || tier.name === 'low' ? 24 : 40);
    const COUNT = side * side;
    const full = ctx.motion === 'full';
    const { renderer, onResize } = useRenderer(ctx, host, { alpha: true, dprCap: Math.min(tier.dpr, 1.75) });
    renderer.setClearColor(0x000000, 0);
    footer.classList.add('is-gl');

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
    camera.position.set(0, 0, 3.2);

    const path = { start: new THREE.Vector3(), end: new THREE.Vector3(), seg: new THREE.Vector3(), tan: new THREE.Vector3(), u: new THREE.Vector3(), v: new THREE.Vector3(), len: 1, time: 0 };
    const field = { count: new THREE.Vector3(), volMin: new THREE.Vector3(), voxel: new THREE.Vector3(), cols: 1, atlas: new THREE.Vector2() };
    const layout = () => {
      const { W, H, band } = measure();
      const p = pathFor(W, H, band);
      idle.set(p.halfW * 0.35, p.cy, Math.min(0.32, (band.bottom - band.top) / p.ppu / 2));
      path.start.set(p.start[0], p.start[1], 0);
      path.end.set(p.end[0], p.end[1], 0);
      path.seg.subVectors(path.end, path.start);
      path.len = path.seg.length();
      path.tan.copy(path.seg).divideScalar(path.len);
      path.u.crossVectors(path.tan, new THREE.Vector3(0, 0, 1)).normalize();
      path.v.crossVectors(path.tan, path.u).normalize();
      const reach = SPIRAL_RADIUS + CURVE_AMP + 0.05;
      const min = new THREE.Vector3(Math.min(path.start.x, path.end.x) - reach, Math.min(path.start.y, path.end.y) - reach, -reach);
      const max = new THREE.Vector3(Math.max(path.start.x, path.end.x) + reach, Math.max(path.start.y, path.end.y) + reach, reach);
      const portrait = Math.abs(path.seg.y) > Math.abs(path.seg.x);
      field.count.set(portrait ? 16 : 32, portrait ? 32 : 16, 16);
      field.volMin.copy(min);
      field.voxel.subVectors(max, min).divide(field.count.clone().subScalar(1));
      field.cols = Math.ceil(Math.sqrt(field.count.x * field.count.y * field.count.z) / field.count.x);
      field.atlas.set(field.count.x * field.cols, field.count.y * Math.ceil(field.count.z / field.cols));
      camera.position.z = p.cameraZ;
    };

    // Per-pebble state on the CPU.
    const pos = new Float32Array(COUNT * 3);
    const vel = new Float32Array(COUNT * 3);
    const radius = new Float32Array(COUNT);
    const phase = new Float32Array(COUNT);
    const freq = new Float32Array(COUNT);
    const bright = new Float32Array(COUNT);
    const quat = new Float32Array(COUNT * 4);
    const tumble = new Float32Array(COUNT * 4);
    const posData = new Float32Array(COUNT * 4);
    const rotData = new Float32Array(COUNT * 4);
    const tmp = new THREE.Vector3();
    const tmp2 = new THREE.Vector3();
    const target = new THREE.Vector3();
    const velV = new THREE.Vector3();
    const qa = new THREE.Quaternion();
    const qb = new THREE.Quaternion();
    const qc = new THREE.Quaternion();
    const m4 = new THREE.Matrix4();
    const yAxis = new THREE.Vector3();
    const xAxis = new THREE.Vector3();
    const zAxis = new THREE.Vector3();

    const pathTarget = (t, i, out) => {
      const a = CURVE_FREQ * t * path.len + path.time * CURVE_SPEED;
      out.copy(path.start).addScaledVector(path.seg, t);
      out.addScaledVector(path.u, CURVE_AMP * Math.sin(a)).addScaledVector(path.v, CURVE_AMP * Math.cos(a));
      const s = SPIRAL_FREQ * freq[i] * t * path.len + phase[i];
      return out.addScaledVector(path.u, radius[i] * Math.cos(s)).addScaledVector(path.v, radius[i] * Math.sin(s));
    };
    // Long axis along the travel, then a fixed per-pebble tumble so the swarm never reads as aligned.
    const orient = (i, amount) => {
      velV.fromArray(vel, i * 3);
      if (velV.lengthSq() > 1e-8) {
        yAxis.copy(velV).normalize();
        xAxis.set(0, 0, 1);
        if (Math.abs(yAxis.z) > 0.99) xAxis.set(1, 0, 0);
        xAxis.cross(yAxis).normalize();
        zAxis.crossVectors(xAxis, yAxis);
        qb.setFromRotationMatrix(m4.makeBasis(xAxis, yAxis, zAxis));
      } else qb.fromArray(quat, i * 4);
      qa.fromArray(quat, i * 4);
      if (amount >= 1 || qa.lengthSq() < 0.5) qa.copy(qb); else qa.slerp(qb, amount);
      qa.toArray(quat, i * 4);
      qc.copy(qa).multiply(qb.fromArray(tumble, i * 4)).toArray(rotData, i * 4);
    };
    const seed = () => {
      let s = 11;
      const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < COUNT; i++) {
        radius[i] = rand() * SPIRAL_RADIUS;
        phase[i] = rand() * Math.PI * 2;
        freq[i] = rand() * 2;
        bright[i] = rand();
        pathTarget(rand(), i, target).toArray(pos, i * 3);
        tmp.copy(path.tan).multiplyScalar(DRIFT_SPEED).toArray(vel, i * 3);
        qa.setFromAxisAngle(tmp.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize(), (rand() - 0.5) * Math.PI * 2).toArray(tumble, i * 4);
        orient(i, 1);
      }
    };

    // Pointer: projected onto the swarm plane (z = 0). The light rides it; the swarm is pushed by it.
    const pointer = { has: false, ndc: new THREE.Vector2(), world: new THREE.Vector3(), prev: new THREE.Vector3(), delta: new THREE.Vector3() };
    const idle = new THREE.Vector3(0.55, 0, 0.3); // the idle figure-eight: x amplitude, centre y, y amplitude
    const light = new THREE.Vector3(0.45, 0.15, LIGHT_LIFT);
    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const onPointer = (e) => {
      const r = host.getBoundingClientRect();
      if (e.clientY < r.top || e.clientY > r.bottom) return;
      pointer.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      pointer.has = true;
    };
    if (full) {
      on(ctx, window, 'pointermove', onPointer, { passive: true });
      on(ctx, window, 'pointerdown', onPointer, { passive: true });
      on(ctx, document, 'pointerleave', () => { pointer.has = false; });
    }

    // Spatial hash for the contact pass: O(n) instead of every pair; numeric keys, no strings per frame.
    const cells = new Map();
    const key = (x, y, z) => ((x + 512) * 1024 + (y + 512)) * 1024 + (z + 512);
    const contacts = () => {
      cells.clear();
      for (let i = 0; i < COUNT; i++) {
        const k = key(Math.floor(pos[i * 3] / CONTACT), Math.floor(pos[i * 3 + 1] / CONTACT), Math.floor(pos[i * 3 + 2] / CONTACT));
        let c = cells.get(k);
        if (!c) cells.set(k, (c = []));
        c.push(i);
      }
      const c2 = CONTACT * CONTACT;
      for (let i = 0; i < COUNT; i++) {
        const cx = Math.floor(pos[i * 3] / CONTACT);
        const cy = Math.floor(pos[i * 3 + 1] / CONTACT);
        const cz = Math.floor(pos[i * 3 + 2] / CONTACT);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
          const list = cells.get(key(cx + dx, cy + dy, cz + dz));
          if (!list) continue;
          for (const j of list) {
            if (j <= i) continue;
            const ex = pos[j * 3] - pos[i * 3];
            const ey = pos[j * 3 + 1] - pos[i * 3 + 1];
            const ez = pos[j * 3 + 2] - pos[i * 3 + 2];
            const d2 = ex * ex + ey * ey + ez * ez;
            if (d2 >= c2 || d2 < 1e-12) continue;
            const d = Math.sqrt(d2);
            const push = ((CONTACT - d) * 0.5) / d;
            pos[i * 3] -= ex * push; pos[i * 3 + 1] -= ey * push; pos[i * 3 + 2] -= ez * push;
            pos[j * 3] += ex * push; pos[j * 3 + 1] += ey * push; pos[j * 3 + 2] += ez * push;
          }
        }
      }
    };

    const step = (dt) => {
      path.time += dt;
      const pull = 1 - Math.exp(-dt * ATTRACTION_RATE);
      const drift = 1 - Math.exp(-dt * DRIFT_RATE);
      const damping = Math.exp(-dt * DAMPING_RATE);
      const carry = Math.exp(-dt * 10);
      const reach = POINTER_RADIUS + SEED;
      for (let i = 0; i < COUNT; i++) {
        const o = i * 3;
        tmp.fromArray(pos, o);
        velV.fromArray(vel, o);
        let t = tmp2.subVectors(tmp, path.start).dot(path.seg) / (path.len * path.len);
        pathTarget(t, i, target);
        velV.addScaledVector(tmp2.subVectors(tmp, target), -pull);
        velV.addScaledVector(path.tan, (DRIFT_SPEED - velV.dot(path.tan)) * drift);
        velV.multiplyScalar(damping);
        tmp.addScaledVector(velV, dt);
        t = tmp2.subVectors(tmp, path.start).dot(path.seg) / (path.len * path.len);
        if (t > 1) pathTarget(0, i, tmp); else if (t < 0) pathTarget(1, i, tmp);
        if (pointer.has) {
          tmp2.subVectors(tmp, pointer.world);
          const d = tmp2.length();
          if (d < reach && d > 1e-3) velV.addScaledVector(tmp2, (cfg.push * (reach - d)) / d).addScaledVector(pointer.delta, POINTER_CARRY * carry);
        }
        tmp.toArray(pos, o);
        velV.toArray(vel, o);
      }
      contacts();
      for (let i = 0; i < COUNT; i++) orient(i, 0.8);
    };

    const posTex = new THREE.DataTexture(posData, side, side, THREE.RGBAFormat, THREE.FloatType);
    const rotTex = new THREE.DataTexture(rotData, side, side, THREE.RGBAFormat, THREE.FloatType);
    for (const t of [posTex, rotTex]) { t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; }
    const upload = () => {
      for (let i = 0; i < COUNT; i++) {
        posData[i * 4] = pos[i * 3]; posData[i * 4 + 1] = pos[i * 3 + 1]; posData[i * 4 + 2] = pos[i * 3 + 2]; posData[i * 4 + 3] = bright[i];
      }
      posTex.needsUpdate = true;
      rotTex.needsUpdate = true;
    };
    const instanceUv = new Float32Array(COUNT * 2);
    for (let i = 0; i < COUNT; i++) { instanceUv[i * 2] = ((i % side) + 0.5) / side; instanceUv[i * 2 + 1] = (Math.floor(i / side) + 0.5) / side; }

    // Light field targets: drawn (this frame's marks), prev and curr (the eased field, ping-pong).
    const rtOpts = { type: THREE.UnsignedByteType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false, generateMipmaps: false };
    let drawnRT;
    let prevRT;
    let currRT;
    const fieldUniforms = { uField: { value: null }, uAtlas: { value: field.atlas }, uCols: { value: 1 }, uCount: { value: field.count }, uVolMin: { value: field.volMin }, uVoxel: { value: field.voxel } };
    const fieldTargets = () => {
      for (const rt of [drawnRT, prevRT, currRT]) rt?.dispose();
      drawnRT = new THREE.WebGLRenderTarget(field.atlas.x, field.atlas.y, rtOpts);
      prevRT = new THREE.WebGLRenderTarget(field.atlas.x, field.atlas.y, rtOpts);
      currRT = new THREE.WebGLRenderTarget(field.atlas.x, field.atlas.y, rtOpts);
      for (const rt of [prevRT, currRT]) { renderer.setRenderTarget(rt); renderer.clear(); }
      renderer.setRenderTarget(null);
      fieldUniforms.uCols.value = field.cols;
      fieldUniforms.uField.value = currRT.texture;
    };

    const geo = new THREE.InstancedBufferGeometry();
    const base = pebbleGeometry(THREE);
    for (const name of ['position', 'normal']) geo.setAttribute(name, base.attributes[name]);
    geo.setIndex(base.getIndex());
    geo.setAttribute('instanceUv', new THREE.InstancedBufferAttribute(instanceUv, 2));
    geo.instanceCount = COUNT;
    const seedUniforms = {
      ...fieldUniforms,
      uPos: { value: posTex }, uRot: { value: rotTex }, uLight: { value: light },
      uColA: { value: new THREE.Color() }, uColB: { value: new THREE.Color() }, uLightColor: { value: new THREE.Color() },
      uFieldStrength: { value: cfg.field ? 1 : 0 }, uAmbient: { value: 0.05 }, uAttK: { value: 9 }, uLightPower: { value: cfg.intensity },
    };
    const seedMat = new THREE.ShaderMaterial({ vertexShader: SEED_VERT, fragmentShader: SEED_FRAG, uniforms: seedUniforms });
    const mesh = new THREE.Mesh(geo, seedMat);
    mesh.frustumCulled = false;
    scene.add(mesh);

    const splatGeo = new THREE.BufferGeometry();
    splatGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    splatGeo.setAttribute('instanceUv', new THREE.BufferAttribute(instanceUv, 2));
    const splatMat = new THREE.ShaderMaterial({ vertexShader: SPLAT_VERT, fragmentShader: SPLAT_FRAG, uniforms: { ...fieldUniforms, uPos: { value: posTex } }, blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, depthTest: false, depthWrite: false });
    const splat = new THREE.Points(splatGeo, splatMat);
    splat.frustumCulled = false;
    const splatScene = new THREE.Scene();
    splatScene.add(splat);
    const blendMat = new THREE.ShaderMaterial({ vertexShader: BLEND_VERT, fragmentShader: BLEND_FRAG, depthTest: false, depthWrite: false, uniforms: { uPrev: { value: null }, uDrawn: { value: null }, uRise: { value: 0.15 }, uFall: { value: 0.05 }, uAtlas: { value: field.atlas }, uCols: fieldUniforms.uCols, uCount: { value: field.count } } });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blendMat);
    quad.frustumCulled = false;
    const quadScene = new THREE.Scene();
    quadScene.add(quad);
    const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const updateField = (instant = false) => {
      renderer.setRenderTarget(drawnRT);
      renderer.clear();
      renderer.render(splatScene, ortho);
      [prevRT, currRT] = [currRT, prevRT];
      blendMat.uniforms.uPrev.value = prevRT.texture;
      blendMat.uniforms.uDrawn.value = drawnRT.texture;
      blendMat.uniforms.uRise.value = instant ? 1 : 0.15;
      blendMat.uniforms.uFall.value = instant ? 1 : 0.05;
      renderer.setRenderTarget(currRT);
      renderer.render(quadScene, ortho);
      renderer.setRenderTarget(null);
      fieldUniforms.uField.value = currRT.texture;
    };

    // Colours from the tokens: the glaze and a lighter glaze, a warm light; more ambient on a light ground.
    const colours = () => {
      const glaze = new THREE.Color(cssColour(cfg.glaze));
      const sand = new THREE.Color(readToken('--sand') || '#e3d2b1');
      seedUniforms.uColA.value.copy(glaze).lerp(new THREE.Color(readToken('--night') || '#1b1d24'), 0.15);
      seedUniforms.uColB.value.copy(glaze).lerp(sand, 0.55);
      seedUniforms.uLightColor.value.set(readToken('--accent') || '#ff5420').lerp(new THREE.Color('#ffffff'), 0.6);
      seedUniforms.uAmbient.value = document.documentElement.dataset.theme === 'dark' ? 0.07 : 0.2;
    };

    // A soft glow behind the swarm where the light is, so the light reads even between pebbles.
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = glowCanvas.height = 128;
    const gc = glowCanvas.getContext('2d');
    const gg = gc.createRadialGradient(64, 64, 0, 64, 64, 64);
    gg.addColorStop(0, 'rgba(255,255,255,1)');
    gg.addColorStop(0.3, 'rgba(255,255,255,0.4)');
    gg.addColorStop(1, 'rgba(255,255,255,0)');
    gc.fillStyle = gg;
    gc.fillRect(0, 0, 128, 128);
    const glowTex = new THREE.CanvasTexture(glowCanvas);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: seedUniforms.uLightColor.value, transparent: true, depthWrite: false }));
    glow.scale.setScalar(1.5);
    scene.add(glow);
    const glowLevel = () => {
      const dark = document.documentElement.dataset.theme === 'dark';
      glow.material.opacity = Math.min(1, (dark ? 0.14 : 0.2) * seedUniforms.uLightPower.value);
    };

    const render = () => {
      glow.position.set(light.x, light.y, -0.45);
      renderer.render(scene, camera);
    };
    let ready = false;
    // Settle the swarm before its first frame, so a still or a thumbnail shows it in its stride, then fill the field.
    const settle = () => { seed(); for (let i = 0; i < 24; i++) step(1 / 30); upload(); updateField(true); };
    const relayout = ({ reseed = false } = {}) => {
      const before = `${field.atlas.x}x${field.atlas.y}`;
      layout();
      camera.updateProjectionMatrix();
      const resized = !drawnRT || before !== `${field.atlas.x}x${field.atlas.y}`;
      if (resized) fieldTargets();
      if (!ready) return;
      // Full motion: the swarm flows to the new path on its own. Reduced: settle again and draw the one frame.
      if (reseed || !full) settle(); else if (resized) updateField(true);
      if (!full) { light.set(idle.x * 0.5, idle.y + idle.z * 0.6, LIGHT_LIFT); render(); }
    };
    onResize(({ width, height }) => { camera.aspect = width / height; relayout(); });
    observeResize(ctx, bandEl, () => relayout());
    document.fonts?.ready.then(() => { if (!ctx.signal.aborted) relayout({ reseed: true }); });
    colours();
    glowLevel();
    light.set(idle.x * 0.5, idle.y + idle.z * 0.6, LIGHT_LIFT);
    settle();
    ready = true;
    ctx.onCleanup(() => {
      for (const o of [drawnRT, prevRT, currRT, posTex, rotTex, geo, base, splatGeo, seedMat, splatMat, blendMat, quad.geometry, glowTex, glow.material]) o?.dispose();
    });

    let clock = 0;
    const frame = (dt) => {
      clock += dt;
      if (pointer.has) {
        ray.setFromCamera(pointer.ndc, camera);
        pointer.prev.copy(pointer.world);
        ray.ray.intersectPlane(plane, pointer.world);
        pointer.delta.subVectors(pointer.world, pointer.prev);
        if (pointer.delta.lengthSq() > 0.25) pointer.delta.set(0, 0, 0); // the first frame after a jump
        light.lerp(tmp.copy(pointer.world).setZ(LIGHT_LIFT), 1 - Math.exp(-dt * 12));
      } else {
        // No pointer yet (or a touch screen): the light idles on a slow figure-eight so the room is never dark.
        light.lerp(tmp.set(idle.x * Math.sin(clock * 0.3), idle.y + idle.z * Math.sin(clock * 0.46), LIGHT_LIFT), 1 - Math.exp(-dt * 2));
      }
      step(Math.min(dt, 1 / 20));
      upload();
      updateField();
      render();
    };

    if (full) {
      let off = null;
      whileVisible(ctx, footer, () => { off = onFrame(ctx, frame); }, () => { off?.(); off = null; }, { rootMargin: '0px' });
    } else {
      render(); // reduced motion: one settled frame, the light parked
    }
    ctx.onTheme(() => { colours(); glowLevel(); if (!full) render(); });

    return {
      set(next, changed) {
        if (changed.includes('glaze')) colours();
        seedUniforms.uLightPower.value = next.intensity;
        seedUniforms.uFieldStrength.value = next.field ? 1 : 0;
        glowLevel();
        if (!full) render();
      },
    };
  }

  return {
    update(next, changed) {
      cfg = { ...next };
      if (changed.includes('count')) return gl ? false : undefined;
      gl?.set(cfg, changed);
      if (!gl && !still.hidden) drawStill();
      return undefined;
    },
  };
}

// A glazed pebble: a squashed ellipsoid, generated, so there is no model file. ~120 triangles: read in aggregate.
function pebbleGeometry(THREE) {
  const g = new THREE.SphereGeometry(1, 10, 7);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * 0.74 * SEED, p.getY(i) * SEED, p.getZ(i) * 0.58 * SEED);
  g.computeVertexNormals();
  return g;
}

const QUAT = /* glsl */ `vec3 qrot(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }`;

// Shared by the pebble shader and the field passes: voxel index space has voxel centres at integers.
const FIELD = /* glsl */ `
  uniform sampler2D uField; uniform vec2 uAtlas; uniform float uCols; uniform vec3 uCount; uniform vec3 uVolMin; uniform vec3 uVoxel;
  vec3 worldToGrid(vec3 p) { return (p - uVolMin) / uVoxel; }
  vec2 sliceUv(vec2 xy, float z) { return (xy + vec2(mod(z, uCols), floor(z / uCols)) * uCount.xy + 0.5) / uAtlas; }
  float sampleField(vec3 g) {
    vec3 c = clamp(g, vec3(0.0), uCount - 1.0);
    float z0 = floor(c.z); float z1 = min(z0 + 1.0, uCount.z - 1.0);
    return mix(texture2D(uField, sliceUv(c.xy, z0)).r, texture2D(uField, sliceUv(c.xy, z1)).r, c.z - z0);
  }`;

const SEED_VERT = /* glsl */ `
  attribute vec2 instanceUv;
  uniform sampler2D uPos; uniform sampler2D uRot;
  varying vec3 vNormal; varying vec3 vWorld; varying float vBright;
  ${QUAT}
  void main() {
    vec4 p = texture2D(uPos, instanceUv);
    vec4 q = texture2D(uRot, instanceUv);
    vec3 world = p.xyz + qrot(q, position);
    vNormal = normalize(qrot(q, normal));
    vWorld = world; vBright = p.w;
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }`;

const SEED_FRAG = /* glsl */ `
  uniform vec3 uLight; uniform vec3 uColA; uniform vec3 uColB; uniform vec3 uLightColor;
  uniform float uFieldStrength; uniform float uAmbient; uniform float uAttK; uniform float uLightPower;
  varying vec3 vNormal; varying vec3 vWorld; varying float vBright;
  ${FIELD}
  void main() {
    vec3 N = normalize(vNormal);
    if (!gl_FrontFacing) N = -N;
    vec3 V = normalize(cameraPosition - vWorld);
    vec3 L = uLight - vWorld; float d = length(L); L /= d;
    vec3 H = normalize(L + V);
    float diff = max(dot(N, L), 0.0);
    float spec = pow(max(dot(N, H), 0.0), 80.0 - 40.0 * vBright);
    float att = uLightPower / (1.0 + uAttK * d * d);
    // Occlusion from the voxel grid: one voxel out along the normal, one and two voxels toward the light.
    float step1 = min(uVoxel.x, min(uVoxel.y, uVoxel.z));
    vec3 g = worldToGrid(vWorld);
    float ao = 1.0 - 0.55 * sampleField(g + N * step1 / uVoxel) * uFieldStrength;
    ao *= ao;
    float block = max(sampleField(g + L * step1 / uVoxel), sampleField(g + 2.0 * L * step1 / uVoxel));
    float shadow = 1.0 - 0.7 * block * uFieldStrength; shadow *= shadow;
    vec3 albedo = mix(uColA, uColB, step(0.62, vBright));
    vec3 col = albedo * uLightColor * diff * att * shadow * ao;
    col += albedo * uAmbient * ao;
    col += uLightColor * spec * att * shadow * ao * 0.45;
    col += albedo * max(-dot(N, L), 0.0) * att * (1.0 - shadow) * 0.04;
    gl_FragColor = vec4(1.0 - exp(-col * 1.6), 1.0);
    #include <colorspace_fragment>
  }`;

// One-pixel points: every pebble marks its voxel in the drawn atlas; MAX blending makes the mark binary.
const SPLAT_VERT = /* glsl */ `
  attribute vec2 instanceUv;
  uniform sampler2D uPos;
  ${FIELD}
  void main() {
    vec3 g = clamp(floor(worldToGrid(texture2D(uPos, instanceUv).xyz) + 0.5), vec3(0.0), uCount - 1.0);
    gl_Position = vec4(sliceUv(g.xy, g.z) * 2.0 - 1.0, 0.0, 1.0);
    gl_PointSize = 1.0;
  }`;
const SPLAT_FRAG = /* glsl */ `void main() { gl_FragColor = vec4(1.0); }`;

// Blur across a 3 × 3 × 3 neighbourhood (bilinear taps between voxels, slices weighted ¼ ½ ¼) and ease toward it.
const BLEND_VERT = /* glsl */ `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const BLEND_FRAG = /* glsl */ `
  uniform sampler2D uPrev; uniform sampler2D uDrawn; uniform float uRise; uniform float uFall;
  uniform vec2 uAtlas; uniform float uCols; uniform vec3 uCount;
  float tap(vec2 xy, float z) {
    vec2 c = clamp(xy, vec2(0.0), uCount.xy - 1.0);
    float zz = clamp(z, 0.0, uCount.z - 1.0);
    return texture2D(uDrawn, (c + vec2(mod(zz, uCols), floor(zz / uCols)) * uCount.xy + 0.5) / uAtlas).r;
  }
  float slice4(vec2 xy, float z) { return (tap(xy + vec2(-0.5, -0.5), z) + tap(xy + vec2(0.5, -0.5), z) + tap(xy + vec2(-0.5, 0.5), z) + tap(xy + vec2(0.5, 0.5), z)) * 0.25; }
  void main() {
    vec2 px = floor(gl_FragCoord.xy);
    vec2 cr = floor(px / uCount.xy);
    float z = cr.y * uCols + cr.x;
    float prev = texture2D(uPrev, gl_FragCoord.xy / uAtlas).r;
    if (z > uCount.z - 1.0) { gl_FragColor = vec4(0.0); return; }
    vec2 xy = px - cr * uCount.xy;
    float curr = (slice4(xy, z - 1.0) + 2.0 * slice4(xy, z) + slice4(xy, z + 1.0)) * 0.25;
    prev += (curr - prev) * (curr > prev ? uRise : uFall);
    gl_FragColor = vec4(prev, prev, prev, 1.0);
  }`;
