// Chosen-item transition — Halden's project index and project pages under @unseenco/taxi, with no copy around them. A
// row click runs one exit: the other rows fade and drop by their distance from the chosen one, and the chosen row
// rises into the slot under the fixed bar (the view's padding-top). The route is pushed only after the rise; the
// project page has the same row in that slot and builds its picture and two facts beneath it. Back reverses it: the
// page folds, the row drops back into its place and its neighbours return by distance. The pages sit in taxi's cache
// up front, and each mount's links carry its own id so a stale router never matches them. Reduced and static motion
// change the route at once.
import './demo.css';
import { Core, Renderer, Transition } from '@unseenco/taxi';
import { on, html, raw, photo, allPhotos, imageHTML, content } from '../../src/demo-kit/index.js';
import { useGsap } from '../../src/demo-kit/gsap.js';

const PHONE = '(max-width: 48rem)';
// Pinned by id where the tag pick lands on a painting, a landmark, or a credit naming another place.
const PINNED = { stillwater: 'land-overcast-sea', 'granite-court': 'arch-concrete-slab', saltworks: 'land-dunes' };

// One different picture per item: a pinned id, else its own tag first, then the fallbacks, then a drawn stand-in.
// photo(id) marks only the pictures actually shown, so the component page credits exactly those.
function uniquePictures(keys, tagsOf, fallbacks, pinned = {}) {
  const pool = allPhotos();
  const used = new Set(Object.values(pinned));
  const take = (tags) => pool.find((m) => !used.has(m.id) && tags.every((t) => m.tags?.includes(t)));
  return Object.fromEntries(keys.map((k) => {
    const m = pinned[k] ? { id: pinned[k] } : [tagsOf(k), ...fallbacks].reduce((hit, tags) => hit || take(tags), null);
    if (m) used.add(m.id);
    return [k, photo(m ? m.id : `pick-${k}`)];
  }));
}

