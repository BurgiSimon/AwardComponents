// Colour reveal — a wool throw's new colourway, dyed by the scroll. One generated cloth wears one stock
// MeshStandardMaterial patched through onBeforeCompile: a luma mix after <map_fragment> turns its woven map grey
// or (saturation-boosted) colour, and a grained circular discard after <clipping_planes_fragment> splits the cloth
// between two layers that share one geometry, the grey keeping the outside of the circle, the colour the inside.
// Both test the same per-pixel hash with opposite outcomes, so no pixel is drawn twice or left empty. The circle
// grows from a DOM dial's rect (read every frame) to the farthest corner, scrubbed by ScrollTrigger with no ease.
// Reduced motion: no circle, the whole cloth mixes evenly with the scroll. Static: settled colour. No WebGL: CSS.
import './demo.css';
import * as THREE from 'three';
import { on, onFrame, whileVisible, html, readToken, content, formatPrice } from '../../src/demo-kit/index.js';
import { useRenderer, webglAvailable } from '../../src/demo-kit/three.js';
import { useGsap } from '../../src/demo-kit/gsap.js';
import { useLenis } from '../../src/demo-kit/lenis.js';

// Woven colourways from the materials: [warp, weft band, pinstripe, ground].
const COLOURWAYS = {
  indigo: { name: 'Indigo and oat', tokens: ['--sky', '--night', '--sand', '--sky'] },
  madder: { name: 'Madder and oat', tokens: ['--clay', '--plum', '--sand', '--clay'] },
  moss: { name: 'Moss and oat', tokens: ['--moss', '--night', '--sand', '--moss'] },
};

// The patch: two chunk replacements (plus the wobble), each throwing if its include is missing, so a three upgrade
// fails loudly instead of rendering silently grey.
function patch(material, shared, own) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared, own);
    const swap = (src, chunk, code) => {
      if (!src.includes(chunk)) throw new Error(`patch: ${chunk} not found`);
      return src.replace(chunk, code);
    };
    let f = swap(shader.fragmentShader, 'void main() {', /* glsl */ `
      uniform vec2 uCenter; uniform float uRadius, uSoft, uMask, uColor, uSide, uSat, uTime, uWobble;
      float grain(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {`);
    // Grained circular discard in drawing-buffer pixels: k < 0 inside, k > 1 outside, the band between dithered.
    f = swap(f, '#include <clipping_planes_fragment>', /* glsl */ `
      #include <clipping_planes_fragment>
      if (uMask > 0.5) {
        float k = (length(gl_FragCoord.xy - uCenter) - (uRadius - uSoft)) / max(uSoft, 1.0);
        bool inside = k < grain(gl_FragCoord.xy);
        if (inside != (uSide > 0.5)) discard;
      }`);
    // Luma mix after the map is sampled: grey at 0, saturation-boosted colour at 1.
    f = swap(f, '#include <map_fragment>', /* glsl */ `
      #include <map_fragment>
      float luma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
      vec3 boosted = max(mix(vec3(luma), diffuseColor.rgb, uSat), 0.0);
      diffuseColor.rgb = mix(vec3(luma), boosted, uColor);`);
    // A two-sine normal wobble, so light ripples across the cloth as it breathes.
    f = swap(f, '#include <normal_fragment_begin>', /* glsl */ `
      #include <normal_fragment_begin>
      normal = normalize(normal + uWobble * vec3(sin(vViewPosition.y * 3.0 + uTime), sin(vViewPosition.x * 2.4 - uTime * 0.8), 0.0));`);
    shader.fragmentShader = f;
  };
}

// The weave, drawn once per colourway: wide weft bands, pinstripes and a fine twill so the grey reads as wool.
function drawWeave(canvas, cw) {
  const [warp, band, pin, ground] = cw.tokens.map((t) => readToken(t) || '#888888');
  const g = canvas.getContext('2d');
  const S = canvas.width;
  g.fillStyle = ground;
  g.fillRect(0, 0, S, S);
  const rows = [[0, 0.22, band], [0.22, 0.26, pin], [0.26, 0.5, warp], [0.5, 0.56, band], [0.56, 0.6, pin], [0.6, 0.86, ground], [0.86, 1, band]];
  for (const [a, b, c] of rows) { g.fillStyle = c; g.fillRect(0, a * S, S, (b - a) * S); }
  g.globalAlpha = 0.5;
  g.fillStyle = pin;
  for (let x = 0; x < S; x += S / 16) g.fillRect(x, 0, 2, S); // warp pinstripes
  // A 2/2 twill: short diagonal dashes, light and dark, over everything.
  g.globalAlpha = 0.16;
  for (let y = 0; y < S; y += 4) {
    for (let x = (y / 4) % 4; x < S; x += 4) {
      g.fillStyle = (x + y) % 8 < 4 ? '#ffffff' : '#000000';
      g.fillRect(x, y, 2, 2);
    }
  }
  g.globalAlpha = 1;
}

