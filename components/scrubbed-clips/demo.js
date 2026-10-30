// Scrubbed clips — three ceramic forms grown by the scroll, with their names as the only copy. Each form carries one
// AnimationClip built in code from position, rotation and scale keyframe tracks on named children. One paused GSAP
// timeline of nine units gives each form a slot of three: a hand-off that slides the rail, a growth proxy that becomes
// mixer.setTime(proxy × duration) and a glaze tone. ScrollTrigger scrubs that timeline across a sticky track, so the
// scroll position is the clip time and scrolling back ungrows each form exactly; frames render only when it changed.
// Reduced motion and static: no scrub, each slot cut to its settled pose. No WebGL 2: a CSS still, the beats still run.
import './demo.css';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { on, html, raw, clamp, readToken, qualityTier, finePointer, content, formatPrice } from '../../src/demo-kit/index.js';
import { useGsap } from '../../src/demo-kit/gsap.js';
import { useLenis } from '../../src/demo-kit/lenis.js';
import { useRenderer, webglAvailable, disposeScene } from '../../src/demo-kit/three.js';

// ── The score: nine units, a slot of three per form ───────────────────────────────────────────────────────
// hand-off: the rail slides the previous form out and this one in, straddling the slot boundary
// growth:   a 0–1 proxy that becomes mixer.setTime(proxy × clip.duration)
// tone:     the glaze warms from the raw clay grey to its colour
// Everything is done by s + SETTLE, the pose shown under reduced motion.
const UNITS = 9;
const SLOT = 3;
const SETTLE = 2.25;
const GAP = 7;
const HANDOFF = { at: -0.5, dur: 1, ease: 'power2.inOut' };
const GROW = { at: 0.25, dur: 1.75, ease: 'sine.inOut' };
const TONE = { at: 1, dur: 1.25, ease: 'sine.inOut' };
const slotAt = (time) => clamp(Math.floor(time / SLOT), 0, 2);

// The collection: name, price and glaze per form; the order comes from the control.
const FORMS = {
  bloom: { title: 'Bloom', price: 220, glaze: ['--moss', '--sky', 0.3], glazeName: 'Celadon' },
  stack: { title: 'Stack', price: 168, glaze: ['--sand', '--clay', 0.25], glazeName: 'Oat' },
  coil: { title: 'Coil', price: 184, glaze: ['--clay'], glazeName: 'Rust' },
};
const ORDERS = { 'bloom-stack-coil': ['bloom', 'stack', 'coil'], 'stack-coil-bloom': ['stack', 'coil', 'bloom'], 'coil-bloom-stack': ['coil', 'bloom', 'stack'] };

