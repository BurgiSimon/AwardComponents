// Physics tags — Halden's "What we do" as a box of pills. matter-js steps the bodies with no renderer of its own:
// each <li> is placed at the box origin and moved by translate() rotate() from its body, so the words stay text in
// source order. A fixed 1/60 s step on the shared ticker (at most four a frame), seeded drop slots so every load
// makes the same heap, sleeping on: once every body sleeps the step leaves the clock. Fine pointers drag through a
// MouseConstraint bound to the list (wheel and touch handed back to the page); a tap, Enter or Space tosses, the
// arrows push, a press on the box itself shakes the pile. Reduced/static: no engine, a settled CSS arrangement.
import './demo.css';
import Matter from 'matter-js';
import { on, onFrame, finePointer, html, raw, content } from '../../src/demo-kit/index.js';

const { Engine, Bodies, Body, Composite, Events, Sleeping, Mouse, MouseConstraint } = Matter;
const STEP = 1000 / 60;
const MAX_STEPS = 4;
const WALL = 400;           // static walls this thick never let a fast body tunnel out
const MAX_AWAKE = 600;      // steps (10 s) awake without a hand before the pile is put to sleep
const TOSS = { up: -14, side: 9, lift: -6, spin: 0.12 };
const BODY = { friction: 0.6, frictionStatic: 0.9, frictionAir: 0.015, density: 0.002, sleepThreshold: 40 };

// What the studio does, with a shape, a tone and a size each (the Shapes and Colours controls remap them).
const WORDS = [
  ['Architecture', 'pill', 1, 'l'], ['Interiors', 'pill', 2, 'l'], ['Cabins', 'circle', 3], ['Landscape', 'block', 4, 'l'],
  ['Libraries', 'pill', 5], ['Timber frames', 'pill', 0], ['Saunas', 'circle', 6], ['Retrofit', 'block', 1],
  ['Daylight studies', 'pill', 4], ['Furniture', 'block', 2], ['Kitchens', 'pill', 3], ['Stairs', 'circle', 0],
  ['Site surveys', 'pill', 6], ['Competitions', 'block', 5],
];
const TONES = {
  materials: ['ink', 'clay', 'moss', 'sky', 'sand', 'plum', 'accent'],
  ink: ['ink', 'paper', 'ink', 'paper', 'paper', 'ink', 'paper'],
  accent: ['ink', 'accent', 'paper', 'accent', 'paper', 'ink', 'accent'],
};

