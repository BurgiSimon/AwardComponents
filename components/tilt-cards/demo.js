// Tilt cards — Parallel's plans, each as the physical card that comes with it. The face turns toward a mouse
// pointer (rotateY = max × nx, rotateX = −max × ny, so the corner under the pointer sinks); a shine twice the face
// follows the pointer by translate and a shade gathers on the raised side. The link carries the perspective and is
// measured; only the face rotates. One quickTo per property. Scrolling locks every card until 140 ms of quiet.
// Mouse only, full motion only: touch, keyboard and reduced motion get flat cards.
import './demo.css';
import { on, finePointer, clamp, html, raw, content, formatPrice } from '../../src/demo-kit/index.js';
import { useGsap } from '../../src/demo-kit/gsap.js';

const UNLOCK_MS = 140;
const CARDS = [
  { id: 'solo', holder: 'Aino Lehto', last: '4021', features: ['One current account', 'Invoices and reminders', 'A tax pot that fills itself'] },
  { id: 'studio', holder: 'Halden Arkitekter', last: '7718', features: ['Cards for up to eight people', 'Limits per project', 'Three accounts, one view'] },
  { id: 'practice', holder: 'Fable & Co', last: '0356', features: ['Up to twenty people', 'Approvals and an audit log', 'Exports for your accountant'] },
];
const CHIP = '<svg viewBox="0 0 40 30" aria-hidden="true"><rect x="0.5" y="0.5" width="39" height="29" rx="6"/><path d="M0 10h12M0 20h12M28 10h12M28 20h12M12 0v30M28 0v30M12 15h16"/></svg>';
const WAVES = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M8 8.5a5 5 0 0 1 0 7M11.5 6a8.5 8.5 0 0 1 0 12M15 3.5a12 12 0 0 1 0 17"/></svg>';
const TICK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7"/></svg>';

