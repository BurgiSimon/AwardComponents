// Shader hover states — the sign-up band that closes a banking app's page. A ring field in one fragment shader sits
// behind the form, centred on the submit button. Its uniforms are plain GSAP tween targets: hovering or focusing the
// button charges the rings (0.9 s power2.out in, 0.45 s power2.in out), focusing the email field moves the band's
// look from calm to charged (0.9 s power2.inOut). Every change goes through one retarget(): kill what is moving
// that value, then tween from wherever it is now, so a half-finished hover turns round without a jump. Frames are
// drawn on GSAP's ticker only while a tween is updating. The button's own fill changes in the same beat, in CSS.
import './demo.css';
import * as THREE from 'three';
import { on, html, readToken, colour, content, observeResize } from '../../src/demo-kit/index.js';
import { gsap } from '../../src/demo-kit/gsap.js';
import { useRenderer, webglAvailable } from '../../src/demo-kit/three.js';

// Scene looks: the post values the band moves between, never a free dial.
const PRESETS = { calm: { vignette: 0.3, grain: 0.035, density: 96 }, charged: { vignette: 0.62, grain: 0.08, density: 150 } };

const vertexShader = /* glsl */ 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }';
const fragmentShader = /* glsl */ `
  uniform vec2 uRes, uCenter, uBoxCenter, uBoxHalf;
  uniform float uPx;
  uniform vec3 uGround, uShade, uRest, uTarget;
  uniform float uHover, uSwell, uVignette, uGrain, uDensity;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
  void main() {
    vec2 p = (gl_FragCoord.xy - uCenter) / uRes.y;
    float r = length(p);
    vec3 tint = mix(uRest, uTarget, uHover);
    float reach = 0.42 + 0.14 * uSwell;
    float rings = smoothstep(0.55, 0.9, 0.5 + 0.5 * cos(r * uDensity - uSwell * 4.0));
    // The rings stay off the form itself (a rounded box from its rectangle), so its label and note keep their contrast.
    float calm = smoothstep(2.0 * uPx, 44.0 * uPx, sdBox(gl_FragCoord.xy - uBoxCenter, uBoxHalf));
    float halo = rings * calm * (1.0 - smoothstep(reach * 0.3, reach, r)) * (0.5 + 0.5 * uHover);
    vec3 col = mix(uGround, tint, halo);
    col = mix(col, uTarget, uHover * 0.16 * (1.0 - smoothstep(0.0, reach * 1.4, r)));   // a warm pool under the charge
    vec2 q = gl_FragCoord.xy / uRes - 0.5;
    col = mix(col, uShade, uVignette * smoothstep(0.25, 0.8, length(q * vec2(uRes.x / uRes.y, 1.0)) * 0.7));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
    gl_FragColor.rgb += (hash(gl_FragCoord.xy) - 0.5) * uGrain;   // grain after encoding, so it reads the same on light and dark
  }`;

