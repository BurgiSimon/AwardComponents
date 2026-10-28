// Overprint index — Signal Festival's line-up as a sortable index with one marker for the whole list. The marker is
// a single aria-hidden bar inside the index's isolated stacking context, blended multiply between the rows' plates
// (z 1) and their words (z 3): the stage-coloured plate under it is overprinted while the marked act's words turn to
// the paper colour. It cuts to the row under the mouse, the row holding keyboard focus or, on touch screens, the row
// crossing a reading line, by writing that row's own offsetTop and offsetHeight; it is never transitioned, so every
// frame sits exactly on a row. Sorting re-appends the rows, says the order in a status line and steps them back in by
// hard sets. On the dark ground the bar blends with screen, multiply's inverse, so the night takes the ink.
// Reduced and static: the same cut, no blink, no stepped re-entry.
import './demo.css';
import { on, html, observeResize, content, formatPrice } from '../../src/demo-kit/index.js';
import { gsap, useGsap } from '../../src/demo-kit/gsap.js';

// Set times for the line-up in content.festival (content.js keeps names only). 12–14 August 2027 is Thursday to
// Saturday; every stage plays once a day in this selection.
const DAYS = [
  { short: 'Thu', long: 'Thursday', date: '12 Aug', full: '12 August' },
  { short: 'Fri', long: 'Friday', date: '13 Aug', full: '13 August' },
  { short: 'Sat', long: 'Saturday', date: '14 Aug', full: '14 August' },
];
const SETS = {
  'Nils & the Weather': { stage: 'Greenhouse', day: 0, time: '17:30', pattern: 'lines' },
  'Kiri Tanaka': { stage: 'The Crane', day: 0, time: '19:00', pattern: 'check' },
  'Black Pine': { stage: 'Hall 4', day: 0, time: '20:45', pattern: 'stripes' },
  'Marlow Ash': { stage: 'Harbour', day: 0, time: '22:15', pattern: 'dots' },
  'Hana Ekström': { stage: 'Greenhouse', day: 1, time: '16:30', pattern: 'half' },
  'Moss Theory': { stage: 'Hall 4', day: 1, time: '18:15', pattern: 'check' },
  'Juno Park': { stage: 'The Crane', day: 1, time: '20:00', pattern: 'disc' },
  'Odessa Rae': { stage: 'Harbour', day: 1, time: '22:30', pattern: 'stripes' },
  'Vesper Choir': { stage: 'Greenhouse', day: 2, time: '15:00', pattern: 'dots' },
  Sundial: { stage: 'Harbour', day: 2, time: '18:30', pattern: 'disc' },
  'Aurelio Cano': { stage: 'The Crane', day: 2, time: '20:15', pattern: 'half' },
  'The Low Tides': { stage: 'Hall 4', day: 2, time: '23:00', pattern: 'lines' },
};
// Each stage prints in one material; each act's plate is a small two-tone print in its stage's colour, its pattern
// chosen so neighbouring rows in the running order never repeat one.
const STAGE_TONE = { Harbour: 'sky', 'Hall 4': 'plum', 'The Crane': 'clay', Greenhouse: 'moss' };
const PATTERNS = ['dots', 'stripes', 'disc', 'half', 'lines', 'check'];
const CAPTURE_ACT = 'Marlow Ash';

const minutes = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const slug = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const READ = { day: 'day and time', stage: 'stage', name: 'artist' };
const KEYS = {
  day: (a) => a.day * 1440 + minutes(a.time),
  stage: (a) => a.stage,
  name: (a) => a.name,
};
const cmp = (x, y) => (typeof x === 'number' ? x - y : x.localeCompare(y, 'en'));

const SORT_START = 0.04;   // s before the first row steps back in after a sort (full tier)

// The blink as a registered effect, hard opacity steps (never a fade). Registered once per page.
if (!gsap.effects.blinkOnce) {
  gsap.registerEffect({
    name: 'blinkOnce',
    extendTimeline: true,
    effect: (targets) => gsap.timeline().set(targets, { opacity: 0 }, 0).set(targets, { opacity: 1, clearProps: 'opacity' }, 0.06),
  });
}

