// Theme wipe — Fieldnote's article page with a Night reading switch. Pressing it shows a fixed, full-screen
// orthographic quad that grows the next theme's ground (its --bg, read once for both themes) from the press point,
// its rim roughened by two octaves of value noise. data-theme on <html> flips in the tween's onComplete, under full
// cover; then the cover fades and is hidden. One proxy drives either the GL quad or, without WebGL, a CSS
// clip-path circle. A press mid-cover reverses the same tween. Reduced and static: an instant swap, no GL context.
import './demo.css';
import '../../src/demo-kit/serif.css';
import { on, later, html, raw, photos, imageHTML, content } from '../../src/demo-kit/index.js';
import { gsap } from '../../src/demo-kit/gsap.js';
import { THREE, useRenderer, webglAvailable } from '../../src/demo-kit/three.js';

const REVEAL = 0.3;
const vertexShader = /* glsl */ `
  void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
// Drawing-buffer pixels throughout. The radius runs from -edge (nothing covered at 0) to the farthest corner + edge
// (everything covered at 1); the noise moves the rim by at most half the edge, so both ends are exact.
const fragmentShader = /* glsl */ `
  uniform float uProgress;
  uniform vec2 uCenter;
  uniform vec2 uResolution;
  uniform vec3 uColor;
  uniform float uEdge;
  uniform float uNoise;
  uniform float uTime;
  uniform float uSeed;

  float hash(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  void main() {
    vec2 px = gl_FragCoord.xy;
    float edge = max(uEdge, 1.0);
    float reach = length(max(uCenter, uResolution - uCenter));
    float radius = mix(-edge, reach + edge, uProgress);
    vec2 drift = vec2(uTime * 0.9, -uTime * 0.6) + uSeed;
    float n = vnoise(px / (edge * 1.6) + drift) * 0.7 + vnoise(px / (edge * 0.45) - drift) * 0.3;
    float rim = length(px - uCenter) + (n - 0.5) * edge * uNoise;
    float inside = 1.0 - smoothstep(radius - 1.0, radius + 1.0, rim);
    gl_FragColor = vec4(uColor, inside);
    #include <colorspace_fragment>
    #include <premultiplied_alpha_fragment>
  }
`;

const BODY = [
  'The sea at Tromsø is four degrees in January and the sun does not rise for seven weeks. The sauna on the quay opens at six in the evening and is full by seven.',
  'Nobody swims far. You walk down the ladder, count to ten in the black water and climb back out into the steam, where someone has already put another log on the stove.',
  'The regulars say the dark is the point. Without a view there is nothing to look at but the cold, and after a winter of it you stop dreading the ladder.',
  'The town’s third floating sauna opened in November. Its windows face north, towards the open sea, so that on a clear night the bench becomes the best seat for the aurora.',
];

export default function mount(root, options, ctx) {
  const { magazine } = content;
  const article = magazine.articles.find((a) => a.slug === 'night-swimming');
  const [pic] = photos({ tags: ['water'], count: 1, seed: 'tw-night', orientation: 'portrait' });
  const doc = document.documentElement;
  let cfg = { ...options };
  root.className = 'tw';
  root.innerHTML = html`
    <header class="ac-bar tw__bar">
      <a class="ac-brand tw__brand" href="#top">${magazine.name}</a>
      <nav aria-label="Sections"><a href="#top">${magazine.issue.split(' — ')[0]}</a><a href="#top">Places</a><a href="#top">Craft</a><a href="#top">Culture</a></nav>
      <button class="tw__switch" type="button" aria-pressed="false" data-switch><span class="tw__track" aria-hidden="true"><span class="tw__knob"></span></span>Night reading</button>
    </header>
    <article class="tw__article">
      <header class="tw__hero ac-wrap">
        <div class="tw__titles">
          <p class="ac-label">${article.section} · ${magazine.issue}</p>
          <h1 class="tw__title">${article.title}</h1>
          <p class="tw__dek">${article.dek}</p>
          <p class="tw__by ac-label">Words by ${article.author} · ${article.read} read</p>
        </div>
        <figure class="tw__fig">
          <div class="ac-media tw__pic">${raw(imageHTML(pic, { eager: true, sizes: '(max-width: 760px) 100vw, 40vw', alt: 'Swimmers on the ladder of a floating sauna at night' }))}</div>
          <figcaption class="ac-small">The floating sauna at Telegrafbukta, January.</figcaption>
        </figure>
      </header>
      <div class="tw__body ac-wrap ac-wrap--narrow">${BODY.map((p) => html`<p>${p}</p>`)}</div>
    </article>
    <div class="tw__cover" aria-hidden="true" data-cover></div>
    <div class="tw__cover tw__cover--css" aria-hidden="true" data-css hidden></div>`;
  root.querySelectorAll('a[href="#top"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const toggle = root.querySelector('[data-switch]');
  const host = root.querySelector('[data-cover]');
  const cssCover = root.querySelector('[data-css]');

  // Each theme's ground, read once. Setting the attribute, reading and restoring it happen in one task: no paint between.
  const grounds = {};
  {
    const prev = doc.getAttribute('data-theme');
    for (const t of ['light', 'dark']) { doc.setAttribute('data-theme', t); grounds[t] = getComputedStyle(doc).getPropertyValue('--bg').trim(); }
    doc.setAttribute('data-theme', prev || 'light');
  }

  const S = { theme: doc.dataset.theme === 'dark' ? 'dark' : 'light', phase: 'idle', surface: 'css', origin: null };
  S.requested = S.theme;
  const setPressed = () => toggle.setAttribute('aria-pressed', String(S.requested === 'dark'));
  setPressed();

  // The GL cover, created on first need (or shortly after mount), never under reduced motion.
  let gl = null;
  const ensureGL = () => {
    if (gl || cfg.css || ctx.motion !== 'full' || !webglAvailable()) return gl;
    const { renderer, onResize } = useRenderer(ctx, host, { alpha: true, antialias: false, dprCap: 2 });
    renderer.setClearColor(0x000000, 0);
    const uniforms = {
      uProgress: { value: 0 }, uCenter: { value: new THREE.Vector2() }, uResolution: { value: new THREE.Vector2(1, 1) },
      uColor: { value: new THREE.Color() }, uEdge: { value: cfg.edge }, uNoise: { value: cfg.noise }, uTime: { value: 0 }, uSeed: { value: 0 },
    };
    const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true, premultipliedAlpha: true, blending: THREE.NoBlending, depthTest: false, depthWrite: false });
    const geometry = new THREE.PlaneGeometry(2, 2);
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(geometry, material));
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    renderer.compile(scene, camera); // compiled ahead, so the first press does not stall
    ctx.onCleanup(() => { geometry.dispose(); material.dispose(); });
    gl = { renderer, uniforms, render: () => renderer.render(scene, camera) };
    onResize(({ width, height }) => {
      const dpr = renderer.getPixelRatio();
      uniforms.uResolution.value.set(width * dpr, height * dpr);
      uniforms.uEdge.value = cfg.edge * dpr;
      if (S.phase !== 'idle' && S.surface === 'gl') paint();
    });
    return gl;
  };

  // One driver, two surfaces: proxy.p is the cover's progress whether the quad or the CSS circle draws it.
  const proxy = { p: 0 };
  let tween = null;
  let fade = null;
  const surface = () => (S.surface === 'gl' ? host : cssCover);
  const paint = () => {
    const o = S.origin;
    if (S.surface === 'gl') {
      const u = gl.uniforms;
      const dpr = gl.renderer.getPixelRatio();
      u.uProgress.value = proxy.p;
      u.uCenter.value.set(o.x * dpr, (innerHeight - o.y) * dpr);
      u.uTime.value = tween ? tween.time() : 0;
      gl.render();
    } else {
      const reach = Math.hypot(Math.max(o.x, innerWidth - o.x), Math.max(o.y, innerHeight - o.y));
      cssCover.style.clipPath = `circle(${(proxy.p * (reach + 2)).toFixed(1)}px at ${o.x}px ${o.y}px)`;
    }
  };

  const apply = (theme) => { doc.setAttribute('data-theme', theme); S.theme = theme; };
  const idle = () => {
    host.classList.remove('is-on');
    cssCover.hidden = true;
    gsap.set([host, cssCover], { opacity: 1 });
    tween = null;
    fade = null;
    proxy.p = 0;
    S.phase = 'idle';
  };
  ctx.onCleanup(() => { tween?.kill(); fade?.kill(); });

  const start = (target, origin) => {
    S.surface = ensureGL() ? 'gl' : 'css';
    S.origin = origin;
    S.phase = 'cover';
    if (S.surface === 'gl') {
      gl.uniforms.uColor.value.setStyle(grounds[target]); // sRGB token → linear; colorspace_fragment converts back
      gl.uniforms.uSeed.value = Math.random() * 100;
      gl.uniforms.uNoise.value = cfg.noise;
      gl.uniforms.uEdge.value = cfg.edge * gl.renderer.getPixelRatio();
      host.classList.add('is-on');
    } else {
      cssCover.style.background = grounds[target];
      cssCover.hidden = false;
    }
    proxy.p = 0;
    paint();
    tween = gsap.to(proxy, {
      p: 1,
      duration: cfg.duration,
      ease: 'power2.inOut',
      onUpdate: paint,
      // Full cover: flip the tokens underneath it, then let the cover go.
      onComplete() {
        apply(target);
        S.phase = 'reveal';
        fade = gsap.to(surface(), { opacity: 0, duration: REVEAL, ease: 'power1.out', onComplete: idle });
      },
      onReverseComplete: idle, // turned around mid-cover: nothing was swapped, nothing to undo
    });
    return tween;
  };

  on(ctx, toggle, 'click', (e) => {
    S.requested = S.requested === 'dark' ? 'light' : 'dark';
    setPressed();
    if (ctx.motion !== 'full') {
      tween?.kill(); fade?.kill(); idle();
      if (S.requested !== S.theme) apply(S.requested);
      return;
    }
    // A press during the cover turns the same edge around, or forward again.
    if (S.phase === 'cover') { if (S.requested === S.theme) tween.reverse(); else tween.play(); return; }
    if (S.phase === 'reveal') { fade.kill(); idle(); }
    // A pointer press starts at the pointer; a key press (detail 0) at the button's centre.
    const r = toggle.getBoundingClientRect();
    const o = e.detail > 0 ? { x: e.clientX, y: e.clientY } : { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    start(S.requested, { x: Math.round(o.x), y: Math.round(o.y) });
  });

  // The library's own theme switch wins over a wipe in progress.
  ctx.onTheme((theme) => {
    tween?.kill(); fade?.kill(); idle();
    S.theme = theme;
    S.requested = theme;
    setPressed();
  });

  if (ctx.motion === 'full') later(ctx, ensureGL, 300);

  // The thumbnail: a wipe from the switch held a little under halfway across the page.
  if (ctx.capture && ctx.motion === 'full') {
    document.fonts.ready.then(() => {
      const r = toggle.getBoundingClientRect();
      S.requested = S.theme === 'dark' ? 'light' : 'dark';
      start(S.requested, { x: Math.round(r.left + r.width * 0.2), y: Math.round(r.top + r.height / 2) }).pause();
      proxy.p = 0.42;
      paint();
    });
  }

  return {
    update(next, changed) {
      cfg = { ...next };
      if (gl && changed.some((k) => k === 'edge' || k === 'noise')) {
        gl.uniforms.uNoise.value = cfg.noise;
        gl.uniforms.uEdge.value = cfg.edge * gl.renderer.getPixelRatio();
        if (S.phase !== 'idle' && S.surface === 'gl') paint();
      }
    },
  };
}