// Seeded so every load drops the same pile: drop order, x band and tilt come from this, never Math.random.
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function mount(root, options, ctx) {
  const { studio } = content;
  let cfg = { ...options };
  const live = ctx.motion === 'full';

  root.className = 'pt';
  root.innerHTML = html`
    <section class="pt__section ac-wrap" aria-labelledby="pt-title">
      <div class="pt__head">
        <div>
          <p class="ac-label">What we do</p>
          <h2 class="ac-h1" id="pt-title">Fourteen things we are asked for, in no particular order.</h2>
        </div>
        <div class="pt__side">
          <p class="ac-body">Most projects start as one of these and end up as three. Tell us which, and we will tell you who in the studio has done it before.</p>
          <a class="ac-btn ac-btn--accent" href="#top">Start a project</a>
        </div>
      </div>
      <div class="pt__box" data-box>
        <ul class="pt__list" role="list" data-list>
          ${WORDS.map(([word, , , size]) => html`<li ${size ? raw(`data-size="${size}"`) : ''}>${word}</li>`)}
        </ul>
      </div>
      <div class="pt__under">
        <p class="ac-small pt__hint" id="pt-hint" data-hint></p>
        <div class="pt__acts">
          <button class="ac-btn ac-btn--ghost ac-btn--sm" type="button" data-shake>Shake</button>
          <button class="ac-btn ac-btn--ghost ac-btn--sm" type="button" data-drop>Drop again</button>
        </div>
      </div>
    </section>
    <footer class="pt__foot ac-wrap">
      <p>© 2026 ${studio.full}</p>
      <a class="ac-link" href="mailto:${studio.email}">${studio.email}</a>
    </footer>`;
  root.querySelectorAll('a[href="#top"], a[href^="mailto"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const box = root.querySelector('[data-box]');
  const list = root.querySelector('[data-list]');
  const hint = root.querySelector('[data-hint]');
  const items = [...list.children].map((el, index) => ({ el, index, word: WORDS[index][0], body: null, w: 0, h: 0, drawn: '' }));

  const applyLook = () => {
    root.dataset.palette = cfg.palette;
    items.forEach((it, i) => {
      const [, shape, tone] = WORDS[i];
      it.el.dataset.shape = cfg.shapes === 'pills' ? 'pill' : cfg.shapes === 'blocks' ? 'block' : shape;
      it.el.dataset.tone = TONES[cfg.palette][tone];
    });
  };
  applyLook();

  // ---------- The simulation (full motion only). Built on mount, rebuilt by Drop again and by a shape change.
  function createSim() {
    const ac = new AbortController();
    const { signal } = ac;
    const random = rng(9);
    const fine = finePointer();
    let W = 0; let H = 0; let P = 10;
    let engine = null; let walls = []; let ceiling = null; let mouse = null; let mc = null;
    let started = false; let asleep = false; let visible = false; let off = null; let acc = 0; let awakeSteps = 0;
    let press = null;

    // Each item gets a real button: the piece is operable and its label is still the word.
    for (const it of items) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = it.word;
      b.setAttribute('aria-describedby', 'pt-hint');
      it.el.replaceChildren(b);
    }
    box.dataset.sim = '';
    hint.textContent = fine
      ? 'Drag a piece, or press the box to shake it. With the keyboard, Tab to a piece: Enter or Space tosses it, the arrows push it.'
      : 'Tap a piece to toss it, or tap the box to shake it. With a keyboard, Enter tosses the focused piece and the arrows push it.';

    const measure = () => {
      const r = list.getBoundingClientRect();
      W = r.width; H = r.height;
      P = parseFloat(getComputedStyle(box).getPropertyValue('--pad')) || 10;
      for (const it of items) { it.w = it.el.offsetWidth; it.h = it.el.offsetHeight; }
    };
    const gap = () => Math.max(...items.map((it) => it.h)) + 24;

    // Before the drop every piece waits above the box, out of sight behind the clip, in its drop slot. The k-th
    // piece to fall aims at the k-th of n bands across the floor, so the pile spreads instead of heaping.
    const dropSlots = () => {
      const order = items.map((it) => it.index);
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      const bands = items.map((_, k) => k);
      for (let i = bands.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [bands[i], bands[j]] = [bands[j], bands[i]]; }
      const slots = [];
      order.forEach((index, k) => {
        const it = items[index];
        const centre = P + ((bands[k] + 0.2 + random() * 0.6) / items.length) * (W - 2 * P);
        slots[index] = { x: Math.min(W - P - it.w / 2, Math.max(P + it.w / 2, centre)), y: -(k + 1) * gap(), a: (random() - 0.5) * 0.6 };
      });
      return slots;
    };
    // Where the CSS arrangement puts each piece, read with the simulation styles off for one layout.
    const flowSlots = () => {
      for (const it of items) { it.el.style.transform = ''; it.drawn = ''; }
      delete box.dataset.sim;
      const o = list.getBoundingClientRect();
      const slots = items.map((it) => {
        const r = it.el.getBoundingClientRect();
        const m = new DOMMatrix(getComputedStyle(it.el).transform);
        return { x: r.left + r.width / 2 - o.left, y: r.top + r.height / 2 - o.top, a: Math.atan2(m.b, m.a) };
      });
      box.dataset.sim = '';
      return slots;
    };
    const place = (it, x, y, a) => {
      const t = `translate(${(x - it.w / 2).toFixed(2)}px, ${(y - it.h / 2).toFixed(2)}px) rotate(${a.toFixed(4)}rad)`;
      if (t !== it.drawn) { it.el.style.transform = t; it.drawn = t; }
    };
    const makeBody = (it, x, y, a) => {
      const shape = it.el.dataset.shape;
      const opts = { ...BODY, restitution: cfg.bounce, angle: a, label: it.word };
      const b = shape === 'circle'
        ? Bodies.circle(x, y, it.w / 2, opts, 40)
        : Bodies.rectangle(x, y, it.w, it.h, { ...opts, chamfer: { radius: shape === 'pill' ? Math.min(it.w, it.h) / 2 - 0.5 : 8 } });
      b.plugin.item = it;
      return b;
    };

    // Walls sit P inside the clip; the side walls reach far above so the waiting pieces fall in between them.
    const buildWalls = () => {
      if (walls.length) Composite.remove(engine.world, walls);
      const rise = (items.length + 2) * gap();
      const tall = H + WALL + rise;
      const o = { isStatic: true, friction: 0.6, label: 'wall' };
      walls = [
        Bodies.rectangle(W / 2, H - P + WALL / 2, W + 2 * WALL, WALL, o),
        Bodies.rectangle(P - WALL / 2, (H + WALL - rise) / 2, WALL, tall, o),
        Bodies.rectangle(W - P + WALL / 2, (H + WALL - rise) / 2, WALL, tall, o),
      ];
      if (ceiling) walls.push(ceiling = Bodies.rectangle(W / 2, P - WALL / 2, W + 2 * WALL, WALL, o));
      Composite.add(engine.world, walls);
    };
    const closeLid = () => {
      ceiling = Bodies.rectangle(W / 2, P - WALL / 2, W + 2 * WALL, WALL, { isStatic: true, friction: 0.6, label: 'wall' });
      walls.push(ceiling);
      Composite.add(engine.world, ceiling);
    };

    const start = (fromFlow = false) => {
      if (started) return;
      started = true;
      const flow = fromFlow ? flowSlots() : null;
      measure();
      engine = Engine.create({ gravity: { x: 0, y: cfg.gravity }, enableSleeping: true, positionIterations: 8, velocityIterations: 6 });
      buildWalls();
      const slots = flow ?? dropSlots();
      for (const it of items) it.body = makeBody(it, slots[it.index].x, slots[it.index].y, slots[it.index].a);
      Composite.add(engine.world, items.map((it) => it.body));
      if (fine) attachMouse();
      Events.on(engine, 'beforeUpdate', clampMouse);
      // The frame capture wants the settled heap: step it to rest at once (a few hundred steps, well under 100 ms).
      if (ctx.capture) {
        for (let i = 0; i < 1500 && !items.every((it) => it.body.isSleeping); i++) {
          Engine.update(engine, STEP);
          if (!ceiling && items.every((it) => it.body.bounds.min.y > P + 1)) closeLid();
        }
      }
      draw();
      wake();
    };

    // Drag through a MouseConstraint bound to the list; its wheel (preventDefault) and touch listeners go back.
    const attachMouse = () => {
      mouse = Mouse.create(list);
      list.removeEventListener('wheel', mouse.mousewheel);
      list.removeEventListener('touchmove', mouse.mousemove);
      list.removeEventListener('touchstart', mouse.mousedown);
      list.removeEventListener('touchend', mouse.mouseup);
      mc = MouseConstraint.create(engine, { mouse, constraint: { stiffness: 0.2, damping: 0.1, angularStiffness: 0 } });
      Composite.add(engine.world, mc);
      box.dataset.drag = '';
      // A release or a move outside the box still reaches the constraint, so a piece never sticks to the hand.
      window.addEventListener('mouseup', (e) => { if (mouse.button === 0 && !list.contains(e.target)) mouse.mouseup(e); }, { signal });
      window.addEventListener('mousemove', (e) => { if (mc.body && !list.contains(e.target)) mouse.mousemove(e); }, { signal });
      window.addEventListener('blur', () => { mouse.button = -1; delete box.dataset.holding; }, { signal });
    };
    const clampMouse = () => {
      if (!mouse) return;
      mouse.position.x = Math.min(W - P, Math.max(P, mouse.position.x));
      mouse.position.y = Math.min(H - P, Math.max(P, mouse.position.y));
    };

    // On the clock only while there is something to step and someone to see it.
    const sync = () => {
      const want = started && !asleep && visible;
      if (want && !off) { acc = 0; off = onFrame(ctx, tick); }
      if (!want && off) { off(); off = null; }
    };
    const wake = () => { if (!engine) return; asleep = false; awakeSteps = 0; sync(); };

    const draw = () => { for (const it of items) place(it, it.body.position.x, it.body.position.y, it.body.angle); };
    const tick = (dt) => {
      acc = Math.min(acc + dt * 1000, STEP * MAX_STEPS);
      while (acc >= STEP) {
        Engine.update(engine, STEP);
        acc -= STEP;
        awakeSteps++;
        if (!ceiling && items.every((it) => it.body.bounds.min.y > P + 1)) closeLid();
      }
      draw();
      const holding = mouse?.button === 0 || !!mc?.body;
      if (!holding && awakeSteps > MAX_AWAKE && !items.every((it) => it.body.isSleeping)) for (const it of items) Sleeping.set(it.body, true);
      if (!holding && items.every((it) => it.body.isSleeping)) { asleep = true; draw(); sync(); }
    };

    // Keyboard and tap: Enter / Space (a click) tosses the piece up, the arrows push it sideways.
    const nudge = (it, dir) => {
      const b = it.body;
      Sleeping.set(b, false);
      const s = (random() - 0.5) * 2;
      if (dir === 'up') Body.setVelocity(b, { x: s * 2, y: TOSS.up });
      else Body.setVelocity(b, { x: dir === 'left' ? -TOSS.side : TOSS.side, y: TOSS.lift });
      Body.setAngularVelocity(b, s * TOSS.spin);
      wake();
    };
    const shake = () => {
      if (!started) return;
      for (const it of items) {
        Sleeping.set(it.body, false);
        Body.setVelocity(it.body, { x: (random() - 0.5) * 10, y: -6 - random() * 10 });
        Body.setAngularVelocity(it.body, (random() - 0.5) * 0.3);
      }
      wake();
    };
    const itemOf = (target) => items.find((it) => it.el.contains(target));

    list.addEventListener('click', (e) => {
      const it = itemOf(e.target);
      if (!it || !it.body) return;
      if (e.detail > 0 && press?.moved) return; // a mouse press that travelled was a drag, not a toss
      nudge(it, 'up');
    }, { signal });
    list.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const it = itemOf(e.target);
      if (!it || !it.body) return;
      e.preventDefault();
      nudge(it, e.key === 'ArrowLeft' ? 'left' : 'right');
    }, { signal });
    list.addEventListener('pointerdown', (e) => {
      press = { x: e.clientX, y: e.clientY, moved: false };
      if (e.target === list) { shake(); return; } // a press on the box itself, not on a piece
      if (e.pointerType === 'mouse' && e.button === 0 && mc) { box.dataset.holding = ''; wake(); }
    }, { signal });
    window.addEventListener('pointermove', (e) => { if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 5) press.moved = true; }, { signal });
    window.addEventListener('pointerup', () => { delete box.dataset.holding; }, { signal });
    // Tabbing in before the drop starts from the laid-out arrangement instead.
    list.addEventListener('focusin', () => { if (!started) start(true); }, { signal });

    // Start once 30 % of the box is on screen; pause the steps while it is off screen.
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && entry.intersectionRatio >= 0.3) start();
      sync();
    }, { threshold: [0, 0.3] });
    // A change in the box's size rebuilds the walls, re-measures the pieces and wakes the pile.
    const ro = new ResizeObserver(() => {
      const r = list.getBoundingClientRect();
      if (Math.abs(r.width - W) < 1 && Math.abs(r.height - H) < 1) return;
      if (!started) { measure(); parkAll(); return; }
      const before = items.map((it) => ({ w: it.w, h: it.h }));
      measure();
      buildWalls();
      for (const it of items) {
        let b = it.body;
        if (Math.abs(before[it.index].w - it.w) > 1 || Math.abs(before[it.index].h - it.h) > 1) {
          Composite.remove(engine.world, b);
          b = it.body = makeBody(it, b.position.x, b.position.y, b.angle);
          Composite.add(engine.world, b);
        }
        const hw = (b.bounds.max.x - b.bounds.min.x) / 2;
        const hh = (b.bounds.max.y - b.bounds.min.y) / 2;
        const x = Math.min(W - P - hw, Math.max(P + hw, b.position.x));
        const y = Math.min(H - P - hh, b.position.y);
        if (x !== b.position.x || y !== b.position.y) Body.setPosition(b, { x, y }, false);
        Sleeping.set(b, false);
      }
      wake();
    });
    const parkAll = () => {
      const slots = dropSlots();
      for (const it of items) place(it, slots[it.index].x, slots[it.index].y, slots[it.index].a);
    };

    measure();
    parkAll();
    io.observe(box);
    ro.observe(list);

    return {
      shake,
      setGravity(g) { if (engine) { engine.gravity.y = g; for (const it of items) Sleeping.set(it.body, false); wake(); } },
      setBounce(r) { if (engine) for (const it of items) it.body.restitution = r; },
      destroy() {
        ac.abort();
        io.disconnect();
        ro.disconnect();
        off?.();
        off = null;
        if (mouse) for (const [type, fn] of [['mousemove', mouse.mousemove], ['mousedown', mouse.mousedown], ['mouseup', mouse.mouseup]]) list.removeEventListener(type, fn);
        if (engine) { Composite.clear(engine.world, false); Engine.clear(engine); }
        for (const it of items) { it.el.textContent = it.word; it.el.style.transform = ''; it.drawn = ''; it.body = null; }
        delete box.dataset.sim;
        delete box.dataset.drag;
        delete box.dataset.holding;
      },
    };
  }

  let sim = null;
  const rebuild = () => { sim?.destroy(); sim = live ? createSim() : null; };
  ctx.onCleanup(() => sim?.destroy());

  if (!live) {
    box.dataset.tier = ctx.motion;
    hint.textContent = ctx.motion === 'reduced' ? 'Reduced motion is on, so nothing falls: the pieces are laid out as they would settle.' : 'The pieces, laid out as they would settle.';
    root.querySelectorAll('[data-shake], [data-drop]').forEach((b) => { b.hidden = true; });
  } else {
    // Piece sizes depend on the real face: build once the fonts are in.
    (document.fonts?.ready || Promise.resolve()).then(() => { if (!ctx.signal.aborted) rebuild(); });
    on(ctx, root.querySelector('[data-shake]'), 'click', () => sim?.shake());
    on(ctx, root.querySelector('[data-drop]'), 'click', rebuild);
  }

  return {
    update(next, changed) {
      cfg = { ...next };
      applyLook();
      if (changed.includes('shapes') && live) rebuild();
      if (changed.includes('gravity')) sim?.setGravity(cfg.gravity);
      if (changed.includes('bounce')) sim?.setBounce(cfg.bounce);
    },
    action(id) {
      if (id === 'drop' && live) rebuild();
      if (id === 'shake') sim?.shake();
    },
  };
}
