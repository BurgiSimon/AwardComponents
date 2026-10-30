// Frame scrub — a speaker's turntable on its sticky stage, with four short feature labels. The recipe's frames come
// from an offline renderer; here three.js renders the stand-in sequence once at load (one offscreen renderer, one
// ImageBitmap per frame, then the renderer is thrown away), and the count drives a progress readout. Only when every
// frame is decoded does the scrub arm: a 300 svh section holds a sticky stage, one tween scrubbed across it picks the
// frame, and a 2D canvas draws it. The poster <img> stays for no-WebGL; reduced motion draws one chosen frame and
// lists every callout.
import './demo.css';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { html, clamp, content } from '../../src/demo-kit/index.js';
import { webglAvailable } from '../../src/demo-kit/three.js';
import { useGsap } from '../../src/demo-kit/gsap.js';
import { useLenis } from '../../src/demo-kit/lenis.js';

const CALLOUTS = [
  { at: [0, 0.22], k: 'Front', t: 'One status light' },
  { at: [0.22, 0.46], k: 'Side', t: 'Wool-blend grille' },
  { at: [0.46, 0.72], k: 'Back', t: 'Eight screws, no glue' },
  { at: [0.72, 1.01], k: 'Top', t: 'The dial is the remote' },
];

const POSTER = (hex) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><defs><radialGradient id="s" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient><linearGradient id="b" x1="0" x2="1"><stop offset="0" stop-color="${hex}" stop-opacity=".78"/><stop offset=".45" stop-color="${hex}"/><stop offset="1" stop-color="${hex}" stop-opacity=".62"/></linearGradient></defs><ellipse cx="300" cy="512" rx="170" ry="26" fill="url(#s)"/><rect x="190" y="110" width="220" height="392" rx="96" fill="url(#b)"/><ellipse cx="300" cy="126" rx="100" ry="20" fill="#d9d9d6"/><ellipse cx="300" cy="124" rx="52" ry="9" fill="none" stroke="#f2f2ee" stroke-width="5"/><circle cx="300" cy="236" r="4.5" fill="#ff5420"/></svg>`)}`;

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

function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(0,0,0,0.5)');
  r.addColorStop(0.55, 'rgba(0,0,0,0.18)');
  r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// Render `count` frames of one full turn into ImageBitmaps, reporting progress; returns null if aborted.
