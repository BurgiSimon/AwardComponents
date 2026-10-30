// Magnetic button — a studio's contact disc and three round contacts, alone on the stage.
// Each [data-magnet] leans toward a fine pointer inside a radius (smoothstep falloff to zero at the edge) through one
// gsap.quickTo per axis; its label follows a share of that travel. Coarse pointers and reduced motion: no pull.
import './demo.css';
import { gsap, useGsap } from '../../src/demo-kit/gsap.js';
import { on, finePointer, colour, html, raw, content } from '../../src/demo-kit/index.js';

const ICONS = {
  mail: '<path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/>',
  phone: '<path d="M6.5 4h3l1.5 4-2 1.5a10 10 0 0 0 5.5 5.5L16 13l4 1.5v3A2 2 0 0 1 18 19.5 15.5 15.5 0 0 1 4.5 6 2 2 0 0 1 6.5 4Z"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
};
const svg = (name) => raw(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`);

export default function mount(root, options, ctx) {
  const { studio } = content;
  root.className = 'mb';
  root.innerHTML = html`
    <section class="ac-stage mb__stage" id="contact" aria-label="Contact">
      <a class="mb__cta" href="mailto:${studio.email}" data-magnet data-primary>
        <span class="mb__body"></span>
        <span class="mb__label" data-magnet-label>Start a <br>project<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg></span>
      </a>
      <ul class="mb__icons" role="list">
        <li><a class="mb__icon" href="mailto:${studio.email}" aria-label="Email" data-magnet><span class="mb__body"></span><span class="mb__label" data-magnet-label>${svg('mail')}</span></a></li>
        <li><a class="mb__icon" href="tel:${studio.phone.replace(/\s/g, '')}" aria-label="Call" data-magnet><span class="mb__body"></span><span class="mb__label" data-magnet-label>${svg('phone')}</span></a></li>
        <li><a class="mb__icon" href="#contact" aria-label="Find the studio" data-magnet><span class="mb__body"></span><span class="mb__label" data-magnet-label>${svg('pin')}</span></a></li>
      </ul>
      <p class="ac-stage__note"><span>${studio.name} · contact section</span></p>
    </section>`;
  root.querySelectorAll('a[href^="#"], a[href^="mailto"], a[href^="tel"]').forEach((a) => a.addEventListener('click', (e) => e.preventDefault(), { signal: ctx.signal }));

  const primary = root.querySelector('[data-primary]');
  let cfg = { ...options };
  const live = ctx.motion === 'full' && finePointer();

  const apply = () => {
    root.style.setProperty('--mb-accent', colour(cfg.accent));
    primary.dataset.style = cfg.style;
    root.classList.toggle('mb--field', cfg.field);
    for (const m of magnets) m.measure();
  };

  // One magnet per element. quickTo retargets a live tween on every move instead of creating tweens per event.
  const makeMagnet = (el) => {
    const label = el.querySelector('[data-magnet-label]');
    let toX; let toY; let lx; let ly;
    let rect = el.getBoundingClientRect();
    let radius = 0;
    const tweens = () => {
      const o = { duration: cfg.duration, ease: 'expo.out' };
      toX = gsap.quickTo(el, 'x', o); toY = gsap.quickTo(el, 'y', o);
      lx = gsap.quickTo(label, 'x', o); ly = gsap.quickTo(label, 'y', o);
    };
    const measure = () => {
      const x = Number(gsap.getProperty(el, 'x')) || 0;
      const y = Number(gsap.getProperty(el, 'y')) || 0;
      const r = el.getBoundingClientRect();
      rect = { left: r.left - x, top: r.top - y, width: r.width, height: r.height };
      radius = Math.hypot(rect.width, rect.height) * cfg.radius;
      el.style.setProperty('--field', `${radius * 2}px`);
    };
    const move = (px, py) => {
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = px - cx;
      const dy = py - cy;
      const d = Math.hypot(dx, dy);
      if (d > radius) { release(); return; }
      const t = 1 - d / radius;
      const k = t * t * (3 - 2 * t);
      const x = dx * cfg.pull * k;
      const y = dy * cfg.pull * k;
      el.classList.add('is-near');
      toX(x); toY(y);
      lx(x * cfg.label); ly(y * cfg.label);
    };
    const release = () => {
      if (!el.classList.contains('is-near')) return;
      el.classList.remove('is-near');
      toX(0); toY(0); lx(0); ly(0);
    };
    tweens();
    measure();
    return { el, measure, move, release, tweens };
  };

  const magnets = [];
  useGsap(ctx, root, () => {
    root.querySelectorAll('[data-magnet]').forEach((el) => magnets.push(makeMagnet(el)));
  });
  apply();

  if (live) {
    on(ctx, window, 'pointermove', (e) => { for (const m of magnets) m.move(e.clientX, e.clientY); }, { passive: true });
    on(ctx, document, 'pointerleave', () => magnets.forEach((m) => m.release()));
  }
  on(ctx, window, 'resize', () => magnets.forEach((m) => m.measure()));
  on(ctx, window, 'scroll', () => magnets.forEach((m) => m.measure()), { passive: true });
  document.fonts?.ready.then(() => magnets.forEach((m) => m.measure()));

  return {
    update(next, changed) {
      cfg = { ...next };
      if (changed.includes('duration')) magnets.forEach((m) => m.tweens());
      apply();
    },
  };
}
