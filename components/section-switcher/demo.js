// Section switcher — Halden's selected work as a full-screen deck of pictures and project names; the document never
// scrolls. GSAP Observer sums
// wheel deltas (deltaMode normalised) into a visible ring that commits one step at `threshold`, then swallows the
// wheel for `lock` ms; an idle second drains it and reversing starts a fresh sum. Swipe (> 55 px on release), arrow
// and Page keys, Home/End and Prev/Next step the same index; each change is announced once.
// Reduced/static: every input still steps, panels swap in place and the ring jumps.
import './demo.css';
import { Observer } from 'gsap/Observer';
import { on, html, raw, photos, imageHTML, content } from '../../src/demo-kit/index.js';
import { gsap, useGsap } from '../../src/demo-kit/gsap.js';

gsap.registerPlugin(Observer);

const IDLE = 1;
const SWIPE = 55;
const DUR = 0.9;
const TAGS = ['architecture', 'architecture', 'water', 'interior', 'city'];
const pad = (n) => String(n).padStart(2, '0');

export default function mount(root, options, ctx) {
  const { studio } = content;
  const projects = studio.projects.slice(0, 5);
  const pics = projects.map((p, i) => photos({ tags: [TAGS[i]], count: 1, seed: `sw-${p.slug}` })[0]);
  const N = projects.length;
  let cfg = { ...options };

  root.className = 'sw';
  root.innerHTML = html`
    <main class="sw__stage" data-stage aria-label="${studio.name} selected work">
      ${projects.map((p, i) => html`
        <section class="sw__panel" aria-labelledby="sw-t${i}" data-panel>
          <span class="ac-media sw__photo">${raw(imageHTML(pics[i], { sizes: '100vw', alt: '', eager: i < 2 }))}</span>
          <span class="sw__veil" aria-hidden="true"></span>
          <h2 class="ac-display sw__name" id="sw-t${i}" data-rise>${p.title}</h2>
        </section>`)}
    </main>
    <nav class="sw__controls" aria-label="Projects deck">
      <div class="sw__keys">
        <button type="button" class="sw__key" data-prev aria-label="Previous project"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M8 12.5V3.5M4 7.5l4-4 4 4"/></svg></button>
        <button type="button" class="sw__key" data-next aria-label="Next project"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M8 3.5v9M4 8.5l4 4 4-4"/></svg></button>
      </div>
      <div class="sw__ring" role="progressbar" aria-label="Wheel toward the next project" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" data-ring>
        <svg viewBox="0 0 40 40" aria-hidden="true"><circle class="sw__track" cx="20" cy="20" r="17" pathLength="1"/><circle class="sw__arc" cx="20" cy="20" r="17" pathLength="1" data-arc/></svg>
        <span class="ac-label"><span class="sw__fine">Scroll to commit · ↑ ↓ keys</span><span class="sw__touch">Swipe or tap the arrows</span></span>
      </div>
      <p class="ac-label sw__count" aria-hidden="true" data-count>01 / 05</p>
    </nav>
    <p class="sr-only" aria-live="polite" data-live></p>`;

  const html_ = document.documentElement;
  const stage = root.querySelector('[data-stage]');
  const panels = [...root.querySelectorAll('[data-panel]')];
  const prevBtn = root.querySelector('[data-prev]');
  const nextBtn = root.querySelector('[data-next]');
  const ring = root.querySelector('[data-ring]');
  const arc = root.querySelector('[data-arc]');
  const count = root.querySelector('[data-count]');
  const live = root.querySelector('[data-live]');
  const full = ctx.motion === 'full';
  const { context } = useGsap(ctx, root);

  let index = 0;
  let acc = 0;
  let accDir = 0;
  let lockUntil = 0;
  let tl = null;

  // Deck mode: the document stops scrolling; only the active panel is visible and reachable.
  html_.style.overflow = 'hidden';
  ctx.onCleanup(() => { html_.style.overflow = ''; });
  root.classList.add('is-deck');
  panels.forEach((p, i) => { p.classList.toggle('is-active', i === 0); p.inert = i !== 0; });

  const apply = () => {
    root.classList.toggle('sw--no-ring', !cfg.ring);
  };
  apply();

  const paintRing = (f, dur) => {
    ring.setAttribute('aria-valuenow', String(Math.round(f * 100)));
    ring.setAttribute('aria-label', accDir < 0 ? 'Wheel toward the previous project' : 'Wheel toward the next project');
    // pathLength 1: the whole ring lives between 0 and 1 px of offset, so autoRound must be off.
    if (full) gsap.to(arc, { strokeDashoffset: 1 - f, duration: dur, ease: 'power2.out', overwrite: true, autoRound: false });
    else { gsap.killTweensOf(arc); gsap.set(arc, { strokeDashoffset: 1 - f, autoRound: false }); }
  };

  const sync = (announce = true) => {
    count.textContent = `${pad(index + 1)} / ${pad(N)}`;
    if (announce) live.textContent = `Project ${index + 1} of ${N}: ${projects[index].title}`;
    prevBtn.setAttribute('aria-disabled', String(index === 0)); // aria-disabled, not disabled: focus stays put
    nextBtn.setAttribute('aria-disabled', String(index === N - 1));
  };

  const goTo = (to) => {
    to = Math.max(0, Math.min(N - 1, to));
    if (to === index) return false;
    tl?.progress(1).kill(); // a new request settles any running travel first
    const from = index;
    const dir = Math.sign(to - from);
    index = to;
    panels.forEach((p, i) => { p.inert = i !== to; });
    sync();
    const rise = panels[to].querySelectorAll('[data-rise]');
    if (!full) {
      panels[from].classList.remove('is-active', 'is-leaving');
      panels[to].classList.add('is-active');
      return true;
    }
    panels[from].classList.replace('is-active', 'is-leaving');
    panels[to].classList.add('is-active');
    const photo = panels[to].querySelector('.sw__photo');
    context.add(() => {
      tl = gsap.timeline({
        onComplete() {
          panels[from].classList.remove('is-leaving');
          gsap.set([panels[from], panels[to], photo], { clearProps: 'transform,opacity' });
          tl = null;
        },
      });
      if (cfg.transition === 'fade') {
        tl.fromTo(panels[to], { opacity: 0 }, { opacity: 1, duration: DUR * 0.8, ease: 'power2.inOut' }, 0)
          .fromTo(photo, { scale: 1.06 }, { scale: 1, duration: DUR * 1.4, ease: 'expo.out' }, 0);
      } else {
        tl.fromTo(panels[to], { yPercent: 100 * dir }, { yPercent: 0, duration: DUR, ease: 'expo.inOut' }, 0)
          .fromTo(panels[from], { yPercent: 0 }, { yPercent: -30 * dir, duration: DUR, ease: 'expo.inOut' }, 0);
      }
      tl.fromTo(rise, { y: 42 * dir, opacity: 0 }, { y: 0, opacity: 1, duration: 0.72, ease: 'power3.out', stagger: 0.065 }, 0.45);
    });
    return true;
  };

  // Wheel: Observer sums one frame's deltas; frames add up toward the threshold.
  const wheel = Observer.create({
    target: window,
    type: 'wheel',
    preventDefault: true,
    onStopDelay: IDLE,
    onChangeY(self) {
      if (performance.now() < lockUntil) { acc = 0; return; }
      const dir = Math.sign(self.deltaY);
      if (!dir) return;
      if (dir !== accDir) { acc = 0; accDir = dir; } // reversing starts a fresh sum the other way
      if (index + dir < 0 || index + dir >= N) { acc = 0; paintRing(0, 0.2); return; } // the blocked end never fills
      acc += Math.abs(self.deltaY);
      if (acc < cfg.threshold) { paintRing(acc / cfg.threshold, 0.2); return; }
      acc = 0;
      lockUntil = performance.now() + cfg.lock;
      paintRing(1, 0.12);
      gsap.delayedCall(0.25, () => { if (!acc) paintRing(0, 0.4); });
      goTo(index + dir);
    },
    onStop() { if (acc) { acc = 0; paintRing(0, 0.4); } }, // idle rollback
  });
  // Swipe: one step per release past 55 px; a finger moving up means next.
  const swipe = Observer.create({
    target: stage,
    type: 'touch',
    onRelease(self) {
      const dy = self.y - self.startY;
      if (Math.abs(dy) > SWIPE) goTo(index + (dy < 0 ? 1 : -1));
    },
  });
  ctx.onCleanup(() => { wheel.kill(); swipe.kill(); });

  on(ctx, window, 'keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const onPage = e.target === document.body || e.target === html_;
    const map = { ArrowDown: 1, ArrowRight: 1, PageDown: 1, ArrowUp: -1, ArrowLeft: -1, PageUp: -1 };
    let to = null;
    if (e.key in map) to = index + map[e.key];
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = N - 1;
    else if (e.key === ' ' && onPage) to = index + (e.shiftKey ? -1 : 1); // Space belongs to a focused button
    if (to === null) return;
    e.preventDefault();
    goTo(to);
  });
  on(ctx, prevBtn, 'click', () => goTo(index - 1));
  on(ctx, nextBtn, 'click', () => goTo(index + 1));

  sync(false); // announce changes, not the first panel on load
  if (ctx.capture && cfg.ring) gsap.set(arc, { strokeDashoffset: 0.38, autoRound: false }); // the thumbnail shows a gesture under way

  return {
    update(next) {
      cfg = { ...next };
      apply();
    },
  };
}