// The cloth: a plane displaced once into soft folds, normals recomputed.
function clothGeometry(seg) {
  const geo = new THREE.PlaneGeometry(1, 1, seg, Math.round(seg * 0.66));
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(i, 0.16 * Math.sin(x * 9 + y * 3) + 0.09 * Math.cos(y * 11 - x * 2) + 0.05 * Math.sin(x * 23 - y * 5));
  }
  geo.computeVertexNormals();
  return geo;
}

export default function mount(root, options, ctx) {
  const { shop } = content;
  const throwItem = shop.products.find((p) => p.id === 'strand-throw');
  let cfg = { ...options };
  const full = ctx.motion === 'full';
  root.className = 'cr';
  root.innerHTML = html`
    <section class="cr__scene" data-scene aria-labelledby="cr-title">
      <div class="cr__stage" data-stage>
        <div class="cr__card">
          <p class="ac-label">${shop.name} · New colourway</p>
          <h1 class="ac-h1" id="cr-title">${throwItem.name}, dyed</h1>
          <p class="cr__way"><span data-way-from>Undyed lambswool</span> → <strong data-way-to></strong></p>
          <p class="ac-small cr__hint" data-hint>Scroll to put it in the dye bath</p>
        </div>
        <div class="cr__dial" data-anchor role="img" aria-label="Dyed 0 per cent"><span class="ac-num" data-dial>00</span><small>% dyed</small></div>
      </div>
    </section>
    <section class="cr__after ac-wrap" aria-labelledby="cr-after">
      <div>
        <p class="ac-label">${formatPrice(throwItem.price)} · ${throwItem.sizes[0]} cm</p>
        <h2 class="ac-h2" id="cr-after">Dyed in Os with madder, indigo and nettle, then woven on the same loom.</h2>
      </div>
      <dl class="cr__facts">
        <div><dt class="ac-label">Wool</dt><dd>${throwItem.material}</dd></div>
        <div><dt class="ac-label">Weight</dt><dd>${throwItem.weight}</dd></div>
        <div><dt class="ac-label">Care</dt><dd>Air it outside; wash cold by hand twice a year.</dd></div>
      </dl>
      <button type="button" class="ac-btn ac-btn--lg">Add to bag</button>
    </section>`;

  const scene = root.querySelector('[data-scene]');
  const stage = root.querySelector('[data-stage]');
  const anchor = root.querySelector('[data-anchor]');
  const dial = root.querySelector('[data-dial]');
  const wayTo = root.querySelector('[data-way-to]');
  const proxy = { p: ctx.motion === 'static' ? 1 : 0 };
  let gl = null; // { colourway(), render(), wake() } once WebGL runs

  const showProgress = () => {
    const pct = Math.round(proxy.p * 100);
    dial.textContent = String(pct).padStart(2, '0');
    anchor.setAttribute('aria-label', `Dyed ${pct} per cent`);
    root.style.setProperty('--cr-p', proxy.p.toFixed(3));
    gl?.wake();
  };
  const apply = () => {
    wayTo.textContent = COLOURWAYS[cfg.colourway].name;
    root.dataset.colourway = cfg.colourway;
    gl?.colourway();
  };
  apply();
  showProgress();

  // One scrubbed proxy over the 300svh scene, ease none: the scroll supplies the smoothing.
  if (ctx.motion !== 'static') {
    useLenis(ctx);
    const { gsap, ScrollTrigger } = useGsap(ctx, root);
    const tween = gsap.to(proxy, { p: 1, ease: 'none', onUpdate: showProgress, scrollTrigger: { trigger: scene, start: 'top top', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true } });
    ctx.onCleanup(() => { tween.scrollTrigger?.kill(); tween.kill(); });
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
  }

  if (!webglAvailable()) {
    root.classList.add('cr--dom');
    return { update(next) { cfg = { ...next }; apply(); } };
  }

  const { renderer, onResize, tier } = useRenderer(ctx, stage, { alpha: true });
  renderer.domElement.classList.add('cr__gl');
  stage.prepend(renderer.domElement);
  renderer.setClearColor(0x000000, 0);
  const three = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.z = 6;
  three.add(new THREE.HemisphereLight(0xffffff, 0x404040, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 1.9);
  key.position.set(-3, 4, 5);
  three.add(key);

  // Shared uniforms: both layers read the same circle. Each layer owns uColor (0 grey … 1 colour) and uSide.
  const shared = {
    uCenter: { value: new THREE.Vector2() }, uRadius: { value: 0 }, uSoft: { value: 16 }, uMask: { value: 1 },
    uSat: { value: cfg.saturation }, uTime: { value: 0 }, uWobble: { value: cfg.wobble },
  };
  const weaveCanvas = document.createElement('canvas');
  weaveCanvas.width = weaveCanvas.height = 512;
  const map = new THREE.CanvasTexture(weaveCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 2);
  const geo = clothGeometry(tier.name === 'low' ? 80 : 120);
  const layer = (color, side) => {
    const m = new THREE.MeshStandardMaterial({ map, roughness: 0.82, metalness: 0, side: THREE.DoubleSide });
    const own = { uColor: { value: color }, uSide: { value: side } };
    patch(m, shared, own);
    return { m, own };
  };
  const outgoing = layer(0, 0);
  const incoming = layer(1, 1);
  const meshOut = new THREE.Mesh(geo, outgoing.m);
  const meshIn = new THREE.Mesh(geo, incoming.m);
  const group = new THREE.Group();
  group.add(meshOut, meshIn);
  group.rotation.x = -0.2;
  three.add(group);
  ctx.onCleanup(() => { geo.dispose(); map.dispose(); outgoing.m.dispose(); incoming.m.dispose(); });

  let dpr = 1;
  onResize(({ width, height }) => {
    dpr = renderer.getPixelRatio();
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const vh = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    group.scale.set(vh * camera.aspect * 1.6, vh * 1.6, 1); // overfill the view so the cloth never shows an edge
    gl?.wake();
  });

  const render = (t) => {
    const c = stage.getBoundingClientRect();
    const a = anchor.getBoundingClientRect();
    const cx = a.left + a.width / 2 - c.left;
    const cy = a.top + a.height / 2 - c.top;
    const r0 = a.width / 2;
    // The farthest stage corner from the dial, plus 2 px, so p = 1 leaves nothing grey.
    const rMax = Math.max(Math.hypot(cx, cy), Math.hypot(c.width - cx, cy), Math.hypot(cx, c.height - cy), Math.hypot(c.width - cx, c.height - cy)) + 2;
    const p = proxy.p;
    shared.uCenter.value.set(cx * dpr, (c.height - cy) * dpr);
    shared.uSoft.value = cfg.grain * dpr;
    if (full) {
      // The circle hand-off: grey keeps the outside, colour the inside. The radius curve p² starts slowly at the dial.
      shared.uMask.value = 1;
      meshIn.visible = true;
      outgoing.own.uColor.value = 0;
      shared.uRadius.value = (r0 + (rMax - r0) * p * p) * dpr;
      shared.uTime.value = t * 0.001;
      group.rotation.y = Math.sin(t * 0.0002) * 0.04;
    } else {
      // Reduced: no spreading shape and no sway; colour follows the scroll evenly. Static: settled colour.
      shared.uMask.value = 0;
      meshIn.visible = false;
      outgoing.own.uColor.value = p;
      shared.uTime.value = 0;
      group.rotation.y = 0;
    }
    renderer.render(three, camera);
  };

  let off = null;
  let visible = false;
  let dirty = true;
  const frame = (dt, t) => {
    // Full motion breathes (sway and wobble) while on screen; otherwise frames only follow the scroll.
    if (!full && !dirty) { off?.(); off = null; return; }
    render(t);
    dirty = false;
  };
  gl = {
    wake() { dirty = true; if (visible && !off) off = onFrame(ctx, frame); },
    colourway() { drawWeave(weaveCanvas, COLOURWAYS[cfg.colourway]); map.needsUpdate = true; this.wake(); },
  };
  whileVisible(ctx, stage, () => { visible = true; gl.wake(); }, () => { visible = false; off?.(); off = null; }, { rootMargin: '0px' });
  gl.colourway();
  ctx.onTheme(() => gl.colourway());
  on(ctx, window, 'resize', () => gl.wake());

  return {
    update(next, changed) {
      cfg = { ...next };
      shared.uSat.value = cfg.saturation;
      shared.uWobble.value = cfg.wobble;
      if (changed.includes('colourway')) apply();
      gl.wake();
    },
  };
}