// ── Clips built in code: keyframe tracks on named children of procedural groups ─────────────────────────────
const Y = new THREE.Vector3(0, 1, 0);
const X = new THREE.Vector3(1, 0, 0);
const quat = (yaw, pitch = 0) => new THREE.Quaternion().setFromAxisAngle(Y, yaw).multiply(new THREE.Quaternion().setFromAxisAngle(X, pitch)).toArray();
// Hold the rest value until `from`, move to the end value by `to`, hold to the clip's end. Times stay strictly increasing.
function hold(D, from, to, a, b) {
  const times = [0];
  const values = [...a];
  if (from > 0) { times.push(from); values.push(...a); }
  times.push(to);
  values.push(...b);
  if (to < D) { times.push(D); values.push(...b); }
  return [times, values];
}
const BUILD = {
  // Bloom: eight petals on pivots open outward, a heart swells, a quarter turn on the root.
  bloom(segments, mats) {
    const D = 2.4;
    const root = new THREE.Group();
    const tracks = [];
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.6, segments), mats.rest);
    foot.position.y = 0.3;
    const heart = new THREE.Mesh(new THREE.SphereGeometry(0.3, segments, segments / 2), mats.tone);
    heart.name = 'heart';
    heart.position.y = 0.72;
    root.add(foot, heart);
    const petal = new THREE.SphereGeometry(1, segments, segments / 2);
    petal.scale(0.26, 0.7, 0.08);
    petal.translate(0, 0.66, 0);
    for (let k = 0; k < 8; k++) {
      const pivot = new THREE.Group();
      pivot.name = `petal${k}`;
      pivot.position.y = 0.62;
      pivot.add(new THREE.Mesh(petal, mats.tone));
      root.add(pivot);
      const yaw = (k * Math.PI) / 4;
      const open = 1.1 + (k % 2) * 0.14;
      tracks.push(new THREE.QuaternionKeyframeTrack(`petal${k}.quaternion`, ...hold(D, D * (0.06 + 0.03 * k), D * (0.6 + 0.03 * k), quat(yaw, 0.16), quat(yaw, open))));
    }
    tracks.push(new THREE.VectorKeyframeTrack('heart.scale', [0, D * 0.45, D], [0.3, 0.3, 0.3, 0.78, 0.78, 0.78, 1, 1, 1]));
    tracks.push(new THREE.QuaternionKeyframeTrack('.quaternion', [0, D], [...quat(0), ...quat(Math.PI / 4)]));
    return { root, clip: new THREE.AnimationClip('bloom-growth', D, tracks) };
  },
  // Stack: seven plates rise from the plinth and twist, each a little later and smaller; a knob grows on top.
  stack(segments, mats) {
    const D = 2.8;
    const root = new THREE.Group();
    const tracks = [];
    for (let k = 0; k < 7; k++) {
      const r = 0.95 - k * 0.1;
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.9, 0.13, segments), k % 2 ? mats.rest : mats.tone);
      plate.name = `disc${k}`;
      plate.position.y = 0.065;
      root.add(plate);
      const from = D * 0.06 * k;
      const to = from + D * 0.5;
      tracks.push(new THREE.VectorKeyframeTrack(`disc${k}.position`, ...hold(D, from, to, [0, 0.065, 0], [0, 0.065 + k * 0.2, 0])));
      tracks.push(new THREE.QuaternionKeyframeTrack(`disc${k}.quaternion`, ...hold(D, from, to, quat(0), quat(k * 0.28))));
    }
    const heart = new THREE.Mesh(new THREE.SphereGeometry(0.22, segments, segments / 2), mats.tone);
    heart.name = 'heart';
    root.add(heart);
    tracks.push(new THREE.VectorKeyframeTrack('heart.position', [0, D], [0, 0.3, 0, 0, 1.55, 0]));
    tracks.push(new THREE.VectorKeyframeTrack('heart.scale', [0, D * 0.3, D], [0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 1, 1, 1]));
    return { root, clip: new THREE.AnimationClip('stack-growth', D, tracks) };
  },
  // Coil: fourteen coils, each sized to the vase's profile, leave the centre one after another and settle into
  // their course, so the vase is built turn by turn; the whole piece makes a half turn as it grows.
  coil(segments, mats) {
    const D = 3;
    const root = new THREE.Group();
    const tracks = [];
    const radii = [0.46, 0.56, 0.65, 0.72, 0.76, 0.77, 0.74, 0.67, 0.57, 0.47, 0.4, 0.37, 0.39, 0.45];
    radii.forEach((r, k) => {
      const ring = new THREE.TorusGeometry(r, 0.062, 10, segments);
      ring.rotateX(Math.PI / 2);
      const m = new THREE.Mesh(ring, k % 3 ? mats.tone : mats.rest);
      m.name = `bead${k}`;
      root.add(m);
      const from = D * 0.045 * k;
      const to = from + D * 0.36;
      tracks.push(new THREE.VectorKeyframeTrack(`bead${k}.position`, ...hold(D, from, to, [0, 1.1, 0], [0, 0.07 + k * 0.118, 0])));
      tracks.push(new THREE.VectorKeyframeTrack(`bead${k}.scale`, ...hold(D, from, to, [0.04, 0.04, 0.04], [1, 1, 1])));
    });
    const heart = new THREE.Mesh(new THREE.CircleGeometry(0.44, segments), mats.rest);
    heart.name = 'heart';
    heart.rotation.x = -Math.PI / 2;
    heart.position.y = 0.04;
    root.add(heart);
    tracks.push(new THREE.VectorKeyframeTrack('heart.scale', [0, D * 0.12, D], [0.01, 0.01, 0.01, 1, 1, 1, 1, 1, 1]));
    tracks.push(new THREE.QuaternionKeyframeTrack('.quaternion', [0, D], [...quat(0), ...quat(Math.PI / 2)]));
    return { root, clip: new THREE.AnimationClip('coil-growth', D, tracks) };
  },
};

