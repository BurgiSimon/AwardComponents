// Scroll film — "Inside Kova One" as a scroll-driven film with short captions. One value owns it: the scroll position inside a tall track
// is a raw 0–1; a piecewise-linear map turns raw into progress so two stretch bands cost more scroll; a clock follows
// that target at no more than K × dt / FILM_SECONDS per frame, so a flick cannot skip a beat; and five scene windows
// read the clock, each switched on half-way into the one before and off half-way into the next (toggled, never
// destroyed). Lenis and the frame share GSAP's ticker: Lenis first, then scroll is read, mapped and the clock stepped.
// Reduced motion and static: no smoothing, no spin, one settled frame per beat. No WebGL: the HUD and rail still run.
import './demo.css';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { whileVisible, html, clamp, readToken, content } from '../../src/demo-kit/index.js';
import { gsap } from '../../src/demo-kit/gsap.js';
import { useLenis } from '../../src/demo-kit/lenis.js';
import { useRenderer, webglAvailable, disposeScene } from '../../src/demo-kit/three.js';

const FILM_SECONDS = 14; // the film's length at full speed; the clock cap K comes from the "fastest run" control
const SPACING = 12; // scenes sit this far apart along −z; the camera travels one spacing per beat

// Fold stretch bands into one piecewise-linear map: knots {p (progress), r (raw)}, r normalised to 0..1.
// Overlapping bands are discarded, not merged, so the table stays readable.
function buildMap(bands) {
  const kept = [];
  for (const b of [...bands].sort((a, c) => a.from - c.from)) if (!kept.some((k) => b.from < k.to && b.to > k.from)) kept.push(b);
  const cuts = [0, ...kept.flatMap((b) => [b.from, b.to]), 1];
  const factorAt = (p) => kept.find((b) => p >= b.from && p < b.to)?.factor ?? 1;
  const knots = [{ p: 0, r: 0 }];
  for (let i = 1; i < cuts.length; i++) knots.push({ p: cuts[i], r: knots[i - 1].r + (cuts[i] - cuts[i - 1]) * factorAt(cuts[i - 1]) });
  const total = knots.at(-1).r;
  knots.forEach((k) => { k.r /= total; });
  const interp = (x, from, to) => {
    for (let i = 1; i < knots.length; i++) {
      const a = knots[i - 1];
      const b = knots[i];
      if (x <= b[from] || i === knots.length - 1) {
        const span = b[from] - a[from];
        return span > 0 ? a[to] + (b[to] - a[to]) * clamp((x - a[from]) / span, 0, 1) : b[to];
      }
    }
    return x;
  };
  return { kept, toProgress: (r) => interp(clamp(r, 0, 1), 'r', 'p'), toRaw: (p) => interp(clamp(p, 0, 1), 'p', 'r') };
}

