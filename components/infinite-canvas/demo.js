// Infinite canvas — Halden's index: twenty-four projects on a plane you pan by drag, wheel, finger or keys. It wraps
// on both axes without clones: the 24 <li>s are the list and the pool at once, each placed by
//   x = mod(c·pitch + x0 + offset + pitch, 6·pitch) − pitch   (and y on rows, odd columns half a row lower)
// so every tile stays within [−pitch, span − pitch). The pitch is max(tile + gap, stage / (count − 1)): one sheet
// always spans the stage plus a tile, so no hole opens at any size. A drag is direct; the release coasts by the exact
// integral of v·e^(−k·t) on the shared ticker. The stage is a parked overflow: hidden scroller, so Tab and
// find-in-page scroll it (never the page) and the script turns that scroll into a glide of the plane.
// Reduced: drag and wheel stay, no coast, keys land at once. Static: the same links as a plain grid.
import './demo.css';
import { on, html, raw, ticker, photo, allPhotos, observeResize, content } from '../../src/demo-kit/index.js';

const MORE = [
  ['Moss Hut', 'Valdres, NO', 2021, 'Architecture'], ['Birch Room', 'Helsinki, FI', 2022, 'Interiors'], ['Quarry Steps', 'Larvik, NO', 2019, 'Landscape'],
  ['Lantern Stool', 'Edition of 120', 2021, 'Furniture'], ['Harbour Baths', 'Ålesund, NO', 2022, 'Architecture'], ['Rye Bakery', 'Aarhus, DK', 2023, 'Interiors'],
  ['Shore Path', 'Lofoten, NO', 2020, 'Landscape'], ['Nordnes School', 'Bergen, NO', 2019, 'Architecture'], ['Table Nine', 'Edition of 60', 2020, 'Furniture'],
  ['Fog House', 'Shetland, UK', 2018, 'Architecture'], ['Cellar Room', 'Bordeaux, FR', 2021, 'Interiors'], ['Orchard Wall', 'Hardanger, NO', 2017, 'Landscape'],
  ['Rink Pavilion', 'Lillehammer, NO', 2018, 'Architecture'], ['Ash Bench', 'Edition of 40', 2019, 'Furniture'], ['Wool Mill Lofts', 'Os, NO', 2017, 'Architecture'],
  ['Ferry Shed', 'Stord, NO', 2016, 'Interiors'],
].map(([title, place, year, discipline]) => ({ title, place, year, discipline, slug: title.toLowerCase().replace(/\s+/g, '-') }));
const TAGS = { Architecture: ['architecture'], Interiors: ['interior'], Landscape: ['landscape'], Furniture: ['furniture'] };

const COLS = 6, ROWS = 4;      // the logical sheet; COLS stays even so the column stagger meets itself across the wrap
const DRAG_THRESHOLD = 6;      // px before a press becomes a drag; a shorter press stays a click on the link
const VELOCITY_WINDOW = 100;   // ms of pointer samples that set the release velocity
const REST_GAP = 60;           // ms: a pointer held still this long before release throws nothing
const V_MAX = 4000;            // px/s clamp on the release velocity
const V_STOP = 8;              // px/s: the coast ends below this
const WHEEL_K = 16;            // 1/s: a wheel notch eases in over ≈ 150 ms (trackpad streams read as direct)
const GLIDE = 0.42;            // s: arrow, Home, End, click and focus glides, expo-out
const EDGE = 32;               // px a focused tile keeps from the stage edge
const mod = (a, n) => ((a % n) + n) % n;
const residue = (v, span) => mod(v + span / 2, span) - span / 2;   // the shortest way back round the wrap

// One picture per project, by discipline, never twice; when a discipline runs out, an unused material or site
// picture stands in (a blurred drawn field reads as an image that failed to load); drawn fields only after that.
const NEAR = ['texture', 'landscape'];
function pictures(projects) {
  const pool = allPhotos();
  const taken = new Set();
  const free = (tags) => pool.find((m) => tags.every((t) => m.tags?.includes(t)) && !taken.has(m.id));
  return projects.map((p) => {
    let hit = free(TAGS[p.discipline] || []);
    for (const t of NEAR) hit ||= free([t]);
    if (hit) { taken.add(hit.id); return photo(hit.id); }
    return photo(`halden-${p.slug}`);
  });
}

