// Post-processing presets — a festival's after-dark neon, full-bleed on its own. A night stage holds a neon signal
// mark, its reflection in a wet floor and a chase of truss lights. The postprocessing composer runs render → bloom +
// grain (one merged EffectPass) → SMAA, on half-float buffers (bytes on the low tier, which skips post entirely).
// The look is one of three fixed presets — hero 1.5, chapter 0.5, quiet 0.25 — chosen with real buttons, never a
// free intensity dial. Reduced motion and static: no pulse, one render per change. No WebGL: a drawn still.
import './demo.css';
import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, NoiseEffect, SMAAEffect, BlendFunction } from 'postprocessing';
import { on, onFrame, whileVisible, html, raw, readToken, content, qualityTier } from '../../src/demo-kit/index.js';
import { useRenderer, webglAvailable, disposeScene } from '../../src/demo-kit/three.js';

// Fixed presets: the three looks a multi-scene site needs (hero, a chapter, a quiet section).
const PRESETS = {
  hero: { label: 'Hero', bloom: 1.5, grain: 0.18 },
  chapter: { label: 'Chapter', bloom: 0.5, grain: 0.12 },
  quiet: { label: 'Quiet', bloom: 0.25, grain: 0.06 },
};

// The signal mark: a dot and three arcs each side, as neon tubes. Shared by the scene and the no-WebGL still.
const ARCS = [0.62, 1.04, 1.46];
const ARC_SPAN = (100 * Math.PI) / 180;
const MARK_SVG = `<svg viewBox="-2 -2 4 4" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="0.11" stroke-linecap="round"><circle r="0.2" fill="currentColor" stroke="none"/>${ARCS.map((r) => {
  const a = ARC_SPAN / 2;
  const x = (r * Math.cos(a)).toFixed(3);
  const y = (r * Math.sin(a)).toFixed(3);
  return `<path d="M${x},${-y} A${r},${r} 0 0 1 ${x},${y}"/><path d="M${-x},${-y} A${r},${r} 0 0 0 ${-x},${y}"/>`;
}).join('')}</svg>`;

