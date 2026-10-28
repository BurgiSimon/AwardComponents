// Scene cuts — a festival trailer hero. Three procedural day-scenes share one fixed canvas and one scene target, and
// every cut between them lives in the last pass, the one that already grades the frame: a blur dip (full, half,
// then quarter resolution, ending in a flat colour; the scene swaps under it) or a frozen-frame iris (the outgoing
// scene is rendered once into a cache, and the new one opens inside a growing diamond while the still stays
// outside, its edge drawn crisp on a 2D canvas). Scrolling to the footer closes a diamond onto the footer's ground
// while the frame zooms, leaving a window of the world over the last words.
// Reduced motion: no clocks, no autoplay, every cut a hard switch. Static or no WebGL: CSS gradients per scene.
import './demo.css';
import * as THREE from 'three';
import { on, onFrame, html, raw, clamp, mapRange, readToken, whileVisible, content, formatPrice } from '../../src/demo-kit/index.js';
import { useRenderer, webglAvailable } from '../../src/demo-kit/three.js';

const LIFT = 0.06; // the diamonds sit a little above the middle, in viewport heights
const fit = (v, a, b, c, d) => clamp(mapRange(v, a, b, c, d), Math.min(c, d), Math.max(c, d));

const DAYS = [
  { day: 'Friday 12 August', stage: 'The Harbour', name: 'Dusk', acts: 'Marlow Ash, Kiri Tanaka and The Low Tides from seven, as the sun drops behind the cranes.', tokens: ['--plum', '--clay', '--sand'] },
  { day: 'Saturday 13 August', stage: 'Hall 4', name: 'Tide', acts: 'Odessa Rae, Nils & the Weather and Juno Park in the old ship hall, doors at eight.', tokens: ['--night', '--sky', '--sand'] },
  { day: 'Sunday 14 August', stage: 'The Greenhouse', name: 'Moss', acts: 'Vesper Choir and Aurelio Cano under glass, then Moss Theory to close the weekend.', tokens: ['--night', '--moss', '--sand'] },
];

const VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
// One program draws all three scenes; uKind picks the field. Each reads as one hue family so the cuts are legible.
const SCENE_FRAG = /* glsl */ `
  precision highp float;
  uniform float uKind; uniform float uTime; uniform float uAspect;
  uniform vec3 uA; uniform vec3 uB; uniform vec3 uC;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; } return v; }
  void main() {
    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
    vec3 col;
    if (uKind < 0.5) { // dusk: a low sun and drifting haze
      col = mix(uA, uB, smoothstep(0.65, -0.45, p.y));
      float sun = smoothstep(0.32, 0.0, length(p - vec2(0.35 * uAspect * 0.5, -0.12)));
      col = mix(col, uC, sun * 0.85);
      col += (fbm(p * 3.0 + vec2(uTime * 0.04, 0.0)) - 0.5) * 0.08;
    } else if (uKind < 1.5) { // tide: bent stripes moving sideways
      float f = fbm(p * 2.2 + vec2(0.0, uTime * 0.05));
      float s = sin((p.x * 7.0 + f * 4.0 - uTime * 0.35) * 3.14159);
      col = mix(uA, uB, smoothstep(-0.6, 0.9, s) * 0.85);
      col = mix(col, uC, smoothstep(0.92, 1.0, s) * 0.5);
    } else { // moss: rippled bands rising slowly
      float f = fbm(p * vec2(1.5, 6.0) + vec2(uTime * 0.03, -uTime * 0.08));
      col = mix(uA, uB, smoothstep(0.25, 0.75, f));
      col = mix(col, uC, smoothstep(0.7, 0.9, f) * 0.5);
    }
    gl_FragColor = vec4(max(col, 0.0), 1.0);
  }`;
