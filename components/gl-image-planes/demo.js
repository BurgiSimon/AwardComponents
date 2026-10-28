// WebGL image planes — Halden's work index. HTML lays out, WebGL renders: every picture stays an <img> with alt
// text inside a real link, and one absolute canvas, moved to the scroll each frame, draws a plane exactly over each
// image's rectangle (a camera whose distance makes one unit one pixel). The planes bulge with the damped Lenis
// velocity (z −= (sin πv + sin πu) · |speed| · strength) and lie flat at rest; hover or focus colours a plane in
// from grey. Touch: the plane nearest the middle of the screen colours in. The loop sleeps when nothing moves.
// Reduced motion, static or no WebGL: the images are simply images, coloured in on hover by a CSS filter.
import './demo.css';
import * as THREE from 'three';
import { on, onFrame, damp, clamp, html, raw, photos, imageHTML, finePointer, qualityTier, content } from '../../src/demo-kit/index.js';
import { useRenderer, webglAvailable } from '../../src/demo-kit/three.js';
import { useLenis } from '../../src/demo-kit/lenis.js';

const DIST = 1000; // camera distance: one world unit is one CSS pixel at z = 0
const MODES = { reveal: 0, fade: 1, lift: 2 };

const VERT = /* glsl */ `
  uniform float uSpeed;
  uniform float uStrength;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    // Both axes read as a sine hump scaled by the scroll speed; z is in pixels (the mesh scales x and y only).
    p.z -= (sin(uv.y * 3.14159) + sin(uv.x * 3.14159)) * abs(uSpeed) * uStrength;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;

const FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec2 uCover;
  uniform vec2 uOffset;
  uniform vec2 uSize;
  uniform vec2 uMouse;
  uniform float uRadius;
  uniform float uHover;
  uniform float uGrey;
  uniform float uMode;
  varying vec2 vUv;
  void main() {
    // object-fit: cover, plus a slow push-in on hover.
    vec2 uv = (vUv - 0.5) * (1.0 - 0.06 * uHover) + 0.5;
    vec4 tex = texture2D(uMap, uv * uCover + uOffset);
    vec3 grey = vec3(dot(tex.rgb, vec3(0.2126, 0.7152, 0.0722)));
    float amount = 0.0;
    if (uMode < 0.5) {
      // Reveal: a soft circle of colour grows from the pointer.
      float r = length((vUv - uMouse) * vec2(uSize.x / uSize.y, 1.0));
      float R = uHover * 1.7;
      amount = 1.0 - smoothstep(R - 0.2, R, r);
    } else if (uMode < 1.5) {
      amount = uHover;
    }
    vec3 col = mix(grey, tex.rgb, mix(1.0, amount, uGrey));
    // The image's own rounded corners, in pixels.
    vec2 q = abs(vUv - 0.5) * uSize - (uSize * 0.5 - uRadius);
    float d = length(max(q, 0.0)) - uRadius;
    gl_FragColor = vec4(col, 1.0 - smoothstep(-0.75, 0.75, d));
    #include <colorspace_fragment>
  }`;