// The no-WebGL still: the first form settled, in CSS.
const STILL = `<span class="sc__petals">${Array.from({ length: 8 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}<b></b></span>`;

export default function mount(root, options, ctx) {
  const { shop } = content;
  let cfg = { ...options };
  const order = ORDERS[cfg.order] || ORDERS['bloom-stack-coil'];
  const beats = order.map((id) => ({ id, ...FORMS[id] }));
  root.className = 'sc';
  root.innerHTML = html`
    <section class="sc__track" data-track aria-label="${shop.name} autumn forms">
      ${beats.map((b, i) => html`<span class="sc__marker" id="sc-${b.id}" style="--p:${((i * SLOT + SETTLE) / UNITS).toFixed(4)}"></span>`)}
      <div class="sc__stage" data-stage>
        <a class="ac-link ac-small sc__skip" href="#sc-after">Skip to the collection</a>
        <div class="sc__still" data-still hidden aria-hidden="true">${raw(STILL)}</div>
        <nav class="sc__beats" aria-label="The three forms">
          <ol class="sc__list" role="list">
            ${beats.map((b, i) => html`<li class="sc__beat" data-beat="${i}"><a href="#sc-${b.id}" data-seek="${i}">${b.title}</a></li>`)}
          </ol>
        </nav>
        <p class="ac-stage__note"><span>${shop.name} · autumn collection</span><span class="sc__readout" aria-hidden="true" data-readout></span></p>
      </div>
    </section>
    <section class="sc__after ac-wrap" id="sc-after" aria-labelledby="sc-after-title">
      <h2 class="ac-h3" id="sc-after-title">The autumn forms</h2>
      <ul class="sc__shop" role="list">
        ${beats.map((b) => html`<li><span class="sc__dot" style="--glaze:${raw(b.glaze[1] ? `color-mix(in oklab, var(${b.glaze[0]}), ${b.glaze[1] === 'white' ? 'white' : `var(${b.glaze[1]})`} ${Math.round(b.glaze[2] * 100)}%)` : `var(${b.glaze[0]})`)}"></span><strong>${b.title}</strong><span class="ac-small">${b.glazeName} glaze · stoneware</span><span class="ac-num">${formatPrice(b.price)}</span></li>`)}
      </ul>
    </section>`;

  const track = root.querySelector('[data-track]');
  const stage = root.querySelector('[data-stage]');
  const readout = root.querySelector('[data-readout]');
  const links = [...root.querySelectorAll('[data-seek]')];
  root.style.setProperty('--track-base', `${cfg.track}svh`);

  // Clips and the scene graph exist without WebGL too: the timeline and the beats still run.
  const tier = qualityTier();
  const segments = tier.name === 'high' ? 48 : tier.name === 'mid' ? 32 : 20;
  const tone = ([a, b, t = 0]) => {
    const c = new THREE.Color(readToken(a) || '#888888');
    if (b) c.lerp(b === 'white' ? new THREE.Color(1, 1, 1) : new THREE.Color(readToken(b) || '#888888'), t);
    return c;
  };
  const restTone = new THREE.Color();
  const paintRest = () => restTone.copy(tone(['--sand', '--night', 0.5]));
  paintRest();
  const glaze = { roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.3 };
  const mats = {
    tone: new THREE.MeshPhysicalMaterial({ color: restTone.clone(), ...glaze }),
    rest: new THREE.MeshPhysicalMaterial({ color: restTone.clone().multiplyScalar(0.86), roughness: 0.8 }),
    line: new THREE.MeshBasicMaterial({ color: restTone.clone() }),
  };
  const plinth = new THREE.RingGeometry(1.05, 1.085, segments);
  plinth.rotateX(-Math.PI / 2);
  const forms = beats.map((b, i) => {
    const { root: group, clip } = BUILD[b.id](segments, mats);
    const ring = new THREE.Mesh(plinth, mats.line);
    ring.position.y = 0.002;
    group.add(ring);
    const mat = mats.tone.clone();
    group.traverse((o) => { if (o.material === mats.tone) o.material = mat; });
    group.position.x = i * GAP;
    // One mixer per form, never played on a clock: the timeline sets its time. LoopOnce + clampWhenFinished holds the
    // last pose; the action is unpaused before every set, or a clamp at the end would freeze it on the way back.
    const mixer = new THREE.AnimationMixer(group);
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    mixer.setTime(0);
    return { ...b, group, clip, mat, mixer, action, glazeColour: tone(b.glaze), grow: { t: 0 }, tone: { c: 0 } };
  });
  const rail = new THREE.Group();
  forms.forEach((f) => rail.add(f.group));
  const view = { x: 0 };
  ctx.onCleanup(() => forms.forEach((f) => { f.mixer.stopAllAction(); f.mixer.uncacheRoot(f.group); }));

  let dirty = true;
  let shownSlot = -1;
  const setClip = (f, time) => { f.action.paused = false; f.mixer.setTime(time); };
  const { gsap, ScrollTrigger } = useGsap(ctx, root);
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' }, onUpdate: () => apply() });
  // The DOM mirror: the active form's link carries aria-current; the readout is decoration.
  const syncBeats = () => {
    const slot = slotAt(tl.time());
    if (slot !== shownSlot) {
      shownSlot = slot;
      links.forEach((a, i) => {
        if (i === slot) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
        a.closest('.sc__beat').toggleAttribute('data-active', i === slot);
      });
      stage.dataset.slot = String(slot);
    }
    const f = forms[slot];
    readout.textContent = `${f.title} · clip ${f.mixer.time.toFixed(2)} / ${f.clip.duration.toFixed(2)} s`;
  };
  function apply() {
    for (const f of forms) {
      setClip(f, f.grow.t * f.clip.duration);
      f.mat.color.lerpColors(restTone, f.glazeColour, f.tone.c);
    }
    rail.position.x = view.x;
    forms.forEach((f, i) => { f.group.visible = Math.abs(i * GAP + view.x) < GAP * 0.9; });
    syncBeats();
    dirty = true; // the only invalidation besides a resize
  }
  forms.forEach((f, i) => {
    const s = i * SLOT;
    if (i > 0) tl.fromTo(view, { x: -(i - 1) * GAP }, { x: -i * GAP, duration: HANDOFF.dur, ease: HANDOFF.ease, immediateRender: false }, s + HANDOFF.at);
    tl.fromTo(f.grow, { t: 0 }, { t: 1, duration: GROW.dur, ease: GROW.ease, immediateRender: false }, s + GROW.at);
    tl.fromTo(f.tone, { c: 0 }, { c: 1, duration: TONE.dur, ease: TONE.ease, immediateRender: false }, s + TONE.at);
  });
  tl.set({}, {}, UNITS); // pad to nine units: the last form holds, settled, to the end of the track
  ctx.onCleanup(() => tl.kill());

  // ── Scroll → timeline. Full: the trigger scrubs it. Reduced and static: the slot the scroll is in is cut settled.
  const lenis = useLenis(ctx, { lerp: 0.1 });
  let cutSlot = -1;
  const cut = (progress) => {
    const slot = slotAt(progress * UNITS);
    if (slot === cutSlot) return;
    cutSlot = slot;
    tl.seek(slot * SLOT + SETTLE, false);
  };
  let st = null;
  const build = () => {
    st?.kill();
    const smoothing = finePointer() ? cfg.smoothing : Math.min(cfg.smoothing, 0.3); // shorter under a finger
    st = ctx.motion === 'full'
      ? ScrollTrigger.create({ trigger: track, start: 'top top', end: 'bottom bottom', scrub: smoothing > 0 ? smoothing : true, animation: tl, invalidateOnRefresh: true })
      : ScrollTrigger.create({ trigger: track, start: 'top top', end: 'bottom bottom', invalidateOnRefresh: true, onUpdate: (self) => cut(self.progress), onRefresh: (self) => cut(self.progress) });
    if (ctx.motion !== 'full') { cutSlot = -1; cut(st.progress); }
  };
  build();
  ctx.onCleanup(() => st?.kill());
  apply();
  document.fonts?.ready.then(() => { if (!ctx.signal.aborted) ScrollTrigger.refresh(); });

  // The links jump to each form's settled pose and keep focus; without script they are anchors to markers there.
  const yAt = (p) => st.start + clamp(p, 0, 1) * (st.end - st.start);
  links.forEach((a, i) => on(ctx, a, 'click', (e) => {
    e.preventDefault();
    const y = yAt((i * SLOT + SETTLE) / UNITS);
    if (lenis) lenis.scrollTo(y, { duration: 1.2 });
    else { window.scrollTo(0, y); ScrollTrigger.update(); }
  }));
  on(ctx, root.querySelector('a[href="#sc-after"]'), 'click', (e) => {
    e.preventDefault();
    const target = root.querySelector('#sc-after');
    if (lenis) lenis.scrollTo(target, { duration: 1.2 }); else target.scrollIntoView();
  });

  if (!webglAvailable()) {
    root.querySelector('[data-still]').hidden = false;
    return { update(next, changed) { if (changed.includes('order')) return false; cfg = { ...next }; root.style.setProperty('--track-base', `${cfg.track}svh`); ScrollTrigger.refresh(); build(); return true; } };
  }

  // ── Renderer: drawn on demand ────────────────────────────────────────────────────────────────────────────
  const { renderer, onResize } = useRenderer(ctx, stage, { alpha: false });
  renderer.domElement.classList.add('sc__gl');
  stage.prepend(renderer.domElement);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  const scene = new THREE.Scene();
  scene.environment = env;
  scene.environmentIntensity = 0.55;
  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(3, 5, 4);
  const rim = new THREE.DirectionalLight(0xffffff, 0.8);
  rim.position.set(-4, 2, -3);
  scene.add(rail, key, rim);
  const paintScene = () => {
    scene.background = new THREE.Color(readToken('--bg') || '#f4f4f1');
    paintRest();
    mats.line.color.copy(restTone).lerp(scene.background, 0.45);
    forms.forEach((f) => { f.glazeColour = tone(f.glaze); });
    apply();
  };
  paintScene();
  ctx.onCleanup(() => { disposeScene(scene); env.dispose(); });
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);

  // The form stands centred over the names; portrait stages back off and widen the lens so the open bloom fits.
  onResize(({ width, height }) => {
    const portrait = width < height;
    camera.aspect = width / height;
    camera.fov = portrait ? 40 : 30;
    const z = portrait ? 9.4 : 7.4;
    camera.position.set(0, portrait ? 1.7 : 1.8, z);
    camera.lookAt(0, portrait ? 0.7 : 0.75, 0);
    camera.updateProjectionMatrix();
    dirty = true;
  });
  const draw = () => { if (dirty) { renderer.render(scene, camera); dirty = false; } };
  gsap.ticker.add(draw);
  ctx.onCleanup(() => gsap.ticker.remove(draw));
  ctx.onTheme(paintScene);

  return {
    update(next, changed) {
      if (changed.includes('order')) return false;
      cfg = { ...next };
      root.style.setProperty('--track-base', `${cfg.track}svh`);
      ScrollTrigger.refresh();
      if (changed.includes('smoothing')) build();
      return true;
    },
  };
}
