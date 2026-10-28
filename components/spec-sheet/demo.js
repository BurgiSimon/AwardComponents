// Specification sheet — Ostra's Luma Lamp product page. The facts are one <dl> of term/description pairs with the
// units as real text; a size choice (Table / Floor) and a units switch (metric / imperial) are native radio groups
// that rewrite the values in place. A value that changed rises ~0.4 em into place (30 ms stagger) through WAAPI;
// a dimensioned line drawing follows both switches. Care and delivery are native <details>. No script library.
// Reduced motion: values fade, the drawing changes without moving. Static: everything swaps at once.
import './demo.css';
import { on, html, raw, photos, imageHTML, content, formatPrice } from '../../src/demo-kit/index.js';

// The lamp in two sizes, in centimetres, metres and kilograms. Imperial is derived, never stored.
const SIZES = {
  table: { label: 'Table', price: 340, height: 46, shade: 30, base: 16, cable: 2.4, weight: 3.2 },
  floor: { label: 'Floor', price: 520, height: 152, shade: 38, base: 28, cable: 3, weight: 6.4 },
};
const UNIT = {
  cm: '<abbr title="centimetres">cm</abbr>', in: '<abbr title="inches">in</abbr>', m: '<abbr title="metres">m</abbr>',
  ft: '<abbr title="feet">ft</abbr>', kg: '<abbr title="kilograms">kg</abbr>', lb: '<abbr title="pounds">lb</abbr>',
};
const num = (n, d = 1) => (Number.isInteger(n) && d === 0 ? String(n) : n.toFixed(d).replace(/\.0$/, ''));

const length = (cm, units) => (units === 'imperial' ? `${num(cm / 2.54)} ${UNIT.in}` : `${num(cm, 0)} ${UNIT.cm}`);
const cable = (m, units) => {
  if (units !== 'imperial') return `${num(m)} ${UNIT.m}`;
  const inches = Math.round(m * 39.3701);
  return `${Math.floor(inches / 12)} ${UNIT.ft} ${inches % 12} ${UNIT.in}`;
};
const weight = (kg, units) => (units === 'imperial' ? `${num(kg * 2.20462)} ${UNIT.lb}` : `${num(kg)} ${UNIT.kg}`);

// Each row: a term and a description built from the size and the units (raw markup: the units are <abbr>).
const ROWS = [
  ['Height', (s, u) => length(s.height, u)],
  ['Shade diameter', (s, u) => length(s.shade, u)],
  ['Base diameter', (s, u) => length(s.base, u)],
  ['Cable', (s, u) => `${cable(s.cable, u)}, braided linen`],
  ['Weight', (s, u) => weight(s.weight, u)],
  ['Light', () => 'E27 LED, 8 W, 806 lm, 2700 K'],
  ['Dimmer', () => 'In-line, ten steps'],
  ['Materials', () => 'Mouth-blown opal glass, brushed brass'],
];

// Plain text of a value for the drawing's labels (no markup inside SVG text).
const plain = (markup) => markup.replace(/<[^>]+>/g, '');