const tokenColour = (value) => (/^#|^rgb/.test(value) ? value : readToken(`--${value}`)) || '#ff5420';

export default function mount(root, options, ctx) {
  const { festival } = content;
  let cfg = { ...options };
  root.className = 'pp';
  root.innerHTML = html`
    <section class="pp__stage" aria-label="${festival.name} after-dark hero">
      <div class="pp__gl" data-stage></div>
      <div class="pp__still" data-still hidden>${raw(MARK_SVG)}</div>
      <div class="pp__looks">
        <div class="pp__switch" role="group" aria-label="Post-processing look">
          ${Object.entries(PRESETS).map(([id, p]) => html`<button type="button" data-preset="${id}" aria-pressed="false">${p.label}<span class="ac-num">${p.bloom}</span></button>`)}
        </div>
        <p class="ac-label pp__read" data-read aria-live="polite"></p>
      </div>
      <p class="ac-stage__note ac-stage__note--media"><span>${festival.name} · after-dark hero</span></p>
    </section>`;

  const host = root.querySelector('[data-stage]');
  const still = root.querySelector('[data-still]');
  const read = root.querySelector('[data-read]');
  const buttons = [...root.querySelectorAll('[data-preset]')];
  const tier = qualityTier();
  let preset = cfg.preset;
  let apply = () => {};

  const choose = (id) => {
    preset = id;
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === id)));
    root.dataset.look = id;
    apply();
  };
  buttons.forEach((b) => on(ctx, b, 'click', () => choose(b.dataset.preset)));
  const describe = (post) => {
    const p = PRESETS[preset];
    read.textContent = post ? `Bloom ${p.bloom} · grain ${(p.grain * cfg.grain).toFixed(2)} · ${cfg.smaa ? 'SMAA' : 'no AA'}` : 'Low tier · no post pass';
  };

  if (!webglAvailable()) {
    still.hidden = false;
    root.style.setProperty('--neon', `var(--${cfg.neon})`);
    apply = () => { read.textContent = PRESETS[preset].label; };
    choose(preset);
    return { update(next) { cfg = { ...next }; root.style.setProperty('--neon', `var(--${cfg.neon})`); choose(cfg.preset); } };
  }

  const { renderer, onResize } = useRenderer(ctx, host, { alpha: false, antialias: false });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);
  camera.position.set(0, 0.6, 7);

  // Neon: basic materials pushed above 1.0 so the half-float buffer keeps the overflow for the bloom to find.
  const neonMat = new THREE.MeshBasicMaterial();
  const arcMats = ARCS.map(() => new THREE.MeshBasicMaterial());
  const lampMat = new THREE.MeshBasicMaterial();
  const mark = new THREE.Group();
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 16), neonMat);
  mark.add(dot);
  ARCS.forEach((r, i) => {
    const geo = new THREE.TorusGeometry(r, 0.055, 12, 72, ARC_SPAN);
    for (const side of [0, Math.PI]) {
      const arc = new THREE.Mesh(geo, arcMats[i]);
      arc.rotation.z = side - ARC_SPAN / 2;
      mark.add(arc);
    }
  });
  // The wet floor: the mark mirrored below the floor line, seen through a dark, slightly clear floor plane.
  const reflection = mark.clone();
  reflection.scale.y = -1;
  const mirrorMats = new Map();
  reflection.traverse((o) => {
    if (!o.isMesh) return;
    if (!mirrorMats.has(o.material)) mirrorMats.set(o.material, new THREE.MeshBasicMaterial());
    o.material = mirrorMats.get(o.material);
  });
  const floorMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.84, depthWrite: false });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), floorMat);
  floor.rotation.x = -Math.PI / 2;
  // The truss: a row of small lamps along the top, with a chase running through them.
  const lamps = new THREE.Group();
  const lampGeo = new THREE.SphereGeometry(0.045, 12, 8);
  const lampList = [];
  for (let i = 0; i < 15; i++) {
    const m = new THREE.Mesh(lampGeo, lampMat.clone());
    m.position.set((i - 7) * 0.9, 2.4, -3);
    lamps.add(m);
    lampList.push(m);
  }
  const lampLine = new THREE.Mesh(new THREE.BoxGeometry(14, 0.025, 0.025), new THREE.MeshBasicMaterial());
  lampLine.position.set(0, 2.46, -3);
  scene.add(mark, reflection, floor, lamps, lampLine);
  ctx.onCleanup(() => disposeScene(scene));

  // Composer: render → bloom + grain (merged into one EffectPass) → SMAA. Half-float on capable devices.
  const post = tier.name !== 'low';
  const composer = new EffectComposer(renderer, { frameBufferType: tier.name === 'low' ? THREE.UnsignedByteType : THREE.HalfFloatType, multisampling: 0 });
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new BloomEffect({ intensity: PRESETS[preset].bloom, luminanceThreshold: cfg.threshold, luminanceSmoothing: 0.2, mipmapBlur: true, radius: 0.8 });
  const grain = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: true });
  composer.addPass(new EffectPass(camera, bloom, grain));
  const smaaPass = new EffectPass(camera, new SMAAEffect());
  if (cfg.smaa) composer.addPass(smaaPass);
  ctx.onCleanup(() => { composer.dispose(); smaaPass.dispose(); });

  let dirty = true;
  const colours = { neon: new THREE.Color(), night: new THREE.Color(), sky: new THREE.Color(), plum: new THREE.Color(), sand: new THREE.Color() };
  const paint = () => {
    colours.neon.set(tokenColour(cfg.neon));
    colours.night.set(readToken('--night') || '#1b1d24');
    colours.sky.set(readToken('--sky') || '#8db1d6');
    colours.plum.set(readToken('--plum') || '#6b4968');
    colours.sand.set(readToken('--sand') || '#e3d2b1');
    scene.background = colours.night.clone().multiplyScalar(0.55);
    floorMat.color.copy(colours.night).multiplyScalar(0.7);
    lampLine.material.color.copy(colours.night).lerp(colours.sand, 0.12);
    dirty = true;
  };
  paint();

  // Brightness: the dot and arcs carry a pulse that travels outward every 2.4 s; the truss runs a slow chase.
  let t = 0;
  const light = () => {
    const pulse = (k) => (ctx.motion === 'full' ? Math.max(0, Math.sin(((t / 2.4) - k * 0.14) * Math.PI * 2)) ** 6 : 0);
    // Brightness is set on the colour's largest channel, so every token clips to the same kind of hot core.
    const hot = (m, c, v) => m.color.copy(c).multiplyScalar(v / Math.max(c.r, c.g, c.b, 1e-3));
    hot(neonMat, colours.neon, 3.4 + pulse(0) * 2);
    arcMats.forEach((m, i) => hot(m, i === 2 ? colours.neon.clone().lerp(colours.plum, 0.3) : colours.neon, 3.1 + pulse(i + 1) * 2.2 - i * 0.3));
    // The reflection is a dim copy, so it reads as light on a wet floor rather than a second sign.
    for (const [src, mirror] of mirrorMats) mirror.color.copy(src.color).multiplyScalar(0.28);
    lampList.forEach((m, i) => {
      const chase = ctx.motion === 'full' ? Math.max(0, Math.sin(t * 1.6 - i * 0.5)) ** 3 : 0.3;
      m.material.color.copy(colours.sand).lerp(colours.sky, 0.35).multiplyScalar(0.35 + chase * 1.6);
    });
  };

  apply = () => {
    const p = PRESETS[preset];
    bloom.intensity = p.bloom;
    bloom.luminanceMaterial.threshold = cfg.threshold;
    grain.blendMode.opacity.value = p.grain * cfg.grain;
    describe(post);
    dirty = true;
  };
  choose(preset);

  // The mark stands centred over its reflection in the wet floor. The camera backs off until the whole mark fits
  // the width, so a tall, narrow stage shows the same sign smaller with more floor under it.
  const TAN = Math.tan((17.5 * Math.PI) / 180);
  onResize(({ width, height }) => {
    const aspect = width / height;
    camera.aspect = aspect;
    const reach = ARCS[2] + 0.12;
    const scale = aspect > 1.1 ? 1 : 0.85;
    const y = 0.75;
    const lookY = 0.2;
    camera.position.set(0, 0.6, Math.max(8.6, (reach * scale + 0.3) / (TAN * aspect)));
    mark.position.set(0, y, 0);
    mark.scale.setScalar(scale);
    // The floor sits just under the lowest arc tip, so the reflection starts where the tubes end.
    const floorY = y - (ARCS[2] * Math.sin(ARC_SPAN / 2) + 0.1) * scale;
    floor.position.y = floorY;
    reflection.position.set(0, 2 * floorY - y, 0);
    reflection.scale.set(scale, -scale, scale);
    lamps.position.y = lookY + TAN * (camera.position.z + 3) * 0.8 - 2.4;
    lampLine.position.y = lamps.position.y + 2.46;
    camera.lookAt(0, lookY, 0);
    camera.updateProjectionMatrix();
    composer.setSize(width, height, false);
    dirty = true;
  });

  const render = (dt) => {
    light();
    if (post) composer.render(dt);
    else renderer.render(scene, camera);
    dirty = false;
  };
  // Full motion: the loop runs while the stage is on screen. Reduced and static: one render per change.
  let off = null;
  const frame = (dt) => {
    if (ctx.motion === 'full') { t += dt; render(dt); } else if (dirty) render(0);
  };
  whileVisible(ctx, host, () => { dirty = true; off = onFrame(ctx, frame); }, () => { off?.(); off = null; });
  ctx.onTheme(paint);

  return {
    update(next, changed) {
      cfg = { ...next };
      if (changed.includes('smaa')) { if (cfg.smaa) composer.addPass(smaaPass); else composer.removePass(smaaPass); }
      if (changed.includes('neon')) paint();
      if (changed.includes('preset')) choose(cfg.preset);
      else apply();
      return true;
    },
  };
}
