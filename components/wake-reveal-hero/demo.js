// Wake reveal — a house project's hero, by day. Where a fine pointer passes it leaves up to 140 short-lived points,
// stamped as radial gradients (lighter compositing) into a small 2D canvas; the shader reads that canvas as a mask
// and shows the same photograph graded to night (or dusk, or winter) only where the mask is open. The graded world
// renders into its own target at 0.62 of the pixel ratio, every second frame, and nothing renders at rest.
// Touch, reduced motion and no WebGL: the day picture, plus a Night button (GL where it runs, a CSS grade otherwise).
import './demo.css';
import * as THREE from 'three';
import { on, onFrame, html, raw, finePointer, readToken, photos, imageHTML, loadImage, content } from '../../src/demo-kit/index.js';
import { useRenderer, webglAvailable } from '../../src/demo-kit/three.js';

const WAKE = { max: 140, minStep: 6, speedRef: 1600, maskW: 480, maskH: 300 };
const WORLD_SCALE = 0.62;   // the world's render scale, separate from the canvas's own pixel ratio
const GRADES = { night: 0, dusk: 1, winter: 2 };
const CAPTURE_T = 100000;   // the frozen clock for the thumbnail

const vert = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const worldFrag = /* glsl */ `
  uniform sampler2D uPhoto;
  uniform vec4 uCover;
  uniform float uTime;
  uniform float uAspect;
  uniform int uGrade;
  uniform vec3 uA;
  uniform vec3 uB;
  uniform vec3 uC;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    vec3 day = texture2D(uPhoto, uCover.xy + vUv * uCover.zw).rgb;
    float lum = dot(day, vec3(0.2126, 0.7152, 0.0722));
    float sky = smoothstep(0.38, 0.85, vUv.y) * smoothstep(0.18, 0.55, lum);
    vec3 col;
    if (uGrade == 0) {
      // Night: moonlight over the land, the bright sky deepened and starred, the brightest low surfaces lit warm.
      col = day * uA * 0.42;
      col = mix(col, mix(uB, uA * 0.22, vUv.y), sky * 0.9);
      vec2 p = vec2(vUv.x * uAspect, vUv.y) * 130.0;
      float h = hash(floor(p));
      col += vec3(step(0.985, h) * smoothstep(0.22, 0.0, length(fract(p) - 0.5)) * (0.7 + 0.3 * sin(uTime * 2.0 + h * 40.0))) * sky;
      col += uC * smoothstep(0.6, 0.92, lum) * (1.0 - smoothstep(0.32, 0.58, vUv.y)) * 0.85;
    } else if (uGrade == 1) {
      // Dusk: a low warm sun; the sky burns from clay at the horizon to plum overhead.
      col = day * mix(uA, vec3(1.0), 0.4) * 0.85;
      col = mix(col, mix(uA * 1.2, uB, smoothstep(0.4, 1.0, vUv.y)), sky * 0.7);
    } else {
      // Winter: desaturated and lifted, cold in the shadows, the bright faces gone to snow.
      vec3 grey = vec3(lum);
      col = mix(day, grey, 0.78) * mix(vec3(1.0), uA, 0.35) * 1.15 + 0.05;
      col = mix(col, vec3(0.92, 0.95, 1.0), smoothstep(0.45, 0.85, lum) * 0.6);
    }
    gl_FragColor = vec4(col, 1.0);
  }`;
const compositeFrag = /* glsl */ `
  uniform sampler2D uWorld;
  uniform sampler2D uMask;
  uniform float uSoft;
  uniform float uAll;
  varying vec2 vUv;
  void main() {
    // Alpha: the white paint uploads unpremultiplied, so the channel is 1 wherever any alpha is.
    float m = max(smoothstep(0.02, uSoft, texture2D(uMask, vUv).a), uAll);
    gl_FragColor = vec4(texture2D(uWorld, vUv).rgb, 1.0);
    #include <colorspace_fragment>
    gl_FragColor = vec4(gl_FragColor.rgb, m); // normal blending premultiplies into the clear buffer: the day picture shows where the mask is shut
  }`;

