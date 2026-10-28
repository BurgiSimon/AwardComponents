// Cart drawer — Ostra's autumn kiln: three product cards (one link each; size radios and a quick add beside it) and
// the bag behind the header's Bag (n) button. An add answers in words (a polite status) and a number (the count),
// plus the button's own 1.4 s "Added" state. The bag is a native <dialog> opened with showModal(): page inert and
// locked, focus on its heading; Escape (cancel), Close, the scrim and the empty state all end in the dialog's close
// event, which returns focus to the bag button. Lines are keyed and updated in place so a focused stepper survives.
// Full: the panel slides from the inline edge (bottom sheet on phones); reduced: fades; static: appears.
import './demo.css';
import { on, later, html, raw, photo, photos, imageHTML, content } from '../../src/demo-kit/index.js';

const MAX_QTY = 9;
const ADDED_MS = 1400;
const EASE_IN = 'cubic-bezier(0.16, 1, 0.3, 1)';
const EASE_OUT = 'cubic-bezier(0.7, 0, 0.84, 0)';
const FADE = 180;

// One price list per currency (rounded the way a shop would set it), held in minor units so sums never drift.
const CURRENCIES = {
  EUR: { locale: 'en-IE', rate: 1, round: 1 },
  GBP: { locale: 'en-GB', rate: 0.86, round: 1 },
  NOK: { locale: 'nb-NO', rate: 11.6, round: 10 },
  USD: { locale: 'en-US', rate: 1.08, round: 1 },
};
const listPrice = (eur, code) => {
  const c = CURRENCIES[code];
  return Math.round((eur * c.rate) / c.round) * c.round * 100;
};

// Three pieces with a real choice each; the vase's large size is sold out and stays focusable. Each names the
// picture from the shared set that shows it, and falls back to any ceramic when that picture is missing.
const PRODUCTS = [
  { id: 'tide-vase', name: 'Tide Vase', glaze: 'Celadon glaze, porcelain stoneware', pic: 'obj-celadon-vase', options: [{ v: 'S', eur: 118 }, { v: 'M', eur: 148 }, { v: 'L', eur: 178, out: true }], pick: 1 },
  { id: 'ember-bowl', name: 'Ember Tea Bowl', glaze: 'Streaked iron glaze, stoneware', pic: 'obj-jian-tea-bowl', options: [{ v: '180 ml', eur: 32 }, { v: '260 ml', eur: 38 }], pick: 0 },
  { id: 'fern-vase', name: 'Fern Vase', glaze: 'Matte leaf-green glaze, earthenware', pic: 'obj-grueby-vase', options: [{ v: 'Short', eur: 86 }, { v: 'Tall', eur: 124 }], pick: 0 },
];

