// Camera path — a walk through Halden's exhibition. The room does not scroll: wheel and touch add velocity to a
// float that coasts with friction (0.97 per 60 Hz frame), a double lerp (.075 → .15) smooths it, and the float sets
// the camera's place on a Catmull-Rom spline threaded past five framed photographs. DOM tags are projected onto the
// frames, and after 900 ms idle the float snaps to the nearest work over 1.4 s (in-out cubic). Keys and buttons move
// by work; the works are also a real list below the room. The loop renders only while something moves.
// Reduced and static: each input is one step with no easing. No WebGL: one framed photograph at a time in the DOM.
import './demo.css';
import * as THREE from 'three';
import { on, html, raw, clamp, damp, ticker, photo, allPhotos, loadImage, readToken, content } from '../../src/demo-kit/index.js';
import { useRenderer, webglAvailable, disposeScene } from '../../src/demo-kit/three.js';

const WHEEL = 0.00035;       // progress per wheel pixel (× the speed control)
const FRICTION = 0.97;       // per-frame decay of the velocity at 60 fps
const LERP_A = 0.075, LERP_B = 0.15;
const SNAP_DURATION = 1.4;   // s, in-out cubic
const EYE = 1.62;            // m
const pad = (n) => String(n).padStart(2, '0');
const SLUGS = ['fjordhus', 'tern-library', 'stillwater', 'kiln-house', 'saltworks'];

function pictures(works) {
  const pool = allPhotos();
  const taken = new Set();
  return works.map((w) => {
    const hit = pool.find((m) => w.tags.every((t) => m.tags?.includes(t)) && !taken.has(m.id)) || pool.find((m) => m.tags?.includes('architecture') && !taken.has(m.id));
    if (hit) { taken.add(hit.id); return photo(hit.id); }
    return photo(`halden-show-${w.slug}`);   // unknown id → a drawn field
  });
}