export default function mount(root, options, ctx) {
  const { shop } = content;
  const lamp = shop.products.find((p) => p.id === 'luma-lamp');
  let cfg = { ...options };
  const state = { size: 'table', units: cfg.units };

  // A lamp picture when the set has one, else the closest thing; the drawn stand-in last.
  const pick = [['lamp'], ['glass'], ['interior', 'light'], ['object']].map((tags) => photos({ tags, count: 1, seed: 'ss-luma' })[0]);
  const pic = pick.find((p) => !p.drawn) || pick[0];

  root.className = 'ss';
  root.innerHTML = html`
    <header class="ac-bar ss__bar">
      <a class="ac-brand" href="#top">${shop.name}</a>
      <nav aria-label="Shop"><a href="#top">Ceramics</a><a href="#top" aria-current="page">Lighting</a><a href="#top">Textiles</a><a href="#top">Journal</a></nav>
      <a class="ss__bag" href="#top">Bag <span class="ss__count" data-bag>0</span></a>
    </header>
    <main class="ss__page ac-wrap">
      <section class="ss__spec" aria-labelledby="ss-title">
        <figure class="ss__fig">
          <div class="ac-media ss__photo">${raw(imageHTML(pic, { sizes: '(min-width: 760px) 50vw, 100vw', eager: true, alt: pic.drawn ? '' : pic.alt }))}</div>
          <figcaption class="ss__draw" data-draw>
            <svg viewBox="0 0 220 250" aria-hidden="true">
              <defs><radialGradient id="ss-glass" cx="0.36" cy="0.32" r="0.75"><stop offset="0" class="ss__glass-hi"/><stop offset="1" class="ss__glass-lo"/></radialGradient></defs>
              <rect class="ss__ground" x="12" y="226" width="196" height="1"/>
              <circle class="ss__globe" data-g="globe" cx="92"/>
              <rect class="ss__stem" data-g="stem" width="4"/>
              <rect class="ss__stem" data-g="collar" width="12" height="5" rx="1"/>
              <rect class="ss__base" data-g="base" rx="2"/>
              <rect class="ss__dim" data-g="vline" x="188" width="1"/>
              <rect class="ss__dim" data-g="vtop" x="183" width="11" height="1"/>
              <rect class="ss__dim" data-g="vbot" x="183" width="11" height="1"/>
              <rect class="ss__dim" data-g="hline" height="1"/>
              <rect class="ss__dim" data-g="hl" width="1" height="11"/>
              <rect class="ss__dim" data-g="hr" width="1" height="11"/>
              <text class="ss__dim-label" data-g="vlabel" text-anchor="middle"></text>
              <text class="ss__dim-label" data-g="hlabel" text-anchor="middle"></text>
            </svg>
            <span class="ac-label" data-draw-caption></span>
          </figcaption>
        </figure>

        <div class="ss__facts">
          <div class="ss__lead">
            <div class="ss__intro">
              <p class="ac-label">Lighting · Mouth-blown glass</p>
              <h1 class="ac-h1" id="ss-title">${lamp.name}</h1>
              <p class="ac-body">A globe of opal glass on a brushed brass stem. The light comes through the whole shade: warm, even, no bright spot.</p>
            </div>

            <form class="ss__buy" data-buy>
              <fieldset class="ss__seg ss__seg--size">
                <legend class="sr-only">Size</legend>
                ${Object.entries(SIZES).map(([id, s]) => html`<label><input type="radio" name="ss-size" value="${id}"><span>${s.label}</span></label>`)}
              </fieldset>
              <button class="ac-btn ac-btn--lg ss__add" type="submit">Add to bag <span class="ss__dot" aria-hidden="true">·</span> <span data-price></span></button>
              <p class="ac-small ss__status" role="status" data-status></p>
            </form>
          </div>

          <div class="ss__sheet">
            <div class="ss__head">
              <h2 class="ac-h3" id="ss-spec">Specification</h2>
              <fieldset class="ss__seg ss__seg--units">
                <legend class="sr-only">Units</legend>
                <label><input type="radio" name="ss-units" value="metric"><span>cm · kg</span></label>
                <label><input type="radio" name="ss-units" value="imperial"><span>in · lb</span></label>
              </fieldset>
            </div>
            <dl class="ss__dl">
              ${ROWS.map(([term], i) => html`<dt>${term}</dt><dd><span class="ss__val" data-row="${i}"></span></dd>`)}
            </dl>

            <div class="ss__more" data-more>
              <details>
                <summary><span>Care</span><span class="ss__plus" aria-hidden="true"></span></summary>
                <p class="ac-body">Dust the glass with a dry cloth. To wash it, let the lamp cool, lift the shade off its three brass clips and rinse it by hand in warm water. The brass darkens where it is touched; leave it, or bring it back with a soft cloth and a little wax.</p>
              </details>
              <details>
                <summary><span>Delivery and returns</span><span class="ss__plus" aria-hidden="true"></span></summary>
                <p class="ac-body">Made to order in Småland and assembled in Os, then sent in a moulded pulp crate within 8–12 working days. Delivery is free in the EU on orders over ${formatPrice(shop.freeShippingFrom)}. Return it unused within 30 days, in the crate it came in.</p>
              </details>
            </div>
          </div>
        </div>
      </section>
    </main>`;

  root.querySelectorAll('a[href="#top"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const vals = [...root.querySelectorAll('[data-row]')];
  const g = Object.fromEntries([...root.querySelectorAll('[data-g]')].map((el) => [el.dataset.g, el]));
  const drawCaption = root.querySelector('[data-draw-caption]');
  const price = root.querySelector('[data-price]');
  const status = root.querySelector('[data-status]');
  const bag = root.querySelector('[data-bag]');
  const sizeRadios = [...root.querySelectorAll('input[name="ss-size"]')];
  const unitRadios = [...root.querySelectorAll('input[name="ss-units"]')];
  let count = 0;

  // A changed value rises into place (or fades); the first render and static motion just write the text.
  const write = (el, markup, i, animate) => {
    if (el.innerHTML === markup) return false;
    el.innerHTML = markup;
    const style = ctx.motion === 'static' ? 'none' : ctx.motion === 'reduced' && cfg.change === 'rise' ? 'fade' : cfg.change;
    if (!animate || style === 'none') return true;
    const from = style === 'rise' ? { opacity: 0, transform: 'translateY(0.45em)' } : { opacity: 0 };
    el.animate([from, { opacity: 1, transform: 'none' }], { duration: style === 'rise' ? 420 : 280, delay: i * 30, easing: 'cubic-bezier(0.2, 0.7, 0.1, 1)', fill: 'backwards' });
    return true;
  };

  // The drawing: geometry from the size, scaled so the lamp is 172 units tall; set as CSS geometry properties so a
  // size change transitions (attributes too, for engines without SVG geometry in CSS).
  const set = (el, props) => {
    for (const [k, v] of Object.entries(props)) {
      el.setAttribute(k, v);
      if (k !== 'transform') el.style.setProperty(k, `${v}px`);
    }
  };
  const draw = () => {
    const s = SIZES[state.size];
    const k = 172 / s.height;
    const ground = 226;
    const top = ground - 172;
    const r = (s.shade / 2) * k;
    const cx = 92;
    const baseH = Math.max(4, Math.min(9, 2 * k));
    set(g.globe, { cy: top + r, r });
    set(g.collar, { x: cx - 6, y: top + r * 2 - 2 });
    set(g.stem, { x: cx - 2, y: top + r * 2 + 2, height: Math.max(0, ground - baseH - (top + r * 2 + 2)) });
    set(g.base, { x: cx - (s.base / 2) * k, y: ground - baseH, width: s.base * k, height: baseH });
    set(g.vline, { y: top, height: 172 });
    set(g.vtop, { y: top });
    set(g.vbot, { y: ground });
    set(g.hline, { x: cx - r, y: top - 14, width: r * 2 });
    set(g.hl, { x: cx - r, y: top - 19 });
    set(g.hr, { x: cx + r, y: top - 19 });
    g.vlabel.style.transform = `translate(204px, ${top + 86}px) rotate(-90deg)`;
    g.hlabel.style.transform = `translate(${cx}px, ${top - 24}px)`;
    g.vlabel.textContent = plain(length(s.height, state.units));
    g.hlabel.textContent = `Ø ${plain(length(s.shade, state.units))}`;
    drawCaption.textContent = `${s.label} · ${state.units === 'imperial' ? 'inches' : 'centimetres'}`;
  };

  const render = (animate) => {
    const s = SIZES[state.size];
    let n = 0;
    ROWS.forEach(([, fn], i) => { if (write(vals[i], fn(s, state.units), n, animate)) n++; });
    price.textContent = formatPrice(s.price);
    sizeRadios.forEach((r) => { r.checked = r.value === state.size; });
    unitRadios.forEach((r) => { r.checked = r.value === state.units; });
    draw();
  };

  sizeRadios.forEach((r) => on(ctx, r, 'change', () => { state.size = r.value; render(true); }));
  unitRadios.forEach((r) => on(ctx, r, 'change', () => { state.units = r.value; render(true); }));
  on(ctx, root.querySelector('[data-buy]'), 'submit', (e) => {
    e.preventDefault();
    count++;
    bag.textContent = String(count);
    status.textContent = `Added: ${lamp.name}, ${SIZES[state.size].label.toLowerCase()} size, ${formatPrice(SIZES[state.size].price)}.`;
  });

  const apply = () => {
    root.dataset.layout = cfg.layout;
    root.querySelector('[data-draw]').hidden = !cfg.drawing;
    root.querySelector('[data-more]').hidden = !cfg.care;
  };
  apply();
  render(false);

  return {
    update(next, changed) {
      cfg = { ...next };
      if (changed.includes('units')) { state.units = cfg.units; render(true); }
      apply();
    },
  };
}
