// Scene switch — a speaker's finish picker. Each finish is its own scene (its own set, light and ground), rendered
// into a render target; choosing another finish blends the outgoing and incoming targets on one fullscreen plane with
// a feathered wipe, a noise dissolve or an iris, plus a touch of zoom. Only the two scenes involved render during a
// switch, one at rest, none when nothing moves. The copy column's tint changes in the same beat (same duration, same
// ease). Radios, arrow keys and prev/next switch; reduced motion swaps at once. No WebGL: drawn stills.
import './demo.css';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { on, onFrame, whileVisible, html, raw, readToken, qualityTier, content, formatPrice } from '../../src/demo-kit/index.js';
import { useRenderer, webglAvailable, disposeScene } from '../../src/demo-kit/three.js';

// Grounds are token mixes so the sets stay in the library's palette: [token, other, share of the other].
const FINISHES = [
  { id: 'chalk', note: 'A warm white that sits back against plaster, pale oak and linen.', ground: ['--sand', 'white', 0.55], set: 'stone' },
  { id: 'graphite', note: 'Anodised near-black with a charcoal grille, for dark shelves and late rooms.', ground: ['--night', '--sky', 0.06], set: 'studio' },
  { id: 'clay', note: 'Fired-earth orange, the colour of the foam in the first prototype.', ground: ['--clay', '--sand', 0.42], set: 'arch' },
];
const MODES = { wipe: 0, noise: 1, iris: 2 };
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2); // the theme's in-out curve, sampled