export default function mount(root, options, ctx) {
  const { app } = content;
  let cfg = { ...options };
  root.className = 'sb';
  root.innerHTML = html`
    <header class="ac-bar sb__bar">
      <a class="ac-brand" href="#top">${app.name}</a>
      <nav aria-label="Product"><a href="#top">Features</a><a href="#top">Pricing</a><a href="#top">Sign in</a></nav>
    </header>
    <section class="sb__features ac-wrap" aria-label="Features">
      ${app.features.slice(0, 3).map((f, i) => html`<div><span class="ac-label">0${i + 1}</span><h2 class="sb__ft">${f.title}</h2><p class="ac-small">${f.body.split('. ')[0].replace(/\.$/, '')}.</p></div>`)}
    </section>
    <section class="sb__band" data-band aria-labelledby="sb-title">
      <div class="sb__gl" data-stage></div>
      <div class="sb__inner ac-wrap">
        <div class="sb__copy">
          <p class="ac-label">${app.name} · for studios of two to twenty</p>
          <h2 class="ac-display sb__title" id="sb-title">Close the month in an afternoon.</h2>
          <p class="ac-lede">Open an account in eleven minutes, ID included. Your first invoice can go out today.</p>
        </div>
        <form class="sb__form" data-form novalidate>
          <label class="ac-label" for="sb-email">Work email</label>
          <div class="sb__row">
            <input class="sb__input" id="sb-email" name="email" type="email" autocomplete="email" placeholder="you@studio.com" data-email>
            <button class="sb__cta" type="submit" data-charge>Open an account<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M11 5l5 5-5 5"/></svg></button>
          </div>
          <p class="ac-small sb__note" data-status role="status">Free for one person. No card, no call.</p>
        </form>
      </div>
    </section>
    <footer class="sb__foot ac-wrap"><span class="ac-small">${app.name} is a fictional bank, used for this demo.</span><span class="ac-label">Plans from €0</span></footer>`;
  root.querySelectorAll('a[href^="#"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const band = root.querySelector('[data-band]');
  const host = root.querySelector('[data-stage]');
  const button = root.querySelector('[data-charge]');
  const email = root.querySelector('[data-email]');
  const status = root.querySelector('[data-status]');
  const form = root.querySelector('[data-form]');

  // Timing per motion tier. Full: entrance slower than exit, spatial swell on. Reduced: colour only, short. Static: instant.
  const timing = () => ({
    full: { in: { duration: cfg.charge, ease: cfg.ease }, out: { duration: cfg.release, ease: cfg.ease.replace('.out', '.in') }, preset: { duration: 0.9, ease: 'power2.inOut' }, swell: true },
    reduced: { in: { duration: 0.25, ease: 'power2.out' }, out: { duration: 0.2, ease: 'power2.in' }, preset: { duration: 0.3, ease: 'power2.inOut' }, swell: false },
    static: { in: { duration: 0 }, out: { duration: 0 }, preset: { duration: 0 }, swell: false },
  })[ctx.motion];
  // The DOM half shares the duration: the button's fill and the band's tint transition on the same clock.
  const domTiming = (charging) => band.style.setProperty('--sb-dur', `${(charging ? timing().in : timing().out).duration}s`);
  band.style.setProperty('--sb-target', colour(cfg.palette));

  const u = {
    uRes: { value: new THREE.Vector2(1, 1) },
    uCenter: { value: new THREE.Vector2(0, 0) },
    uBoxCenter: { value: new THREE.Vector2(0, 0) },
    uBoxHalf: { value: new THREE.Vector2(0, 0) },
    uPx: { value: 1 },
    uGround: { value: new THREE.Color() },
    uShade: { value: new THREE.Color() },
    uRest: { value: new THREE.Color() },
    uTarget: { value: new THREE.Color() },
    uHover: { value: 0 },
    uSwell: { value: 0 },
    uVignette: { value: PRESETS[cfg.look].vignette },
    uGrain: { value: PRESETS[cfg.look].grain },
    uDensity: { value: PRESETS[cfg.look].density },
  };
  let dirty = true;
  const markDirty = () => { dirty = true; };
  ctx.onCleanup(() => gsap.killTweensOf(Object.values(u)));

  // The technique: kill whatever is moving this value, then tween from wherever it is now. No fromTo, no reset.
  const retarget = (targets, vars) => {
    gsap.killTweensOf(targets);
    return gsap.to(targets, { ...vars, onUpdate: markDirty });
  };
  let charged = false;
  const setCharge = (on) => {
    if (on === charged) return;
    charged = on;
    const t = timing();
    domTiming(on);
    band.classList.toggle('is-charged', on);
    retarget(u.uHover, { value: on ? 1 : 0, ...(on ? t.in : t.out) });
    if (t.swell) retarget(u.uSwell, { value: on ? 1 : 0, ...(on ? t.in : t.out) });
    markDirty();
  };
  const applyLook = (name) => {
    const p = PRESETS[name];
    band.dataset.look = name;
    retarget([u.uVignette, u.uGrain, u.uDensity], { value: (i) => [p.vignette, p.grain, p.density][i], ...timing().preset });
  };
  // Hover charging listens to mouse pointers only, so a tap does not leave a stuck charge; focus does the same.
  on(ctx, button, 'pointerenter', (e) => { if (e.pointerType === 'mouse') setCharge(true); });
  on(ctx, button, 'pointerleave', (e) => { if (e.pointerType === 'mouse' && document.activeElement !== button) setCharge(false); });
  on(ctx, button, 'focus', () => setCharge(true));
  on(ctx, button, 'blur', () => { if (!button.matches(':hover')) setCharge(false); });
  on(ctx, email, 'focus', () => applyLook('charged'));
  on(ctx, email, 'blur', () => applyLook(cfg.look));
  on(ctx, form, 'submit', (e) => {
    e.preventDefault();
    const v = email.value.trim();
    status.textContent = /.+@.+\..+/.test(v) ? `Check ${v}: the link to open your account is on its way.` : 'Add a work email and we will send the link there.';
  });

  const paint = () => {
    const ground = new THREE.Color(readToken('--bg-2') || '#ecece7');
    const ink = new THREE.Color(readToken('--ink') || '#121211');
    const dark = ground.r + ground.g + ground.b < 0.6;
    u.uGround.value.copy(ground);
    if (dark) u.uShade.value.copy(ground).multiplyScalar(0.45); else u.uShade.value.copy(ground).lerp(ink, 0.16);
    u.uRest.value.copy(ground).lerp(ink, dark ? 0.16 : 0.18);
    const target = cfg.palette.startsWith('#') ? cfg.palette : readToken(`--${cfg.palette}`);
    u.uTarget.value.set(target || '#f94c16');
    markDirty();
  };

  if (!webglAvailable()) {
    band.classList.add('sb--still');
    return { update(next) { cfg = { ...next }; band.style.setProperty('--sb-target', colour(cfg.palette)); } };
  }

  const { renderer, onResize } = useRenderer(ctx, host, { alpha: false, antialias: false, dprCap: 1.5 });
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const material = new THREE.ShaderMaterial({ uniforms: u, vertexShader, fragmentShader });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  scene.add(quad);
  ctx.onCleanup(() => { quad.geometry.dispose(); material.dispose(); });
  paint();

  // The rings are centred on the button, wherever the layout puts it; the form's rectangle is their quiet zone.
  const centre = () => {
    const br = band.getBoundingClientRect();
    const r = button.getBoundingClientRect();
    const fr = form.getBoundingClientRect();
    const dpr = renderer.getPixelRatio();
    u.uPx.value = dpr;
    u.uCenter.value.set((r.left + r.width / 2 - br.left) * dpr, (br.bottom - (r.top + r.height / 2)) * dpr);
    u.uBoxCenter.value.set((fr.left + fr.width / 2 - br.left) * dpr, (br.bottom - (fr.top + fr.height / 2)) * dpr);
    u.uBoxHalf.value.set((fr.width / 2 + 6) * dpr, (fr.height / 2 + 6) * dpr);
    markDirty();
  };
  onResize(({ width, height }) => {
    const dpr = renderer.getPixelRatio();
    u.uRes.value.set(width * dpr, height * dpr);
    centre();
  });
  observeResize(ctx, [button, form], centre);
  document.fonts?.ready.then(() => { if (!ctx.signal.aborted) centre(); });

  // GSAP owns the clock: ticker listeners run after tweens update, so the frame drawn shows this tick's values.
  const tick = () => {
    if (!dirty) return;
    dirty = false;
    renderer.render(scene, camera);
  };
  gsap.ticker.add(tick);
  ctx.onCleanup(() => gsap.ticker.remove(tick));
  ctx.onTheme(paint);
  applyLook(cfg.look);

  return {
    update(next, changed) {
      cfg = { ...next };
      band.style.setProperty('--sb-target', colour(cfg.palette));
      if (changed.includes('palette')) paint();
      if (changed.includes('look')) applyLook(cfg.look);
      return true;
    },
    action(id) {
      if (id === 'charge') { setCharge(!charged); }
    },
  };
}
