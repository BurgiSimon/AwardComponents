// Idle settle snap — a Halden case study opening on a full-height cover. When a wheel scroll comes to rest partway
// through the cover, the page waits for `quiet` ms (counted in ticker time) and eases to the nearer end through
// lenis.scrollTo, never locked. Only a wheel arms it (Lenis virtual-scroll); native scrolls disarm it; a pressed
// pointer holds it and stops a settle in place; a guard (duration + 0.2 s) stops it re-arming on its own motion.
// Off for coarse pointers and under reduced motion (no Lenis there: native scrolling).
import './demo.css';
import { on, onFrame, clamp, html, raw, photos, imageHTML, content } from '../../src/demo-kit/index.js';
import { useLenis } from '../../src/demo-kit/lenis.js';

const easeOutCubic = (t) => 1 - (1 - t) ** 3;
const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar']);

export default function mount(root, options, ctx) {
  const { studio } = content;
  const project = studio.projects[1];
  const next = studio.projects[2];
  const [cover, a, b] = photos({ tags: ['architecture'], count: 3, seed: 'ss-tern' });
  let cfg = { ...options };

  root.className = 'ss';
  root.innerHTML = html`
    <section class="ss__cover" data-zone aria-labelledby="ss-title">
      <span class="ac-media ss__photo">${raw(imageHTML(cover, { sizes: '100vw', alt: `${project.title}, ${project.place}`, eager: true }))}</span>
      <span class="ss__veil" aria-hidden="true"></span>
      <header class="ss__bar ac-wrap">
        <a class="ac-brand" href="#top">${studio.name}</a>
        <nav aria-label="Studio">${studio.nav.map((n) => html`<a href="#top">${n}</a>`)}</nav>
      </header>
      <div class="ss__copy ac-wrap">
        <p class="ac-label">Project 02 of 08 · ${project.discipline}</p>
        <h1 class="ac-display" id="ss-title">${project.title}</h1>
        <div class="ss__meta">
          <p class="ss__summary">${project.summary}</p>
          <dl class="ss__facts">
            <div><dt class="ac-label">Place</dt><dd>${project.place}</dd></div>
            <div><dt class="ac-label">Completed</dt><dd>${project.year}</dd></div>
            <div><dt class="ac-label">Area</dt><dd>${project.size}</dd></div>
          </dl>
        </div>
      </div>
    </section>

    <section class="ss__story ac-wrap" id="story" aria-labelledby="ss-story">
      <p class="ac-label">The brief</p>
      <h2 class="ac-h1" id="ss-story">A reading room for a city that is dark for two months of the year.</h2>
      <div class="ss__cols">
        <p class="ac-body">Tromsø asked for a library that would be used in the polar night as much as in the midnight sun. The answer is one long room on the waterfront, under a roof that steps down toward the sound, with a single window forty-two metres long.</p>
        <p class="ac-body">In December the window is a lit band seen from the ferries; in June it frames the light that never quite leaves. Between the two, 2,400 square metres of reading tables, a children’s floor and a stage for the winter lecture series.</p>
      </div>
      <div class="ss__pair">
        <figure><span class="ac-media">${raw(imageHTML(a, { sizes: '50vw', alt: 'The long window from the reading room' }))}</span><figcaption class="ac-small">The window, forty-two metres from end to end.</figcaption></figure>
        <figure><span class="ac-media">${raw(imageHTML(b, { sizes: '50vw', alt: 'The stepped roof from the water' }))}</span><figcaption class="ac-small">The roof steps down toward the sound.</figcaption></figure>
      </div>
      <a class="ss__next" href="#top"><span class="ac-label">Next project</span><strong>${next.title}</strong><span class="ac-small">${next.place} · ${next.year}</span></a>
    </section>
    <div class="ss__gauge" aria-hidden="true" data-gauge>
      <span class="ss__rail"><span class="ss__mid"></span><span class="ss__dead ss__dead--top"></span><span class="ss__dead ss__dead--end"></span><span class="ss__dot" data-dot></span></span>
      <span class="ss__marks ac-label"><span>Cover</span><span>½</span><span>Story</span></span>
      <span class="ss__status ac-label" data-status>000 · idle</span>
    </div>`;
  root.querySelectorAll('a[href^="#"]').forEach((el) => on(ctx, el, 'click', (e) => e.preventDefault()));

  const zone = root.querySelector('[data-zone]');
  const gauge = root.querySelector('[data-gauge]');
  const dot = root.querySelector('[data-dot]');
  const status = root.querySelector('[data-status]');
  const fine = matchMedia('(pointer: fine)').matches;
  const lenis = useLenis(ctx);
  const enabled = !!lenis && fine;
  const S = { armed: false, held: false, snapping: false, quiet: 0, guard: 0, lastY: scrollY };

  const apply = () => {
    root.classList.toggle('ss--gauge', cfg.gauge);
    root.style.setProperty('--dead', `${cfg.dead}%`);
  };
  apply();

  // The readout: where the rest sits inside the cover, and what the settle is doing.
  const draw = () => {
    const p = clamp(scrollY / zone.offsetHeight, 0, 1);
    dot.style.transform = `translate3d(-50%, ${(p * 100).toFixed(2)}cqh, 0)`;
    const word = !enabled ? (fine ? 'off · reduced' : 'off · touch') : S.held ? 'held' : S.snapping ? 'settling' : S.armed ? 'armed' : 'idle';
    status.textContent = `${String(Math.round(p * 100)).padStart(3, '0')} · ${word}`;
    gauge.classList.toggle('is-past', scrollY > zone.offsetHeight * 1.08);
  };

  const settle = (y) => {
    S.armed = false;
    const span = zone.offsetHeight;
    const p = y / span;
    const dead = cfg.dead / 100;
    if (p <= dead || p >= 1 - dead) return; // outside the cover, or close enough to an end: leave it
    const to = p < 0.5 ? 0 : span;
    S.snapping = true;
    S.guard = (cfg.duration + 0.2) * 1000;
    lenis.scrollTo(to, { duration: cfg.duration, easing: easeOutCubic, onComplete: () => { S.snapping = false; draw(); } });
  };

  // The clock runs only while something is pending: armed, settling or guarded. Quiet and guard add up ticker dt,
  // which is clamped to 100 ms, so a stalled frame never passes for a pause.
  let stop = null;
  const frame = (dt) => {
    const y = scrollY;
    const ms = dt * 1000;
    if (Math.abs(y - S.lastY) > 0.5) { S.quiet = 0; S.lastY = y; } else S.quiet += ms;
    S.guard = Math.max(0, S.guard - ms);
    if (S.armed && !S.held && !S.snapping && !S.guard && S.quiet >= cfg.quiet) settle(y);
    draw();
    if (!S.armed && !S.snapping && !S.guard) { stop?.(); stop = null; }
  };
  const wake = () => { if (!stop) stop = onFrame(ctx, frame); };

  if (enabled) {
    lenis.on('virtual-scroll', ({ event }) => {
      S.quiet = 0;
      S.snapping = false; // a wheel during a settle takes over; Lenis retargets from where the tween is
      S.armed = event.type === 'wheel' && !event.ctrlKey; // touch never arms it
      wake();
    });
    lenis.on('scroll', () => { if (lenis.isScrolling === 'native') S.armed = false; });
    on(ctx, window, 'keydown', (e) => { if (SCROLL_KEYS.has(e.key)) S.armed = false; });
    on(ctx, window, 'pointerdown', () => {
      S.held = true;
      if (S.snapping) { lenis.reset(); S.snapping = false; }
      draw();
    });
    const release = () => { S.held = false; S.quiet = 0; draw(); };
    on(ctx, window, 'pointerup', release);
    on(ctx, window, 'pointercancel', release);
  }
  on(ctx, window, 'scroll', draw, { passive: true });
  on(ctx, window, 'resize', draw);
  draw();

  return {
    update(next) {
      cfg = { ...next };
      apply();
      draw();
    },
  };
}