export default function mount(root, options, ctx) {
  const { shop } = content;
  let cfg = { ...options };
  const pics = PRODUCTS.map((p, i) => { const hit = photo(p.pic); return hit.drawn ? photos({ tags: ['ceramic'], count: i + 1, seed: 'cd-kiln' })[i] : hit; });

  let money; let tag;
  const setCurrency = () => {
    const c = CURRENCIES[cfg.currency];
    money = new Intl.NumberFormat(c.locale, { style: 'currency', currency: cfg.currency });
    tag = new Intl.NumberFormat(c.locale, { style: 'currency', currency: cfg.currency, trailingZeroDisplay: 'stripIfInteger' });
  };
  setCurrency();
  const fmt = (minor) => money.format(minor / 100);
  const fmtTag = (minor) => tag.format(minor / 100);
  const unitOf = (line) => listPrice(line.eur, cfg.currency);

  root.className = 'cd';
  root.dataset.side = cfg.side;
  root.innerHTML = html`
    <header class="ac-bar cd__bar">
      <a class="ac-brand" href="#top">${shop.name}</a>
      <nav aria-label="Shop"><a href="#top" aria-current="page">Ceramics</a><a href="#top">Lighting</a><a href="#top">Textiles</a><a href="#top">Journal</a></nav>
      <button class="cd__bag-btn" type="button" aria-haspopup="dialog" aria-controls="cd-bag" aria-expanded="false" data-opener>Bag (<span data-count>0</span>)</button>
    </header>

    <main class="cd__main ac-wrap">
      <div class="cd__intro">
        <div>
          <p class="ac-label">New from the kiln · Autumn run</p>
          <h1 class="ac-h1">Fired in October, in runs of forty.</h1>
        </div>
        <p class="ac-body">Thrown and glazed in our workshop in Os. When a size is gone it comes back with the spring firing.</p>
      </div>
      <p class="cd__status" role="status" data-announce></p>

      <ul class="cd__grid" role="list">
        ${PRODUCTS.map((p, i) => html`
          <li class="cd__card" data-product="${p.id}">
            <a class="cd__link" href="#top">
              <span class="cd__media ac-media">${raw(imageHTML(pics[i], { sizes: '(min-width: 760px) 33vw, 100vw', eager: true, alt: '' }))}</span>
              <span class="cd__meta"><span class="cd__name">${p.name}</span><span class="cd__price" data-price></span></span>
              <span class="cd__glaze">${p.glaze}</span>
            </a>
            <div class="cd__buy">
              <fieldset class="cd__sizes">
                <legend class="sr-only">Size of ${p.name}</legend>
                ${p.options.map((o, k) => html`<label class="cd__size ${o.out ? 'cd__size--out' : ''}"><input type="radio" name="cd-${p.id}" value="${o.v}" ${k === p.pick ? raw('checked') : ''} ${o.out ? raw('data-out') : ''} aria-describedby="cd-note-${p.id}"><span>${o.v}</span>${o.out ? html`<span class="sr-only"> sold out</span>` : ''}</label>`)}
              </fieldset>
              <button class="cd__add" type="button" data-add><span class="cd__add-label">Add to bag</span><span class="cd__add-done" aria-hidden="true">Added</span></button>
            </div>
            <p class="cd__note" id="cd-note-${p.id}" data-note></p>
          </li>`)}
      </ul>
    </main>

    <dialog class="cd__bag" id="cd-bag" aria-labelledby="cd-bag-title" data-bag>
      <div class="cd__scrim" data-scrim></div>
      <div class="cd__panel" data-panel>
        <header class="cd__bag-head">
          <h2 class="cd__bag-title" id="cd-bag-title" tabindex="-1">Your bag</h2>
          <p class="ac-label" data-bag-count></p>
          <button class="cd__close" type="button" data-close>Close</button>
        </header>
        <div class="cd__ship" data-ship>
          <p data-ship-text></p>
          <div class="cd__meter" aria-hidden="true"><i data-ship-bar></i></div>
        </div>
        <div class="cd__body">
          <ul class="cd__lines" role="list" data-lines></ul>
          <div class="cd__empty" data-empty>
            <p class="ac-h3">Your bag is empty.</p>
            <button class="ac-btn ac-btn--ghost" type="button" data-close>Back to the shop</button>
          </div>
        </div>
        <footer class="cd__foot">
          <dl class="cd__sum"><dt>Subtotal</dt><dd data-subtotal></dd></dl>
          <p class="ac-small cd__tax">VAT included. Delivery is worked out at checkout.</p>
          <button class="ac-btn ac-btn--lg cd__checkout" type="button" data-checkout>Check out</button>
          <p class="cd__demo ac-label" data-demo></p>
          <p class="sr-only" role="status" data-bag-announce></p>
        </footer>
      </div>
    </dialog>`;
  root.querySelectorAll('a[href="#top"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const $ = (s) => root.querySelector(s);
  const opener = $('[data-opener]');
  const countEl = $('[data-count]');
  const announce = $('[data-announce]');
  const dialog = $('[data-bag]');
  const panel = $('[data-panel]');
  const scrim = $('[data-scrim]');
  const title = $('#cd-bag-title');
  const list = $('[data-lines]');
  const empty = $('[data-empty]');
  const subtotalEl = $('[data-subtotal]');
  const bagCount = $('[data-bag-count]');
  const bagAnnounce = $('[data-bag-announce]');
  const shipText = $('[data-ship-text]');
  const shipBar = $('[data-ship-bar]');
  const demoNote = $('[data-demo]');
  const sheet = matchMedia('(max-width: 767.98px)');
  const say = (region, message) => { region.textContent = message; };

  // The cart, keyed "product:option". A real shop keeps it on its commerce backend behind a cart id.
  const cart = new Map();
  const lines = () => [...cart.values()];
  const count = () => lines().reduce((n, l) => n + l.qty, 0);
  const subtotal = () => lines().reduce((s, l) => s + l.qty * unitOf(l), 0);
  const pieces = (n) => `${n} ${n === 1 ? 'piece' : 'pieces'}`;
  const named = (l) => `${l.name}, ${l.option}`;

  // ---------- Cards: the price follows the choice at once; the add button's name follows it too.
  const cards = PRODUCTS.map((p, i) => {
    const card = root.querySelectorAll('[data-product]')[i];
    const price = card.querySelector('[data-price]');
    const note = card.querySelector('[data-note]');
    const button = card.querySelector('[data-add]');
    const chosen = () => card.querySelector('input:checked');
    const optionOf = (r) => p.options.find((o) => o.v === r.value);
    const inStock = () => p.options.filter((o) => !o.out).map((o) => o.v);
    const soldOutText = (r) => `${r.value} is sold out. ${inStock().join(' and ')} ${inStock().length === 1 ? 'is' : 'are'} in stock.`;
    let timer = 0;
    const sync = () => {
      const r = chosen();
      const out = r.hasAttribute('data-out');
      price.textContent = fmtTag(listPrice(optionOf(r).eur, cfg.currency));
      button.setAttribute('aria-label', `Add to bag, ${p.name}, ${r.value}${out ? ', sold out' : ''}`);
      note.textContent = out ? soldOutText(r) : '';
    };
    on(ctx, card, 'change', sync);
    on(ctx, button, 'click', () => add());
    const add = (quiet = false) => {
      const r = chosen();
      if (r.hasAttribute('data-out')) { say(announce, `Not added. ${p.name}: ${soldOutText(r)}`); return; }
      const key = `${p.id}:${r.value}`;
      const line = cart.get(key) ?? { key, id: p.id, index: i, name: p.name, option: r.value, eur: optionOf(r).eur, qty: 0 };
      if (line.qty >= MAX_QTY) {
        note.textContent = `${MAX_QTY} is the most per order for ${r.value}.`;
        say(announce, `Not added. ${named(line)}: ${note.textContent}`);
        return;
      }
      line.qty += 1;
      cart.set(key, line);
      render();
      if (quiet) return;
      // The answer is words and a number, never only an animation.
      say(announce, `Added ${named(line)} to the bag. ${pieces(count())} in the bag.`);
      button.dataset.added = '';
      opener.classList.add('is-bumped');
      clearTimeout(timer);
      timer = setTimeout(() => { delete button.dataset.added; opener.classList.remove('is-bumped'); }, ADDED_MS);
      if (cfg.openOnAdd) open();
    };
    ctx.onCleanup(() => clearTimeout(timer));
    return { sync, add, card };
  });

  // ---------- The bag: keyed lines updated in place.
  const lineHTML = (l) => {
    const n = named(l);
    return html`<li class="cd__line" data-key="${l.key}">
      <span class="cd__thumb ac-media">${raw(imageHTML(pics[l.index], { sizes: '72px', alt: '' }))}</span>
      <div class="cd__line-info"><p class="cd__line-name">${l.name}</p><p class="cd__line-meta">${l.option} · <span data-each></span> each</p></div>
      <p class="cd__line-total" data-total></p>
      <div class="cd__stepper" role="group" aria-label="Quantity of ${n}">
        <button type="button" data-step="-1" aria-label="Decrease quantity of ${n}"><span aria-hidden="true">−</span></button>
        <input type="number" inputmode="numeric" min="1" max="${MAX_QTY}" step="1" aria-label="Quantity of ${n}" data-qty>
        <button type="button" data-step="1" aria-label="Increase quantity of ${n}"><span aria-hidden="true">+</span></button>
      </div>
      <button class="cd__remove" type="button" data-remove>Remove<span class="sr-only"> ${n}</span></button>
    </li>`;
  };

  const render = () => {
    const n = count();
    const sum = subtotal();
    countEl.textContent = String(n);
    bagCount.textContent = pieces(n);
    subtotalEl.textContent = fmt(sum);
    panel.toggleAttribute('data-empty', n === 0);
    empty.hidden = n > 0;
    const keep = new Set();
    for (const l of lines()) {
      keep.add(l.key);
      let li = list.querySelector(`[data-key="${CSS.escape(l.key)}"]`);
      if (!li) { list.insertAdjacentHTML('beforeend', String(lineHTML(l))); li = list.lastElementChild; }
      const qty = li.querySelector('[data-qty]');
      if (qty.value !== String(l.qty)) qty.value = String(l.qty);
      li.querySelector('[data-each]').textContent = fmt(unitOf(l));
      li.querySelector('[data-total]').textContent = fmt(l.qty * unitOf(l));
      // aria-disabled, not disabled: a disabled button would drop focus to <body> at its limit.
      li.querySelector('[data-step="-1"]').setAttribute('aria-disabled', String(l.qty <= 1));
      li.querySelector('[data-step="1"]').setAttribute('aria-disabled', String(l.qty >= MAX_QTY));
    }
    for (const li of list.querySelectorAll('[data-key]')) if (!keep.has(li.dataset.key)) li.remove();
    // Free delivery from the shop's threshold, in the same currency's price list.
    const free = listPrice(shop.freeShippingFrom, cfg.currency);
    const left = Math.max(0, free - sum);
    shipText.innerHTML = left > 0 ? html`<strong>${fmt(left)}</strong> more for free delivery` : html`<strong>Free delivery</strong> on this order`;
    shipBar.style.transform = `scaleX(${Math.min(1, sum / free).toFixed(4)})`;
    $('[data-ship]').classList.toggle('is-free', left === 0);
  };

  on(ctx, list, 'click', (e) => {
    const li = e.target.closest('[data-key]');
    const line = li && cart.get(li.dataset.key);
    if (!line) return;
    const step = e.target.closest('[data-step]');
    if (step) {
      if (step.getAttribute('aria-disabled') === 'true') {
        say(bagAnnounce, line.qty <= 1 ? `${named(line)}: 1 is the fewest. Use Remove to take it out.` : `${named(line)}: ${MAX_QTY} is the most per order.`);
        return;
      }
      line.qty += Number(step.dataset.step);
      render();
      say(bagAnnounce, `${named(line)}: ${line.qty}. Subtotal ${fmt(subtotal())}.`);
      return;
    }
    if (e.target.closest('[data-remove]')) {
      cart.delete(line.key);
      render();
      title.focus(); // the focused button is gone; the heading is the stable place to land
      say(bagAnnounce, cart.size ? `Removed ${named(line)}. Subtotal ${fmt(subtotal())}.` : `Removed ${named(line)}. Your bag is empty.`);
    }
  });
  on(ctx, list, 'change', (e) => {
    const input = e.target.closest('[data-qty]');
    const line = input && cart.get(input.closest('[data-key]').dataset.key);
    if (!line) return;
    const v = Math.round(Number(input.value));
    line.qty = Number.isFinite(v) && v > 0 ? Math.min(MAX_QTY, v) : line.qty;
    render();
    say(bagAnnounce, `${named(line)}: ${line.qty}. Subtotal ${fmt(subtotal())}.`);
  });
  on(ctx, $('[data-checkout]'), 'click', () => {
    demoNote.textContent = 'Demo only: a real shop hands you to its hosted checkout here. Nothing was charged.';
    say(bagAnnounce, demoNote.textContent);
  });

  // ---------- The drawer. Every way out ends in the dialog's close event.
  let running = [];
  let closing = false;
  const cancelRunning = () => { for (const a of running) a.cancel(); running = []; };
  const edge = () => {
    if (sheet.matches) return 'translateY(100%)';
    const fromStart = cfg.side === 'start';
    const rtl = getComputedStyle(panel).direction === 'rtl';
    return (fromStart !== rtl) ? 'translateX(-100%)' : 'translateX(100%)';
  };

  const open = () => {
    if (dialog.open) return;
    render();
    closing = false;
    document.documentElement.classList.add('cd-locked'); // a modal dialog does not stop the page behind it scrolling
    dialog.showModal();
    opener.setAttribute('aria-expanded', 'true');
    title.focus();
    cancelRunning();
    if (ctx.motion === 'static') return;
    const slide = ctx.motion === 'full';
    const opts = { duration: slide ? cfg.slide : FADE, easing: slide ? EASE_IN : 'linear', fill: 'both' };
    running = [
      panel.animate(slide ? [{ transform: edge() }, { transform: 'none' }] : [{ opacity: 0 }, { opacity: 1 }], opts),
      scrim.animate([{ opacity: 0 }, { opacity: 1 }], { ...opts, easing: 'linear' }),
    ];
  };

  const close = () => {
    if (!dialog.open || closing) return;
    closing = true;
    let timer = 0;
    const done = () => { clearTimeout(timer); if (dialog.open) dialog.close(); };
    // A timer backs up the animation's finished promise, so the bag always closes even if no frame is drawn.
    const settle = (anim, ms) => { anim.finished.then(done, () => {}); timer = setTimeout(done, ms + 120); ctx.onCleanup(() => clearTimeout(timer)); };
    if (ctx.motion === 'static') { done(); return; }
    // Closed while still opening: the same animations run backwards from where they are, no jump.
    const opening = running.find((a) => a.playState === 'running');
    if (opening) { for (const a of running) a.reverse(); settle(opening, cfg.slide); return; }
    cancelRunning();
    const slide = ctx.motion === 'full';
    const opts = { duration: slide ? Math.round(cfg.slide * 0.7) : FADE, easing: slide ? EASE_OUT : 'linear', fill: 'forwards' };
    running = [
      panel.animate(slide ? [{ transform: 'none' }, { transform: edge() }] : [{ opacity: 1 }, { opacity: 0 }], opts),
      scrim.animate([{ opacity: 1 }, { opacity: 0 }], { ...opts, easing: 'linear' }),
    ];
    settle(running[0], opts.duration);
  };

  on(ctx, dialog, 'close', () => {
    cancelRunning();
    closing = false;
    document.documentElement.classList.remove('cd-locked');
    opener.setAttribute('aria-expanded', 'false');
    opener.focus();
  });
  // Escape arrives as cancel: take it over so the exit plays its tier instead of cutting.
  on(ctx, dialog, 'cancel', (e) => { e.preventDefault(); close(); });
  on(ctx, opener, 'click', open);
  on(ctx, scrim, 'click', close);
  root.querySelectorAll('[data-close]').forEach((b) => on(ctx, b, 'click', close));
  ctx.onCleanup(() => { cancelRunning(); document.documentElement.classList.remove('cd-locked'); });

  const apply = () => {
    root.dataset.side = cfg.side;
    $('[data-ship]').hidden = !cfg.shipping;
  };
  cards.forEach((c) => c.sync());
  render();
  apply();

  return {
    update(next, changed) {
      cfg = { ...next };
      if (changed.includes('currency')) { setCurrency(); cards.forEach((c) => c.sync()); render(); }
      apply();
    },
    action(id) {
      if (id === 'open') open();
      if (id === 'sample') {
        // A tea bowl and the short vase: under the free-delivery line, so the meter has something to show.
        if (!cart.size) {
          const bowl = cards[1].card.querySelector('input[value="260 ml"]');
          bowl.checked = true;
          cards[1].sync();
          cards[1].add(true);
          cards[2].add(true);
        }
        later(ctx, open, 60);
      }
    },
  };
}