// Draw the <img> through a 2D canvas: works for SVG sources and keeps the texture within 1024 px.
function textureFrom(img) {
  const iw = img.naturalWidth || 1200;
  const ih = img.naturalHeight || 1500;
  const s = Math.min(1, 1024 / Math.max(iw, ih));
  const c = document.createElement('canvas');
  c.width = Math.round(iw * s);
  c.height = Math.round(ih * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return { texture: t, aspect: iw / ih };
}

export default function mount(root, options, ctx) {
  const { studio } = content;
  let cfg = { ...options };
  const projects = studio.projects;
  const pics = photos({ tags: ['architecture'], count: projects.length, seed: 'gp-work' });
  const counts = studio.disciplines.map((d) => [d, projects.filter((p) => p.discipline === d).length]);

  root.className = 'gp';
  root.innerHTML = html`
    <header class="ac-bar gp__bar">
      <a class="ac-brand" href="#top">${studio.name}</a>
      <nav aria-label="Studio">${studio.nav.map((n, i) => html`<a href="#top"${raw(i === 0 ? ' aria-current="page"' : '')}>${n}</a>`)}</nav>
    </header>
    <main class="gp__page ac-wrap">
      <section class="gp__intro" aria-labelledby="gp-title">
        <p class="ac-label">Work · 2022–2026</p>
        <h1 class="ac-h1" id="gp-title">Eight projects, most of them in the rain.</h1>
        <p class="ac-lede">Houses, a library, a bathing pavilion and one chair. Every project here was drawn, built and lived in along the west coast.</p>
        <ul class="gp__counts" role="list">${counts.map(([d, n]) => html`<li><span>${d}</span><span class="ac-num">${String(n).padStart(2, '0')}</span></li>`)}</ul>
        <p class="gp__hint ac-label" data-hint>Scroll fast — the pictures bend with you</p>
      </section>
      <ol class="gp__grid" role="list" aria-label="Projects">
        ${projects.map((p, i) => html`<li class="gp__fig">
          <a href="#${p.slug}" class="gp__link" data-plane-link="${i}">
            <span class="gp__media">${raw(imageHTML(pics[i], { sizes: '(max-width: 760px) 92vw, 30vw', eager: true, className: 'gp__img', alt: `${p.title}, ${p.place}` }))}</span>
            <span class="gp__cap"><span class="gp__title">${p.title}</span><span class="ac-label">${p.place} · ${p.year}</span></span>
            <span class="gp__sum ac-small">${p.summary}</span>
          </a>
        </li>`)}
      </ol>
    </main>
    <div class="gp__gl" data-gl aria-hidden="true"></div>`;
  root.querySelectorAll('a[href^="#"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const links = [...root.querySelectorAll('[data-plane-link]')];
  const imgs = links.map((a) => a.querySelector('img'));
  const glHost = root.querySelector('[data-gl]');
  const apply = () => root.classList.toggle('gp--grey', cfg.grey);
  apply();

  if (ctx.motion !== 'full' || !webglAvailable()) {
    root.classList.add('gp--dom');
    return { update(next) { cfg = { ...next }; apply(); } };
  }

  const lenis = useLenis(ctx);
  const tier = qualityTier();
  const segments = tier.name === 'high' ? 32 : tier.name === 'mid' ? 16 : 8;
  const { renderer, onResize } = useRenderer(ctx, glHost, { alpha: true });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 10, 4000);
  camera.position.z = DIST;
  const geometry = new THREE.PlaneGeometry(1, 1, segments, segments);
  const size = { w: innerWidth, h: innerHeight };
  const fine = finePointer();
  let speed = 0;
  let lastY = -1;
  let off = null;
  let dirty = true;

  // One plane per image, made once its picture has decoded. The <img> hides only when its plane draws.
  const planes = links.map((link, i) => ({ i, link, img: imgs[i], mesh: null, h: 0, target: 0, mouse: new THREE.Vector2(0.5, 0.5) }));
  const uniformsFor = (p, made) => ({
    uMap: { value: made.texture }, uCover: { value: new THREE.Vector2(1, 1) }, uOffset: { value: new THREE.Vector2() },
    uSize: { value: new THREE.Vector2(1, 1) }, uMouse: { value: p.mouse }, uRadius: { value: 8 },
    uSpeed: { value: 0 }, uStrength: { value: cfg.strength }, uHover: { value: 0 }, uGrey: { value: cfg.grey ? 1 : 0 }, uMode: { value: MODES[cfg.hover] },
  });
  planes.forEach((p) => {
    const make = () => {
      if (ctx.signal.aborted || p.mesh) return;
      const made = textureFrom(p.img);
      const material = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: uniformsFor(p, made), transparent: true });
      p.aspect = made.aspect;
      p.mesh = new THREE.Mesh(geometry, material);
      p.mesh.frustumCulled = false;
      p.radius = parseFloat(getComputedStyle(p.img).borderTopLeftRadius) || 0;
      scene.add(p.mesh);
      p.img.classList.add('is-gl');
      wake();
    };
    (p.img.decode ? p.img.decode() : Promise.resolve()).then(make, make);
  });
  ctx.onCleanup(() => {
    geometry.dispose();
    planes.forEach((p) => { if (p.mesh) { p.mesh.material.uniforms.uMap.value.dispose(); p.mesh.material.dispose(); } });
  });

  onResize(({ width, height }) => {
    size.w = width;
    size.h = height;
    camera.aspect = width / height;
    camera.fov = 2 * Math.atan(height / 2 / DIST) * (180 / Math.PI);
    camera.updateProjectionMatrix();
    wake();
  });
  // The canvas host is one viewport tall; on phones the visible height changes as the toolbar hides.
  const fitHost = () => { glHost.style.height = `${innerHeight}px`; };
  fitHost();
  on(ctx, window, 'resize', fitHost);

  // Hover and focus set a plane's target; the reveal starts where the pointer entered.
  const uvOf = (p, e) => {
    const r = p.img.getBoundingClientRect();
    p.mouse.set((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height);
  };
  planes.forEach((p) => {
    if (fine) {
      on(ctx, p.link, 'pointerenter', (e) => { uvOf(p, e); p.target = 1; wake(); });
      on(ctx, p.link, 'pointermove', (e) => { if (cfg.hover === 'reveal' && p.h < 0.98) { uvOf(p, e); wake(); } });
      on(ctx, p.link, 'pointerleave', () => { p.target = 0; wake(); });
    }
    on(ctx, p.link, 'focus', () => { p.mouse.set(0.5, 0.5); p.target = 1; wake(); });
    on(ctx, p.link, 'blur', () => { p.target = 0; wake(); });
  });

  // The loop runs only while something moves: the scroll, the velocity settling, a hover easing in or out.
  function frame(dt) {
    const y = window.scrollY;
    glHost.style.transform = `translate3d(0, ${y}px, 0)`;
    speed = damp(speed, clamp(lenis?.velocity || 0, -60, 60), cfg.damping, dt); // capped: a dropped frame is not a fling
    if (Math.abs(speed) < 0.01) speed = 0;
    // Touch: the plane nearest the middle of the screen is the one in colour.
    if (!fine) {
      let best = null;
      let bestD = size.h * 0.3;
      for (const p of planes) {
        const r = p.img.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - size.h / 2);
        if (d < bestD) { bestD = d; best = p; }
      }
      for (const p of planes) if (document.activeElement !== p.link) p.target = p === best ? 1 : 0;
    }
    let easing = false;
    for (const p of planes) {
      p.h = damp(p.h, p.target, 5, dt);
      if (Math.abs(p.h - p.target) < 0.002) p.h = p.target; else easing = true;
      if (!p.mesh) continue;
      const r = p.img.getBoundingClientRect();
      const visible = r.bottom > -100 && r.top < size.h + 100;
      p.mesh.visible = visible;
      if (!visible) continue;
      p.mesh.position.set(r.left + r.width / 2 - size.w / 2, size.h / 2 - (r.top + r.height / 2), 0);
      p.mesh.scale.set(r.width, r.height, 1);
      const u = p.mesh.material.uniforms;
      u.uSpeed.value = speed;
      u.uHover.value = p.h;
      u.uSize.value.set(r.width, r.height);
      u.uRadius.value = p.radius;
      const pa = r.width / r.height;
      if (p.aspect > pa) { u.uCover.value.set(pa / p.aspect, 1); u.uOffset.value.set((1 - pa / p.aspect) / 2, 0); }
      else { u.uCover.value.set(1, p.aspect / pa); u.uOffset.value.set(0, (1 - p.aspect / pa) / 2); }
    }
    renderer.render(scene, camera);
    const moving = y !== lastY || speed !== 0 || easing || dirty;
    lastY = y;
    dirty = false;
    if (!moving) { off?.(); off = null; }
  }
  function wake() { dirty = true; if (!off) off = onFrame(ctx, frame); }
  on(ctx, window, 'scroll', wake, { passive: true });
  lenis?.on('scroll', wake);
  document.fonts?.ready.then(wake);
  wake();

  return {
    update(next) {
      cfg = { ...next };
      apply();
      planes.forEach((p) => {
        if (!p.mesh) return;
        const u = p.mesh.material.uniforms;
        u.uStrength.value = cfg.strength;
        u.uGrey.value = cfg.grey ? 1 : 0;
        u.uMode.value = MODES[cfg.hover];
      });
      wake();
    },
  };
}
