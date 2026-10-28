// Flip grid — Ostra's shop index, rearranged three ways with GSAP Flip: a grid that becomes a list, a category filter
// that re-flows what is left, and a product whose picture travels from its card into a detail dialog and back. Every
// change is the same three steps: Flip.getState() records where things are, a class, a hidden attribute or a parent
// changes, and Flip.from() animates from the record to the new layout. The DOM is never rebuilt, so listeners, focus
// and the accessibility tree survive each change. Reduced and static: the same changes land on the next frame.
import './demo.css';
import { Flip } from 'gsap/Flip';
import { CustomEase } from 'gsap/CustomEase';
import { gsap, useGsap } from '../../src/demo-kit/gsap.js';
import { on, html, raw, photo, allPhotos, content, formatPrice } from '../../src/demo-kit/index.js';

gsap.registerPlugin(Flip, CustomEase);

const CATS = [
  { id: 'vessels', label: 'Vessels', items: ['tide-vase', 'dune-bowl', 'ember-cup', 'pebble-dish'] },
  { id: 'light', label: 'Light', items: ['luma-lamp', 'wick-candle'] },
  { id: 'living', label: 'Living', items: ['arc-chair', 'strand-throw'] },
];
const catOf = (id) => CATS.find((c) => c.items.includes(id));
const NOTES = {
  'tide-vase': 'Thrown in one pull and trimmed leather-hard, so the wall thins toward the lip. The glaze breaks to iron where it runs thin.',
  'dune-bowl': 'A wide, low bowl for fruit or bread. The dry glaze is soft to the hand and does not show fingerprints.',
  'ember-cup': 'A handleless cup that sits in two hands. Iron in the clay comes through the glaze as small dark specks.',
  'luma-lamp': 'A mouth-blown opal globe on a brushed brass stem. It gives a low, even light with no bright spot.',
  'arc-chair': 'One steam-bent length of ash forms the back and both arms. Oiled, not lacquered, so it can be sanded back.',
  'strand-throw': 'Woven in Os from undyed Norwegian lambswool. Heavy enough for a cabin, soft enough for a sofa.',
  'pebble-dish': 'A small porcelain dish for rings, salt or a bar of soap. Each one is pressed by hand, so no two match.',
  'wick-candle': 'Forged from one bar of iron and waxed. Holds a standard dinner candle or a tea light.',
};
const TAGS = { 'tide-vase': ['ceramic'], 'dune-bowl': ['ceramic'], 'ember-cup': ['ceramic'], 'pebble-dish': ['ceramic'], 'luma-lamp': ['lamp'], 'wick-candle': ['object'], 'arc-chair': ['furniture'], 'strand-throw': ['textile'] };
const EASES = { inOut: 'ac-flip', out: 'expo.out', spring: 'back.out(1.3)' };

function pictures(products) {
  const pool = allPhotos();
  const taken = new Set();
  return products.map((p) => {
    const tags = TAGS[p.id] || ['object'];
    const hit = pool.find((m) => tags.every((t) => m.tags?.includes(t)) && !taken.has(m.id)) || pool.find((m) => m.tags?.includes('product') && !taken.has(m.id));
    if (hit) { taken.add(hit.id); return photo(hit.id); }
    return photo(`ostra-${p.id}`);
  });
}

const VIEW_ICONS = {
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1"/>',
  list: '<path d="M4 6h16M4 12h16M4 18h16"/>',
};