const BLUR_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uTex; uniform vec2 uDelta; varying vec2 vUv;
  void main() {
    vec4 c = texture2D(uTex, vUv) * 0.2270270270;
    c += (texture2D(uTex, vUv + uDelta * 1.3846153846) + texture2D(uTex, vUv - uDelta * 1.3846153846)) * 0.3162162162;
    c += (texture2D(uTex, vUv + uDelta * 3.2307692308) + texture2D(uTex, vUv - uDelta * 3.2307692308)) * 0.0702702703;
    gl_FragColor = c;
  }`;
const FINAL_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uScene; uniform sampler2D uHalf; uniform sampler2D uQuarter; uniform sampler2D uCache;
  uniform vec2 uTexel; uniform float uAspect; uniform float uLift; uniform float uAA;
  uniform float uDip; uniform vec3 uDipColor;
  uniform float uIris; uniform float uFrozen;
  uniform float uClose; uniform float uCloseSize; uniform vec3 uGround;
  varying vec2 vUv;
  float sdDiamond(vec2 p, float halfDiag) { return (abs(p.x) + abs(p.y) - halfDiag) * 0.70710678; }
  vec3 blur4(vec2 uv, vec2 d) {
    return (texture2D(uScene, uv + vec2(d.x, d.y)).rgb + texture2D(uScene, uv + vec2(-d.x, d.y)).rgb + texture2D(uScene, uv + vec2(d.x, -d.y)).rgb + texture2D(uScene, uv - d).rgb) * 0.25;
  }
  void main() {
    // The close zooms the live frame toward the diamond as it shuts.
    float zoomT = clamp((uClose - 0.75) / 0.25, 0.0, 1.0);
    vec2 uv = (vUv - 0.5) / (1.0 + 2.0 * zoomT * zoomT) + 0.5 + vec2(0.0, 0.03 * uClose);
    vec3 col = texture2D(uScene, uv).rgb;
    // The dip: blur at three resolutions in turn, then a flat colour. Nothing of the scene survives the peak.
    if (uDip > 0.0) {
      col = mix(col, blur4(uv, uTexel * 3.0), smoothstep(0.0, 0.333, uDip));
      col = mix(col, texture2D(uHalf, uv).rgb, smoothstep(0.25, 0.667, uDip));
      col = mix(col, texture2D(uQuarter, uv).rgb, smoothstep(0.667, 1.0, uDip));
      col = mix(col, uDipColor, smoothstep(0.8, 1.0, uDip));
    }
    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) - vec2(0.0, uLift);
    // The iris: inside the diamond the live scene, outside the frame frozen when the cut began.
    if (uFrozen > 0.5) {
      float inside = 1.0 - smoothstep(-uAA, uAA, sdDiamond(p, uIris));
      col = mix(texture2D(uCache, vUv).rgb, col, inside);
    }
    // The close: outside a shrinking diamond, the footer's ground.
    if (uClose > 0.0) {
      float inside = 1.0 - smoothstep(-uAA, uAA, sdDiamond(p, uCloseSize));
      col = mix(uGround, col, inside);
    }
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

export default function mount(root, options, ctx) {
  const { festival } = content;
  let cfg = { ...options };
  const full = ctx.motion === 'full';
  root.className = 'sc';
  root.innerHTML = html`
    <div class="sc__gl" data-gl aria-hidden="true"><canvas class="sc__outline" data-outline></canvas></div>
    <section class="sc__hero" aria-roledescription="carousel" aria-labelledby="sc-title">
      <header class="ac-bar sc__bar">
        <a class="ac-brand" href="#top">${festival.name}</a>
        <nav aria-label="Festival"><a href="#top">Line-up</a><a href="#top">Stages</a><a href="#top">Travel</a></nav>
        <a class="ac-btn ac-btn--sm sc__buy" href="#tickets">Tickets</a>
      </header>
      <h1 class="sr-only" id="sc-title">${festival.edition}: three days, three stages</h1>
      <div class="sc__slides ac-wrap" aria-live="off" data-slides>
        ${DAYS.map((d, i) => html`<article class="sc__slide sc__slide--${i}" aria-roledescription="slide" aria-label="${d.name}, ${i + 1} of ${DAYS.length}" data-slide="${i}">
          <p class="ac-label">${d.day} · ${d.stage}</p>
          <h2 class="sc__name">${d.name}</h2>
          <p class="sc__acts">${d.acts}</p>
        </article>`)}
      </div>
      <div class="sc__controls ac-wrap">
        <div class="sc__steps" role="group" aria-label="Choose a day">
          ${DAYS.map((d, i) => html`<button type="button" class="sc__step" data-go="${i}" aria-label="${d.day}: ${d.name}"><span class="sc__fill"></span><span class="sc__step-label">${d.name}</span></button>`)}
        </div>
        <div class="sc__buttons">
          <button type="button" class="sc__btn" data-prev aria-label="Previous day">${raw('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>')}</button>
          <button type="button" class="sc__btn" data-pause aria-pressed="false" aria-label="Pause the trailer">${raw('<svg viewBox="0 0 24 24" aria-hidden="true" class="sc__i-pause"><path d="M9 6v12M15 6v12"/></svg><svg viewBox="0 0 24 24" aria-hidden="true" class="sc__i-play"><path d="M8 6l10 6-10 6z"/></svg>')}</button>
          <button type="button" class="sc__btn" data-next aria-label="Next day">${raw('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>')}</button>
        </div>
      </div>
    </section>
    <footer class="sc__foot" id="tickets" data-footer>
      <div class="sc__foot-inner ac-wrap">
        <p class="ac-label">${festival.dates} · ${festival.place}</p>
        <p class="sc__close">Three days, four stages, one ferry home.</p>
        <div class="sc__tickets">
          ${festival.tickets.map((t) => html`<a class="sc__ticket" href="#tickets"><span>${t.name}</span><strong class="ac-num">${formatPrice(t.price)}</strong></a>`)}
        </div>
      </div>
    </footer>`;
  root.querySelectorAll('a[href^="#"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const slides = [...root.querySelectorAll('[data-slide]')];
  const steps = [...root.querySelectorAll('[data-go]')];
  const pauseBtn = root.querySelector('[data-pause]');
  const footer = root.querySelector('[data-footer]');
  const hero = root.querySelector('.sc__hero');
  const host = root.querySelector('[data-gl]');
  const outline = root.querySelector('[data-outline]');

  // The carousel state the DOM shows: one active slide (others inert), the step being timed, play/pause.
  let gl = null; // the running GL layer: { wake(), hardSwitch(to) }
  let active = 0;
  let paused = !full || !cfg.autoplay;
  let held = 0; // seconds the current scene has been on
  const showSlide = (i) => {
    active = i;
    slides.forEach((s, j) => {
      const on = j === i;
      s.classList.toggle('is-active', on);
      s.inert = !on;
      s.setAttribute('aria-hidden', String(!on));
    });
    root.dataset.active = String(i);
    steps.forEach((b, j) => { b.classList.toggle('is-done', j < i); b.classList.toggle('is-active', j === i); b.setAttribute('aria-current', j === i ? 'true' : 'false'); });
  };
  const setPaused = (p) => {
    paused = p;
    pauseBtn.setAttribute('aria-pressed', String(p));
    pauseBtn.setAttribute('aria-label', p ? 'Play the trailer' : 'Pause the trailer');
    root.classList.toggle('sc--paused', p);
    gl?.wake();
  };
  const progress = (t) => root.style.setProperty('--sc-progress', t.toFixed(4));
  showSlide(0);
  setPaused(paused);
  progress(0);

  let cut = null; // { kind, from, to, t0 }
  // Start a cut toward scene `to`. The DOM copy swaps where the picture does: at the dip's peak, at the iris's start.
  const goTo = (to, kind = null) => {
    to = (to + DAYS.length) % DAYS.length;
    if (to === active && !kind) return;
    held = 0;
    const type = kind || (cfg.cut === 'mixed' ? (to === 2 || (to === 0 && active === 2) ? 'iris' : 'dip') : cfg.cut);
    if (!gl || !full || type === 'hard') { showSlide(to); gl?.hardSwitch(to); return; }
    cut = { kind: type, from: active, to, t0: performance.now(), swapped: false };
    if (type === 'iris') { showSlide(to); cut.swapped = true; }
    gl.wake();
  };
  steps.forEach((b) => on(ctx, b, 'click', () => goTo(Number(b.dataset.go))));
  on(ctx, root.querySelector('[data-prev]'), 'click', () => goTo(active - 1));
  on(ctx, root.querySelector('[data-next]'), 'click', () => goTo(active + 1));
  on(ctx, pauseBtn, 'click', () => setPaused(!paused));
  // Hover or focus inside the hero holds the autoplay, like any carousel.
  let hovering = false;
  on(ctx, hero, 'pointerenter', () => { hovering = true; });
  on(ctx, hero, 'pointerleave', () => { hovering = false; });
  let focused = false;
  on(ctx, hero, 'focusin', () => { focused = true; });
  on(ctx, hero, 'focusout', () => { focused = false; });

  if (ctx.motion === 'static' || !webglAvailable()) {
    root.classList.add('sc--dom');
    return { update(next) { cfg = { ...next }; }, action(id) { if (id === 'next' || id === 'iris' || id === 'dip') goTo(active + 1, 'hard'); } };
  }

  const { renderer, onResize } = useRenderer(ctx, host, { alpha: false, antialias: false });
  const rt = () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false, generateMipmaps: false });
  const sceneRT = rt();
  const cacheRT = rt();
  const halfA = rt();
  const halfB = rt();
  const quarterA = rt();
  const quarterB = rt();
  const kinds = DAYS.map(() => [new THREE.Color(), new THREE.Color(), new THREE.Color()]);
  const sceneMat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: SCENE_FRAG, depthTest: false, depthWrite: false, uniforms: { uKind: { value: 0 }, uTime: { value: 0 }, uAspect: { value: 1 }, uA: { value: new THREE.Color() }, uB: { value: new THREE.Color() }, uC: { value: new THREE.Color() } } });
  const blurMat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: BLUR_FRAG, depthTest: false, depthWrite: false, uniforms: { uTex: { value: null }, uDelta: { value: new THREE.Vector2() } } });
  const U = {
    uScene: { value: sceneRT.texture }, uHalf: { value: halfB.texture }, uQuarter: { value: quarterB.texture }, uCache: { value: cacheRT.texture },
    uTexel: { value: new THREE.Vector2() }, uAspect: { value: 1 }, uLift: { value: LIFT }, uAA: { value: 0.002 },
    uDip: { value: 0 }, uDipColor: { value: new THREE.Color() }, uIris: { value: 0 }, uFrozen: { value: 0 },
    uClose: { value: 0 }, uCloseSize: { value: 2 }, uGround: { value: new THREE.Color() },
  };
  const finalMat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FINAL_FRAG, depthTest: false, depthWrite: false, uniforms: U });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), sceneMat);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const pass = (mat, target) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(scene, cam); };
  ctx.onCleanup(() => { for (const o of [sceneRT, cacheRT, halfA, halfB, quarterA, quarterB, quad.geometry, sceneMat, blurMat, finalMat]) o.dispose(); });

  // Every colour comes from the tokens: three materials per scene, the dip in sand, the close in night.
  const colours = () => {
    DAYS.forEach((d, i) => d.tokens.forEach((t, j) => kinds[i][j].set(readToken(t) || '#888888')));
    U.uDipColor.value.set(readToken('--sand') || '#e3d2b1');
    U.uGround.value.set(readToken('--night') || '#1b1d24');
  };
  colours();
  ctx.onTheme(() => { colours(); gl.wake(); });

  const octx = outline.getContext('2d');
  let W = 1;
  let H = 1;
  let time = 0;
  let shown = 0; // the scene the target renders (swaps under the dip's flat colour)
  let frozen = false;
  let lastOutline = '';
  const sceneUniforms = (i) => {
    sceneMat.uniforms.uKind.value = i;
    sceneMat.uniforms.uTime.value = time;
    sceneMat.uniforms.uA.value = kinds[i][0];
    sceneMat.uniforms.uB.value = kinds[i][1];
    sceneMat.uniforms.uC.value = kinds[i][2];
  };
  // The iris begins: render the outgoing scene once into the cache, rather than copying the last frame.
  const freeze = (from) => { sceneUniforms(from); pass(sceneMat, cacheRT); frozen = true; };
  const drawOutline = (halfDiag, alpha) => {
    const s = Math.min(2, devicePixelRatio || 1);
    octx.setTransform(s, 0, 0, s, 0, 0);
    octx.clearRect(0, 0, W, H);
    if (alpha <= 0) return;
    const cx = W / 2;
    const cy = H / 2 - LIFT * H;
    const r = halfDiag * H;
    octx.strokeStyle = readToken('--sand') || '#e3d2b1';
    octx.globalAlpha = alpha;
    octx.lineWidth = 1;
    octx.beginPath();
    octx.moveTo(cx, cy - r);
    octx.lineTo(cx + r, cy);
    octx.lineTo(cx, cy + r);
    octx.lineTo(cx - r, cy);
    octx.closePath();
    octx.stroke();
    octx.globalAlpha = 1;
  };

  onResize(({ width, height }) => {
    W = width;
    H = height;
    const dpr = renderer.getPixelRatio();
    const bw = Math.max(1, Math.round(W * dpr));
    const bh = Math.max(1, Math.round(H * dpr));
    sceneRT.setSize(bw, bh);
    cacheRT.setSize(bw, bh);
    halfA.setSize(bw >> 1, bh >> 1);
    halfB.setSize(bw >> 1, bh >> 1);
    quarterA.setSize(bw >> 2, bh >> 2);
    quarterB.setSize(bw >> 2, bh >> 2);
    U.uTexel.value.set(1 / bw, 1 / bh);
    U.uAspect.value = sceneMat.uniforms.uAspect.value = W / H;
    U.uAA.value = 1.5 / H;
    const s = Math.min(2, devicePixelRatio || 1);
    outline.width = Math.round(W * s);
    outline.height = Math.round(H * s);
    lastOutline = '';
    if (frozen && cut?.kind === 'iris') freeze(cut.from); // a cached frame of another size is no longer valid
    gl?.wake();
  });

  let off = null;
  let holdAt = null; // the thumbnail holds an iris half open
  function frame(dt) {
    const now = performance.now();
    if (full && !paused) time += dt;
    // Autoplay: hold each scene, never while a cut runs, the pointer rests on the hero or focus is inside it.
    if (full && !paused && !cut && !hovering && !focused) {
      held += dt;
      progress(Math.min(1, held / cfg.hold));
      if (held >= cfg.hold) goTo(active + 1);
    }
    let dip = 0;
    let iris = 0;
    if (cut) {
      let c = Math.min(1, (now - cut.t0) / 1000 / cfg.duration);
      if (holdAt !== null) c = Math.min(c, holdAt);
      if (cut.kind === 'dip') {
        dip = c < 0.5 ? c * 2 : (1 - c) * 2;
        if (c >= 0.5 && !cut.swapped) { cut.swapped = true; showSlide(cut.to); }
        shown = c >= 0.5 ? cut.to : cut.from;
      } else {
        if (!frozen) freeze(cut.from);
        iris = c;
        shown = cut.to;
      }
      if (c >= 1) { cut = null; frozen = false; dip = 0; iris = 0; shown = active; progress(0); }
    } else shown = active;

    // The close, from the footer's top as a fraction of the viewport: 1 as it enters, 0 at the top.
    const top = footer.getBoundingClientRect().top / H;
    const close = full ? fit(top, 0.95, 0.0, 0, 0.925) : top < 0.5 ? 0.925 : 0;

    sceneUniforms(shown);
    pass(sceneMat, sceneRT);
    if (dip > 0) {
      blurMat.uniforms.uTex.value = sceneRT.texture; blurMat.uniforms.uDelta.value.set(4 / halfA.width, 0); pass(blurMat, halfA);
      blurMat.uniforms.uTex.value = halfA.texture; blurMat.uniforms.uDelta.value.set(0, 4 / halfA.height); pass(blurMat, halfB);
      blurMat.uniforms.uTex.value = halfB.texture; blurMat.uniforms.uDelta.value.set(8 / quarterA.width, 0); pass(blurMat, quarterA);
      blurMat.uniforms.uTex.value = quarterA.texture; blurMat.uniforms.uDelta.value.set(0, 8 / quarterA.height); pass(blurMat, quarterB);
    }
    // Diamond sizes are fractions of the frame's own reach (|x| + |y| at a corner), so 1 just clears the corners
    // at any aspect: a portrait phone gets the same staging as a desktop.
    const reach = U.uAspect.value / 2 + 0.5 + LIFT + 0.01;
    U.uDip.value = dip;
    U.uFrozen.value = frozen ? 1 : 0;
    U.uIris.value = iris * reach;
    U.uClose.value = close;
    U.uCloseSize.value = (1 - close) * reach;
    pass(finalMat, null);
    // The 2D edge redraws only when its geometry changes.
    const edge = frozen && iris > 0 && iris < 1;
    const key = edge ? `i${iris.toFixed(4)}` : close > 0 ? `c${close.toFixed(4)}` : 'none';
    if (key !== lastOutline) {
      lastOutline = key;
      if (edge) drawOutline(U.uIris.value, fit(iris, 0, 0.15, 0, 0.9) * fit(iris, 0.8, 1, 1, 0));
      else if (close > 0) drawOutline(U.uCloseSize.value, fit(close, 0, 0.25, 0, 0.6));
      else drawOutline(0, 0);
    }
    // Asleep when nothing moves: paused (or reduced) with no cut running.
    if ((paused || !full) && !cut) { off?.(); off = null; }
  }
  gl = {
    wake() { if (!off) off = onFrame(ctx, frame); },
    hardSwitch(to) { cut = null; frozen = false; shown = to; this.wake(); },
  };
  whileVisible(ctx, root, () => gl.wake(), () => { off?.(); off = null; }, { rootMargin: '0px' });
  on(ctx, window, 'scroll', () => gl.wake(), { passive: true });
  gl.wake();

  return {
    update(next, changed) {
      cfg = { ...next };
      if (changed.includes('autoplay')) setPaused(!full || !cfg.autoplay);
      gl.wake();
    },
    action(id) {
      if (id === 'next') goTo(active + 1);
      if (id === 'iris' || id === 'dip') {
        if (ctx.capture && id === 'iris') holdAt = 0.55;
        goTo(active + 1, full ? id : 'hard');
      }
    },
  };
}