export default function mount(root, options, ctx) {
  const { product } = content;
  let cfg = { ...options };
  // Five beats, five windows of 0.2. Tuning keeps the drivers live a little longer (dropPrevAt) as the camera turns.
  const BEATS = [
    { name: 'Housing', title: 'One piece of recycled aluminium' },
    { name: 'Drivers', title: 'Two tweeters, one long-throw woofer' },
    { name: 'Grille', title: 'A wool-blend sleeve' },
    { name: 'Tuning', title: 'Four microphones listen to the room' },
    { name: 'Assembled', title: 'Eight screws, no glue' },
  ].map((b, i) => ({ ...b, from: i * 0.2, to: (i + 1) * 0.2, ...(i === 3 ? { dropPrevAt: 0.75 } : {}) }));
  const N = BEATS.length;
  const mid = (i) => (BEATS[i].from + BEATS[i].to) / 2;
  const preloadAt = (i) => (i === 0 ? -Infinity : BEATS[i - 1].preloadNextAt ?? mid(i - 1));
  const dropAt = (i) => (i === N - 1 ? Infinity : BEATS[i + 1].dropPrevAt ?? mid(i + 1));
  const windowsAt = (p) => BEATS.map((_, i) => p >= preloadAt(i) && p < dropAt(i));
  const beatAt = (p) => { const i = BEATS.findIndex((s) => p < s.to); return i < 0 ? N - 1 : i; };
  const bandsFor = () => [{ from: 0.24, to: 0.36, factor: cfg.stretch }, { from: 0.62, to: 0.72, factor: 1 + (cfg.stretch - 1) / 2 }];
  let map = buildMap(bandsFor());

  root.className = 'sw';
  root.innerHTML = html`
    <section class="sw__film" data-film aria-label="Inside ${product.name}">
      <div class="sw__stage" data-stage>
        <div class="sw__still" data-still hidden aria-hidden="true"><span data-still-num>01</span></div>
        <div class="sw__hud ac-wrap">
          <div class="sw__panel">
            <p class="ac-label" data-beat-label>01 · Housing</p>
            <p class="sw__title" data-beat-title aria-hidden="true">${BEATS[0].title}</p>
            <a class="ac-link ac-small sw__skip" href="#sw-beats">Skip the film, read the five steps</a>
          </div>
        </div>
        <div class="sw__rail ac-wrap" aria-hidden="true">
          <p class="ac-label sw__rail-label"><span class="ac-num" data-progress>000</span></p>
          <div class="sw__track" data-rail><span class="sw__fill" data-fill></span></div>
        </div>
        <p class="ac-stage__note"><span>${product.maker} · product story</span></p>
      </div>
    </section>
    <section class="sw__beats ac-wrap" id="sw-beats" aria-labelledby="sw-beats-title">
      <h2 class="ac-label" id="sw-beats-title">Inside ${product.name}, in five steps</h2>
      <ol class="sw__list" role="list">
        ${BEATS.map((b, i) => html`<li><span class="ac-label">${String(i + 1).padStart(2, '0')} · ${b.name}</span><h3 class="ac-h3">${b.title}</h3></li>`)}
      </ol>
    </section>`;

  const film = root.querySelector('[data-film]');
  const stage = root.querySelector('[data-stage]');
  const rail = root.querySelector('[data-rail]');
  const fill = root.querySelector('[data-fill]');
  const els = {
    label: root.querySelector('[data-beat-label]'),
    title: root.querySelector('[data-beat-title]'),
    progress: root.querySelector('[data-progress]'),
    still: root.querySelector('[data-still]'),
    stillNum: root.querySelector('[data-still-num]'),
  };

  // The rail: band blocks and window ticks drawn from the same tables the map reads.
  const drawRail = () => {
    rail.querySelectorAll('.sw__band, .sw__tick').forEach((n) => n.remove());
    for (const b of map.kept) {
      if (b.factor <= 1) continue;
      const el = document.createElement('span');
      el.className = 'sw__band';
      el.style.left = `${b.from * 100}%`;
      el.style.width = `${(b.to - b.from) * 100}%`;
      rail.append(el);
    }
    for (const s of BEATS.slice(1)) {
      const el = document.createElement('span');
      el.className = 'sw__tick';
      el.style.left = `${s.from * 100}%`;
      rail.append(el);
    }
  };
  const applyLayout = () => {
    root.style.setProperty('--track-base', `${cfg.track}svh`);
    root.classList.toggle('sw--no-rail', !cfg.rail);
    drawRail();
  };
  applyLayout();

  // ── Scroll → raw → target → clock ───────────────────────────────────────────────────────────────────
  useLenis(ctx, { lerp: 0.1 }); // null under reduced motion: native scroll is that path
  const S = { raw: 0, target: 0, clock: 0, shown: -1, beat: -1, enabled: windowsAt(0) };
  const trackPx = () => Math.max(1, film.offsetHeight - innerHeight);
  const readRaw = () => clamp((window.scrollY - film.offsetTop) / trackPx(), 0, 1);
  let dirty = true;
  const show = (p) => {
    // Windows are toggled, never destroyed: a scene switched off keeps its GPU resources for the way back.
    const enabled = windowsAt(p);
    if (enabled.some((e, i) => e !== S.enabled[i])) { S.enabled = enabled; dirty = true; }
    const b = beatAt(p);
    if (b !== S.beat) {
      S.beat = b;
      els.label.textContent = `${String(b + 1).padStart(2, '0')} · ${BEATS[b].name}`;
      els.title.textContent = BEATS[b].title;
      els.stillNum.textContent = String(b + 1).padStart(2, '0');
      stage.dataset.beat = String(b);
    }
    els.progress.textContent = String(Math.round(p * 100)).padStart(3, '0');
    fill.style.transform = `scaleX(${p.toFixed(4)})`;
  };

  let renderScene = null;
  // One clock: GSAP's ticker runs Lenis first (useLenis added it), then this reads the scroll, maps it and steps.
  const tick = (time, deltaMs) => {
    const dt = Math.min(0.25, deltaMs / 1000);
    S.raw = readRaw();
    S.target = map.toProgress(S.raw);
    // The speed limit: however far the target jumps, the clock moves at most K × dt / FILM_SECONDS this frame.
    const K = FILM_SECONDS / cfg.fastest;
    const cap = (K * dt) / FILM_SECONDS;
    S.clock += clamp(S.target - S.clock, -cap, cap);
    // Reduced and static: one settled frame per beat, the middle of the window the scroll is in. No glide.
    const p = ctx.motion === 'full' ? S.clock : mid(beatAt(S.target));
    if (p !== S.shown) { S.shown = p; dirty = true; show(p); }
    renderScene?.(dt, p);
  };
  let ticking = false;
  const start = () => { if (!ticking) { ticking = true; gsap.ticker.add(tick); } };
  const stop = () => { if (ticking) { ticking = false; gsap.ticker.remove(tick); } };
  whileVisible(ctx, film, start, stop, { rootMargin: '0px' });
  ctx.onCleanup(stop);
  show(0);

  if (!webglAvailable()) {
    els.still.hidden = false;
    return { update(next, changed) { cfg = { ...next }; if (changed.includes('stretch')) map = buildMap(bandsFor()); applyLayout(); return true; } };
  }

  // ── The scenes: generated geometry only, one group per window ──────────────────────────────────────────
  const { renderer, onResize } = useRenderer(ctx, stage, { alpha: false });
  renderer.domElement.classList.add('sw__gl');
  stage.prepend(renderer.domElement);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  const scene = new THREE.Scene();
  scene.environment = env;
  scene.environmentIntensity = 0.8;
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(3, 6, 5);
  scene.add(key);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
  const colours = {};
  const paint = () => {
    colours.bg = new THREE.Color(readToken('--bg') || '#f4f4f1');
    colours.ink = new THREE.Color(readToken('--ink') || '#121211');
    colours.accent = new THREE.Color(readToken('--accent') || '#f94c16');
    colours.sand = new THREE.Color(readToken('--sand') || '#e3d2b1');
    colours.clay = new THREE.Color(readToken('--clay') || '#c9744b');
    colours.night = new THREE.Color(readToken('--night') || '#1b1d24');
    scene.background = colours.bg;
    scene.fog = new THREE.Fog(colours.bg, 9, 24);
    dirty = true;
  };
  paint();

  const metal = () => new THREE.MeshStandardMaterial({ color: 0xcfd0d2, metalness: 1, roughness: 0.32 });
  const matte = (c, r = 0.6) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const bodyProfile = [];
  for (let i = 0; i <= 24; i++) { const t = i / 24; bodyProfile.push(new THREE.Vector2(1 - (Math.abs(t - 0.5) * 2) ** 6 * 0.3, -1.5 + t * 3)); }
  const knitMat = matte(new THREE.Color(product.colours[2].hex), 0.95);
  const builders = [
    // Housing: the spun shell, open at the top so the inside reads.
    () => {
      const g = new THREE.Group();
      const shell = new THREE.Mesh(new THREE.LatheGeometry(bodyProfile, 96), metal());
      shell.material.side = THREE.DoubleSide;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.04, 12, 96), metal());
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 1.5;
      g.add(shell, rim);
      g.rotation.x = 0.18;
      return g;
    },
    // Drivers: two domes and a woofer cone, exploded along the axis.
    () => {
      const g = new THREE.Group();
      const cone = new THREE.LatheGeometry([0, 0.15, 0.6, 0.95, 1.05].map((r, i) => new THREE.Vector2(r, [0.25, 0.22, 0.05, -0.12, -0.12][i])), 64);
      const woofer = new THREE.Mesh(cone, matte(colours.night, 0.5));
      woofer.material.side = THREE.DoubleSide;
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), matte(colours.accent, 0.4));
      cap.position.y = 0.2;
      const surround = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.07, 12, 72), matte(colours.night, 0.8));
      surround.rotation.x = Math.PI / 2;
      surround.position.y = -0.12;
      const woof = new THREE.Group();
      woof.add(woofer, cap, surround);
      woof.position.y = -1;
      g.add(woof);
      for (const x of [-0.7, 0.7]) {
        const t = new THREE.Group();
        const dome = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), metal());
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 12, 48), matte(colours.night, 0.7));
        ring.rotation.x = Math.PI / 2;
        t.add(dome, ring);
        t.position.set(x, 0.9, 0);
        t.rotation.z = -x * 0.5;
        g.add(t);
      }
      g.rotation.x = 0.5;
      return g;
    },
    // Grille: the knitted tube, every stitch two slanted legs (a V), as one instanced mesh.
    () => {
      const cols = 36;
      const rows = 24;
      const legs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 8, 6), knitMat, cols * rows * 2);
      const o = new THREE.Object3D();
      let n = 0;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          for (const leg of [-1, 1]) {
            const a = ((x + leg * 0.2) / cols) * Math.PI * 2;
            o.position.set(Math.cos(a) * 1.02, -1.42 + y * 0.123, Math.sin(a) * 1.02);
            o.lookAt(o.position.x * 2, o.position.y, o.position.z * 2);
            o.rotateZ(leg * 0.5);
            o.scale.set(0.62, 1.45, 0.5);
            o.updateMatrix();
            legs.setMatrixAt(n++, o.matrix);
          }
        }
      }
      const g = new THREE.Group();
      g.add(legs);
      g.rotation.x = 0.16;
      return g;
    },
    // Tuning: four microphones round the body and the rings of a sweep spreading across the floor.
    () => {
      const g = new THREE.Group();
      const core = new THREE.Mesh(new THREE.LatheGeometry(bodyProfile, 64), matte(colours.sand, 0.8));
      core.scale.setScalar(0.55);
      g.add(core);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const mic = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.22, 6, 12), matte(colours.accent, 0.4));
        mic.position.set(Math.cos(a) * 0.56, 0.2, Math.sin(a) * 0.56);
        g.add(mic);
      }
      const rings = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.02, 8, 96), new THREE.MeshBasicMaterial({ color: colours.accent, transparent: true, opacity: 0.6 }));
        ring.rotation.x = Math.PI / 2;
        ring.userData.phase = i / 4;
        rings.add(ring);
      }
      rings.position.y = -0.82;
      g.add(rings);
      g.userData.rings = rings;
      g.rotation.x = 0.35;
      return g;
    },
    // Assembled: the shell in its sleeve, cap on, on a low plinth.
    () => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.LatheGeometry(bodyProfile, 96), knitMat);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.88, 0.12, 96), metal());
      cap.position.y = 1.52;
      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.55, 0.3, 72), matte(colours.sand, 0.9));
      plinth.position.y = -1.66;
      g.add(body, cap, plinth);
      g.rotation.x = 0.1;
      return g;
    },
  ];
  const groups = builders.map((build, i) => {
    const g = build();
    g.position.set(0, 0, -i * SPACING);
    g.visible = false;
    scene.add(g);
    return g;
  });
  ctx.onCleanup(() => { disposeScene(scene); env.dispose(); });

  // Framing: on wide stages the scene sits centred above the caption; on narrow ones the camera backs off and frames
  // the scene above the caption panel.
  const frame = { dist: 6.2, lookDrop: 0.1 };
  onResize(({ width, height }) => {
    const aspect = width / height;
    const narrow = width < 760;
    camera.aspect = aspect;
    camera.fov = narrow ? 50 : 40;
    frame.dist = narrow ? 8.6 : 6.2;
    frame.lookDrop = narrow ? 1.5 : 0.75;
    const scale = narrow ? 0.9 : aspect < 1.5 ? 0.8 : 0.88;
    groups.forEach((g) => { g.scale.setScalar(scale); g.position.y = 0.1; });
    camera.updateProjectionMatrix();
    dirty = true;
  });

  let t = 0;
  renderScene = (dt, p) => {
    const spin = ctx.motion === 'full';
    if (spin) t += dt;
    groups.forEach((g, i) => {
      g.visible = S.enabled[i];
      if (spin && g.visible) g.rotation.y += dt * 0.25;
    });
    const rings = groups[3].userData.rings;
    if (groups[3].visible) rings.children.forEach((r) => {
      const k = spin ? (t * 0.35 + r.userData.phase) % 1 : r.userData.phase;
      r.scale.setScalar(0.7 + k * 2.4);
      r.material.opacity = 0.7 * (1 - k);
    });
    if (!spin && !dirty) return; // reduced and static: draw only when the beat or the size changed
    // One value drives the camera: the window centres sit SPACING apart, the camera 6 units in front. It holds on
    // each scene through the middle of its window and travels between neighbours around the window edges.
    const b = (p - mid(0)) / (mid(1) - mid(0));
    const k = Math.round(b);
    const f = b - k;
    const travel = Math.min(1, Math.max(0, (Math.abs(f) - 0.18) / 0.32));
    const beat = k + Math.sign(f) * 0.5 * travel * travel * (3 - 2 * travel);
    camera.position.set(Math.sin(beat * 1.3) * 0.6, 0.6, frame.dist - beat * SPACING);
    camera.lookAt(0, 0.1 - frame.lookDrop, -beat * SPACING - 4);
    renderer.render(scene, camera);
    dirty = false;
  };
  ctx.onTheme(paint);
  document.fonts?.ready.then(() => { dirty = true; });

  return {
    update(next, changed) {
      cfg = { ...next };
      if (changed.includes('stretch')) map = buildMap(bandsFor());
      applyLayout();
      dirty = true;
      return true;
    },
  };
}
