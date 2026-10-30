// Page transition — Halden's site as three routes (Home, Work, Studio; a big name and one picture each) run by
// @unseenco/taxi, with the small nav that routes between them. A link click runs one lifecycle: the wipe covers the
// old view (its label, the next page's name, held still while the wipe slides over it), the renderer reverts the old
// view's gsap.context, taxi swaps the view, the scroll resets through Lenis, the wipe leaves and the new headline
// rises. In this preview the pages are put in taxi's cache up front instead of fetched; each mount's links carry its
// own id, so a stale router from an earlier mount never matches them. Reduced: the wipe fades. Static: an instant swap.
import './demo.css';
import { Core, Renderer, Transition } from '@unseenco/taxi';
import { on, html, raw, photos, imageHTML, content, colour } from '../../src/demo-kit/index.js';
import { useGsap } from '../../src/demo-kit/gsap.js';
import { useLenis } from '../../src/demo-kit/lenis.js';

const ORDER = ['home', 'work', 'studio'];
const TITLES = { home: 'Home', work: 'Work', studio: 'Studio' };
const AXES = { up: ['yPercent', 1], down: ['yPercent', -1], left: ['xPercent', 1], right: ['xPercent', -1] };
// The wipe's label colour for each swatch; a custom colour gets a dark or light label by its luminance.
const ON = { ink: 'var(--bg)', accent: 'var(--on-accent)', sky: 'var(--night)', sand: 'var(--night)' };
function labelColour(value) {
  if (ON[value]) return ON[value];
  if (!/^#[0-9a-f]{6}$/i.test(value)) return 'var(--bg)';
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5 ? 'var(--night)' : 'var(--sand)';
}

export default function mount(root, options, ctx) {
  const { studio } = content;
  let cfg = { ...options };
  const uid = Math.random().toString(36).slice(2, 8);
  const LINKS = `a[data-pt="${uid}"]`;
  const startTitle = document.title;
  const urlFor = (page) => { const u = new URL(location.href); u.searchParams.set('page', page); u.hash = ''; return u.href; };
  const pageOf = (url) => new URL(url, location.href).searchParams.get('page');
  const first = ORDER.includes(pageOf(location.href)) ? pageOf(location.href) : 'home';
  const pics = photos({ tags: ['architecture'], count: 2, seed: 'pt-work' }).concat(photos({ tags: ['interior'], count: 1, seed: 'pt-int' }));
  const link = (page, label, cls = '') => html`<a href="${urlFor(page)}" data-pt="${uid}" class="${cls}">${label}</a>`;
  const lines = (...ls) => ls.map((l) => html`<span class="pt__mask"><span class="pt__line">${l}</span></span>`);
  const picture = (item) => html`<span class="ac-media pt__pic">${raw(imageHTML(item, { sizes: '(max-width: 760px) 100vw, 40vw' }))}</span>`;

  // The three views, a big name and one picture each. Each is complete markup, as a fetched page would be.
  const VIEWS = {
    home: html`
      <div data-taxi-view data-view="home" class="pt__view ac-wrap">
        <h1 class="ac-display pt__h1" id="pt-h-home" tabindex="-1">${lines('Buildings for', 'long winters.')}</h1>
        <span class="ac-media pt__pic pt__pic--wide"><span class="pt__par" data-parallax>${raw(imageHTML(pics[0], { sizes: '100vw' }))}</span></span>
      </div>`,
    work: html`
      <div data-taxi-view data-view="work" class="pt__view pt__view--split ac-wrap">
        <h1 class="ac-display pt__h1 pt__h1--name" id="pt-h-work" tabindex="-1">${lines('Work')}</h1>
        ${picture(pics[1])}
      </div>`,
    studio: html`
      <div data-taxi-view data-view="studio" class="pt__view pt__view--split pt__view--flip ac-wrap">
        <h1 class="ac-display pt__h1 pt__h1--name" id="pt-h-studio" tabindex="-1">${lines('Studio')}</h1>
        ${picture(pics[2])}
      </div>`,
  };

  root.className = 'pt';
  root.innerHTML = html`
    <header class="ac-bar pt__bar">
      ${link('home', studio.name, 'ac-brand')}
      <nav aria-label="Main">${ORDER.map((p) => html`<a href="${urlFor(p)}" data-pt="${uid}" data-nav="${p}">${TITLES[p]}</a>`)}</nav>
    </header>
    <main class="pt__main" data-taxi>${VIEWS[first]}</main>
    <div class="pt__wipe" aria-hidden="true"><div class="pt__wipe-in"><span class="pt__wipe-label" data-label></span></div></div>`;

  const wipe = root.querySelector('.pt__wipe');
  const inner = root.querySelector('.pt__wipe-in');
  const label = root.querySelector('[data-label]');
  const navLinks = [...root.querySelectorAll('[data-nav]')];
  const full = ctx.motion === 'full';
  const lenis = useLenis(ctx);
  const { gsap, ScrollTrigger, context: g } = useGsap(ctx, root);
  const park = () => gsap.set([wipe, inner], { xPercent: 0, yPercent: 0, autoAlpha: 0 });
  park();

  const apply = () => {
    root.style.setProperty('--pt-wipe', colour(cfg.colour, 'var(--ink)'));
    root.style.setProperty('--pt-wipe-ink', labelColour(cfg.colour));
    root.classList.toggle('pt--no-label', !cfg.label);
  };
  apply();

  // The URL carries the page, so a hard reload lands where the visitor was.
  history.replaceState(history.state, '', urlFor(first));
  ctx.onCleanup(() => {
    const u = new URL(location.href);
    u.searchParams.delete('page');
    history.replaceState(history.state, '', u.href);
    document.title = startTitle;
  });

  // Renderer = lifecycle. Everything a view starts lives in pageCtx, made on enter and reverted on leave.
  let pageCtx = null;
  let navigating = false;
  class Page extends Renderer {
    onEnter() {
      const view = this.content.dataset.view;
      navLinks.forEach((a) => (a.dataset.nav === view ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
      pageCtx?.revert();
      pageCtx = gsap.context(() => {
        if (!full) return;
        gsap.from(this.content.querySelectorAll('.pt__line'), { yPercent: 120, duration: 1.2, ease: 'expo.out', stagger: 0.08, delay: navigating ? cfg.duration * 0.55 : 0.1, clearProps: 'transform' });
        this.content.querySelectorAll('[data-parallax]').forEach((el) => {
          gsap.fromTo(el, { yPercent: -5 }, { yPercent: 5, ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
        });
      }, this.content);
      ScrollTrigger.refresh();
    }
    onLeave() {
      pageCtx?.revert();
      pageCtx = null;
    }
  }

  // Transition: the wipe covers, the view swaps underneath, the scroll resets, the wipe leaves. Its inner layer
  // moves the opposite way by the same amount, so the label stays put while the wipe slides over and off it.
  class Wipe extends Transition {
    onLeave({ done }) {
      navigating = true;
      label.textContent = TITLES[pageOf(taxi.targetLocation.raw)] || '';
      const [axis, sign] = AXES[cfg.direction];
      if (ctx.motion === 'static') { gsap.set(wipe, { autoAlpha: 1 }); done(); return; }
      g.add(() => {
        if (!full) { gsap.to(wipe, { autoAlpha: 1, duration: 0.25, ease: 'none', onComplete: done }); return; }
        gsap.set([wipe, inner], { autoAlpha: 1 });
        gsap.fromTo(wipe, { [axis]: 100 * sign }, { [axis]: 0, duration: cfg.duration, ease: 'expo.inOut', onComplete: done });
        gsap.fromTo(inner, { [axis]: -100 * sign }, { [axis]: 0, duration: cfg.duration, ease: 'expo.inOut' });
      });
    }
    onEnter({ done }) {
      lenis?.scrollTo(0, { immediate: true, force: true });
      window.scrollTo(0, 0);
      const finish = () => { park(); navigating = false; done(); };
      const [axis, sign] = AXES[cfg.direction];
      if (ctx.motion === 'static') { finish(); return; }
      g.add(() => {
        if (!full) { gsap.to(wipe, { autoAlpha: 0, duration: 0.25, delay: 0.05, ease: 'none', onComplete: finish }); return; }
        gsap.to(wipe, { [axis]: -100 * sign, duration: cfg.duration, delay: 0.1, ease: 'expo.inOut', onComplete: finish });
        gsap.to(inner, { [axis]: 100 * sign, duration: cfg.duration, delay: 0.1, ease: 'expo.inOut' });
      });
    }
  }

  const taxi = new Core({
    links: LINKS,
    renderers: { default: Page },
    transitions: { default: Wipe },
    allowInterruption: false,
    reloadJsFilter: false,
    reloadCssFilter: false,
  });
  // Prime the cache with every page, the way taxi.preload() would after fetching them.
  const parser = new DOMParser();
  for (const p of ORDER) {
    const doc = parser.parseFromString(`<!doctype html><title>${TITLES[p]} — ${studio.name}</title><main data-taxi>${VIEWS[p]}</main>`, 'text/html');
    taxi.cache.set(new URL(urlFor(p)).href, taxi.createCacheEntry(doc, urlFor(p)));
  }
  document.title = `${TITLES[first]} — ${studio.name}`;

  // Focus follows a link into the new page, with a ring only when the link was pressed with a key. The toolbar's
  // Next page (navigateTo, trigger false) leaves focus where it is.
  let keyNav = false;
  on(ctx, root, 'click', (e) => { keyNav = e.detail === 0; }, { capture: true });
  const onEnd = ({ to, trigger }) => {
    if (!trigger) return;
    to?.renderer?.content?.querySelector('h1')?.focus({ preventScroll: true, focusVisible: keyNav && trigger !== 'popstate' });
  };
  taxi.on('NAVIGATE_END', onEnd);
  ctx.onCleanup(() => {
    window.removeEventListener('popstate', taxi.onPopstate);
    taxi.off('NAVIGATE_END', onEnd);
    pageCtx?.revert();
  });

  // The thumbnail: the wipe a little under halfway over the home page, carrying the next page's name.
  if (ctx.capture && first === 'home') {
    label.textContent = TITLES.work;
    gsap.set([wipe, inner], { autoAlpha: 1 });
    gsap.set(wipe, { yPercent: 30.6 });
    gsap.set(inner, { yPercent: -30.6 });
  }

  return {
    update(next) { cfg = { ...next }; apply(); },
    action(name) {
      if (name !== 'next' || taxi.isTransitioning) return;
      const current = pageOf(location.href) || 'home';
      taxi.navigateTo(urlFor(ORDER[(ORDER.indexOf(current) + 1) % ORDER.length])).catch(() => {});
    },
  };
}
