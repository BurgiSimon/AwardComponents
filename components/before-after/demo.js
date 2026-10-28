// Before / after — Fieldnote's photo desk: the Issue 14 cover's raw scan against its final grade. Two aligned
// copies of one photograph; the graded copy is clipped with clip-path: inset() at --split. The handle is a real
// slider (arrows 5 %, Shift 20 %, Home/End, Space peeks); a drag captures the pointer and always lets go; holding
// anywhere else on the picture peeks at the other side in full until release. The before side is CSS filters.
// Reduced/static: the divider jumps straight to its value instead of gliding.
import './demo.css';
import '../../src/demo-kit/serif.css';
import { on, later, html, raw, photos, imageHTML, content } from '../../src/demo-kit/index.js';

// What the before side is called, and the notes on the grade that turned it into the cover.
const BEFORE = {
  raw: { label: 'Raw scan', short: 'raw scan' },
  contact: { label: 'Contact print', short: 'contact print' },
  faded: { label: 'Faded print', short: 'faded print' },
};
const NOTES = [
  ['Film', 'Portra 400, scanned flat at 4,000 dpi'],
  ['White balance', '5,600 K → 5,150 K'],
  ['Exposure', '+0.3 EV, shadows lifted'],
  ['Contrast', '+18, a soft S curve'],
  ['Colour', 'Sky held, greens pulled toward moss'],
  ['Retouch', 'Two dust spots, nothing moved'],
];

