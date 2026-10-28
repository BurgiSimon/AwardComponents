// Throw toys — Halden's "start a project" close, played as a toy. Four extruded CSS-3D blocks, one per discipline,
// sit on a shelf above a tray tipped back in perspective. Grab one and let go mid-swing: Draggable + InertiaPlugin
// keep the hand's velocity, the inner body tilts into the travel (0.018° per px/s, capped) and a landing inside the
// tray snaps it to its slot, decided once on the clamped end point. Each discipline also has a toggle button that
// throws its block there or takes it back, and the brief link and a polite live region follow what is in the tray.
// Reduced motion and static: no inertia, a block lands where it is let go, the buttons place blocks at once.
import './demo.css';
import { Draggable } from 'gsap/Draggable';
import { InertiaPlugin } from 'gsap/InertiaPlugin';
import { gsap, useGsap } from '../../src/demo-kit/gsap.js';
import { on, html, observeResize, finePointer, content } from '../../src/demo-kit/index.js';

gsap.registerPlugin(Draggable, InertiaPlugin);

// One block per discipline: a size in units (scaled to the stage by --u in CSS) and a material.
const SHAPES = [
  { key: 'A', w: 96, h: 96, d: 96, m: 'clay' },
  { key: 'I', w: 62, h: 118, d: 62, m: 'sky' },
  { key: 'L', w: 126, h: 70, d: 50, m: 'moss' },
  { key: 'F', w: 84, h: 84, d: 64, m: 'sand' },
];
const TILT = 0.018; // degrees of tilt per px/s of hand velocity
const FACES = ['front', 'back', 'right', 'left', 'top', 'bottom'];

const list = (names) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

