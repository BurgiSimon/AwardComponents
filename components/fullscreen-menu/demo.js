// Fullscreen menu — Halden's site header. The Menu button wipes a full-screen overlay in with clip-path (top edge,
// a circle from the button, or a corner sweep), then the display-size links rise out of masks on a stagger and a
// picture follows the hovered or focused link. The page behind is inert and Lenis stops; focus is trapped in the
// overlay (its Close button sits where the toggle is), Escape and links close, focus returns. Reduced: no wipe.
import './demo.css';
import { on, html, raw, photos, imageHTML, content } from '../../src/demo-kit/index.js';
import { useGsap } from '../../src/demo-kit/gsap.js';
import { useLenis } from '../../src/demo-kit/lenis.js';

const LINKS = [
  { label: 'Work', count: 8, unit: 'projects', tag: 'architecture', note: 'Fjordhus, Hardanger' },
  { label: 'Studio', count: null, tag: 'interior', note: 'The drawing room, Strandkaien' },
  { label: 'Journal', count: 23, unit: 'entries', tag: 'landscape', note: 'Field notes from Læsø' },
  { label: 'Contact', count: null, tag: 'city', note: 'Bergen, from the harbour' },
];
const SOCIALS = ['Instagram', 'LinkedIn', 'Are.na'];