export default function mount(root, options, ctx) {
  const { magazine, people } = content;
  let cfg = { ...options };
  const pick = [['landscape', 'sky'], ['landscape'], ['water'], ['nature']].map((tags) => photos({ tags, count: 1, seed: 'ba-cover' })[0]);
  const pic = pick.find((p) => !p.drawn) || pick[0];
  const alt = pic.drawn ? '' : pic.alt;

  root.className = 'ba';
  root.innerHTML = html`
    <header class="ac-bar ba__bar">
      <a class="ac-brand ba__brand" href="#top">${magazine.name}</a>
      <nav aria-label="Magazine"><a href="#top">Issues</a><a href="#top">Stories</a><a href="#top" aria-current="page">Photo desk</a><a href="#top">Shop</a></nav>
    </header>
    <main class="ba__page ac-wrap">
      <figure class="ba__fig">
        <div class="ba__compare" data-compare>
          <div class="ba__layer ba__before" data-before>${raw(imageHTML(pic, { sizes: '(min-width: 900px) 62vw, 100vw', eager: true, alt: alt && `${alt} (before the grade)` }))}</div>
          <div class="ba__layer ba__after" data-after>${raw(imageHTML(pic, { sizes: '(min-width: 900px) 62vw, 100vw', eager: true, alt: alt && `${alt} (final grade)` }))}</div>
          <span class="ba__tag ba__tag--a" aria-hidden="true" data-tag-a></span>
          <span class="ba__tag ba__tag--b" aria-hidden="true">Final grade</span>
          <div class="ba__handle" role="slider" tabindex="0" aria-label="Grade divider" aria-valuemin="0" aria-valuemax="100" data-handle>
            <span class="ba__grip" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M9.5 7 5 12l4.5 5M14.5 7l4.5 5-4.5 5"/></svg>
            </span>
          </div>
          <p class="ba__hint ac-label" aria-hidden="true"><span>Drag</span> or hold</p>
        </div>
        <figcaption class="ac-small">Cover, ${magazine.issue}. Photograph by ${people[3].name}; grade by ${people[2].name.split(' ')[0]} at the photo desk.</figcaption>
      </figure>

      <section class="ba__notes" aria-labelledby="ba-title">
        <p class="ac-label">Photo desk · ${magazine.issue}</p>
        <h1 class="ba__title" id="ba-title">How the cover was graded</h1>
        <p class="ac-body">The scan that came back from the lab was flat on purpose. Six small moves later it was the cover: compare them on the picture itself.</p>
        <dl class="ba__dl">${NOTES.map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}</dl>
        <p class="ba__keys ac-small"><span class="ac-kbd">←</span><span class="ac-kbd">→</span> move the divider · hold <span class="ac-kbd">Space</span> to see the other side</p>
      </section>
    </main>`;
  root.querySelectorAll('a[href="#top"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const box = root.querySelector('[data-compare]');
  const handle = root.querySelector('[data-handle]');
  const tagA = root.querySelector('[data-tag-a]');
  const keys = root.querySelector('.ba__keys');
  const state = { split: cfg.start, dragging: false, holding: false, rest: cfg.start };
  const vertical = () => cfg.orientation === 'vertical';

  const setSplit = (v, { announce = true } = {}) => {
    state.split = Math.max(0, Math.min(100, v));
    box.style.setProperty('--split', `${state.split}%`);
    // Each corner label steps back as the divider covers its side.
    box.style.setProperty('--tag-a', String(Math.min(1, state.split / 14)));
    box.style.setProperty('--tag-b', String(Math.min(1, (100 - state.split) / 14)));
    if (announce) {
      const v2 = Math.round(state.split);
      handle.setAttribute('aria-valuenow', String(v2));
      handle.setAttribute('aria-valuetext', `${BEFORE[cfg.before].label} ${v2} %, final grade ${100 - v2} %`);
    }
  };
  const pct = (e) => {
    const r = box.getBoundingClientRect();
    return vertical() ? ((e.clientY - r.top) / r.height) * 100 : ((e.clientX - r.left) / r.width) * 100;
  };

  // Drag: pointer capture on the handle; moves read on the window so the gesture survives the handle sliding away.
  on(ctx, handle, 'pointerdown', (e) => {
    e.preventDefault();
    try { handle.setPointerCapture(e.pointerId); } catch { /* capture can fail on synthetic events */ }
    state.dragging = true;
    box.classList.add('is-dragging', 'is-used');
    setSplit(pct(e));
  });
  on(ctx, window, 'pointermove', (e) => { if (state.dragging) setSplit(pct(e)); });
  const release = () => { if (!state.dragging) return; state.dragging = false; box.classList.remove('is-dragging'); };
  on(ctx, window, 'pointerup', release);
  on(ctx, window, 'pointercancel', release);
  on(ctx, window, 'blur', release);
  on(ctx, handle, 'lostpointercapture', release);

  // Hold: press anywhere on the picture to see the other side whole; release goes back to where it rested.
  const peek = () => { state.holding = true; state.rest = state.split; box.classList.add('is-holding', 'is-used'); setSplit(state.split > 50 ? 0 : 100, { announce: false }); };
  const endHold = () => { if (!state.holding) return; state.holding = false; box.classList.remove('is-holding'); setSplit(state.rest); };
  on(ctx, box, 'pointerdown', (e) => { if (!e.target.closest('[data-handle]') && e.button === 0) peek(); });
  on(ctx, box, 'pointerup', endHold);
  on(ctx, box, 'pointercancel', endHold);
  on(ctx, box, 'pointerleave', endHold);
  on(ctx, box, 'contextmenu', (e) => e.preventDefault());

  // Keyboard: arrows step 5, Shift+arrows 20, Home/End to the ends, Space peeks while held.
  on(ctx, handle, 'keydown', (e) => {
    const step = e.shiftKey ? 20 : 5;
    // Side by side: right and up grow the before side; top and bottom: the keys follow the divider on screen.
    const map = vertical() ? { ArrowUp: -step, ArrowDown: step, ArrowLeft: -step, ArrowRight: step } : { ArrowLeft: -step, ArrowRight: step, ArrowDown: -step, ArrowUp: step };
    if (e.key in map) { e.preventDefault(); box.classList.add('is-used'); setSplit(state.split + map[e.key]); }
    else if (e.key === 'Home') { e.preventDefault(); setSplit(0); }
    else if (e.key === 'End') { e.preventDefault(); setSplit(100); }
    else if (e.key === ' ') { e.preventDefault(); if (!state.holding) peek(); }
  });
  on(ctx, handle, 'keyup', (e) => { if (e.key === ' ') endHold(); });
  on(ctx, handle, 'blur', endHold);

  const apply = () => {
    root.dataset.orientation = cfg.orientation;
    root.dataset.grip = cfg.handle;
    root.dataset.before = cfg.before;
    handle.setAttribute('aria-orientation', cfg.orientation);
    tagA.textContent = BEFORE[cfg.before].label;
    keys.innerHTML = vertical()
      ? '<span class="ac-kbd">↑</span><span class="ac-kbd">↓</span> move the divider · hold <span class="ac-kbd">Space</span> to see the other side'
      : '<span class="ac-kbd">←</span><span class="ac-kbd">→</span> move the divider · hold <span class="ac-kbd">Space</span> to see the other side';
  };
  apply();
  setSplit(state.split);
  // The glide is only for full motion, and only after the first paint (no slide in from 0 on load).
  if (ctx.motion === 'full') requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add('is-ready')));

  return {
    update(next, changed) {
      cfg = { ...next };
      apply();
      if (changed.includes('start')) setSplit(cfg.start);
      else setSplit(state.split);
    },
    action(id) {
      if (id !== 'peek') return;
      peek();
      later(ctx, endHold, 1100);
    },
  };
}