export default function mount(root, options, ctx) {
  const { studio } = content;
  let cfg = { ...options };
  const full = ctx.motion === 'full';
  const blocks = studio.disciplines.slice(0, 4).map((name, i) => ({ name, ...SHAPES[i] }));

  root.className = 'tt';
  root.innerHTML = html`
    <header class="ac-bar tt__bar">
      <a class="ac-brand" href="#top">${studio.name}</a>
      <nav aria-label="Studio">${studio.nav.map((n) => html`<a href="#top">${n}</a>`)}</nav>
    </header>
    <section class="tt__play ac-wrap" aria-labelledby="tt-title">
      <div class="tt__copy">
        <p class="ac-label">New project · ${studio.city}</p>
        <h1 class="ac-h1" id="tt-title">What are we building?</h1>
        <p class="ac-lede">Throw what you need into the brief, or press the names below. We answer every brief within two working days.</p>
      </div>
      <div class="tt__stage" data-stage>
        <ul class="tt__shelf" role="list" aria-label="Shelf">
          ${blocks.map((b, i) => html`<li class="tt__spot"><div class="tt__obj" data-obj="${i}" style="--w:${b.w};--h:${b.h};--d:${b.d};--m:var(--${b.m})" role="img" aria-label="${b.name} block">
            <div class="tt__body" data-body aria-hidden="true">${FACES.map((f) => (f === 'front'
              ? html`<span class="tt__face tt__f-front"><b>${b.key}</b><small>${b.name}</small></span>`
              : html`<span class="tt__face tt__f-${f}"></span>`))}</div>
          </div></li>`)}
        </ul>
        <div class="tt__tray" data-catcher aria-hidden="true">
          <div class="tt__floor"></div>
          <ol class="tt__slots">${blocks.map((b) => html`<li class="tt__slot" data-slot><span>${b.key}</span></li>`)}</ol>
          <p class="tt__tray-label ac-label">Your brief</p>
        </div>
        <p class="tt__hint ac-label" data-hint>${finePointer() ? 'Drag a block and let go mid-swing' : 'Drag a block, or use the buttons'}</p>
      </div>
      <div class="tt__picks">
        <div class="tt__chips" role="group" aria-label="Disciplines in your brief">
          ${blocks.map((b, i) => html`<button type="button" class="tt__chip" aria-pressed="false" data-pick="${i}" style="--m:var(--${b.m})"><span class="tt__dot" aria-hidden="true"></span>${b.name}</button>`)}
        </div>
        <div class="tt__send">
          <a class="ac-btn ac-btn--lg" href="mailto:${studio.email}" data-send>Send the brief <span class="tt__count ac-num" data-count>0</span></a>
          <button type="button" class="ac-btn ac-btn--ghost" data-reset>Back on the shelf</button>
        </div>
        <p class="ac-small tt__status" data-status aria-live="polite">The brief is empty.</p>
      </div>
    </section>`;
  root.querySelectorAll('a[href="#top"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const stage = root.querySelector('[data-stage]');
  const catcher = root.querySelector('[data-catcher]');
  const objs = [...root.querySelectorAll('[data-obj]')];
  const bodies = objs.map((el) => el.querySelector('[data-body]'));
  const slots = [...root.querySelectorAll('[data-slot]')];
  const picks = [...root.querySelectorAll('[data-pick]')];
  const status = root.querySelector('[data-status]');
  const send = root.querySelector('[data-send]');
  const count = root.querySelector('[data-count]');
  const caught = new Set();
  const rest = () => ({ rotationX: -18, rotationY: cfg.rest });

  const pos = (el) => ({ x: Number(gsap.getProperty(el, 'x')) || 0, y: Number(gsap.getProperty(el, 'y')) || 0 });
  // Centre of block i at x = y = 0 (the rect includes the live translation, so take it off).
  const home = (i) => {
    const r = objs[i].getBoundingClientRect();
    const p = pos(objs[i]);
    return { x: r.left + r.width / 2 - p.x, y: r.top + r.height / 2 - p.y };
  };
  // The translation that stands block i on slot i: its centre a little above the slot's, so it sits on the floor.
  const slotOffset = (i) => {
    const h = home(i);
    const s = slots[i].getBoundingClientRect();
    return { x: s.left + s.width / 2 - h.x, y: s.top + s.height / 2 - h.y - objs[i].offsetHeight * 0.46 };
  };
  const inTray = (i, p) => {
    const h = home(i);
    const c = catcher.getBoundingClientRect();
    const x = h.x + p.x;
    const y = h.y + p.y;
    return x >= c.left && x <= c.right && y >= c.top && y <= c.bottom;
  };

  const settle = (i, isCaught) => {
    if (isCaught) caught.add(i); else caught.delete(i);
    objs[i].dataset.caught = String(isCaught);
    slots[i].classList.toggle('is-filled', isCaught);
    picks[i].setAttribute('aria-pressed', String(isCaught));
    const names = blocks.filter((_, j) => caught.has(j)).map((b) => b.name);
    count.textContent = String(names.length);
    status.textContent = names.length ? `${names.length} of ${blocks.length} in the brief: ${list(names)}.` : 'The brief is empty.';
    send.href = `mailto:${studio.email}${names.length ? `?subject=${encodeURIComponent(`New project: ${names.join(', ')}`)}` : ''}`;
  };

  let drags = [];
  let tiltTo = [];
  const { context: g } = useGsap(ctx, root);
  g.add(() => {
    gsap.set(bodies, rest());
    tiltTo = bodies.map((b) => ({
      x: gsap.quickTo(b, 'rotationX', { duration: 0.35, ease: 'power3.out' }),
      y: gsap.quickTo(b, 'rotationY', { duration: 0.35, ease: 'power3.out' }),
    }));
  });
  const tiltFromVelocity = (i) => {
    const max = cfg.tilt;
    const vx = InertiaPlugin.getVelocity(objs[i], 'x') || 0;
    const vy = InertiaPlugin.getVelocity(objs[i], 'y') || 0;
    tiltTo[i].y(cfg.rest + gsap.utils.clamp(-max, max, vx * TILT));
    tiltTo[i].x(-18 - gsap.utils.clamp(-max, max, vy * TILT));
  };
  const restTilt = (i) => { tiltTo[i].x(-18); tiltTo[i].y(cfg.rest); };

  const build = () => {
    drags.forEach((d) => d.kill());
    drags = objs.map((el, i) => Draggable.create(el, {
      type: 'x,y',
      bounds: stage,
      zIndexBoost: true,
      inertia: full, // full tier only: the release velocity keeps the block moving after pointerup
      throwResistance: 1000 / cfg.power,
      // Where a throw lands, decided once: inside the tray means "go to your slot", anywhere else stays put.
      // InertiaPlugin hands over the unbounded natural end, so clamp it to the bounds before asking.
      snap: { points: (p) => {
        const d = drags[i];
        const q = { x: gsap.utils.clamp(d.minX, d.maxX, p.x), y: gsap.utils.clamp(d.minY, d.maxY, p.y) };
        return cfg.snap && inTray(i, q) ? slotOffset(i) : p;
      } },
      onDragStart() { settle(i, false); },
      onDrag() { if (full) tiltFromVelocity(i); },
      onRelease() {
        if (full) return; // the throw tween takes over; onThrowComplete settles it
        const p = pos(el);
        const inside = inTray(i, p);
        if (inside && cfg.snap) gsap.set(el, slotOffset(i));
        this.update();
        settle(i, inside);
      },
      onThrowUpdate() { tiltFromVelocity(i); },
      onThrowComplete() { restTilt(i); settle(i, inTray(i, pos(el))); },
    })[0]);
  };
  ctx.onCleanup(() => drags.forEach((d) => d.kill()));

  // The keyboard path: the same end state as a good throw, or back to the shelf when it is already in.
  const throwToSlot = (i, instant = !full) => {
    const to = slotOffset(i);
    gsap.killTweensOf(objs[i]);
    if (instant) {
      gsap.set(objs[i], to);
      gsap.set(bodies[i], rest());
      drags[i].update();
      settle(i, true);
      return;
    }
    gsap.to(objs[i], { x: to.x, y: to.y, duration: 0.9, ease: 'expo.out', onComplete: () => drags[i].update() });
    gsap.fromTo(bodies[i], { rotationY: cfg.rest - 200 }, { ...rest(), duration: 0.9, ease: 'expo.out' });
    settle(i, true);
  };
  const toShelf = (i) => {
    gsap.killTweensOf(objs[i]);
    if (full) gsap.to(objs[i], { x: 0, y: 0, duration: 0.6, ease: 'expo.out', onComplete: () => drags[i].update() });
    else { gsap.set(objs[i], { x: 0, y: 0 }); drags[i].update(); }
    settle(i, false);
  };
  const reset = () => objs.forEach((_, i) => toShelf(i));

  picks.forEach((b, i) => on(ctx, b, 'click', () => (caught.has(i) ? toShelf(i) : throwToSlot(i))));
  on(ctx, root.querySelector('[data-reset]'), 'click', reset);
  on(ctx, send, 'click', (e) => e.preventDefault());

  // Layout changes move the slots: caught blocks follow them, loose blocks go back to the shelf.
  let resizeTimer = 0;
  let width = 0;
  observeResize(ctx, stage, () => {
    if (stage.clientWidth === width) return;
    width = stage.clientWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => objs.forEach((el, i) => {
      gsap.killTweensOf(el);
      gsap.set(el, caught.has(i) ? slotOffset(i) : { x: 0, y: 0 });
      drags[i]?.update();
    }), 150);
  });
  ctx.onCleanup(() => clearTimeout(resizeTimer));

  const apply = () => { root.dataset.palette = cfg.palette; };
  apply();
  build();
  // The thumbnail opens with one block already in; the capture's action throws a second.
  if (ctx.capture) document.fonts?.ready.then(() => throwToSlot(2, true));

  return {
    update(next, changed) {
      cfg = { ...next };
      apply();
      if (changed.includes('power')) build();
      if (changed.includes('rest')) {
        if (full) gsap.to(bodies, { ...rest(), duration: 0.6, ease: 'expo.out' });
        else gsap.set(bodies, rest());
      }
      if (changed.includes('snap') && cfg.snap) caught.forEach((i) => gsap.set(objs[i], slotOffset(i)));
    },
    action(id) {
      if (id === 'reset') reset();
      if (id === 'throw') {
        const next = objs.findIndex((_, i) => !caught.has(i));
        if (next >= 0) throwToSlot(next, !full || ctx.capture);
      }
    },
  };
}
