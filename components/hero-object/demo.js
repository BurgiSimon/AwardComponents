// Hero object — a speaker's launch hero. three.js draws one procedural speaker (a lathed body, a knit grille and
// an aluminium cap) lit by RoomEnvironment through PMREM, so no HDR file ships. The pointer sets a target tilt
// and a damped spring (stiffness k, damping c) chases it; the scroll across the hero adds a turn. Frames render
// only while the spring or the scroll is moving. No WebGL → a drawn still; reduced motion → a held 3/4 view.
import './demo.css';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { on, onFrame, finePointer, html, raw, clamp, content, formatPrice } from '../../src/demo-kit/index.js';
import { useRenderer, webglAvailable, disposeScene } from '../../src/demo-kit/three.js';
import { useLenis } from '../../src/demo-kit/lenis.js';
import { useGsap } from '../../src/demo-kit/gsap.js';

const STILL = (hex) => `<svg viewBox="0 0 300 380" aria-hidden="true"><defs><linearGradient id="ho-g" x1="0" x2="1"><stop offset="0" stop-color="${hex}" stop-opacity=".75"/><stop offset=".45" stop-color="${hex}"/><stop offset="1" stop-color="${hex}" stop-opacity=".6"/></linearGradient></defs><ellipse cx="150" cy="352" rx="96" ry="12" fill="#000" opacity=".12"/><rect x="62" y="40" width="176" height="300" rx="70" fill="url(#ho-g)"/><ellipse cx="150" cy="58" rx="80" ry="16" fill="#d8d8d4"/></svg>`;

function knitTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#808080';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 4) {
    for (let x = 0; x < 256; x += 4) {
      const v = 110 + ((x * 7 + y * 13) % 5) * 12 + (y % 8 === 0 ? 30 : 0);
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
  const colourOf = (id) => product.colours.find((c) => c.id === id)?.hex || '#e8e4dc';
  root.className = 'ho';
  root.innerHTML = html`
    <section class="ho__hero ac-wrap" aria-labelledby="ho-title">
      <div class="ho__copy">
        <p class="ac-label">${product.maker} · ${product.kind}</p>
        <h1 class="ac-display" id="ho-title">${product.name}</h1>
        <p class="ac-lede">${product.tagline} Room tuning, a wool-blend grille and eight screws you can undo.</p>
        <fieldset class="ho__swatches">
          <legend class="ac-label">Finish — <span data-finish-name></span></legend>
          ${product.colours.map((c) => html`<label class="ho__sw" style="--sw:${c.hex}"><input type="radio" name="ho-finish" value="${c.id}"><span class="sr-only">${c.name}</span></label>`)}
        </fieldset>
        <div class="ho__buy"><a class="ac-btn ac-btn--lg" href="#buy">Pre-order — ${formatPrice(product.price)}</a><span class="ac-small">Ships in March</span></div>
      </div>
      <div class="ho__stage" data-stage><div class="ho__still" data-still hidden></div></div>
    </section>
    <section class="ho__specs ac-wrap" aria-label="Specifications">
      ${product.specs.slice(0, 4).map(([k, v]) => html`<div><dt class="ac-label">${k}</dt><dd>${v}</dd></div>`)}
    </section>
    <div class="ho__spacer" aria-hidden="true"></div>`;
  on(ctx, root.querySelector('a[href="#buy"]'), 'click', (e) => e.preventDefault());

  const stage = root.querySelector('[data-stage]');
  const still = root.querySelector('[data-still]');
  const finishName = root.querySelector('[data-finish-name]');
  const radios = [...root.querySelectorAll('input[name="ho-finish"]')];
  let setColour = (hex) => { still.innerHTML = STILL(hex); };

  const selectFinish = (id) => {
    radios.forEach((r) => { r.checked = r.value === id; });
    finishName.textContent = product.colours.find((c) => c.id === id)?.name || '';
    setColour(colourOf(id));
  };
  radios.forEach((r) => on(ctx, r, 'change', () => selectFinish(r.value)));

  if (!webglAvailable()) {
    still.hidden = false;
    selectFinish(cfg.finish);
    return { update(next) { cfg = { ...next }; selectFinish(cfg.finish); } };
  }

  const { renderer, onResize } = useRenderer(ctx, stage, { alpha: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = env;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0.25, 8);

  // The speaker: a lathed body (a soft capsule profile), a knit grille sleeve, an aluminium cap and a status light.
  const group = new THREE.Group();
  const profile = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const y = -1.6 + t * 3.2;
    const r = 1.05 - Math.pow(Math.abs(t - 0.5) * 2, 6) * 0.32;
    profile.push(new THREE.Vector2(r, y));
  }
  const knit = knitTexture();
  const bodyMat = new THREE.MeshPhysicalMaterial({ color: colourOf(cfg.finish), roughness: 0.92, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color('#ffffff'), bumpMap: knit, bumpScale: 1.2 });
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 96), bodyMat);
  const capMat = new THREE.MeshStandardMaterial({ color: '#d9d9d6', metalness: 1, roughness: 0.28 });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.9, 0.12, 96), capMat);
  cap.position.y = 1.62;
  const dial = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 16, 96), new THREE.MeshStandardMaterial({ color: '#f2f2ee', metalness: 1, roughness: 0.15 }));
  dial.rotation.x = Math.PI / 2;
  dial.position.y = 1.69;
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 16), new THREE.MeshBasicMaterial({ color: '#ff5420' }));
  led.position.set(0, 1.0, 1.02);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.06, 64), new THREE.MeshStandardMaterial({ color: '#1b1b1d', roughness: 0.6 }));
  base.position.y = -1.62;
  group.add(body, cap, dial, led, base);
  group.rotation.set(0.08, -0.6, 0);
  scene.add(group);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.5, 64), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.14 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -1.7;
  shadow.scale.set(1, 0.6, 1);
  scene.add(shadow);
  ctx.onCleanup(() => { disposeScene(scene); env.dispose(); knit.dispose(); });

  let dirty = true;
  setColour = (hex) => { bodyMat.color.set(hex); dirty = true; };
  selectFinish(cfg.finish);

  onResize(({ width, height }) => {
    camera.aspect = width / height;
    camera.position.z = width / height < 0.8 ? 10.5 : 8;
    camera.updateProjectionMatrix();
    dirty = true;
  });

  // Spring state: angle, velocity and target per axis; scroll turn added on top.
  const s = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, turn: 0, spin: 0 };
  let pointerAway = true;
  const moving = ctx.motion === 'full';
  if (moving && finePointer()) {
    on(ctx, window, 'pointermove', (e) => {
      const nx = (e.clientX / innerWidth) * 2 - 1;
      const ny = (e.clientY / innerHeight) * 2 - 1;
      const rad = (cfg.tilt * Math.PI) / 180;
      s.ty = nx * rad;
      s.tx = ny * rad * 0.6;
      pointerAway = false;
      dirty = true;
    }, { passive: true });
    on(ctx, document, 'pointerleave', () => { s.tx = 0; s.ty = 0; pointerAway = true; dirty = true; });
  }
  if (moving) {
    useLenis(ctx);
    const { ScrollTrigger } = useGsap(ctx, root);
    const st = ScrollTrigger.create({ trigger: root.querySelector('.ho__hero'), start: 'top top', end: 'bottom top', onUpdate: (self) => { s.turn = self.progress; dirty = true; } });
    ctx.onCleanup(() => st.kill());
  }

  onFrame(ctx, (dt) => {
    if (moving) {
      const k = cfg.stiffness;
      const c = cfg.damping;
      const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
      const h = dt / steps;
      for (let i = 0; i < steps; i++) {
        s.vx += ((s.tx - s.x) * k - s.vx * c) * h;
        s.vy += ((s.ty - s.y) * k - s.vy * c) * h;
        s.x += s.vx * h;
        s.y += s.vy * h;
      }
      if (cfg.spin && pointerAway) { s.spin += dt * 0.35; dirty = true; }
      const settling = Math.abs(s.vx) + Math.abs(s.vy) + Math.abs(s.tx - s.x) + Math.abs(s.ty - s.y) > 1e-4;
      if (!settling && !dirty) return;
      group.rotation.x = 0.08 + s.x;
      group.rotation.y = -0.6 + s.y + s.spin + (s.turn * cfg.turn * Math.PI) / 180;
      group.rotation.z = -s.vy * 0.04;
    } else if (!dirty) return;
    renderer.render(scene, camera);
    dirty = false;
  });

  return {
    update(next) {
      const finishChanged = next.finish !== cfg.finish;
      cfg = { ...next };
      if (finishChanged) selectFinish(cfg.finish);
      dirty = true;
    },
  };
}