export default function mount(root, options, ctx) {
  const { studio } = content;
  const projects = studio.projects.concat(MORE).slice(0, COLS * ROWS);
  const art = pictures(projects);
  const N = projects.length;
  const tier = ctx.motion;
  const live = tier !== 'static';
  let cfg = { ...options };

  root.className = `ic${live ? ' ic--live' : ' ic--static'}`;
  root.innerHTML = html`
    <header class="ac-bar ic__bar">
      <a class="ac-brand" href="#top">${studio.name}</a>
      <p class="ic__where ac-label">Index · ${N} projects · 2016–2026</p>
      <nav aria-label="Studio">${studio.nav.map((n, i) => html`<a href="#${n.toLowerCase()}"${i === 0 ? raw(' aria-current="page"') : ''}>${n}</a>`)}</nav>
    </header>
    <a class="ic__skip sr-only" href="#ic-after">Skip past the projects</a>
    <section class="ic__plane" aria-label="Projects, on a plane that wraps in every direction" aria-describedby="ic-help">
      <div class="ic__stage" data-stage>
        <ul class="ic__tiles" role="list" data-tiles>
          ${projects.map((p, i) => html`
            <li class="ic__tile" data-tile="${i}">
              <a class="ic__link" href="#${p.slug}" draggable="false">
                <span class="ic__plate ac-media">${raw(imgTag(art[i]))}</span>
                <span class="ic__name">${p.title}</span>
                <span class="ic__meta ac-label">${p.place} · ${p.year}</span>
              </a>
            </li>`)}
        </ul>
      </div>
    </section>
    <footer class="ic__legend" id="ic-after" tabindex="-1">
      <p class="ic__readout" data-readout></p>
      <p class="ic__help ac-small" id="ic-help">${live ? raw('Drag, scroll or flick the plane. <span class="ic__keys">Tab and the arrow keys step between projects.</span>') : 'Every project, in order.'}</p>
    </footer>`;

  const stage = root.querySelector('[data-stage]');
  const list = root.querySelector('[data-tiles]');
  const items = [...list.children];
  const links = items.map((li) => li.querySelector('a'));
  const readout = root.querySelector('[data-readout]');
  on(ctx, root.querySelector('.ic__bar'), 'click', (e) => { if (e.target.closest('a')) e.preventDefault(); });

  const S = { ox: 0, oy: 0, vx: 0, vy: 0 };
  const G = { w: 0, h: 0, tw: 0, th: 0, px: 0, py: 0, sx: 1, sy: 1, x0: 0, y0: 0, hx: 0, hy: 0 };
  let glide = null;              // { fx, fy, tx, ty, t } in offset px, t 0 → 1
  const wheel = { x: 0, y: 0 };  // wheel delta still to be applied (full tier)
  let drag = null;               // { id, x, y, ox, oy, moved, samples }
  let pressing = false, suppressClick = false;

  const apply = () => {
    root.style.setProperty('--ic-gap', `${cfg.gap}px`);
    root.style.setProperty('--ic-tile', `${cfg.size}px`);
  };
  apply();

  // At rest: name the project nearest the middle of the stage (a plain line, not a live region: Tab announces each).
  const nameAt = (i) => `${projects[i].title} · ${projects[i].place} · ${projects[i].year}`;
  if (!live) {
    readout.textContent = '';
    return { update(next) { cfg = { ...next }; apply(); } };
  }

  function measure() {
    const before = { px: G.px, py: G.py };
    G.w = stage.clientWidth; G.h = stage.clientHeight;
    G.tw = items[0].offsetWidth; G.th = items[0].offsetHeight;
    // The pitch never drops below stage / (count − 1): the sheet then spans the stage plus one tile in each axis,
    // so every tile can wrap one pitch past an edge and a hole never opens, at any stage size.
    G.px = Math.max(G.tw + cfg.gap, G.w / (COLS - 1));
    G.py = Math.max(G.th + cfg.gap, G.h / (ROWS - 1));
    G.sx = COLS * G.px; G.sy = ROWS * G.py;
    G.x0 = (G.w - G.tw) / 2; G.y0 = (G.h - G.th) / 2;   // offset 0 centres the first project
    // The scroll content is one sheet plus a pitch; the stage is parked a whole-pixel pitch in on each axis.
    G.hx = Math.round(G.px); G.hy = Math.round(G.py);
    list.style.width = `${Math.ceil(G.sx + G.px)}px`;
    list.style.height = `${Math.ceil(G.sy + G.py)}px`;
    park();
    // Offsets are kept in tiles across a resize, so the plane keeps its place.
    if (before.px && before.py && (before.px !== G.px || before.py !== G.py)) {
      const kx = G.px / before.px, ky = G.py / before.py;
      S.ox *= kx; S.oy *= ky;
      if (glide) { glide.fx *= kx; glide.tx *= kx; glide.fy *= ky; glide.ty *= ky; }
    }
  }

  // The modulo wrap: nothing is created or destroyed; a tile leaving one side re-enters on the other.
  function place(i, ox, oy) {
    const c = i % COLS, r = (i - c) / COLS;
    return [
      mod(c * G.px + G.x0 + ox + G.px, G.sx) - G.px,
      mod((r + (c % 2) * cfg.stagger) * G.py + G.y0 + oy + G.py, G.sy) - G.py,
    ];
  }
  // Transform writes only, no layout reads. Layout coordinates add the stage's home scroll, so every tile sits at a
  // positive place the browser can scroll to when focus or find-in-page reaches it.
  function render(ox = S.ox, oy = S.oy, rest = false) {
    for (let i = 0; i < N; i++) {
      let [x, y] = place(i, ox, oy);
      x += G.hx; y += G.hy;
      if (rest) { x = Math.round(x); y = Math.round(y); } else { x = Math.round(x * 100) / 100; y = Math.round(y * 100) / 100; }
      items[i].style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }
  }
  const park = () => { stage.scrollLeft = G.hx; stage.scrollTop = G.hy; };
  // What the browser scrolled the stage by since it was parked; the stage goes straight back home, before any paint.
  function takeScroll() {
    const dx = stage.scrollLeft - G.hx, dy = stage.scrollTop - G.hy;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return null;
    park();
    return [dx, dy];
  }
  // The offset that puts tile i inside the stage, EDGE px clear of every side (and clear of the bars), moving least.
  function keepInside(i, ox, oy) {
    const [x, y] = place(i, ox, oy);
    const top = EDGE + barH, bottom = G.h - EDGE - legendH;
    const dx = x < EDGE ? EDGE - x : x + G.tw > G.w - EDGE ? G.w - EDGE - (x + G.tw) : 0;
    const dy = y < top ? top - y : y + G.th > bottom ? bottom - (y + G.th) : 0;
    return [ox + dx, oy + dy];
  }
  const base = () => (glide ? { x: glide.tx, y: glide.ty } : { x: S.ox, y: S.oy });
  const moving = () => !!glide || S.vx !== 0 || S.vy !== 0 || wheel.x !== 0 || wheel.y !== 0;

  let barH = 0, legendH = 0;
  const measureChrome = () => {
    barH = root.querySelector('.ic__bar').offsetHeight;
    legendH = root.querySelector('.ic__legend').offsetHeight;
  };

  function settle() {
    let best = 0, d = Infinity;
    for (let i = 0; i < N; i++) {
      const [x, y] = place(i, S.ox, S.oy);
      const e = Math.hypot(x + G.tw / 2 - G.w / 2, y + G.th / 2 - G.h / 2);
      if (e < d) { d = e; best = i; }
    }
    items.forEach((li, i) => li.classList.toggle('is-centre', i === best));
    const text = nameAt(best);
    if (readout.dataset.text !== text) {
      readout.dataset.text = text;
      readout.innerHTML = html`<span class="ac-label">At the centre</span> ${text}`;
    }
  }

  // One clock: the shared ticker, subscribed only while something moves.
  let ticking = false;
  const wake = () => { if (!ticking) { ticking = true; ticker.add(frame); } };
  const sleep = () => { if (ticking) { ticking = false; ticker.remove(frame); } };
  ctx.onCleanup(sleep);
  function frame(dt) {
    if (glide) {
      glide.t = Math.min(1, glide.t + dt / GLIDE);
      const e = glide.t === 1 ? 1 : 1 - Math.pow(2, -10 * glide.t);
      S.ox = glide.fx + (glide.tx - glide.fx) * e;
      S.oy = glide.fy + (glide.ty - glide.fy) * e;
      if (glide.t === 1) glide = null;
    }
    if (S.vx || S.vy) {
      // Exact integral of v·e^(−kt) over the frame: a flick coasts v0 / k px at 30, 60 or 144 Hz.
      const k = cfg.friction;
      const f = Math.exp(-k * dt);
      S.ox += (S.vx * (1 - f)) / k; S.oy += (S.vy * (1 - f)) / k;
      S.vx *= f; S.vy *= f;
      if (Math.hypot(S.vx, S.vy) < V_STOP) { S.vx = 0; S.vy = 0; }
    }
    if (wheel.x || wheel.y) {
      const f = 1 - Math.exp(-WHEEL_K * dt);
      let ax = wheel.x * f, ay = wheel.y * f;
      if (Math.abs(wheel.x - ax) < 0.5 && Math.abs(wheel.y - ay) < 0.5) { ax = wheel.x; ay = wheel.y; }
      S.ox -= ax; S.oy -= ay; wheel.x -= ax; wheel.y -= ay;
    }
    const busy = moving() || !!drag;
    render(S.ox, S.oy, !busy);
    if (!busy) { settle(); sleep(); }
  }
  // Stop where it is: a press or a wheel ends a coast or a glide in place.
  function halt({ keepWheel = false } = {}) {
    glide = null; S.vx = S.vy = 0;
    if (!keepWheel) { wheel.x = 0; wheel.y = 0; }
  }
  function glideTo(tx, ty) {
    S.vx = S.vy = 0; wheel.x = wheel.y = 0;
    if (tier !== 'full') { glide = null; S.ox = tx; S.oy = ty; render(S.ox, S.oy, true); settle(); return; }
    glide = { fx: S.ox, fy: S.oy, tx, ty, t: 0 };
    wake();
  }
  // Centre tile i the short way round (Home, End, and a click in the demo).
  function centre(i) {
    const b = base();
    const [x, y] = place(i, b.x, b.y);
    glideTo(b.x - (x - G.x0), b.y - (y - G.y0));
  }

  // Drag: direct manipulation in every live tier; the release coasts only in the full tier.
  on(ctx, stage, 'pointerdown', (e) => {
    if (drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    pressing = true; suppressClick = false;
    halt();
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, ox: S.ox, oy: S.oy, moved: false, samples: [[e.timeStamp, e.clientX, e.clientY]] };
  });
  on(ctx, stage, 'pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.samples.push([e.timeStamp, e.clientX, e.clientY]);
    while (drag.samples.length > 2 && drag.samples[0][0] < e.timeStamp - VELOCITY_WINDOW) drag.samples.shift();
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      // Capture only once it is a drag, so a plain click still lands on the link under the pointer.
      drag.moved = true;
      stage.setPointerCapture(e.pointerId);
      root.classList.add('is-dragging');
    }
    S.ox = drag.ox + dx; S.oy = drag.oy + dy;
    wake();
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null; pressing = false;
    root.classList.remove('is-dragging');
    if (!d.moved) return;
    suppressClick = true;
    // Velocity from the last 100 ms of samples; a pointer that rested before letting go throws nothing.
    const now = e.timeStamp;
    const recent = d.samples.filter(([t]) => t >= now - VELOCITY_WINDOW);
    const [t0, x0, y0] = recent[0] ?? d.samples.at(-1);
    const [t1, x1, y1] = recent.at(-1) ?? d.samples.at(-1);
    let vx = 0, vy = 0;
    if (e.type === 'pointerup' && t1 > t0 && now - t1 < REST_GAP) { vx = ((x1 - x0) / (t1 - t0)) * 1000; vy = ((y1 - y0) / (t1 - t0)) * 1000; }
    const speed = Math.hypot(vx, vy);
    if (speed > V_MAX) { vx *= V_MAX / speed; vy *= V_MAX / speed; }
    if (tier === 'full' && Math.hypot(vx, vy) >= V_STOP) { S.vx = vx; S.vy = vy; }
    wake();
  };
  on(ctx, stage, 'pointerup', endDrag);
  on(ctx, stage, 'pointercancel', endDrag);
  // A drag that ends over a link never follows it. A plain click centres the project here; a site would open it.
  on(ctx, stage, 'click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    e.preventDefault();
    if (suppressClick) { e.stopPropagation(); suppressClick = false; return; }
    centre(links.indexOf(a));
  }, { capture: true });
  on(ctx, stage, 'dragstart', (e) => e.preventDefault());

  // Wheel in both axes (Shift turns a vertical wheel sideways). Ctrl + wheel stays the browser's zoom. Until the
  // stage sits wholly in the window a vertical wheel scrolls the page instead, so the plane never traps a reader.
  on(ctx, stage, 'wheel', (e) => {
    if (e.ctrlKey) return;
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? G.h : 1;
    let dx = e.deltaX * unit, dy = e.deltaY * unit;
    if (e.shiftKey && !dx) { dx = dy; dy = 0; }
    const r = stage.getBoundingClientRect();
    const framed = (r.top >= -1 && r.bottom <= innerHeight + 1) || (r.top <= 0 && r.bottom >= innerHeight);
    if (!framed && Math.abs(dy) >= Math.abs(dx)) return;
    e.preventDefault();
    halt({ keepWheel: true });
    if (tier === 'full') { wheel.x += dx; wheel.y += dy; } else { S.ox -= dx; S.oy -= dy; }
    wake();
  }, { passive: false });

  // Arrows move focus to the neighbouring tile and the plane by exactly one pitch (plus the stagger between columns),
  // so the neighbour lands where the focused tile was. Home and End centre the first and last project.
  on(ctx, stage, 'keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const i = links.indexOf(e.target);
    if (i < 0) return;
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      const j = e.key === 'Home' ? 0 : N - 1;
      if (j === 0) { const b = base(); glideTo(b.x - residue(b.x, G.sx), b.y - residue(b.y, G.sy)); } else centre(j);
      links[j].focus({ preventScroll: true });
      return;
    }
    const d = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const b = base();
    const c = i % COLS, r = (i - c) / COLS;
    const nc = mod(c + d[0], COLS), nr = mod(r + d[1], ROWS);
    const lift = ((nc % 2) - (c % 2)) * cfg.stagger * G.py;
    glideTo(b.x - d[0] * G.px, b.y - d[1] * G.py - lift);
    links[nr * COLS + nc].focus({ preventScroll: true });
  });

  // Focus brings the tile into the window: the browser scrolls the parked stage (never the page); the scroll is
  // taken back at once and becomes a glide of the plane by as much, plus the EDGE margin.
  function reveal(i, scrolled) {
    const b = base();
    const [tx, ty] = keepInside(i, b.x - (scrolled?.[0] ?? 0), b.y - (scrolled?.[1] ?? 0));
    if (Math.abs(tx - b.x) < 0.01 && Math.abs(ty - b.y) < 0.01) return;
    glideTo(tx, ty);
  }
  on(ctx, stage, 'focusin', (e) => {
    const i = links.indexOf(e.target);
    if (i < 0) return;
    const scrolled = takeScroll();
    if (pressing) return;   // a press focuses the link it lands on; the drag decides where the plane goes
    reveal(i, scrolled);
    if (glide) render(glide.tx, glide.ty);
  });
  on(ctx, stage, 'scroll', () => {
    const scrolled = takeScroll();   // find-in-page or scrollIntoView: move the plane by as much
    if (!scrolled || pressing) return;
    const b = base();
    glideTo(b.x - scrolled[0], b.y - scrolled[1]);
  }, { passive: true });

  const relayout = () => { measureChrome(); measure(); render(S.ox, S.oy, !moving()); settle(); };
  relayout();
  root.classList.add('is-ready');
  observeResize(ctx, [stage, items[0]], relayout);
  document.fonts?.ready.then(() => { if (!ctx.signal.aborted) relayout(); });

  return {
    update(next, changed) {
      cfg = { ...next };
      apply();
      if (changed.some((k) => k === 'gap' || k === 'size' || k === 'stagger')) relayout();
    },
  };
}

// Not lazy: tiles enter from any side mid-drag and must not pop in late; the small rendition keeps 24 cheap.
function imgTag(item) {
  return `<img src="${item.srcSm || item.src}" alt="" width="${item.smWidth || item.width || 1200}" height="${item.smHeight || item.height || 1500}" decoding="async" draggable="false" style="object-position:${item.focus || '50% 50%'}">`;
}
