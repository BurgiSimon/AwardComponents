// Horizontal rail — an architecture studio's selected work. A sticky stage whose track moves sideways as the page
// scrolls: the rail is the track's overflow plus one viewport tall, so vertical travel equals horizontal travel and
// the scrollbar stays honest. Arrow buttons, arrow keys on the focused rail and tabbing to a card all move the page
// scroll, which drives the track. Touch and reduced motion: a native horizontal scroller with snap points.
import './demo.css';
import { on, html, raw, clamp, photos, imageHTML, content } from '../../src/demo-kit/index.js';
import { useGsap } from '../../src/demo-kit/gsap.js';
import { useLenis } from '../../src/demo-kit/lenis.js';

const ARROW = (d) => raw(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d === 'prev' ? 'M15 5 8 12l7 7' : 'm9 5 7 7-7 7'}"/></svg>`);

export default function mount(root, options, ctx) {
  const { studio } = content;
  const projects = studio.projects;
  const shots = projects.map((p, i) => photos({ tags: p.tags, count: 1, seed: `hr-${p.slug}-${i}` })[0]);
  const n = projects.length;
  const pad = (i) => String(i).padStart(2, '0');
  let cfg = { ...options };

  root.className = 'hr';
  root.innerHTML = html`
    <header class="ac-bar hr__bar">
      <a class="ac-brand" href="#top">${studio.name}</a>
      <nav aria-label="Studio">${studio.nav.map((x, i) => html`<a href="#top" ${i === 0 ? raw('aria-current="page"') : ''}>${x}</a>`)}</nav>
    </header>

    <section class="hr__rail" data-rail tabindex="0" aria-labelledby="hr-title" aria-describedby="hr-keys">
      <div class="hr__stage" data-stage>
        <div class="hr__head">
          <div class="hr__titles">
            <p class="ac-label">Selected work · 2022–2026</p>
            <h2 class="ac-h1" id="hr-title">Eight buildings on one coast.</h2>
            <p class="sr-only" id="hr-keys">Use the left and right arrow keys to move one project.</p>
          </div>
          <div class="hr__nav">
            <p class="hr__count ac-num" aria-hidden="true"><b data-count>01</b><span> / ${pad(n)}</span></p>
            <button class="hr__arrow" type="button" data-step="-1" aria-label="Previous project">${ARROW('prev')}</button>
            <button class="hr__arrow" type="button" data-step="1" aria-label="Next project">${ARROW('next')}</button>
          </div>
        </div>
        <div class="hr__viewport" data-viewport>
          <ul class="hr__track" role="list" data-track>
            ${projects.map((p, i) => html`
              <li class="hr__card">
                <a href="#top" class="hr__link">
                  <span class="ac-media hr__media">${raw(imageHTML(shots[i], { sizes: '(max-width: 700px) 78vw, 30vw', alt: '' }))}<span class="hr__no ac-label">${pad(i + 1)}</span></span>
                  <span class="hr__cap">
                    <strong class="hr__name">${p.title}</strong>
                    <span class="hr__meta">${p.discipline} · ${p.place} · ${p.year}</span>
                  </span>
                </a>
              </li>`)}
          </ul>
        </div>
        <div class="hr__progress" aria-hidden="true">
          <span class="hr__line"><span data-fill></span></span>
          <span class="hr__ticks">${projects.map(() => raw('<span></span>'))}</span>
          <span class="hr__big ac-num"><b data-big>01</b> / ${pad(n)}</span>
        </div>
      </div>
    </section>

    <section class="hr__after ac-wrap" aria-labelledby="hr-after">
      <p class="ac-label">The studio</p>
      <h2 class="ac-h2" id="hr-after">Eleven people above a boatyard in ${studio.city}, drawing buildings that are cheap to heat and easy to mend.</h2>
      <a class="ac-link" href="#top">Read about the studio</a>
    </section>`;
  root.querySelectorAll('a[href="#top"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const rail = root.querySelector('[data-rail]');
  const stage = root.querySelector('[data-stage]');
  const viewport = root.querySelector('[data-viewport]');
  const track = root.querySelector('[data-track]');
  const cards = [...root.querySelectorAll('.hr__card')];
  const ticks = [...root.querySelectorAll('.hr__ticks span')];
  const fill = root.querySelector('[data-fill]');
  const countEl = root.querySelector('[data-count]');
  const bigEl = root.querySelector('[data-big]');
  const [prevBtn, nextBtn] = root.querySelectorAll('[data-step]');

  const head = root.querySelector('.hr__head');
  const padPx = () => root.style.setProperty('--pad-px', getComputedStyle(head).paddingLeft);
  const apply = () => {
    padPx();
    root.style.setProperty('--card', `${cfg.card}vw`);
    root.style.setProperty('--gap', `${cfg.gap}px`);
    root.dataset.progress = cfg.progress;
  };
  apply();

  // One readout for both modes: progress 0–1 → the line, the ticks, the counters and the arrows' disabled state.
  let shownIndex = -1;
  const readout = (p) => {
    fill.style.transform = `scaleX(${p.toFixed(4)})`;
    const i = clamp(Math.round(p * (n - 1)), 0, n - 1);
    if (i !== shownIndex) {
      shownIndex = i;
      countEl.textContent = pad(i + 1);
      bigEl.textContent = pad(i + 1);
      ticks.forEach((t, k) => t.classList.toggle('is-on', k <= i));
      cards.forEach((c, k) => c.classList.toggle('is-active', k === i));
    }
    prevBtn.setAttribute('aria-disabled', String(p <= 0.001));
    nextBtn.setAttribute('aria-disabled', String(p >= 0.999));
  };
  const stepSize = () => cards[0].offsetWidth + cfg.gap;

  const lenis = useLenis(ctx);
  const { gsap, ScrollTrigger, context } = useGsap(ctx, root);
  const native = ctx.motion !== 'full' || matchMedia('(pointer: coarse)').matches;
  root.classList.toggle('hr--native', native);

  if (native) {
    // A native horizontal scroller with snap points; the readout follows its scrollLeft.
    const update = () => {
      const max = viewport.scrollWidth - viewport.clientWidth;
      readout(max > 0 ? viewport.scrollLeft / max : 0);
    };
    on(ctx, viewport, 'scroll', update, { passive: true });
    on(ctx, window, 'resize', () => { padPx(); update(); });
    const step = (dir) => viewport.scrollBy({ left: stepSize() * dir, behavior: ctx.motion === 'full' ? 'smooth' : 'auto' });
    [prevBtn, nextBtn].forEach((b) => on(ctx, b, 'click', () => step(Number(b.dataset.step))));
    on(ctx, rail, 'keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      step(e.key === 'ArrowRight' ? 1 : -1);
    });
    update();
    return { update(next) { cfg = { ...next }; apply(); requestAnimationFrame(update); } };
  }

  // Pinned mode: the rail's height is the track's overflow plus one viewport.
  const distance = () => Math.max(0, track.offsetWidth - viewport.clientWidth);
  let tween = null;
  const build = () => {
    if (tween) { tween.scrollTrigger?.kill(); tween.kill(); tween = null; }
    gsap.set(track, { clearProps: 'transform' });
    rail.style.height = `${innerHeight + distance()}px`;
    tween = context.add(() => gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: rail,
        start: 'top top',
        end: 'bottom bottom',
        scrub: cfg.scrub > 0 ? cfg.scrub : true,
        invalidateOnRefresh: true,
        onUpdate: (s) => readout(s.progress),
      },
    }));
    readout(tween.scrollTrigger.progress);
  };
  build();

  // Every step moves the page scroll; the scrub moves the track. Vertical px = horizontal px by construction.
  const scrollBy = (dy) => {
    const st = tween.scrollTrigger;
    const y = clamp(scrollY + dy, st.start, st.end);
    if (lenis) lenis.scrollTo(y, { duration: 0.7 }); else scrollTo({ top: y });
  };
  [prevBtn, nextBtn].forEach((b) => on(ctx, b, 'click', () => {
    const st = tween.scrollTrigger;
    // From above the rail, the first press brings the stage to the top before stepping.
    if (scrollY < st.start - 1) { if (lenis) lenis.scrollTo(st.start, { duration: 0.7 }); else scrollTo({ top: st.start }); return; }
    scrollBy(stepSize() * Number(b.dataset.step));
  }));
  on(ctx, rail, 'keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    scrollBy(stepSize() * (e.key === 'ArrowRight' ? 1 : -1));
  });
  // Tabbing to a card off to the side scrolls the page until the card sits at the track's start.
  on(ctx, track, 'focusin', (e) => {
    const card = e.target.closest('.hr__card');
    if (!card) return;
    const st = tween.scrollTrigger;
    const target = clamp(st.start + card.offsetLeft - parseFloat(getComputedStyle(track).paddingLeft), st.start, st.end);
    if (lenis) lenis.scrollTo(target, { duration: 0.6 }); else scrollTo({ top: target });
  });

  on(ctx, window, 'resize', () => { padPx(); build(); ScrollTrigger.refresh(); });
  document.fonts?.ready.then(() => { build(); ScrollTrigger.refresh(); });
  root.querySelectorAll('img').forEach((img) => on(ctx, img, 'load', () => ScrollTrigger.refresh(), { once: true }));

  return {
    update(next, changed) {
      cfg = { ...next };
      apply();
      if (changed.some((c) => c === 'card' || c === 'gap' || c === 'scrub')) { build(); ScrollTrigger.refresh(); }
      return undefined;
    },
  };
}