async function renderSequence({ count, size, hex, signal, onProgress, only }) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = env;
  const key = new THREE.DirectionalLight('#ffffff', 0.55);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 1.25, 9.2);
  camera.lookAt(0, -0.12, 0);

  const group = new THREE.Group();
  const profile = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    profile.push(new THREE.Vector2(1.05 - Math.pow(Math.abs(t - 0.5) * 2, 6) * 0.32, -1.6 + t * 3.2));
  }
  const knit = knitTexture();
  const shadowTex = shadowTexture();
  const metal = new THREE.MeshStandardMaterial({ color: '#d9d9d6', metalness: 1, roughness: 0.28 });
  const dark = new THREE.MeshStandardMaterial({ color: '#1c1c1e', roughness: 0.55, metalness: 0.2 });
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 96), new THREE.MeshStandardMaterial({ color: hex, roughness: 0.92, bumpMap: knit, bumpScale: 1.2 }));
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.9, 0.12, 96), metal);
  cap.position.y = 1.62;
  const dial = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 16, 96), new THREE.MeshStandardMaterial({ color: '#f2f2ee', metalness: 1, roughness: 0.14 }));
  dial.rotation.x = Math.PI / 2;
  dial.position.y = 1.7;
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 16), new THREE.MeshBasicMaterial({ color: '#ff5420' }));
  led.position.set(0, 0.95, 1.035);
  // The back: a dark plate curved to the body, with a port, a socket and four screws, so the turn shows a new side.
  const R = 1.062;
  const onBack = (mesh, y, ang = 0, r = R + 0.012) => { mesh.position.set(Math.sin(Math.PI + ang) * r, y, Math.cos(Math.PI + ang) * r); mesh.rotation.y = ang; return mesh; };
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.92, 32, 1, true, Math.PI - 0.31, 0.62), new THREE.MeshStandardMaterial({ color: '#1c1c1e', roughness: 0.55, metalness: 0.2, side: THREE.DoubleSide }));
  plate.position.y = -0.55;
  const port = onBack(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.03), new THREE.MeshBasicMaterial({ color: '#050505' })), -0.32);
  const socket = onBack(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 32), metal), -0.62);
  socket.rotation.x = Math.PI / 2;
  const screws = [[-0.23, -0.15], [0.23, -0.15], [-0.23, -0.95], [0.23, -0.95]].map(([a, y]) => onBack(new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 12), metal), y, a));
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.06, 64), dark);
  base.position.y = -1.62;
  group.add(body, cap, dial, led, plate, port, socket, base, ...screws);
  group.rotation.x = 0.04;
  scene.add(group);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -1.66;
  scene.add(shadow);

  const frames = [];
  const indices = only != null ? [only] : [...Array(count).keys()];
  try {
    for (const i of indices) {
      // Yield between frames: the page keeps painting (and the readout moving) while the sequence renders.
      await new Promise((r) => setTimeout(r));
      if (signal.aborted) break;
      group.rotation.y = (i / count) * Math.PI * 2;
      renderer.render(scene, camera);
      frames[i] = await createImageBitmap(renderer.domElement);
      onProgress?.(frames.filter(Boolean).length, indices.length);
    }
  } finally {
    scene.traverse((o) => { o.geometry?.dispose(); [].concat(o.material || []).forEach((m) => m.dispose()); });
    [knit, shadowTex, env].forEach((t) => t.dispose());
    renderer.dispose();
    renderer.forceContextLoss();
  }
  if (signal.aborted) { frames.forEach((f) => f?.close()); return null; }
  return frames;
}