export default function mount(root, options, ctx) {
  const { shop } = content;
  const products = shop.products;
  const art = pictures(products);
  let cfg = { ...options };
  const animate = () => ctx.motion === 'full';
  CustomEase.create('ac-flip', '0.76,0,0.24,1');

  root.className = 'fg';
  root.innerHTML = html`
    <header class="ac-bar fg__bar">
      <a class="ac-brand" href="#top">${shop.name}</a>
      <nav aria-label="Shop"><a href="#shop" aria-current="page">Shop</a><a href="#makers">Makers</a><a href="#care">Care</a></nav>
      <a class="fg__bag" href="#bag">Bag (0)</a>
    </header>
    <section class="fg__index ac-wrap" aria-labelledby="fg-title">
      <div class="fg__head">
        <div class="fg__heading">
          <p class="ac-label">Autumn objects</p>
          <h1 class="ac-h1" id="fg-title">The shop</h1>
        </div>
        <div class="fg__tools">
          <div class="fg__group" role="group" aria-label="Filter by category">
            <button type="button" class="fg__switch" data-filter="all" aria-pressed="true">All<span class="fg__n">${products.length}</span></button>
            ${CATS.map((c) => html`<button type="button" class="fg__switch" data-filter="${c.id}" aria-pressed="false">${c.label}<span class="fg__n">${c.items.length}</span></button>`)}
          </div>
          <div class="fg__group fg__views" role="group" aria-label="View">
            ${['grid', 'list'].map((v) => html`<button type="button" class="fg__switch fg__view" data-view="${v}" aria-pressed="${v === 'grid'}"><svg viewBox="0 0 24 24" aria-hidden="true">${raw(VIEW_ICONS[v])}</svg><span>${v === 'grid' ? 'Grid' : 'List'}</span></button>`)}
          </div>
        </div>
        <p class="fg__status ac-label" role="status" data-status>${products.length} of ${products.length} objects, as a grid</p>
      </div>
      <ul class="fg__works" role="list" data-view="grid" data-works>
        ${products.map((p, i) => html`
          <li class="fg__item" data-item="${p.id}" data-cat="${catOf(p.id)?.id || ''}">
            <div class="fg__frame" data-part><div class="fg__plate" data-plate>${raw(imgTag(art[i]))}</div></div>
            <h3 class="fg__name" data-part><button type="button" class="fg__open" data-open aria-haspopup="dialog">${p.name}</button></h3>
            <p class="fg__meta" data-part><span class="fg__material">${p.material.split(/,| with /)[0]} · ${p.colour}</span><span class="fg__price">${formatPrice(p.price)}</span></p>
          </li>`)}
      </ul>
    </section>
    <dialog class="fg__detail" aria-labelledby="fg-dtitle" data-detail>
      <div class="fg__ground" data-ground></div>
      <div class="fg__dbar">
        <button type="button" class="ac-btn ac-btn--ghost ac-btn--sm" data-close><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg>Back to the shop</button>
        <p class="ac-label" data-where></p>
      </div>
      <div class="fg__dbody">
        <div class="fg__dframe" data-slot aria-hidden="true"></div>
        <div class="fg__dcopy" data-copy>
          <h2 class="ac-h1" id="fg-dtitle" data-dtitle></h2>
          <p class="fg__dprice" data-dprice></p>
          <p class="ac-body" data-dtext></p>
          <dl class="fg__facts" data-facts></dl>
          <div class="fg__buy"><a class="ac-btn ac-btn--lg" href="#bag">Add to bag</a><span class="ac-small">Ships from Os in 2–4 days</span></div>
        </div>
      </div>
    </dialog>`;
  root.querySelectorAll('a[href^="#"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const list = root.querySelector('[data-works]');
  const items = [...list.children];
  const viewButtons = [...root.querySelectorAll('[data-view]')].filter((b) => b.tagName === 'BUTTON');
  const filterButtons = [...root.querySelectorAll('[data-filter]')];
  const status = root.querySelector('[data-status]');
  const dialog = root.querySelector('[data-detail]');
  const ground = dialog.querySelector('[data-ground]');
  const slot = dialog.querySelector('[data-slot]');
  const copy = dialog.querySelector('[data-copy]');
  const { context } = useGsap(ctx, root);

  const ui = { view: 'grid', filter: 'all', open: null };
  const visible = () => items.filter((li) => !li.hidden);
  const ease = () => EASES[cfg.ease] || 'ac-flip';
  const fade = () => Math.min(0.3, cfg.duration * 0.4);
  const press = (buttons, key, value) => buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[key] === value)));
  const announce = () => { status.textContent = `${visible().length} of ${items.length} objects, as a ${ui.view}`; };
  // Stagger by item, not by Flip target: a card and its parts share one delay, so a name never trails its own card.
  const byItem = (order) => (i, el) => (order.get(el.closest('[data-item]')) ?? 0) * cfg.stagger;

  // 1 · Grid ↔ list. The item and its parts are flipped together (nested), with scale off so text never squashes,
  // and absolute so one item's changing size cannot push its neighbours mid-flight; the list's height is pinned.
  function setView(next) {
    if (next === ui.view || ui.open) return;
    const shown = visible();
    const state = animate() ? Flip.getState(shown.flatMap((li) => [li, ...li.querySelectorAll('[data-part]')]), { props: 'borderTopColor' }) : null;
    ui.view = next;
    list.dataset.view = next;
    press(viewButtons, 'view', next);
    announce();
    if (!state) return;
    list.style.height = '';
    const h = list.offsetHeight;
    list.style.height = `${h}px`;
    context.add(() => Flip.from(state, {
      duration: cfg.duration, ease: ease(), nested: true, absolute: true,
      stagger: byItem(new Map(shown.map((li, i) => [li, i]))),
      onComplete: () => { list.style.height = ''; },
    }));
  }

  // 2 · Filter. Items keep their size, so this Flip scales. Leavers go absolute so the rest take their places at once;
  // they shrink and fade in onLeave while arrivals grow back in onEnter.
  function setFilter(next) {
    if (next === ui.filter || ui.open) return;
    const state = animate() ? Flip.getState(items) : null;
    ui.filter = next;
    items.forEach((li) => { li.hidden = !(next === 'all' || li.dataset.cat === next); });
    press(filterButtons, 'filter', next);
    announce();
    if (!state) { gsap.set(items, { clearProps: 'opacity,scale,transform' }); return; }
    context.add(() => Flip.from(state, {
      duration: cfg.duration, ease: ease(), scale: true, absoluteOnLeave: true,
      stagger: byItem(new Map(visible().map((li, i) => [li, i]))),
      onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: cfg.duration, ease: ease(), stagger: cfg.stagger }),
      onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.85, duration: fade(), ease: 'power1.in' }),
      onComplete: () => gsap.set(items.filter((li) => li.hidden), { clearProps: 'opacity,scale,transform' }),
    }));
  }

  // 3 · Detail. The picture itself moves: recorded in its card, reparented into the dialog's frame and flown there
  // (both frames are square, so the scale is uniform). Closing fades the copy and the ground first, then puts the
  // picture back in its card and flies it home over the page.
  function fill(li) {
    const p = products.find((x) => x.id === li.dataset.item);
    dialog.querySelector('[data-where]').textContent = `${shop.name} / ${catOf(p.id)?.label || 'Objects'}`;
    dialog.querySelector('[data-dtitle]').textContent = p.name;
    dialog.querySelector('[data-dprice]').textContent = formatPrice(p.price);
    dialog.querySelector('[data-dtext]').textContent = NOTES[p.id] || '';
    dialog.querySelector('[data-facts]').innerHTML = html`${[
      ['Material', p.material], ['Size', `${p.dims.h} × ${p.dims.d} ${p.dims.unit}`], ['Weight', p.weight], ['Colours', p.colours.join(', ')],
    ].map(([k, v]) => html`<div><dt class="ac-label">${k}</dt><dd>${v}</dd></div>`)}`;
  }

  function openDetail(li, opener) {
    if (ui.open) return;
    const plate = li.querySelector('[data-plate]');
    ui.open = { li, opener, plate, home: plate.parentElement, closing: false };
    fill(li);
    const state = animate() ? Flip.getState(plate) : null;
    slot.append(plate);
    li.classList.add('is-open');
    dialog.showModal();   // focus moves to the dialog's first control
    if (!state) return;
    dialog.classList.add('is-flying');
    context.add(() => {
      gsap.timeline({ onComplete: () => dialog.classList.remove('is-flying') })
        .fromTo(ground, { opacity: 0 }, { opacity: 1, duration: fade(), ease: 'none' }, 0)
        .add(Flip.from(state, { duration: cfg.duration, ease: ease(), scale: true }), 0)
        .from([...copy.children], { opacity: 0, y: 16, duration: cfg.duration * 0.6, ease: ease(), stagger: cfg.stagger * 2 }, cfg.duration * 0.45);
    });
  }

  function land() {
    const o = ui.open;
    const state = animate() && dialog.open ? Flip.getState(o.plate) : null;
    o.home.append(o.plate);
    if (dialog.open) dialog.close();
    gsap.set([ground, ...copy.children], { clearProps: 'opacity,transform' });
    dialog.classList.remove('is-flying');
    o.li.classList.remove('is-open');
    ui.open = null;
    o.opener.focus({ preventScroll: true });   // back on the button that opened it
    if (state) context.add(() => Flip.from(state, { duration: cfg.duration, ease: ease(), scale: true, zIndex: 3 }));
  }

  function closeDetail() {
    const o = ui.open;
    if (!o || o.closing) return;
    o.closing = true;
    if (!animate()) { land(); return; }
    dialog.classList.add('is-flying');
    context.add(() => {
      gsap.timeline({ onComplete: land })
        .to([...copy.children], { opacity: 0, duration: fade(), ease: 'power1.in' }, 0)
        .to(ground, { opacity: 0, duration: fade(), ease: 'none' }, fade() * 0.5);
    });
  }

  viewButtons.forEach((b) => on(ctx, b, 'click', () => setView(b.dataset.view)));
  filterButtons.forEach((b) => on(ctx, b, 'click', () => setFilter(b.dataset.filter)));
  items.forEach((li) => { const opener = li.querySelector('[data-open]'); on(ctx, opener, 'click', () => openDetail(li, opener)); });
  on(ctx, dialog.querySelector('[data-close]'), 'click', closeDetail);
  // Escape runs the authored close instead of the dialog's instant one.
  on(ctx, dialog, 'cancel', (e) => { e.preventDefault(); closeDetail(); });
  // Closed some other way: settle at once so the picture is never left in the dialog.
  on(ctx, dialog, 'close', () => { if (ui.open && !ui.open.closing) { ui.open.closing = true; land(); } });
  ctx.onCleanup(() => { if (dialog.open) dialog.close(); });

  return {
    update(next) { cfg = { ...next }; },
    action(id) {
      if (id === 'view') setView(ui.view === 'grid' ? 'list' : 'grid');
      if (id === 'open') {
        if (ui.open) { closeDetail(); return; }
        const li = visible()[0];
        if (li) openDetail(li, li.querySelector('[data-open]'));
      }
    },
  };
}

function imgTag(item) {
  return `<img src="${item.srcSm || item.src}" alt="" decoding="async" style="object-position:${item.focus || '50% 50%'}">`;
}