export default function mount(root, options, ctx) {
  const { studio } = content;
  const projects = studio.projects;
  let cfg = { ...options };
  const uid = Math.random().toString(36).slice(2, 8);
  const startTitle = document.title;
  const urlFor = (slug) => { const u = new URL(location.href); if (slug) u.searchParams.set('p', slug); else u.searchParams.delete('p'); u.hash = ''; return u.href; };
  const slugOf = (url) => new URL(url, location.href).searchParams.get('p');
  const pics = uniquePictures(projects.map((p) => p.slug), (slug) => projects.find((p) => p.slug === slug).tags.slice(0, 1), [['architecture'], ['interior'], ['landscape']], PINNED);
  const num = (i) => String(i + 1).padStart(2, '0');

  // One row layout for both pages, so the chosen row and the project page's heading line up exactly.
  const rowInner = (p, i, heading) => html`
    <span class="se__n ac-label">${num(i)}</span>
    <span class="ac-media se__thumb">${raw(imageHTML(pics[p.slug], { sizes: '96px', alt: '' }))}</span>
    ${heading ? html`<h1 class="se__name" tabindex="-1">${p.title}</h1>` : html`<span class="se__name">${p.title}</span>`}
    <span class="se__place">${p.place}</span>
    <span class="se__meta ac-label">${p.discipline} · ${p.year}</span>`;

  const indexView = html`
    <div data-taxi-view data-view="index" class="se__view ac-wrap">
      <h1 class="sr-only" tabindex="-1">${studio.name}, selected work</h1>
      <ol class="se__rows" role="list">
        ${projects.map((p, i) => html`<li><a class="se__row" data-row href="${urlFor(p.slug)}" data-pt="${uid}">${rowInner(p, i)}</a></li>`)}
      </ol>
    </div>`;
  const caseView = (p, i) => html`
    <div data-taxi-view data-view="case" data-slug="${p.slug}" class="se__view ac-wrap">
      <div class="se__row se__row--head">${rowInner(p, i, true)}</div>
      <figure class="ac-media se__hero" data-build-media>${raw(imageHTML(pics[p.slug], { sizes: '(max-width: 1320px) 100vw, 1320px', alt: `${p.title}, ${p.place}` }))}</figure>
      <dl class="se__facts" data-build>
        <div><dt class="ac-label">Completed</dt><dd>${p.year}</dd></div>
        <div><dt class="ac-label">Size</dt><dd>${p.size}</dd></div>
      </dl>
    </div>`;

  const firstSlug = projects.some((p) => p.slug === slugOf(location.href)) ? slugOf(location.href) : null;
  root.className = 'se';
  root.innerHTML = html`
    <header class="se__bar">
      <a class="ac-brand" href="${urlFor(null)}" data-pt="${uid}">${studio.name}</a>
      <a class="se__back" href="${urlFor(null)}" data-pt="${uid}" data-back><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>All work</a>
    </header>
    <main data-taxi>${firstSlug ? caseView(projects.find((p) => p.slug === firstSlug), projects.findIndex((p) => p.slug === firstSlug)) : indexView}</main>
    <p class="ac-stage__note"><span>${studio.name} · selected work</span></p>`;

  const back = root.querySelector('[data-back]');
  const full = ctx.motion === 'full';
  const { gsap, context: g } = useGsap(ctx, root);

  // The browser must not restore the index's scroll on Back: the transition does, after placing the row.
  const restoration = history.scrollRestoration;
  history.scrollRestoration = 'manual';
  ctx.onCleanup(() => {
    history.scrollRestoration = restoration;
    history.replaceState(history.state, '', urlFor(null));
    document.title = startTitle;
  });

  const timing = () => {
    const phone = matchMedia(PHONE).matches;
    return { rise: cfg.rise * (phone ? 0.7 : 1), stagger: cfg.stagger * (phone ? 0.67 : 1), fade: 0.65 };
  };
  const steps = (i, chosen) => (cfg.order === 'distance' ? Math.abs(i - chosen) : i);
  const visible = (el) => { const b = el.getBoundingClientRect(); return b.bottom > 0 && b.top < innerHeight; };

  // The exit: siblings by distance, the chosen row to the slot. Returns the timeline; the push waits for its end.
  const promote = (view, chosen) => {
    const t = timing();
    const rows = [...view.querySelectorAll('[data-row]')];
    const row = rows[chosen];
    const slot = parseFloat(getComputedStyle(view).paddingTop);
    row.setAttribute('data-chosen', '');
    const tl = gsap.timeline();
    rows.forEach((r, i) => {
      if (i === chosen) return;
      if (!visible(r)) { gsap.set(r, { autoAlpha: 0 }); return; }
      tl.to(r, { autoAlpha: 0, y: 18, duration: t.fade, ease: 'power2.in' }, t.stagger * steps(i, chosen));
    });
    return tl.to(row, { y: slot - row.getBoundingClientRect().top, duration: t.rise, ease: 'power2.inOut' }, 0);
  };

  // The project page builds under its heading row: the picture opens downward, then the facts rise in.
  const build = (view, withHead) => {
    const media = view.querySelector('[data-build-media]');
    const tl = gsap.timeline();
    if (withHead) tl.from(view.querySelector('.se__row--head'), { autoAlpha: 0, duration: 0.45, ease: 'power1.out' }, 0);
    return tl
      .fromTo(media, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'expo.out', clearProps: 'clipPath' }, 0.05)
      .from(media.querySelector('img'), { scale: 1.12, duration: 1.4, ease: 'expo.out', clearProps: 'transform' }, 0.05)
      .from(view.querySelectorAll('[data-build]'), { autoAlpha: 0, y: 24, duration: 0.9, ease: 'expo.out', stagger: 0.08, clearProps: 'all' }, 0.3);
  };
  const fold = (view, withHead) => {
    const tl = gsap.timeline()
      .to(view.querySelectorAll('[data-build]'), { autoAlpha: 0, y: 18, duration: 0.35, ease: 'power2.in', stagger: { each: 0.04, from: 'end' } }, 0)
      .to(view.querySelector('[data-build-media]'), { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.6, ease: 'power3.inOut' }, 0.1);
    if (withHead) tl.to(view.querySelector('.se__row--head'), { autoAlpha: 0, duration: 0.3 }, 0.35);
    return tl;
  };

  // Back into the index: the row starts where the project heading was and drops into its place.
  let indexScroll = 0;
  let cameFrom = null; // the view the last navigation left
  let leaving = null; // { slug, headTop } of the project page just left
  const settle = (view) => {
    const t = timing();
    const rows = [...view.querySelectorAll('[data-row]')];
    const chosen = projects.findIndex((p) => p.slug === leaving?.slug);
    window.scrollTo(0, indexScroll);
    if (chosen < 0 || !cfg.reverse) return gsap.timeline().from(rows, { autoAlpha: 0, duration: 0.45, ease: 'power1.out', clearProps: 'all' });
    const row = rows[chosen];
    if (!visible(row)) window.scrollTo(0, window.scrollY + row.getBoundingClientRect().top - innerHeight * 0.45);
    const from = leaving.headTop - row.getBoundingClientRect().top;
    row.setAttribute('data-chosen', '');
    const tl = gsap.timeline({ onComplete: () => row.removeAttribute('data-chosen') });
    tl.fromTo(row, { y: from }, { y: 0, duration: t.rise, ease: 'power2.inOut', clearProps: 'transform' }, 0);
    rows.forEach((r, i) => {
      if (i === chosen) return;
      tl.fromTo(r, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: t.fade, ease: 'power2.out', clearProps: 'all' }, t.rise * 0.65 + t.stagger * steps(i, chosen));
    });
    return tl;
  };

  class Page extends Renderer {
    onEnter() {
      const isCase = this.content.dataset.view === 'case';
      back.hidden = !isCase;
    }
  }

  class Promote extends Transition {
    onLeave({ from, trigger, done }) {
      const isIndex = from.dataset.view === 'index';
      cameFrom = from.dataset.view;
      if (isIndex) indexScroll = window.scrollY;
      else leaving = { slug: from.dataset.slug, headTop: from.querySelector('.se__row--head').getBoundingClientRect().top };
      if (!full) { done(); return; }
      g.add(() => {
        if (!isIndex) { fold(from, slugOf(taxi.targetLocation.raw) !== null || !cfg.reverse).call(done); return; }
        const rows = [...from.querySelectorAll('[data-row]')];
        const chosen = trigger instanceof Element ? rows.indexOf(trigger.closest('[data-row]')) : -1;
        if (chosen < 0) { gsap.timeline().to(from, { autoAlpha: 0, duration: 0.45, ease: 'power2.in' }).call(done); return; }
        promote(from, chosen).call(done);
      });
    }
    onEnter({ to, done }) {
      const isIndex = to.dataset.view === 'index';
      if (!full) { window.scrollTo(0, isIndex ? indexScroll : 0); done(); return; }
      g.add(() => {
        if (isIndex) { settle(to).call(done); return; }
        window.scrollTo(0, 0);
        // From the index the heading row is already in the slot; from another project it fades in with the page.
        build(to, cameFrom !== 'index').call(done);
      });
    }
  }

  const taxi = new Core({ links: `a[data-pt="${uid}"]`, renderers: { default: Page }, transitions: { default: Promote }, allowInterruption: false, reloadJsFilter: false, reloadCssFilter: false });
  const parser = new DOMParser();
  const prime = (url, title, view) => taxi.cache.set(new URL(url).href, taxi.createCacheEntry(parser.parseFromString(`<!doctype html><title>${title}</title><main data-taxi>${view}</main>`, 'text/html'), url));
  prime(urlFor(null), `Work — ${studio.name}`, indexView);
  projects.forEach((p, i) => prime(urlFor(p.slug), `${p.title} — ${studio.name}`, caseView(p, i)));
  document.title = firstSlug ? `${projects.find((p) => p.slug === firstSlug).title} — ${studio.name}` : `Work — ${studio.name}`;

  // Focus follows a link into the new page, with a ring only when the link was pressed with a key. The toolbar's
  // actions leave focus where it is.
  let keyNav = false;
  let fromAction = false;
  on(ctx, root, 'click', (e) => { keyNav = e.detail === 0; }, { capture: true });
  const onEnd = ({ to, trigger }) => {
    const skip = fromAction;
    fromAction = false;
    if (skip) return;
    to?.renderer?.content?.querySelector('h1')?.focus({ preventScroll: true, focusVisible: keyNav && trigger !== 'popstate' });
  };
  taxi.on('NAVIGATE_END', onEnd);
  ctx.onCleanup(() => {
    window.removeEventListener('popstate', taxi.onPopstate);
    taxi.off('NAVIGATE_END', onEnd);
  });

  // The thumbnail: the fifth row most of the way up to the slot, the rows it left fading by distance.
  if (ctx.capture && !firstSlug) {
    document.fonts.ready.then(() => {
      const view = root.querySelector('[data-view="index"]');
      g.add(() => promote(view, 4).pause(timing().rise * 0.64));
    });
  }

  return {
    update(next) { cfg = { ...next }; },
    action(name) {
      if (taxi.isTransitioning) return;
      const view = root.querySelector('[data-taxi-view]:last-child');
      if (name === 'open' && view?.dataset.view === 'index') {
        const row = view.querySelectorAll('[data-row]')[2];
        fromAction = true;
        taxi.navigateTo(row.href, false, row).catch(() => { fromAction = false; });
      }
      if (name === 'back' && view?.dataset.view === 'case') {
        fromAction = true;
        taxi.navigateTo(urlFor(null), false, back).catch(() => { fromAction = false; });
      }
    },
  };
}