export default function mount(root, options, ctx) {
  const { festival } = content;
  const acts = festival.lineup.map((name, i) => ({ name, slug: slug(name), ...(SETS[name] || { stage: festival.stages[i % 4], day: i % 3, time: '20:00', pattern: PATTERNS[i % PATTERNS.length] }) }));
  const byName = new Map(acts.map((a) => [a.name, a]));
  const first = [...acts].sort((a, b) => KEYS.day(a) - KEYS.day(b));
  let cfg = { ...options };
  const full = ctx.motion === 'full';

  root.className = 'oi';
  root.innerHTML = html`
    <header class="ac-bar oi__bar">
      <a class="ac-brand" href="#top">${festival.name}<span class="oi__ed">2027</span></a>
      <nav aria-label="Festival"><a href="#line-up" aria-current="page">Line-up</a><a href="#programme">Programme</a><a href="#site-map">Site map</a><a href="#tickets">Tickets</a></nav>
    </header>
    <main>
      <section class="oi__intro ac-wrap" aria-labelledby="oi-title">
        <div class="oi__heading">
          <p class="ac-label">${festival.edition} · ${festival.place}</p>
          <h1 class="ac-display" id="oi-title">Line-up</h1>
        </div>
        <div class="oi__about">
          <p class="oi__dates">${festival.dates}</p>
          <p class="oi__lede">Four stages on the old shipyard over three days. Sort by day to plan the weekend, by stage to stay in one place, or by name to find someone.</p>
          <ul class="oi__legend" role="list" aria-label="Stage colours">
            ${festival.stages.map((s) => html`<li><span class="oi__swatch" style="--m: var(--${STAGE_TONE[s] || 'sand'})" aria-hidden="true"></span>${s}</li>`)}
          </ul>
        </div>
      </section>
      <section class="oi__index ac-wrap" aria-labelledby="oi-acts" data-index>
        <h2 class="sr-only" id="oi-acts">Acts</h2>
        <div class="oi__meta">
          <p class="ac-label">${acts.length} acts · ${festival.stages.length} stages · ${DAYS.length} days</p>
          <p class="ac-label oi__status" role="status" data-status>Sorted by day and time, Thursday first.</p>
        </div>
        <div class="oi__head" role="group" aria-label="Sort the line-up">
          <span class="oi__h oi__h--lead" aria-hidden="true">Sort</span>
          <button type="button" class="oi__h oi__h--name" data-sort="name" aria-pressed="false">Artist<span class="oi__dir" aria-hidden="true"></span></button>
          <button type="button" class="oi__h oi__h--stage" data-sort="stage" aria-pressed="false">Stage<span class="oi__dir" aria-hidden="true"></span></button>
          <button type="button" class="oi__h oi__h--day" data-sort="day" aria-pressed="true">Day<span class="oi__dir" aria-hidden="true">↓</span></button>
          <span class="oi__h oi__h--time" aria-hidden="true">Time</span>
        </div>
        <ol class="oi__list" role="list" data-list>
          ${first.map((a) => html`
            <li class="oi__row" data-act="${a.name}">
              <a class="oi__link" href="#${a.slug}">
                <span class="oi__plate" data-pattern="${a.pattern}" style="--m: var(--${STAGE_TONE[a.stage] || 'sand'})" aria-hidden="true"></span>
                <span class="oi__name">${a.name}</span>
                <span class="oi__stage"><span class="sr-only">, </span>${a.stage}</span>
                <span class="oi__day"><span class="sr-only">, ${DAYS[a.day].long} ${DAYS[a.day].full}</span><span aria-hidden="true">${DAYS[a.day].short} ${DAYS[a.day].date}</span></span>
                <span class="oi__time ac-num"><span class="sr-only">, </span>${a.time}</span>
                <span class="oi__go" aria-hidden="true">→</span>
              </a>
            </li>`)}
        </ol>
        <span class="oi__marker" aria-hidden="true" data-marker></span>
      </section>
      <section class="oi__tickets ac-wrap" aria-labelledby="oi-tickets">
        <div class="oi__tickets-head">
          <h2 class="ac-h2" id="oi-tickets">Tickets</h2>
          <p class="ac-small">Every pass covers all four stages. Wristbands are posted in July.</p>
        </div>
        <ul class="oi__passes" role="list">
          ${festival.tickets.map((t, i) => html`
            <li><a class="oi__pass" href="#tickets">
              <span class="oi__pass-name">${t.name}</span>
              <span class="oi__pass-note">${['Any one day, 14:00 to 02:00', 'Thursday to Saturday', 'Three nights on the island, showers included'][i] || ''}</span>
              <span class="oi__pass-price ac-num">${formatPrice(t.price)}</span>
            </a></li>`)}
        </ul>
      </section>
    </main>
    <footer class="oi__foot ac-wrap ac-small"><span>${festival.edition}</span><span>${festival.place}</span><span>Bus 9A and the harbour ferry stop at the gate</span></footer>`;
  root.querySelectorAll('a[href^="#"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const list = root.querySelector('[data-list]');
  const marker = root.querySelector('[data-marker]');
  const status = root.querySelector('[data-status]');
  const buttons = [...root.querySelectorAll('[data-sort]')];
  const rows = [...list.children];
  const { context } = useGsap(ctx, root);

  const apply = () => {
    root.dataset.ink = cfg.ink;
    root.dataset.overprint = cfg.overprint ? 'on' : 'off';
  };
  apply();

  // ---- The mark: one element, moved by the row's own offset, written only when the row changes.
  const state = { mode: null, key: 'day', dir: 1, writes: 0 };
  let active = null;
  const place = (row) => {
    marker.style.transform = `translate3d(0, ${row.offsetTop}px, 0)`;
    marker.style.height = `${row.offsetHeight}px`;
    state.writes++;
  };
  function mark(row, mode) {
    state.mode = mode;
    if (row === active) return;
    active?.removeAttribute('data-active');
    active = row;
    row.setAttribute('data-active', '');
    place(row);
    if (!marker.classList.contains('is-on')) {
      marker.classList.add('is-on');
      // The blink's first state is set at once: a mark made inside GSAP's tick (after a sort) would otherwise paint
      // one frame at full before the effect's first set renders on the next tick.
      if (full && cfg.blink && !ctx.capture) context.add(() => { gsap.set(marker, { opacity: 0 }); gsap.effects.blinkOnce(marker); });
    }
  }
  function unmark() {
    active?.removeAttribute('data-active');
    active = null;
    state.mode = null;
    marker.classList.remove('is-on');
  }
  const focusedRow = () => list.querySelector(':focus-visible')?.closest('.oi__row') || null;

  // Mouse: the row under the pointer; leaving the list hands the mark back to keyboard focus, or clears it.
  on(ctx, list, 'pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const row = e.target.closest('.oi__row');
    if (row) mark(row, 'pointer');
  });
  on(ctx, list, 'pointerleave', (e) => {
    if (e.pointerType !== 'mouse') return;
    const f = focusedRow();
    if (f) mark(f, 'focus'); else if (state.mode === 'pointer') unmark();
  });
  // Keyboard: focus marks its row; leaving the list clears a focus mark (the reading line takes over on touch).
  on(ctx, list, 'focusin', (e) => {
    const row = e.target.closest('.oi__row');
    if (row && e.target.matches(':focus-visible')) mark(row, 'focus');
  });
  on(ctx, list, 'focusout', (e) => {
    if (list.contains(e.relatedTarget)) return;
    if (state.mode === 'focus') unmark();
    requestAnimationFrame(readingLine);
  });

  // Touch screens have no hover, so the marker becomes a reading-line indicator: the row crossing cfg.line % of the
  // viewport height. Keyboard focus wins; the focus a tap leaves on a link (never :focus-visible) does not freeze it.
  const fine = matchMedia('(pointer: fine) and (hover: hover)');
  function readingLine() {
    if (ctx.signal.aborted) return;
    // A hybrid screen that switches to a mouse hands the mark back to the pointer instead of leaving it stuck.
    if (fine.matches) { if (state.mode === 'reading') unmark(); return; }
    if (focusedRow()) return;
    const y = innerHeight * (cfg.line / 100);
    const row = [...list.children].find((r) => { const b = r.getBoundingClientRect(); return b.top <= y && b.bottom > y; });
    if (row) mark(row, 'reading'); else if (state.mode === 'reading') unmark();
  }
  on(ctx, window, 'scroll', readingLine, { passive: true });
  on(ctx, window, 'resize', readingLine);
  on(ctx, fine, 'change', readingLine);

  // A layout change (fonts, a narrower window, a wrapped name, a status line that wraps) moves rows: re-measure.
  observeResize(ctx, [list, root.querySelector('[data-index]')], () => { if (active) place(active); });

  // ---- Sorting: re-order, keep focus on the button, say the order, step the rows back in.
  let sortTl = null;
  function sortBy(key) {
    state.dir = state.key === key ? -state.dir : 1;
    state.key = key;
    const sorted = [...rows].sort((a, b) => {
      const x = byName.get(a.dataset.act);
      const y = byName.get(b.dataset.act);
      return cmp(KEYS[key](x), KEYS[key](y)) * state.dir || KEYS.day(x) - KEYS.day(y) || x.name.localeCompare(y.name, 'en');
    });
    unmark();
    list.append(...sorted);
    buttons.forEach((b) => {
      const pressed = b.dataset.sort === key;
      b.setAttribute('aria-pressed', String(pressed));
      b.querySelector('.oi__dir').textContent = pressed ? (state.dir > 0 ? '↓' : '↑') : '';
    });
    const order = key === 'day' ? (state.dir > 0 ? 'Thursday first' : 'Saturday first') : state.dir > 0 ? 'A to Z' : 'Z to A';
    status.textContent = `Sorted by ${READ[key]}, ${order}.`;
    sortTl?.kill();
    sortTl = null;
    if (full) {
      // On touch the reading line re-reads once every row is back, so the bar never lights a row still hidden.
      context.add(() => {
        sortTl = gsap.timeline({ onComplete: () => { sortTl = null; readingLine(); } });
        sortTl.set(sorted, { opacity: 0 }, 0);
        sorted.forEach((r, i) => sortTl.set(r, { opacity: 1, clearProps: 'opacity' }, SORT_START + i * cfg.step));
      });
    } else {
      gsap.set(sorted, { clearProps: 'opacity' });
      readingLine();
    }
  }
  buttons.forEach((b) => on(ctx, b, 'click', () => sortBy(b.dataset.sort)));

  // The thumbnail holds one marked act in the middle of the first screen instead of relying on pointer timing.
  if (ctx.capture) {
    const row = rows.find((r) => r.dataset.act === CAPTURE_ACT) || rows[3];
    if (row) mark(row, 'pointer');
  }
  readingLine();

  return {
    update(next, changed) {
      cfg = { ...next };
      apply();
      if (changed.includes('line')) readingLine();
    },
    action(id) {
      if (id === 'sort-day') sortBy('day');
      if (id === 'sort-stage') sortBy('stage');
      if (id === 'sort-name') sortBy('name');
    },
  };
}