const quadVert = /* glsl */ 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
// uA is the outgoing frame, uB the incoming one. m = 1 keeps A; the threshold sweeps across `edge` as p goes 0 → 1.
const compositeFrag = /* glsl */ `
  precision highp float;
  uniform sampler2D uA; uniform sampler2D uB;
  uniform float uProgress, uAspect, uMode, uFeather, uZoom;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);
  }
  void main() {
    vec2 q = vec2(vUv.x * uAspect, vUv.y);
    float edge;
    if (uMode < 0.5) edge = (q.x + vUv.y) / (uAspect + 1.0);                                    // diagonal, bottom-left first
    else if (uMode < 1.5) edge = clamp(noise(q * 3.2) * 0.62 + noise(q * 9.0) * 0.28 + vUv.y * 0.1, 0.0, 1.0); // dissolve
    else edge = length(q - vec2(uAspect * 0.5, 0.5)) / length(vec2(uAspect * 0.5, 0.5));      // iris from the centre
    float p = uProgress;
    float m = smoothstep(p * (1.0 + uFeather) - uFeather, p * (1.0 + uFeather), edge);
    vec2 zoomA = (vUv - 0.5) * (1.0 + uZoom * p) + 0.5;           // the outgoing scene drifts away
    vec2 zoomB = (vUv - 0.5) * (1.0 - uZoom * (1.0 - p)) + 0.5;   // the incoming one settles in
    gl_FragColor = mix(texture2D(uB, zoomB), texture2D(uA, zoomA), m);
    // One light falloff for every set: a lift behind the product, a vignette at the edges.
    float r = length((vUv - vec2(0.5, 0.56)) * vec2(uAspect, 1.0) / max(uAspect, 1.0));
    gl_FragColor.rgb *= mix(1.12, 0.74, smoothstep(0.08, 0.95, r));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

// The no-WebGL still: the same speaker drawn flat, its colours on the custom properties the copy column uses.
const STILL = '<svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect class="ss__still-ground" width="400" height="400"/><ellipse cx="200" cy="318" rx="120" ry="18" fill="rgb(0 0 0 / 0.14)"/><rect class="ss__still-body" x="140" y="96" width="120" height="214" rx="52"/><ellipse cx="200" cy="108" rx="54" ry="11" fill="rgb(255 255 255 / 0.5)"/></svg>';

function knit() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#808080';
  g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 4) {
    for (let x = 0; x < 128; x += 4) {
      const v = 110 + ((x * 7 + y * 13) % 5) * 12;
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x + ((y / 4) % 2) * 2, y, 3, 3);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 6);
  return t;
}

export default function mount(root, options, ctx) {
  const { product } = content;
  let cfg = { ...options };
  const finishes = FINISHES.map((f) => ({ ...f, ...product.colours.find((c) => c.id === f.id) }));
  const cssGround = ([a, b, t]) => `color-mix(in oklab, var(${a}), ${b === 'white' ? 'white' : `var(${b})`} ${Math.round(t * 100)}%)`;
  let index = Math.max(0, finishes.findIndex((f) => f.id === cfg.start));

  root.className = 'ss';
  root.innerHTML = html`
    <header class="ac-bar ss__bar">
      <a class="ac-brand" href="#top">${product.maker}</a>
      <nav aria-label="Product"><a href="#top" aria-current="page">${product.name}</a><a href="#top">Specs</a><a href="#top">Support</a></nav>
    </header>
    <main class="ss__main">
      <section class="ss__copy" aria-labelledby="ss-title">
        <div class="ss__inner">
          <p class="ac-label">${product.name} · Finishes</p>
          <h1 class="ac-h1" id="ss-title">One speaker, three rooms it was made for.</h1>
          <div class="ss__finish" aria-live="polite">
            <p class="ss__name"><span class="ss__dot" data-dot></span><span data-name></span><span class="ac-label ss__count" data-count></span></p>
            <p class="ss__note" data-note></p>
          </div>
          <fieldset class="ss__swatches">
            <legend class="sr-only">Finish</legend>
            ${finishes.map((f) => html`<label class="ss__sw" style="--sw:${f.hex}"><input type="radio" name="ss-finish" value="${f.id}"><span class="ss__sw-chip"></span><span class="ss__sw-label">${f.name}</span></label>`)}
          </fieldset>
          <div class="ss__buy">
            <a class="ac-btn ac-btn--lg" href="#buy">Pre-order — ${formatPrice(product.price)}</a>
            <div class="ss__steps">
              <button type="button" class="ss__step" data-prev aria-label="Previous finish"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12 4 6 10l6 6"/></svg></button>
              <button type="button" class="ss__step" data-next aria-label="Next finish"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m8 4 6 6-6 6"/></svg></button>
            </div>
          </div>
        </div>
      </section>
      <div class="ss__stage" data-stage><div class="ss__still" data-still hidden></div></div>
    </main>`;
  root.querySelectorAll('a[href^="#"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const stage = root.querySelector('[data-stage]');
  const still = root.querySelector('[data-still]');
  const radios = [...root.querySelectorAll('input[name="ss-finish"]')];
  const nameEl = root.querySelector('[data-name]');
  const noteEl = root.querySelector('[data-note]');
  const countEl = root.querySelector('[data-count]');

  // The DOM half of the switch: names, radios and the column's tint, on the same duration and ease as the GL.
  const showCopy = (i) => {
    const f = finishes[i];
    radios.forEach((r) => { r.checked = r.value === f.id; });
    nameEl.textContent = f.name;
    noteEl.textContent = f.note;
    countEl.textContent = `${String(i + 1).padStart(2, '0')} / ${String(finishes.length).padStart(2, '0')}`;
    root.style.setProperty('--ss-ground', cssGround(f.ground));
    root.style.setProperty('--ss-body', f.hex);
  };
  const applyTiming = () => root.style.setProperty('--ss-dur', ctx.motion === 'full' ? `${cfg.duration}s` : '0s');
  applyTiming();

  let go = (i) => { index = i; showCopy(i); };
  const pending = () => target ?? index;
  let target = null;
  const step = (d) => go((pending() + d + finishes.length) % finishes.length);
  radios.forEach((r, i) => on(ctx, r, 'change', () => { if (r.checked) go(i); }));
  on(ctx, root.querySelector('[data-prev]'), 'click', () => step(-1));
  on(ctx, root.querySelector('[data-next]'), 'click', () => step(1));
  // Left / right anywhere on the page (radios already handle their own arrows).
  on(ctx, window, 'keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); step(1); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); step(-1); }
  });

  if (!webglAvailable()) {
    still.hidden = false;
    still.innerHTML = STILL;
    go(index);
    return { update(next) { cfg = { ...next }; applyTiming(); } };
  }

  const tier = qualityTier();
  const { renderer, onResize } = useRenderer(ctx, stage, { alpha: false });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  const knitTex = knit();

  // Shared geometry: a lathed speaker body, its cap and its base; each scene gets its own materials and set.
  const profile = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    profile.push(new THREE.Vector2(1.02 - (Math.abs(t - 0.5) * 2) ** 6 * 0.3, -1.55 + t * 3.1));
  }
  const geo = {
    body: new THREE.LatheGeometry(profile, 96),
    cap: new THREE.CylinderGeometry(0.84, 0.88, 0.12, 96),
    dial: new THREE.TorusGeometry(0.4, 0.035, 16, 96),
    base: new THREE.CylinderGeometry(0.78, 0.78, 0.06, 64),
  };
  const tone = ([a, b, t]) => {
    const c = new THREE.Color(readToken(a) || '#888888');
    if (b) c.lerp(b === 'white' ? new THREE.Color(1, 1, 1) : new THREE.Color(readToken(b) || '#888888'), t);
    return c;
  };

  const sets = {
    // Pale stone: a low plinth and a pebble, soft daylight from the left.
    stone(scene, ground) {
      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.75, 0.5, 72), new THREE.MeshStandardMaterial({ color: ground.clone().lerp(new THREE.Color(1, 1, 1), 0.3), roughness: 0.95 }));
      plinth.position.y = -1.86;
      const pebble = new THREE.Mesh(new THREE.SphereGeometry(0.34, 32, 16), new THREE.MeshStandardMaterial({ color: ground.clone().multiplyScalar(0.82), roughness: 0.7 }));
      pebble.scale.set(1.2, 0.7, 1);
      pebble.position.set(1.25, -1.4, 0.5);
      const sun = new THREE.DirectionalLight(0xfff4e6, 1.1);
      sun.position.set(-4, 5, 4);
      scene.add(plinth, pebble, sun);
      scene.environmentIntensity = 0.7;
    },
    // A dark studio: a slab, a cool rim light behind, a warm key.
    studio(scene, ground) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.36, 2.4), new THREE.MeshStandardMaterial({ color: ground.clone().multiplyScalar(1.25), roughness: 0.55, metalness: 0.1 }));
      slab.position.y = -1.79;
      const rim = new THREE.DirectionalLight(tone(['--sky']), 2.6);
      rim.position.set(2.5, 3, -4);
      const key = new THREE.DirectionalLight(0xffe2c4, 1.1);
      key.position.set(-3, 2, 5);
      scene.add(slab, rim, key);
      scene.environmentIntensity = 0.35;
    },
    // A warm arched doorway behind a drum: the set the first prototype was shot on.
    arch(scene, ground) {
      const shape = new THREE.Shape();
      shape.moveTo(-1.9, -2.3);
      shape.lineTo(-1.9, 0.6);
      shape.absarc(0, 0.6, 1.9, Math.PI, 0, true);
      shape.lineTo(1.9, -2.3);
      shape.closePath();
      const arch = new THREE.Mesh(new THREE.ShapeGeometry(shape, 48), new THREE.MeshStandardMaterial({ color: ground.clone().multiplyScalar(0.62), roughness: 1 }));
      arch.position.set(0, 0, -2.6);
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.7, 72), new THREE.MeshStandardMaterial({ color: ground.clone().lerp(new THREE.Color(1, 1, 1), 0.12), roughness: 0.9 }));
      drum.position.y = -1.96;
      const sun = new THREE.DirectionalLight(0xffe7cc, 1);
      sun.position.set(3, 4, 4);
      scene.add(arch, drum, sun);
      scene.environmentIntensity = 0.6;
    },
  };

  const scenes = finishes.map((f) => {
    const scene = new THREE.Scene();
    const ground = tone(f.ground);
    scene.background = ground;
    scene.environment = env;
    const group = new THREE.Group();
    const dark = f.id === 'graphite';
    const body = new THREE.Mesh(geo.body, new THREE.MeshPhysicalMaterial({ color: f.hex, roughness: 0.9, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color(f.hex).lerp(new THREE.Color(1, 1, 1), dark ? 0.25 : 0.35), bumpMap: knitTex, bumpScale: 1.2 }));
    const capMat = new THREE.MeshStandardMaterial({ color: dark ? 0x3a3b3e : 0xd9d9d6, metalness: 1, roughness: 0.3 });
    const cap = new THREE.Mesh(geo.cap, capMat);
    cap.position.y = 1.57;
    const dial = new THREE.Mesh(geo.dial, capMat);
    dial.rotation.x = Math.PI / 2;
    dial.position.y = 1.64;
    const base = new THREE.Mesh(geo.base, new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.6 }));
    base.position.y = -1.57;
    group.add(body, cap, dial, base);
    group.rotation.set(0.06, -0.5, 0);
    scene.add(group);
    sets[f.set](scene, ground);
    return { scene, group };
  });
  ctx.onCleanup(() => {
    scenes.forEach((s) => disposeScene(s.scene));
    Object.values(geo).forEach((g) => g.dispose());
    knitTex.dispose();
    env.dispose();
  });

  // Two targets, sized to the drawing buffer: half-float where the tier allows, multisampled on high.
  const rtOpts = { type: tier.name === 'low' ? THREE.UnsignedByteType : THREE.HalfFloatType, samples: tier.name === 'high' ? 4 : 0, depthBuffer: true };
  const targets = [new THREE.WebGLRenderTarget(1, 1, rtOpts), new THREE.WebGLRenderTarget(1, 1, rtOpts)];
  const composite = new THREE.ShaderMaterial({
    vertexShader: quadVert,
    fragmentShader: compositeFrag,
    uniforms: { uA: { value: null }, uB: { value: null }, uProgress: { value: 1 }, uAspect: { value: 1 }, uMode: { value: MODES[cfg.transition] }, uFeather: { value: cfg.feather }, uZoom: { value: cfg.zoom / 100 } },
    depthTest: false,
    depthWrite: false,
  });
  const quadScene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), composite);
  quad.frustumCulled = false;
  quadScene.add(quad);
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  ctx.onCleanup(() => { targets.forEach((t) => t.dispose()); composite.dispose(); quad.geometry.dispose(); });

  const size = new THREE.Vector2();
  let dirty = true;
  onResize(({ width, height }) => {
    renderer.getDrawingBufferSize(size);
    targets.forEach((t) => t.setSize(size.x, size.y));
    const aspect = width / height;
    camera.aspect = aspect;
    camera.position.set(0, 0.8, aspect < 0.9 ? 15.5 : aspect < 1.2 ? 13.5 : 12.5);
    camera.lookAt(0, -0.45, 0);
    camera.updateProjectionMatrix();
    composite.uniforms.uAspect.value = aspect;
    dirty = true;
  });

  // Switching: from → to over cfg.duration on the in-out curve, timed by the wall clock so it holds at any frame
  // rate. A request during a switch waits and runs right after it.
  let from = index;
  let progress = 1;
  let tStart = 0;
  let queued = null;
  let spin = 0;
  go = (i) => {
    if (i === pending()) { showCopy(i); return; }
    if (target !== null) { queued = i; showCopy(i); return; }
    showCopy(i);
    if (ctx.motion !== 'full') { index = i; dirty = true; return; }
    from = index;
    target = i;
    progress = 0;
    tStart = performance.now();
  };
  go(index);

  const frame = (dt) => {
    if (target !== null) {
      const raw = Math.min(1, (performance.now() - tStart) / (cfg.duration * 1000));
      progress = ease(raw);
      if (raw >= 1) {
        index = target;
        target = null;
        progress = 1;
        if (queued !== null) { const q = queued; queued = null; go(q); }
      }
      dirty = true;
    }
    if (ctx.motion === 'full' && cfg.turntable) { spin += dt * 0.25; dirty = true; }
    if (!dirty) return;
    scenes.forEach((s) => { s.group.rotation.y = -0.5 + spin; });
    // Only the scenes on screen render: the outgoing one into A, the incoming one into B (during a switch).
    const a = target !== null ? from : index;
    renderer.setRenderTarget(targets[0]);
    renderer.render(scenes[a].scene, camera);
    if (target !== null) {
      renderer.setRenderTarget(targets[1]);
      renderer.render(scenes[target].scene, camera);
    }
    composite.uniforms.uA.value = targets[0].texture;
    composite.uniforms.uB.value = target !== null ? targets[1].texture : targets[0].texture;
    composite.uniforms.uProgress.value = target !== null ? progress : 0;
    renderer.setRenderTarget(null);
    renderer.render(quadScene, ortho);
    dirty = false;
  };
  let off = null;
  whileVisible(ctx, stage, () => { dirty = true; off = onFrame(ctx, frame); }, () => { off?.(); off = null; });
  ctx.onTheme(() => {
    finishes.forEach((f, i) => { scenes[i].scene.background = tone(f.ground); });
    dirty = true;
  });

  return {
    update(next, changed) {
      cfg = { ...next };
      composite.uniforms.uMode.value = MODES[cfg.transition];
      composite.uniforms.uFeather.value = cfg.feather;
      composite.uniforms.uZoom.value = cfg.zoom / 100;
      applyTiming();
      if (changed.includes('start')) go(Math.max(0, finishes.findIndex((f) => f.id === cfg.start)));
      dirty = true;
      return true;
    },
    action(id) {
      if (id === 'next') step(1);
    },
  };
}
