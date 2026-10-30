// View transitions — four of Ostra's products and the product page each opens (picture, name, price, one line),
// swapped inside document.startViewTransition(). Before the swap only the clicked tile's picture and name get a
// view-transition-name; the product hero carries the same names in CSS, so the browser morphs them while the unnamed
// page body slides along the reading direction (mirrored for back through data-vt-dir on <html>); the plate line has
// its own name and holds still. Back names the tile being returned to inside the update and clears it once captured.
// No library. Reduced motion, static and browsers without the API: a plain swap; focus moves either way.
import './demo.css';
import { on, html, raw, photo, allPhotos, imageHTML, content, formatPrice } from '../../src/demo-kit/index.js';

const NAMES = { media: 'ostra-media', title: 'ostra-title' };

// One different picture per item: its own tag first, then the fallbacks, then a drawn stand-in. photo(id) marks only
// the pictures actually shown, so the component page credits exactly those.
function uniquePictures(keys, tagsOf, fallbacks) {
  const pool = allPhotos();
  const used = new Set();
  const take = (tags) => pool.find((m) => !used.has(m.id) && tags.every((t) => m.tags?.includes(t)));
  return Object.fromEntries(keys.map((k) => {
    const m = [tagsOf(k), ...fallbacks].reduce((hit, tags) => hit || take(tags), null);
    if (m) used.add(m.id);
    return [k, photo(m ? m.id : `pick-${k}`)];
  }));
}

export default function mount(root, options, ctx) {
  const { shop } = content;
  const products = shop.products.slice(0, 4);
  let cfg = { ...options };
  const html$ = document.documentElement;
  const startTitle = document.title;
  const pics = uniquePictures(products.map((p) => p.id), (id) => products.find((p) => p.id === id).tags.slice(0, 1), [['product'], ['object']]);
  const urlFor = (id) => { const u = new URL(location.href); if (id) u.searchParams.set('product', id); else u.searchParams.delete('product'); u.hash = ''; return u.href; };
  const idOf = (url) => { const id = new URL(url, location.href).searchParams.get('product'); return products.some((p) => p.id === id) ? id : null; };

  const gridView = () => html`
    <section class="vt__page" aria-labelledby="vt-h">
      <h1 class="sr-only" id="vt-h" tabindex="-1">${shop.name} shop</h1>
      <ul class="vt__grid" role="list">
        ${products.map((p) => html`<li><a class="vt__tile" href="${urlFor(p.id)}" data-id="${p.id}">
          <span class="ac-media vt__tmedia" data-vt="media">${raw(imageHTML(pics[p.id], { sizes: '(max-width: 760px) 50vw, 25vw', alt: '' }))}</span>
          <span class="vt__tname" data-vt="title">${p.name}</span>
          <span class="vt__tprice ac-num">${formatPrice(p.price)}</span>
        </a></li>`)}
      </ul>
    </section>`;

  const productView = (p) => html`
    <section class="vt__page" aria-labelledby="vt-h">
      <a class="vt__back" href="${urlFor(null)}" data-back><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>All objects</a>
      <div class="vt__product">
        <div class="vt__info">
          <h1 class="vt__name" id="vt-h" tabindex="-1">${p.name}</h1>
          <p class="vt__price ac-num">${formatPrice(p.price)}</p>
          <p class="vt__line">${p.material}</p>
        </div>
        <div class="ac-media vt__hero">${raw(imageHTML(pics[p.id], { eager: true, sizes: '(max-width: 760px) 100vw, 50vw', alt: `${p.name} in ${p.colour}` }))}</div>
      </div>
    </section>`;

  root.className = 'vt';
  root.innerHTML = html`
    <div class="ac-stage vt__stage">
      <main class="vt__main" data-main></main>
      <p class="ac-stage__note vt__note"><span>${shop.name} · shop</span></p>
    </div>`;
  const main = root.querySelector('[data-main]');

  let current = idOf(location.href);
  let gridScroll = 0;
  let busy = false;
  let active = null;
  const render = (id) => {
    main.innerHTML = id ? productView(products.find((p) => p.id === id)) : gridView();
    document.title = id ? `${products.find((p) => p.id === id).name} — ${shop.name}` : `Shop — ${shop.name}`;
  };
  const name = (tile, on) => tile?.querySelectorAll('[data-vt]').forEach((el) => { el.style.viewTransitionName = on ? NAMES[el.dataset.vt] : ''; });

  const apply = () => {
    html$.style.setProperty('--vt-morph', `${cfg.duration}s`);
    html$.style.setProperty('--vt-shift', `${cfg.slide}%`);
  };

  const go = (id, { push = true } = {}) => {
    if (busy || id === current) return;
    const from = current;
    if (!from) gridScroll = window.scrollY;
    const animated = cfg.api && ctx.motion === 'full' && typeof document.startViewTransition === 'function';
    const update = () => {
      render(id);
      current = id;
      if (push) history.pushState(history.state, '', urlFor(id));
      // Back: name the tile being returned to, so the hero's picture and name land in it.
      if (!id && animated) name(main.querySelector(`[data-id="${from}"]`), true);
      window.scrollTo(0, id ? 0 : gridScroll);
      main.querySelector('h1')?.focus({ preventScroll: true });
    };
    if (!animated) { update(); return null; }
    // Forward: name only the chosen tile, and only for this swap.
    if (id) name(main.querySelector(`[data-id="${id}"]`), true);
    html$.dataset.vtDir = id ? 'forward' : 'back';
    busy = true;
    const t = document.startViewTransition(update);
    active = t;
    t.ready.then(() => main.querySelectorAll('.vt__tile').forEach((tile) => name(tile, false))).catch(() => {});
    t.finished.finally(() => { busy = false; active = null; delete html$.dataset.vtDir; });
    return t;
  };

  // Plain links: an ordinary click swaps in place, a modified click opens the real URL in a new tab.
  on(ctx, root, 'click', (e) => {
    const a = e.target.closest('a');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (a.matches('.vt__tile')) { e.preventDefault(); go(a.dataset.id); return; }
    if (a.matches('[data-back]')) { e.preventDefault(); go(null); }
  });
  on(ctx, window, 'popstate', () => {
    const run = () => go(idOf(location.href), { push: false });
    if (active) active.finished.finally(run); else run();
  });

  ctx.onCleanup(() => {
    active?.skipTransition();
    history.replaceState(history.state, '', urlFor(null));
    document.title = startTitle;
  });

  apply();
  render(current);

  // The thumbnail: the way back held halfway, the picture flying home into its tile as the grid slides in.
  if (ctx.capture && !current && typeof document.startViewTransition === 'function') {
    document.fonts.ready.then(() => {
      current = products[0].id;
      render(current);
      const t = go(null, { push: false });
      t?.ready.then(() => {
        const at = cfg.duration * 1000 * 0.56;
        // The name's two snapshots cross-fade at different sizes, which a still frame shows as a double image: the
        // frame holds the name's cross-fade at its end, so one name flies home with the picture.
        const nameFade = /^::view-transition-(old|new)\(ostra-title\)/;
        document.getAnimations().forEach((a) => {
          const pe = String(a.effect?.pseudoElement || '');
          if (!pe.startsWith('::view-transition')) return;
          a.pause();
          a.currentTime = nameFade.test(pe) ? a.effect.getComputedTiming().endTime : at;
        });
      });
    });
  }

  return {
    update(next) { cfg = { ...next }; apply(); },
    action(id) {
      if (id === 'open' && !current) go(products[3].id);
      if (id === 'back' && current) go(null);
    },
  };
}