export default function mount(root, options, ctx) {
  const { app } = content;
  let cfg = { ...options };

  root.className = 'tc';
  root.innerHTML = html`
    <header class="ac-bar tc__bar">
      <a class="ac-brand tc__brand" href="#top"><span class="tc__mark" aria-hidden="true"></span>${app.name}</a>
      <nav aria-label="Main"><a href="#top">Features</a><a href="#top" aria-current="page">Plans</a><a href="#top">Log in</a></nav>
    </header>
    <section class="ac-wrap tc__plans" aria-labelledby="tc-title">
      <div class="tc__head">
        <p class="ac-label">Plans · ${app.tagline}</p>
        <h1 class="ac-h1" id="tc-title">Every plan comes with a card worth keeping.</h1>
      </div>
      <ul class="tc__grid" role="list">
        ${app.plans.map((plan, i) => {
          const c = CARDS[i];
          return html`
          <li class="tc__plan${i === 1 ? ' tc__plan--pick' : ''}">
            <a class="tc__card" href="#${c.id}" data-tilt aria-label="${plan.name} card: see the details">
              <span class="tc__face tc__face--${c.id}" data-face>
                <span class="tc__row"><span class="tc__wordmark"><span class="tc__mark" aria-hidden="true"></span>${app.name}</span><span class="tc__tier">${plan.name}</span></span>
                <span class="tc__row tc__row--mid"><span class="tc__chip">${raw(CHIP)}</span><span class="tc__waves">${raw(WAVES)}</span></span>
                <span class="tc__row tc__row--end"><span class="tc__holder">${c.holder}</span><span class="tc__num ac-num">•••• ${c.last}</span></span>
                <span class="tc__shade" data-shade aria-hidden="true"></span>
                <span class="tc__shine" data-shine aria-hidden="true"></span>
              </span>
            </a>
            <div class="tc__info">
              <p class="tc__name"><strong>${plan.name}</strong>${i === 1 ? html`<span class="ac-chip ac-chip--accent">Most chosen</span>` : ''}</p>
              <p class="tc__price"><span class="ac-num">${formatPrice(plan.price)}</span><span class="ac-small">${plan.price ? 'a month, billed yearly' : 'for good'}</span></p>
              <p class="ac-small">${plan.note}</p>
              <ul class="tc__features" role="list">${c.features.map((f) => html`<li>${raw(TICK)}<span>${f}</span></li>`)}</ul>
              <a class="ac-btn ${i === 1 ? 'ac-btn--accent' : 'ac-btn--ghost'}" href="#top">Choose ${plan.name}</a>
            </div>
          </li>`;
        })}
      </ul>
    </section>`;
  root.querySelectorAll('a[href^="#"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const apply = () => {
    root.style.setProperty('--persp', `${cfg.perspective}px`);
    root.style.setProperty('--shine', String(cfg.shine));
  };
  apply();
  const update = (next) => { cfg = { ...next }; apply(); };

  if (!finePointer() || ctx.motion !== 'full') {
    root.classList.add('tc--flat');
    return { update };
  }

  // One quickTo per property: a live tween retargeted on every move; paused and silent until the first aim.
  const { gsap } = useGsap(ctx, root);
  const cards = [...root.querySelectorAll('[data-tilt]')].map((el) => {
    const face = el.querySelector('[data-face]');
    const shine = el.querySelector('[data-shine]');
    const shade = el.querySelector('[data-shade]');
    const q = (target, prop) => gsap.quickTo(target, prop, { duration: 0.6, ease: 'power3.out' });
    return { el, set: { rx: q(face, 'rotationX'), ry: q(face, 'rotationY'), z: q(face, 'z'), sx: q(shine, 'x'), sy: q(shine, 'y'), so: q(shine, 'opacity'), hx: q(shade, 'x'), hy: q(shade, 'y'), ho: q(shade, 'opacity') } };
  });

  const aim = (card, x, y) => {
    // Measure the link, which never transforms, so the rotated face cannot skew its own input.
    const r = card.el.getBoundingClientRect();
    const nx = clamp(((x - r.left) / r.width) * 2 - 1, -1, 1);
    const ny = clamp(((y - r.top) / r.height) * 2 - 1, -1, 1);
    const { set } = card;
    set.ry(cfg.tilt * nx);
    set.rx(-cfg.tilt * ny);
    set.z(cfg.lift ? 28 : 0);
    // The light layers are twice the face and centred: half the face of translate puts the hot spot under the pointer.
    set.sx(nx * r.width * 0.5); set.sy(ny * r.height * 0.5); set.so(1);
    set.hx(-nx * r.width * 0.5); set.hy(-ny * r.height * 0.5); set.ho(Math.min(1, Math.hypot(nx, ny)) * 0.6);
    card.el.classList.add('is-aimed');
  };
  const release = (card) => {
    Object.values(card.set).forEach((f) => f(0));
    card.el.classList.remove('is-aimed');
  };

  let active = -1;
  let locked = false;
  let quiet = true;
  let timer = 0;
  ctx.onCleanup(() => clearTimeout(timer));
  on(ctx, window, 'scroll', () => {
    // A card sliding under a still pointer is not the visitor aiming: hold every card until the scroll settles.
    locked = true;
    quiet = false;
    clearTimeout(timer);
    timer = setTimeout(() => { quiet = true; }, UNLOCK_MS);
  }, { passive: true });
  on(ctx, window, 'pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (locked) {
      if (!quiet) return;
      locked = false; // the first move after the quiet period unlocks, and counts as an ordinary move
    }
    const i = cards.findIndex((c) => c.el.contains(e.target));
    if (i !== active && active >= 0) release(cards[active]);
    active = i;
    if (i >= 0) aim(cards[i], e.clientX, e.clientY);
  }, { passive: true });
  on(ctx, document.documentElement, 'pointerleave', () => {
    if (locked || active < 0) return;
    release(cards[active]);
    active = -1;
  });

  return { update };
}