export default function mount(root, options, ctx) {
  const { product } = content;
  const cfg = { ...options };
  const finish = product.colours.find((c) => c.id === cfg.finish) || product.colours[2];
  const count = clamp(Math.round(cfg.frames), 12, 120);

  root.className = 'fs';
  root.innerHTML = html`
    <section class="fs__seq" data-seq aria-labelledby="fs-title">
      <div class="fs__stage">
        <h1 class="sr-only" id="fs-title">${product.name} in ${finish.name.toLowerCase()}, from every side</h1>
        <figure class="fs__fig">
          <div class="fs__turntable">
            <img class="fs__poster" data-poster src="${POSTER(finish.hex)}" width="600" height="600" alt="${product.name} in ${finish.name.toLowerCase()}, seen from the front">
            <canvas class="fs__canvas" data-canvas aria-hidden="true"></canvas>
            <p class="fs__loading ac-label" data-loading aria-hidden="true"><span class="fs__loading-bar"><span data-loading-bar></span></span><span data-loading-text>Rendering frames</span></p>
          </div>
          <figcaption class="fs__readout ac-label" aria-hidden="true">
            <span>Frame <b data-frame>01</b> / ${String(count).padStart(2, '0')}</span>
            <span class="fs__dial"><span data-needle></span></span>
            <span><b data-angle>0</b>°</span>
          </figcaption>
        </figure>
        <ol class="fs__callouts" role="list">
          ${CALLOUTS.map((c, i) => html`<li class="fs__callout" data-callout="${i}"><span class="ac-label fs__k">${String(i + 1).padStart(2, '0')} · ${c.k}</span><strong>${c.t}</strong></li>`)}
        </ol>
        <p class="ac-stage__note"><span>${product.maker} · product page</span></p>
      </div>
    </section>`;
  root.classList.toggle('fs--no-callouts', !cfg.callouts);

  const seq = root.querySelector('[data-seq]');
  const canvas = root.querySelector('[data-canvas]');
  const g2d = canvas.getContext('2d');
  const callouts = [...root.querySelectorAll('[data-callout]')];
  const frameEl = root.querySelector('[data-frame]');
  const angleEl = root.querySelector('[data-angle]');
  const needle = root.querySelector('[data-needle]');
  const loading = root.querySelector('[data-loading]');
  const loadingBar = root.querySelector('[data-loading-bar]');
  const loadingText = root.querySelector('[data-loading-text]');

  let frames = null;
  let shown = -1;
  let active = -1;
  const draw = (f) => {
    if (!frames) return;
    const idx = ((Math.round(f) % count) + count) % count;
    const p = clamp(f / count, 0, 1);
    const which = CALLOUTS.findIndex((c) => p >= c.at[0] && p < c.at[1]);
    if (which !== active) { active = which; callouts.forEach((c, i) => c.classList.toggle('is-active', i === which)); }
    angleEl.textContent = String(Math.round(p * 360) % 360);
    needle.style.transform = `rotate(${(p * 360).toFixed(1)}deg)`;
    if (idx === shown || !frames[idx]) return;
    shown = idx;
    g2d.clearRect(0, 0, canvas.width, canvas.height);
    g2d.drawImage(frames[idx], 0, 0, canvas.width, canvas.height);
    frameEl.textContent = String(idx + 1).padStart(2, '0');
  };

  useLenis(ctx);
  const full = ctx.motion === 'full';
  callouts[0].classList.add('is-active');
  const instance = {
    update(next, changed) {
      if (changed.some((c) => c === 'frames' || c === 'finish' || c === 'smooth')) return false;
      root.classList.toggle('fs--no-callouts', !next.callouts);
      return undefined;
    },
  };

  if (!webglAvailable()) {
    root.classList.add('fs--still', 'fs--poster');
    loading.hidden = true;
    return instance;
  }

  // Frame size: the turntable's box at a capped density (frames are decoded bitmaps: memory grows with the square).
  const box = root.querySelector('.fs__turntable').getBoundingClientRect();
  const size = clamp(Math.round(Math.min(box.width, box.height) * Math.min(devicePixelRatio || 1, 1.5)), 300, 480);
  canvas.width = canvas.height = size;
  const still = Math.round(count * 0.38); // the chosen frame under reduced motion: a three-quarter view

  // The page is usable at once (poster, callouts, a progress readout); the scrub arms when every frame is decoded.
  renderSequence({
    count,
    size,
    hex: finish.hex,
    signal: ctx.signal,
    only: full ? null : still,
    onProgress: (n, total) => {
      loadingBar.style.transform = `scaleX(${(n / total).toFixed(3)})`;
      loadingText.textContent = `Rendering frames ${n} / ${total}`;
    },
  }).then((result) => {
    if (!result) return;
    frames = result;
    ctx.onCleanup(() => frames.forEach((f) => f?.close()));
    root.classList.add('fs--ready');
    if (!full) {
      root.classList.add('fs--still');
      draw(still);
      return;
    }
    // Decoded: now the scrub arms.
    const { gsap, ScrollTrigger, context } = useGsap(ctx, root);
    const obj = { f: 0 };
    const tween = context.add(() => gsap.to(obj, {
      f: count,
      ease: 'none',
      onUpdate: () => draw(obj.f), // the tween's own update, so the frame keeps easing after the scroll event
      scrollTrigger: { trigger: seq, start: 'top top', end: 'bottom bottom', scrub: cfg.smooth > 0 ? cfg.smooth : true, invalidateOnRefresh: true },
    }));
    // The page may already be scrolled into the section by the time the frames are ready: start from there.
    ScrollTrigger.refresh();
    tween.progress(tween.scrollTrigger.progress);
    draw(obj.f);
  }).catch(() => {
    if (ctx.signal.aborted) return;
    root.classList.add('fs--still', 'fs--poster');
    loading.hidden = true;
  });

  if (!full) root.classList.add('fs--still');
  return instance;
}