const ICON = {
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
};
const svg = (name) => raw(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">${ICON[name]}</svg>`);

export default async function mount(root, options, ctx) {
  const { studio } = content;
  const project = studio.projects[0];
  const [photo] = photos({ tags: ['landscape'], orientation: 'landscape', count: 1, seed: 'wr-day' });
  let cfg = { ...options };
  root.className = 'wr';
  root.innerHTML = html`
    <header class="ac-bar wr__bar">
      <a class="ac-brand" href="#top">${studio.name}</a>
      <nav aria-label="Studio">${studio.nav.map((n) => html`<a href="#top">${n}</a>`)}</nav>
    </header>
    <section class="wr__hero" aria-labelledby="wr-title" data-hero>
      <div class="wr__paper">
        ${raw(imageHTML(photo, { eager: true, sizes: '100vw', alt: photo.alt || `${project.title} by day, above the fjord` }))}
        ${raw(imageHTML(photo, { eager: true, sizes: '100vw', alt: '', className: 'wr__css-world' }))}
      </div>
      <div class="wr__gl" data-gl></div>
      <div class="wr__scrim" aria-hidden="true"></div>
      <div class="wr__copy ac-wrap">
        <p class="ac-label wr__kicker">${project.title} · Hardanger, Norway · ${project.year}</p>
        <h1 class="wr__title" id="wr-title">A house for the dark half of the year.</h1>
        <div class="wr__row">
          <p class="wr__lede">Timber, granite and one long window to the fjord, drawn around six hours of December light.</p>
          <div class="wr__actions">
            <button class="wr__toggle" type="button" aria-pressed="false" data-toggle><span class="wr__sun">${svg('sun')}</span><span class="wr__moon">${svg('moon')}</span><span data-toggle-label>Night</span></button>
            <a class="ac-btn ac-btn--accent ac-btn--lg" href="#top">View the project</a>
          </div>
        </div>
      </div>
      <p class="wr__hint ac-label" data-hint hidden>Move across the picture</p>
    </section>
    <section class="wr__facts ac-wrap" aria-label="Project facts">
      <dl>
        <div><dt class="ac-label">Area</dt><dd>${project.size}</dd></div>
        <div><dt class="ac-label">Glazing</dt><dd>38 m, one pane line</dd></div>
        <div><dt class="ac-label">Heating</dt><dd>Ground source, 4 kW</dd></div>
        <div><dt class="ac-label">Completed</dt><dd>${project.year}</dd></div>
      </dl>
    </section>`;
  root.querySelectorAll('a[href="#top"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const hero = root.querySelector('[data-hero]');
  const host = root.querySelector('[data-gl]');
  const toggle = root.querySelector('[data-toggle]');
  const toggleLabel = root.querySelector('[data-toggle-label]');
  let night = false;
  let setNight = () => {};

  const applyCss = () => {
    root.dataset.grade = cfg.grade;
    toggleLabel.textContent = night ? 'Day' : cfg.grade[0].toUpperCase() + cfg.grade.slice(1);
    toggle.setAttribute('aria-pressed', String(night));
  };
  on(ctx, toggle, 'click', () => { night = !night; applyCss(); setNight(night); });
  applyCss();

  // Paper only: touch, reduced motion, no WebGL. The Night button cross-fades a CSS-graded copy of the picture.
  const live = finePointer() && ctx.motion === 'full' && webglAvailable();
  if (!live) {
    root.classList.add('wr--css');
    setNight = (v) => root.classList.toggle('wr--night', v);
    return {
      update(next) { cfg = { ...next }; applyCss(); },
      action(id) { if (id === 'night') toggle.click(); },
    };
  }

  const img = await loadImage(photo);
  if (ctx.signal.aborted) return {};
  const { renderer, onResize } = useRenderer(ctx, host, { alpha: true, antialias: false, dprCap: 1.5 });
  renderer.setClearColor(0x000000, 0);

  // The wake mask: a small 2D canvas, cleared and repainted from the live points each frame.
  const mask = document.createElement('canvas');
  mask.width = WAKE.maskW; mask.height = WAKE.maskH;
  const mctx = mask.getContext('2d');
  const maskTex = new THREE.CanvasTexture(mask);
  maskTex.minFilter = THREE.LinearFilter;
  maskTex.generateMipmaps = false;
  // The picture goes through a 2D canvas first: drawn stand-ins are SVG, which texImage2D will not take directly.
  const pw = Math.min(1600, photo.width || img.naturalWidth || 1200);
  const ph = Math.round(pw * ((photo.height || img.naturalHeight || 750) / (photo.width || img.naturalWidth || 1200)));
  const still = document.createElement('canvas');
  still.width = pw; still.height = ph;
  still.getContext('2d').drawImage(img, 0, 0, pw, ph);
  const photoTex = new THREE.CanvasTexture(still);
  photoTex.colorSpace = THREE.SRGBColorSpace;
  photoTex.minFilter = THREE.LinearFilter;
  photoTex.generateMipmaps = false;
  photoTex.needsUpdate = true;

  const worldRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, generateMipmaps: false });
  const worldMat = new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: worldFrag, depthTest: false, depthWrite: false,
    uniforms: { uPhoto: { value: photoTex }, uCover: { value: new THREE.Vector4(0, 0, 1, 1) }, uTime: { value: 0 }, uAspect: { value: 1 }, uGrade: { value: 0 }, uA: { value: new THREE.Color() }, uB: { value: new THREE.Color() }, uC: { value: new THREE.Color() } },
  });
  const compMat = new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: compositeFrag, depthTest: false, depthWrite: false, transparent: true,
    uniforms: { uWorld: { value: worldRT.texture }, uMask: { value: maskTex }, uSoft: { value: cfg.softness }, uAll: { value: 0 } },
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), worldMat);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  ctx.onCleanup(() => { for (const o of [worldRT, maskTex, photoTex, worldMat, compMat, quad.geometry]) o.dispose(); });

  // Grades read the theme's material tokens: night = sky / night / accent, dusk = clay / plum, winter = sky.
  const readGrade = () => {
    const u = worldMat.uniforms;
    u.uGrade.value = GRADES[cfg.grade] ?? 0;
    const [a, b, c] = { night: ['--sky', '--night', '--accent'], dusk: ['--clay', '--plum', '--accent'], winter: ['--sky', '--night', '--sky'] }[cfg.grade] || ['--sky', '--night', '--accent'];
    u.uA.value.setStyle(readToken(a)); u.uB.value.setStyle(readToken(b)); u.uC.value.setStyle(readToken(c));
  };
  readGrade();

  // Wake points in hero-local CSS px: x, y, birth time, radius.
  let w = 1; let h = 1;
  const pts = [];
  const clock = () => (ctx.capture ? CAPTURE_T : performance.now());
  let last = null;
  const add = (x, y, t, r) => { pts.push({ x, y, t, r }); if (pts.length > WAKE.max) pts.shift(); };
  on(ctx, hero, 'pointermove', (e) => {
    if (e.pointerType !== 'mouse' || ctx.capture) return;
    const rect = host.getBoundingClientRect();
    const x = e.clientX - rect.left; const y = e.clientY - rect.top;
    const now = performance.now();
    if (last && Math.hypot(x - last.x, y - last.y) < WAKE.minStep) return;
    const speed = last ? Math.hypot(x - last.x, y - last.y) / Math.max(0.008, (now - last.t) / 1000) : 0;
    add(x, y, now, cfg.radius * Math.min(w, h) * (0.6 + 0.6 * Math.min(1.5, speed / WAKE.speedRef)));
    last = { x, y, t: now };
    wake();
  }, { passive: true });
  on(ctx, hero, 'pointerleave', () => { last = null; });

  let time = 0;
  let frame = 0;
  let worldDirty = true;
  let cleared = true;
  let allTarget = 0;
  const paintMask = (now) => {
    while (pts.length && now - pts[0].t > cfg.life) pts.shift();
    mctx.clearRect(0, 0, WAKE.maskW, WAKE.maskH);
    mctx.globalCompositeOperation = 'lighter'; // overlapping stamps add up, so a fresh stroke opens as one band
    const sx = WAKE.maskW / w; const sy = WAKE.maskH / h;
    for (const p of pts) {
      const a = 1 - (now - p.t) / cfg.life;
      const x = p.x * sx; const y = p.y * sy; const r = p.r * sx;
      const g = mctx.createRadialGradient(x, y, 0, x, y, r);
      // A plateau to 45 % of the radius, then a falloff: the band stays open while fresh and narrows as it ages.
      g.addColorStop(0, `rgba(255,255,255,${a.toFixed(3)})`);
      g.addColorStop(0.45, `rgba(255,255,255,${(a * 0.8).toFixed(3)})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      mctx.fillStyle = g;
      mctx.beginPath();
      mctx.ellipse(x, y, r, r * (sy / sx), 0, 0, Math.PI * 2);
      mctx.fill();
    }
    maskTex.needsUpdate = true;
  };

  let off = null;
  const tick = (dt) => {
    time += dt; frame++;
    const u = compMat.uniforms;
    u.uAll.value += (allTarget - u.uAll.value) * (1 - Math.exp(-dt * 6));
    if (Math.abs(allTarget - u.uAll.value) < 0.002) u.uAll.value = allTarget;
    worldMat.uniforms.uTime.value = time;
    paintMask(clock());
    const open = pts.length > 0 || u.uAll.value > 0;
    if (!open) {
      if (!cleared) { renderer.setRenderTarget(null); renderer.clear(); cleared = true; }
      off?.(); off = null;
      return;
    }
    // The world: reduced scale, every second frame.
    if (worldDirty || frame % 2 === 0) {
      quad.material = worldMat; renderer.setRenderTarget(worldRT); renderer.render(scene, cam);
      worldDirty = false;
    }
    quad.material = compMat; renderer.setRenderTarget(null); renderer.render(scene, cam);
    cleared = false;
    const settled = !pts.length && u.uAll.value === allTarget;
    if (settled || ctx.capture) { off?.(); off = null; }
  };
  function wake() { if (!off) off = onFrame(ctx, tick); }

  // object-fit: cover with the picture's own focus, so the graded world lands exactly on the day picture.
  const [fx, fy] = String(photo.focus || '50% 50%').split(' ').map((v) => parseFloat(v) / 100);
  onResize((size) => {
    w = size.width; h = size.height;
    const s = renderer.getPixelRatio() * WORLD_SCALE;
    worldRT.setSize(Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s)));
    const ia = pw / ph;
    const ca = w / h;
    const cover = worldMat.uniforms.uCover.value;
    if (ca > ia) { const sy = ia / ca; cover.set(0, (1 - sy) * (1 - fy), 1, sy); } else { const sx = ca / ia; cover.set((1 - sx) * fx, 0, sx, 1); }
    worldMat.uniforms.uAspect.value = ca;
    worldDirty = true;
    wake();
  });

  setNight = (v) => { allTarget = v ? 1 : 0; worldDirty = true; wake(); };
  ctx.onTheme(() => { readGrade(); worldDirty = true; wake(); });

  // The thumbnail: a fixed S-shaped wake across the picture on a frozen clock.
  if (ctx.capture) {
    const r = cfg.radius * Math.min(w, h) * 1.15;
    for (let i = 0; i <= 70; i++) {
      const t = i / 70;
      add(w * (0.36 + 0.42 * t), h * (0.62 - 0.36 * t + 0.1 * Math.sin(t * Math.PI * 2)), CAPTURE_T - (1 - t) * cfg.life * 0.8, r);
    }
    wake();
  } else {
    root.querySelector('[data-hint]').hidden = false;
  }

  return {
    update(next, changed) {
      cfg = { ...next };
      compMat.uniforms.uSoft.value = cfg.softness;
      if (changed.includes('grade')) { readGrade(); worldDirty = true; }
      applyCss();
      wake();
    },
    action(id) { if (id === 'night') toggle.click(); },
  };
}