export default function mount(root, options, ctx) {
  const { studio } = content;
  const works = SLUGS.map((s) => studio.projects.find((p) => p.slug === s));
  const N = works.length;
  const pics = pictures(works);
  let cfg = { ...options };
  const full = () => ctx.motion === 'full';
  const canGL = webglAvailable();

  root.className = `cp${canGL ? '' : ' cp--dom'}`;
  root.innerHTML = html`
    <section class="cp__world" aria-labelledby="cp-title" data-world>
      <div class="cp__gl" data-gl></div>
      <div class="cp__still" data-still aria-hidden="true" hidden><div class="cp__frame"><img alt="" data-still-img></div></div>
      <div class="cp__tags" aria-hidden="true" data-tags></div>
      <header class="ac-bar cp__bar">
        <a class="ac-brand" href="#top">${studio.name}</a>
        <a class="cp__skip ac-label" href="#cp-rooms">Room list ↓</a>
      </header>
      <div class="cp__hud ac-wrap">
        <p class="ac-label">Exhibition · Bergen Kunsthall · 12 Nov – 8 Feb</p>
        <h1 class="cp__title" id="cp-title">Buildings for long winters</h1>
      </div>
      <aside class="cp__wall" aria-live="polite" data-wall></aside>
      <div class="cp__nav">
        <p class="cp__count ac-label ac-num" aria-hidden="true" data-count></p>
        <button type="button" class="cp__key" data-prev aria-label="Previous work"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg></button>
        <button type="button" class="cp__key" data-next aria-label="Next work"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>
      </div>
      <div class="cp__progress" aria-hidden="true"><span data-bar></span></div>
    </section>
    <section class="cp__rooms ac-wrap" id="cp-rooms" aria-labelledby="cp-rooms-title" tabindex="-1">
      <h2 class="ac-label" id="cp-rooms-title">In the room</h2>
      <ol class="cp__list" role="list">
        ${works.map((w, i) => html`<li><span class="ac-label">${pad(i + 1)}</span><div><h3 class="ac-h3">${w.title}</h3><p class="ac-small">${w.place} · ${w.year} · ${w.discipline}</p><p class="ac-body">${w.summary}</p></div></li>`)}
      </ol>
    </section>`;
  on(ctx, root.querySelector('.ac-brand'), 'click', (e) => e.preventDefault());
  on(ctx, root.querySelector('.cp__skip'), 'click', (e) => { e.preventDefault(); const t = root.querySelector('#cp-rooms'); t.scrollIntoView(); t.focus({ preventScroll: true }); });

  const world = root.querySelector('[data-world]');
  const host = root.querySelector('[data-gl]');
  const wall = root.querySelector('[data-wall]');
  const count = root.querySelector('[data-count]');
  const bar = root.querySelector('[data-bar]');
  const tagsEl = root.querySelector('[data-tags]');

  // The float: input moves `target`; `float` chases it through two lerps. A key step asks for the snap tween.
  const S = { target: 0, mid: 0, float: 0, velocity: 0, snapping: false, snapFrom: 0, snapT: 0, snapTarget: undefined, snapRequest: undefined, idle: 0, chapter: -1 };
  let render = () => {};
  let wake = () => {};

  // The wall text: the work nearest the camera, announced politely when it changes.
  function setChapter(i) {
    if (i === S.chapter) return;
    S.chapter = i;
    const w = works[i];
    wall.innerHTML = html`<p class="ac-label">${pad(i + 1)} / ${pad(N)} · ${w.discipline}</p><h2 class="cp__work">${w.title}</h2><p class="cp__meta ac-small">${w.place} · ${w.year} · ${w.size}</p><p class="cp__text">${w.summary}</p>${i === N - 1 ? raw('<a class="cp__more ac-link" href="#cp-rooms">Continue to the room list</a>') : ''}`;
    wall.querySelector('.cp__more')?.addEventListener('click', (e) => { e.preventDefault(); root.querySelector('#cp-rooms').scrollIntoView(); root.querySelector('#cp-rooms').focus({ preventScroll: true }); }, { signal: ctx.signal });
    count.textContent = `${pad(i + 1)} / ${pad(N)}`;
    root.querySelector('[data-prev]').setAttribute('aria-disabled', String(i === 0));
    root.querySelector('[data-next]').setAttribute('aria-disabled', String(i === N - 1));
  }

  // Step from where the tour is heading, not from where it is: mid-snap the target is still in flight.
  function goTo(i) {
    i = clamp(i, 0, N - 1);
    S.velocity = 0;
    S.idle = 0;
    if (!full()) { S.target = S.mid = S.float = i / (N - 1); S.snapping = false; render(); setChapter(i); return; }
    S.snapRequest = i / (N - 1);
    wake();
  }
  const heading = () => Math.round((S.snapRequest ?? S.snapTarget ?? S.target) * (N - 1));

  // Input is captured only while the room fills the frame, and never past either end: a wheel down at the last
  // work (or up at the first) goes to the page, so the room list below is always one gesture away.
  const roomInView = () => { const r = world.getBoundingClientRect(); return r.top > -2 && r.bottom > innerHeight * 0.5; };
  on(ctx, world, 'wheel', (e) => {
    if (e.ctrlKey || !roomInView()) return;
    const d = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
    if ((d > 0 && S.target >= 0.999 && heading() === N - 1) || (d < 0 && S.target <= 0.001)) return;
    e.preventDefault();
    if (!full()) { if (Math.abs(d) > 4 && performance.now() - (S.lastStep || 0) > 350) { S.lastStep = performance.now(); goTo(heading() + Math.sign(d)); } return; }
    S.velocity += d * WHEEL * cfg.speed;
    S.idle = 0; S.snapping = false; S.snapTarget = undefined; S.snapRequest = undefined;
    wake();
  }, { passive: false });
  let touchY = null;
  on(ctx, world, 'touchstart', (e) => { touchY = e.touches[0].clientY; }, { passive: true });
  on(ctx, world, 'touchmove', (e) => {
    if (touchY == null) return;
    const y = e.touches[0].clientY;
    if (full()) { S.velocity += (touchY - y) * WHEEL * 2 * cfg.speed; touchY = y; S.idle = 0; S.snapping = false; S.snapTarget = undefined; wake(); }
  }, { passive: true });
  on(ctx, world, 'touchend', (e) => {
    if (touchY == null) return;
    const dy = touchY - e.changedTouches[0].clientY;
    if (!full() && Math.abs(dy) > 40) goTo(heading() + Math.sign(dy));   // reduced: one swipe, one step
    touchY = null;
  });
  on(ctx, window, 'keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.target.closest?.('input, textarea, select') || !roomInView()) return;
    const onControl = e.target.closest?.('button, a');
    const step = { ArrowDown: 1, ArrowRight: 1, PageDown: 1, ArrowUp: -1, ArrowLeft: -1, PageUp: -1, ' ': e.shiftKey ? -1 : 1 }[e.key];
    if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); goTo(e.key === 'Home' ? 0 : N - 1); return; }
    if (step === undefined || (e.key === ' ' && onControl)) return;
    if (step > 0 && heading() === N - 1) return;   // past the last work the keys scroll the page on to the list
    e.preventDefault();
    goTo(heading() + step);
  });
  on(ctx, root.querySelector('[data-prev]'), 'click', () => goTo(heading() - 1));
  on(ctx, root.querySelector('[data-next]'), 'click', () => goTo(heading() + 1));

  setChapter(0);
  const instance = {
    update(next) { cfg = { ...next }; applyFog(); render(); },
    action(id) {
      if (id !== 'next') return;
      const to = heading() === N - 1 ? 0 : heading() + 1;
      // The thumbnail: hold the camera just before it arrives at the work, while the path still turns.
      if (ctx.capture && full() && canGL) {
        Object.assign(S, { snapRequest: undefined, snapping: false, velocity: 0, idle: -1e9 });
        S.target = S.mid = S.float = (to - 0.22) / (N - 1);
        render();
        return;
      }
      goTo(to);
    },
  };
  let applyFog = () => {};

  // --- No WebGL: one framed photograph at a time ------------------------------------------------------------
  if (!canGL) {
    const still = root.querySelector('[data-still]');
    const img = root.querySelector('[data-still-img]');
    still.hidden = false;
    render = () => {
      const i = Math.round(S.float * (N - 1));
      img.src = pics[i].src;
      img.style.objectPosition = pics[i].focus || '50% 50%';
      setChapter(i);
      bar.style.transform = `scaleX(${S.float})`;
    };
    wake = () => { if (S.snapRequest !== undefined) { S.target = S.mid = S.float = S.snapRequest; S.snapRequest = undefined; } render(); };
    render();
    return instance;
  }

  // --- The room ---------------------------------------------------------------------------------------------
  const { renderer, onResize } = useRenderer(ctx, host, { alpha: false });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 120);
  const col = (token, fallback) => new THREE.Color(readToken(token) || fallback);
  const mats = {
    floor: new THREE.MeshStandardMaterial({ roughness: 0.92 }),
    panel: new THREE.MeshStandardMaterial({ roughness: 0.85 }),
    frame: new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.1 }),
    column: new THREE.MeshStandardMaterial({ roughness: 0.9 }),
    shadow: null,
  };
  // A soft contact shadow under each panel: one radial texture, multiplied by the night material.
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 128;
  const sg = shadowCanvas.getContext('2d');
  const grad = sg.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  sg.fillStyle = grad; sg.fillRect(0, 0, 128, 128);
  const shadowTex = new THREE.CanvasTexture(shadowCanvas);
  mats.shadow = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });

  const paint = () => {
    const bg = col('--bg', '#f4f4f1');
    scene.background = bg;
    scene.fog = scene.fog || new THREE.Fog(bg, 8, 34);
    scene.fog.color.copy(bg);
    mats.floor.color.copy(col('--bg-2', '#ecece7'));
    mats.panel.color.copy(col('--surface', '#ffffff'));
    mats.frame.color.copy(col('--ink', '#121211'));
    mats.column.color.copy(col('--surface-2', '#f7f7f4'));
    if (document.documentElement.dataset.theme === 'dark') mats.panel.color.copy(col('--raised', '#202022'));
    mats.shadow.color.copy(col('--night', '#1b1d24'));
  };
  applyFog = () => { scene.fog.far = cfg.fog; scene.fog.near = cfg.fog * 0.22; };
  paint();
  applyFog();

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 90), mats.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -18;
  scene.add(floor);
  // Gallery light: a bright, even sky with a key from behind the visitor, so the panels read as white walls.
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b8b2, 2.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(2, 8, 12);
  scene.add(key);
  // Columns along both sides of the hall: depth cues that pass the camera as it walks.
  const colGeo = new THREE.CylinderGeometry(0.28, 0.28, 6, 24);
  for (let z = 2; z > -40; z -= 6) {
    for (const x of [-6.2, 6.2]) {
      const c = new THREE.Mesh(colGeo, mats.column);
      c.position.set(x, 3, z);
      scene.add(c);
    }
  }

  // Stations: free-standing panels on alternating sides, each turned toward the walk. The camera stands 5 m in
  // front of each frame at eye height; the spline threads those camera points, so p = i / (N − 1) is work i.
  const frames = [];
  const camPts = [];
  const panelGeo = new THREE.BoxGeometry(3.4, 3.3, 0.16);
  const shadowGeo = new THREE.PlaneGeometry(4.6, 1.6);
  works.forEach((w, i) => {
    const side = i % 2 ? 1 : -1;
    const pos = new THREE.Vector3(side * 2.5, 0, -i * 6.5);
    const normal = new THREE.Vector3(-side, 0, 0.62).normalize();
    const g = new THREE.Group();
    g.position.copy(pos);
    g.rotation.y = Math.atan2(normal.x, normal.z);
    const panel = new THREE.Mesh(panelGeo, mats.panel);
    panel.position.y = 1.65;
    g.add(panel);
    const shadow = new THREE.Mesh(shadowGeo, mats.shadow);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0, 0.01, 0.1);
    g.add(shadow);
    // The photograph, its frame and a thin mat, sized to the picture's own proportions.
    const aspect = clamp((pics[i].width || 1200) / (pics[i].height || 1500), 0.66, 1.5);
    const h = aspect >= 1 ? 1.5 / aspect + 0.3 : 1.95;
    const wdt = h * aspect;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(wdt + 0.14, h + 0.14, 0.06), mats.frame);
    frame.position.set(0, 1.75, 0.11);
    g.add(frame);
    const picMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(wdt, h), picMat);
    pic.position.set(0, 1.75, 0.145);
    g.add(pic);
    scene.add(g);
    // The picture is cover-fitted into a canvas of the frame's own proportions (drawn stand-ins included), so the
    // texture never needs repeat or offset and keeps one size for its whole life.
    loadImage(pics[i], { small: true }).then((img) => {
      if (ctx.signal.aborted || !img.naturalWidth) return;
      const c = document.createElement('canvas');
      c.height = 960;
      c.width = Math.round(960 * aspect);
      const g2 = c.getContext('2d');
      const s2 = Math.max(c.width / img.naturalWidth, c.height / img.naturalHeight);
      g2.drawImage(img, (c.width - img.naturalWidth * s2) / 2, (c.height - img.naturalHeight * s2) / 2, img.naturalWidth * s2, img.naturalHeight * s2);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      picMat.map = tex;
      picMat.needsUpdate = true;
      render();
    });
    const centre = pos.clone().add(new THREE.Vector3(0, 1.75, 0)).addScaledVector(normal, 0.15);
    frames.push({ centre, top: centre.clone().add(new THREE.Vector3(0, h / 2 + 0.32, 0)) });
    camPts.push(pos.clone().addScaledVector(normal, 5).setY(EYE));
  });
  const path = new THREE.CatmullRomCurve3(camPts, false, 'centripetal', 0.5);
  ctx.onCleanup(() => { disposeScene(scene); shadowTex.dispose(); });

  const tags = works.map((w, i) => {
    const t = document.createElement('span');
    t.className = 'cp__tag';
    t.textContent = `${pad(i + 1)} · ${w.title}`;
    tagsEl.append(t);
    return t;
  });

  const v = new THREE.Vector3();
  const look = new THREE.Vector3();
  let W = 1, H = 1;
  render = () => {
    const p = clamp(S.float, 0, 1);
    path.getPoint(p, camera.position);
    // Look from one frame to the next with an eased hand-over, so the camera turns late, the way a visitor does.
    const f = p * (N - 1);
    const a = Math.floor(f), b = Math.min(N - 1, a + 1);
    const t = f - a;
    look.lerpVectors(frames[a].centre, frames[b].centre, t * t * (3 - 2 * t));
    camera.lookAt(look);
    renderer.render(scene, camera);
    // DOM tags anchored to the frames: project each and place it; only works near the camera are labelled.
    frames.forEach((fr, i) => {
      v.copy(fr.top).project(camera);
      const on = v.z < 1 && Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.95 && Math.abs(i - f) < 1.2;
      tags[i].classList.toggle('is-visible', on);
      tags[i].style.transform = `translate3d(${((v.x * 0.5 + 0.5) * W).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * H).toFixed(1)}px, 0) translate(-50%, -50%)`;
    });
    bar.style.transform = `scaleX(${p.toFixed(4)})`;
    setChapter(Math.round(f));
  };
  onResize(({ width, height }) => {
    W = width; H = height;
    camera.aspect = W / H;
    camera.fov = camera.aspect < 1 ? 60 : camera.aspect < 1.3 ? 52 : 46;   // portrait frames widen the lens
    // On landscape frames the room shifts right of centre, clear of the title and the wall text on the left.
    if (camera.aspect > 1.1) camera.setViewOffset(W, H, -W * 0.14, 0, W, H); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    render();
  });

  // One clock, subscribed only while the float moves or a snap runs.
  let ticking = false;
  wake = () => { if (!ticking) { ticking = true; ticker.add(frame); } };
  const sleep = () => { if (ticking) { ticking = false; ticker.remove(frame); } };
  ctx.onCleanup(sleep);
  function frame(dt) {
    // 1. Integrate input with friction (framerate-independent form of 0.97 per 60 fps frame).
    S.target = clamp(S.target + S.velocity, 0, 1);
    S.velocity *= FRICTION ** (dt * 60);
    if (Math.abs(S.velocity) < 1e-5) S.velocity = 0;
    // 2. Snap to the nearest work after idling, or to the one a key step asked for.
    S.idle += dt * 1000;
    if (S.snapRequest !== undefined) { S.snapFrom = S.target; S.snapT = 0; S.snapTarget = S.snapRequest; S.snapping = true; S.snapRequest = undefined; }
    if (cfg.snap && !S.snapping && S.velocity === 0 && S.idle > cfg.delay) {
      const nearest = Math.round(S.target * (N - 1)) / (N - 1);
      if (Math.abs(nearest - S.target) > 0.002) { S.snapping = true; S.snapFrom = S.target; S.snapT = 0; S.snapTarget = nearest; } else S.target = nearest;
    }
    if (S.snapping && S.snapTarget !== undefined) {
      S.snapT = Math.min(1, S.snapT + dt / SNAP_DURATION);
      const e = S.snapT < 0.5 ? 4 * S.snapT ** 3 : 1 - (-2 * S.snapT + 2) ** 3 / 2;
      S.target = S.snapFrom + (S.snapTarget - S.snapFrom) * e;
      if (S.snapT >= 1) { S.snapping = false; S.snapTarget = undefined; S.idle = 0; }
    }
    // 3. Double lerp, then the camera on the spline.
    S.mid = damp(S.mid, S.target, -Math.log(1 - LERP_A) * 60, dt);
    S.float = damp(S.float, S.mid, -Math.log(1 - LERP_B) * 60, dt);
    const settled = Math.abs(S.float - S.target) < 1e-4 && Math.abs(S.mid - S.target) < 1e-4;
    if (settled) { S.float = S.mid = S.target; }
    render();
    // Asleep only once nothing is left to do: no velocity, no snap pending, and (with snap on) on a work.
    const onWork = Math.abs(S.target * (N - 1) - Math.round(S.target * (N - 1))) < 1e-3;
    if (settled && S.velocity === 0 && !S.snapping && (!cfg.snap || onWork)) sleep();
  }
  ctx.onTheme(() => { paint(); render(); });

  return instance;
}
