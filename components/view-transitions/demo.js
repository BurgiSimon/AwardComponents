// View transitions — Ostra's shop grid and product pages, swapped inside document.startViewTransition(). Before the
// swap only the clicked tile's picture and name get a view-transition-name; the product hero carries the same names
// in CSS, so the browser morphs them while the unnamed page body slides along the reading direction (mirrored for
// back through data-vt-dir on <html>). Back names the tile being returned to inside the update and clears it once
// captured. No library. Reduced motion, static and browsers without the API: a plain swap; focus moves either way.
import './demo.css';
import { on, html, raw, photos, imageHTML, content, formatPrice } from '../../src/demo-kit/index.js';

const NAMES = { media: 'ostra-media', title: 'ostra-title' };
const KIND = { ceramic: 'Ceramics', lamp: 'Lighting', furniture: 'Furniture', textile: 'Textiles', object: 'Objects' };

export default function mount(root, options, ctx) {
  const { shop } = content;
  const products = shop.products;
  let cfg = { ...options };
  const html$ = document.documentElement;
  const startTitle = document.title;
  const pics = Object.fromEntries(products.map((p) => [p.id, photos({ tags: p.tags.slice(0, 1), count: 1, seed: `vt-${p.id}` })[0]]));
  const urlFor = (id) => { const u = new URL(location.href); if (id) u.searchParams.set('product', id); else u.searchParams.delete('product'); u.hash = ''; return u.href; };
  const idOf = (url) => { const id = new URL(url, location.href).searchParams.get('product'); return products.some((p) => p.id === id) ? id : null; };
  let bag = 0;

  const gridView = () => html`
    <section class="vt__page ac-wrap" aria-labelledby="vt-h">
      <div class="vt__intro">
        <p class="ac-label">${shop.name} · Spring kiln, ${products.length} objects</p>
        <h1 class="ac-h1" id="vt-h" tabindex="-1">${shop.tagline}</h1>
      </div>
      <ul class="vt__grid" role="list">
        ${products.map((p) => html`<li><a class="vt__tile" href="${urlFor(p.id)}" data-id="${p.id}">
          <span class="ac-media vt__tmedia" data-vt="media">${raw(imageHTML(pics[p.id], { sizes: '(max-width: 760px) 50vw, 25vw', alt: '' }))}</span>
          <span class="vt__tname" data-vt="title">${p.name}</span>
          <span class="vt__tmeta"><span>${p.colour}</span><span class="ac-num">${formatPrice(p.price)}</span></span>
        </a></li>`)}
      </ul>
    </section>`;

  const productView = (p) => html`
    <section class="vt__page ac-wrap" aria-labelledby="vt-h">
      <a class="vt__back" href="${urlFor(null)}" data-back><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>All objects</a>
      <div class="vt__product">
        <div class="vt__info">
          <p class="ac-label">${KIND[p.tags[0]] || 'Objects'} · ${p.material.split(',')[0]}</p>
          <h1 class="vt__name" id="vt-h" tabindex="-1">${p.name}</h1>
          <p class="vt__price ac-num">${formatPrice(p.price)}</p>
          <fieldset class="vt__opts"><legend class="ac-label">Colour</legend>
            ${p.colours.map((c, i) => html`<label class="vt__chip"><input type="radio" name="vt-colour" value="${c}" ${i === 0 ? raw('checked') : ''}><span>${c}</span></label>`)}
          </fieldset>
          <fieldset class="vt__opts"><legend class="ac-label">Size</legend>
            ${p.sizes.map((s, i) => html`<label class="vt__chip"><input type="radio" name="vt-size" value="${s}" ${i === 0 ? raw('checked') : ''} ${p.soldOut?.includes(s) ? raw('disabled') : ''}><span>${s}${p.soldOut?.includes(s) ? ' · sold out' : ''}</span></label>`)}
          </fieldset>
          <button class="ac-btn ac-btn--lg ac-btn--accent vt__add" type="button" data-add>Add to bag — ${formatPrice(p.price)}</button>
          <dl class="vt__specs">
            <div><dt class="ac-label">Material</dt><dd>${p.material}</dd></div>
            <div><dt class="ac-label">Size</dt><dd>${p.dims.h} × ${p.dims.d} ${p.dims.unit}, ${p.weight}</dd></div>
            <div><dt class="ac-label">Delivery</dt><dd>Free from ${formatPrice(shop.freeShippingFrom)}, packed in paper and wool</dd></div>
          </dl>
        </div>
        <div class="ac-media vt__hero">${raw(imageHTML(pics[p.id], { eager: true, sizes: '(max-width: 760px) 100vw, 55vw', alt: `${p.name} in ${p.colour}` }))}</div>
      </div>
    </section>`;

  root.className = 'vt';
  root.innerHTML = html`
    <header class="ac-bar vt__bar">
      <a class="ac-brand" href="${urlFor(null)}" data-home>${shop.name}</a>
      <nav aria-label="Shop"><a href="${urlFor(null)}" data-home>Shop</a><a href="#journal">Journal</a><a href="#stockists">Stockists</a></nav>
      <span class="vt__bag" data-bag>Bag (0)</span>
    </header>
    <main class="vt__main" data-main></main>
    <p class="sr-only" role="status" aria-live="polite" data-status></p>`;
  const main = root.querySelector('[data-main]');
  const bagEl = root.querySelector('[data-bag]');
  const status = root.querySelector('[data-status]');

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
    if (a.matches('[data-back], [data-home]')) { e.preventDefault(); go(null); return; }
    if (a.getAttribute('href')?.startsWith('#')) e.preventDefault();
  });
  on(ctx, root, 'click', (e) => {
    if (!e.target.closest('[data-add]')) return;
    bag++;
    bagEl.textContent = `Bag (${bag})`;
    status.textContent = `Added to your bag. ${bag} ${bag === 1 ? 'item' : 'items'}.`;
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
        document.getAnimations().forEach((a) => { if (String(a.effect?.pseudoElement || '').startsWith('::view-transition')) { a.pause(); a.currentTime = at; } });
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