export default function mount(root, options, ctx) {
  const { studio } = content;
  const pics = LINKS.map((l, i) => photos({ tags: [l.tag], count: 1, seed: `fm-${i}` })[0]);
  const hero = photos({ tags: ['architecture'], count: 4, seed: 'fm-page' });
  let cfg = { ...options };

  root.className = 'fm';
  root.innerHTML = html`
    <header class="fm__bar" data-page>
      <a class="ac-brand" href="#top">${studio.name}</a>
      <button type="button" class="fm__toggle" aria-expanded="false" aria-controls="fm-menu" aria-haspopup="dialog">
        <span>Menu</span><span class="fm__bars" aria-hidden="true"><i></i><i></i></span>
      </button>
    </header>
    <main class="fm__page" data-page>
      <section class="ac-wrap fm__hero" aria-labelledby="fm-title">
        <p class="ac-label">${studio.full} · ${studio.city}</p>
        <h1 class="ac-display" id="fm-title">${studio.tagline}</h1>
      </section>
      <figure class="ac-wrap fm__figure">
        <span class="ac-media fm__wide">${raw(imageHTML(hero[0], { sizes: '100vw', alt: 'Fjordhus, a timber house above the water', eager: true }))}</span>
        <figcaption class="ac-small">${studio.projects[0].title} — ${studio.projects[0].summary}</figcaption>
      </figure>
      <section class="ac-wrap fm__more" aria-label="Recent projects">
        ${studio.projects.slice(1, 4).map((p, i) => html`<a class="fm__tile" href="#work"><span class="ac-media">${raw(imageHTML(hero[i + 1], { sizes: '33vw', alt: '' }))}</span><strong>${p.title}</strong><span class="ac-small">${p.place} · ${p.year}</span></a>`)}
      </section>
    </main>
    <footer class="ac-wrap fm__foot" data-page><span class="ac-small">${studio.full} · ${studio.address.join(', ')}</span></footer>

    <div class="fm__menu" id="fm-menu" role="dialog" aria-modal="true" aria-label="Site menu" hidden data-lenis-prevent>
      <div class="fm__inner ac-wrap">
        <div class="fm__top">
          <span class="ac-brand" aria-hidden="true">${studio.name}</span>
          <button type="button" class="fm__toggle fm__close" data-close><span>Close</span><span class="fm__bars" aria-hidden="true"><i></i><i></i></span></button>
        </div>
        <div class="fm__body">
          <nav aria-label="Primary">
            <ol class="fm__list" role="list">
              ${LINKS.map((l, i) => html`<li><a href="#${l.label.toLowerCase()}" data-link="${i}"><span class="fm__mask"><span class="fm__word"><span class="fm__num ac-label" aria-hidden="true">0${i + 1}</span>${l.label}${l.count ? html`<sup class="fm__count" aria-hidden="true">${l.count}</sup><span class="sr-only">, ${l.count} ${l.unit}</span>` : ''}</span></span></a></li>`)}
            </ol>
          </nav>
          <figure class="fm__preview" aria-hidden="true">
            <span class="fm__frame">${pics.map((p, i) => raw(imageHTML(p, { sizes: '30vw', alt: '', className: i ? '' : 'is-active' })))}</span>
            <figcaption class="ac-label" data-note>${LINKS[0].note}</figcaption>
          </figure>
        </div>
        <div class="fm__meta">
          <address class="fm__col" data-rise><span class="ac-label">Studio</span>${studio.address.map((l) => html`<span>${l}</span>`)}</address>
          <div class="fm__col" data-rise><span class="ac-label">Talk to us</span><a href="mailto:${studio.email}">${studio.email}</a><a href="tel:${studio.phone.replace(/\s/g, '')}">${studio.phone}</a></div>
          <ul class="fm__col fm__social" role="list" data-rise><li class="ac-label">Elsewhere</li>${SOCIALS.map((s) => html`<li><a href="#top">${s}</a></li>`)}</ul>
        </div>
      </div>
    </div>`;
  root.querySelectorAll('a[href^="#"], a[href^="mailto"], a[href^="tel"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const html_ = document.documentElement;
  const menu = root.querySelector('.fm__menu');
  const toggle = root.querySelector('.fm__toggle');
  const closeBtn = root.querySelector('[data-close]');
  const pages = [...root.querySelectorAll('[data-page]')];
  const words = [...root.querySelectorAll('.fm__word')];
  const rise = [...root.querySelectorAll('[data-rise]')];
  const previews = [...root.querySelectorAll('.fm__frame img')];
  const note = root.querySelector('[data-note]');
  const links = [...root.querySelectorAll('[data-link]')];
  const focusables = () => [...menu.querySelectorAll('a[href], button:not([disabled])')];
  const full = ctx.motion === 'full';
  const lenis = useLenis(ctx);
  const { gsap } = useGsap(ctx, root);
  const state = { open: false, animating: false };
  let tl = null;

  const apply = () => {
    root.dataset.tone = cfg.tone;
    root.classList.toggle('fm--numbered', cfg.numbered);
  };
  apply();

  // The preview follows the hovered or focused link.
  const setActive = (i) => {
    previews.forEach((img, n) => img.classList.toggle('is-active', n === i));
    note.textContent = LINKS[i].note;
  };
  links.forEach((a, i) => {
    on(ctx, a, 'pointerenter', () => setActive(i));
    on(ctx, a, 'focus', () => setActive(i));
    on(ctx, a, 'click', (e) => close({ keyboard: e.detail === 0 }));
  });

  // Clip-path shapes for each origin, as functions of progress so open and close share one description.
  const shapes = () => {
    if (cfg.origin === 'button') {
      const r = toggle.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const far = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 2;
      return { from: `circle(0px at ${x}px ${y}px)`, to: `circle(${far}px at ${x}px ${y}px)`, out: `circle(0px at ${x}px ${y}px)` };
    }
    if (cfg.origin === 'diagonal') {
      const poly = (t) => `polygon(${100 - t * 220}% 0%, 100% 0%, 100% ${t * 220}%, 100% ${t * 220}%)`;
      return { from: poly(0), to: poly(1), out: poly(0) };
    }
    return { from: 'inset(0% 0% 100% 0%)', to: 'inset(0% 0% 0% 0%)', out: 'inset(100% 0% 0% 0%)' };
  };

  const lock = (v) => {
    pages.forEach((el) => { el.inert = v; });
    html_.style.overflow = v ? 'hidden' : '';
    if (v) lenis?.stop(); else lenis?.start();
  };

  // `keyboard` decides whether the moved focus shows its ring: a mouse or the toolbar opening it should not.
  function open({ keyboard = false } = {}) {
    if (state.open || state.animating) return;
    state.open = true;
    menu.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    root.classList.add('is-open');
    lock(true);
    setActive(0);
    state.animating = true;
    tl?.kill();
    const done = () => { state.animating = false; links[0].focus({ preventScroll: true, focusVisible: keyboard }); };
    if (!full) {
      gsap.set(menu, { clipPath: 'none' });
      gsap.set([...words, ...rise], { yPercent: 0, opacity: 1 });
      done();
      return;
    }
    const s = shapes();
    tl = gsap.timeline({ onComplete: done })
      .fromTo(menu, { clipPath: s.from }, { clipPath: s.to, duration: cfg.duration, ease: 'expo.inOut' })
      // fromTo, not from: after a close the words sit at -110 %, which from() would read as its end value.
      .fromTo(words, { yPercent: 110 }, { yPercent: 0, duration: 1, ease: 'expo.out', stagger: cfg.stagger }, `-=${cfg.duration * 0.5}`)
      .fromTo(rise, { yPercent: 30, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.8, ease: 'expo.out', stagger: 0.06 }, '<0.25');
  }

  function close({ restoreFocus = true, keyboard = false, then = null } = {}) {
    if (!state.open || state.animating) return;
    state.open = false;
    toggle.setAttribute('aria-expanded', 'false');
    state.animating = true;
    const done = () => {
      menu.hidden = true;
      root.classList.remove('is-open');
      lock(false);
      state.animating = false;
      if (restoreFocus) toggle.focus({ preventScroll: true, focusVisible: keyboard });
      then?.();
    };
    if (!full) { done(); return; }
    tl?.kill();
    tl = gsap.timeline({ onComplete: done })
      .to(rise, { opacity: 0, duration: 0.3, ease: 'power1.in' })
      .to(words, { yPercent: -110, duration: 0.5, ease: 'expo.in', stagger: 0.04 }, 0)
      .to(menu, { clipPath: shapes().out, duration: cfg.duration * 0.78, ease: 'expo.inOut' }, '-=0.2');
  }

  // A click with detail 0 came from Enter or Space.
  on(ctx, toggle, 'click', (e) => (state.open ? close({ keyboard: e.detail === 0 }) : open({ keyboard: e.detail === 0 })));
  on(ctx, closeBtn, 'click', (e) => close({ keyboard: e.detail === 0 }));
  on(ctx, document, 'keydown', (e) => {
    if (!state.open) return;
    if (e.key === 'Escape') { e.preventDefault(); close({ keyboard: true }); return; }
    if (e.key !== 'Tab') return;
    // The trap wraps at both ends; the overlay's own Close button stands where the toggle was.
    const items = focusables();
    const i = items.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); items.at(-1).focus(); }
    else if (!e.shiftKey && (i === items.length - 1 || i === -1)) { e.preventDefault(); items[0].focus(); }
  });
  ctx.onCleanup(() => { html_.style.overflow = ''; });

  return {
    update(next) {
      cfg = { ...next };
      apply();
    },
    action(id) {
      if (id !== 'open') return;
      if (state.open) close({ restoreFocus: false, then: open });
      else open();
    },
  };
}
