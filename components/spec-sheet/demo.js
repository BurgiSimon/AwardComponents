// Specification sheet — Ostra's Tide Vase product page. The facts are one <dl> of term/description pairs with the
// units as real text; a size choice (S / M / L) and a units switch (metric / imperial) are native radio groups that
// rewrite the values in place. A value that changed rises ~0.45 em into place (30 ms stagger) through WAAPI; a
// dimensioned profile drawing, at one shared scale, follows both switches. Care and delivery are native <details>.
// No script library. Reduced motion: values fade, the drawing changes without moving. Static: everything swaps.
import './demo.css';
import { on, html, raw, photo, photos, imageHTML, content, formatPrice } from '../../src/demo-kit/index.js';

// The vase in three sizes, in centimetres, litres and kilograms. Imperial is derived, never stored.
const SIZES = {
  s: { label: 'S', name: 'small', price: 118, height: 24, diameter: 11, opening: 3, capacity: 0.8, weight: 0.9 },
  m: { label: 'M', name: 'medium', price: 148, height: 32, diameter: 14, opening: 3.5, capacity: 1.6, weight: 1.4 },
  l: { label: 'L', name: 'large', price: 178, height: 40, diameter: 17, opening: 4, capacity: 2.9, weight: 2.3 },
};
const TALLEST = 40;
const UNIT = {
  cm: '<abbr title="centimetres">cm</abbr>', in: '<abbr title="inches">in</abbr>', l: '<abbr title="litres">l</abbr>',
  oz: '<abbr title="US fluid ounces">fl oz</abbr>', kg: '<abbr title="kilograms">kg</abbr>', lb: '<abbr title="pounds">lb</abbr>',
};
const num = (n, d = 1) => n.toFixed(d).replace(/\.0$/, '');

const length = (cm, units) => (units === 'imperial' ? `${num(cm / 2.54)} ${UNIT.in}` : `${num(cm)} ${UNIT.cm}`);
const volume = (l, units) => (units === 'imperial' ? `${Math.round(l * 33.814)} ${UNIT.oz}` : `${num(l)} ${UNIT.l}`);
const weight = (kg, units) => (units === 'imperial' ? `${num(kg * 2.20462)} ${UNIT.lb}` : `${num(kg)} ${UNIT.kg}`);

// Each row: a term and a description built from the size and the units (raw markup: the units are <abbr>).
const ROWS = [
  ['Height', (s, u) => length(s.height, u)],
  ['Diameter', (s, u) => length(s.diameter, u)],
  ['Opening', (s, u) => length(s.opening, u)],
  ['Capacity', (s, u) => volume(s.capacity, u)],
  ['Weight', (s, u) => weight(s.weight, u)],
  ['Body', () => 'Porcelain stoneware, reduction fired at 1,280 °C'],
  ['Glaze', () => 'Celadon, glazed inside, watertight'],
  ['Made in', () => 'Os, Norway, in runs of forty'],
];

// Plain text of a value for the drawing's labels (no markup inside SVG text).
const plain = (markup) => markup.replace(/<[^>]+>/g, '');

// The vase's profile as one path with the same commands for every size, so a CSS transition on `d` can morph it.
function profile(s, k, cx, ground) {
  const H = s.height * k;
  const R1 = (s.diameter / 2) * k; // the widest point of the body
  const R0 = R1 * 0.62;            // the foot
  const Rn = (s.opening / 2) * k * 1.1;
  const Rl = Rn * 1.35;            // the lip
  const y = (f) => (ground - H * f).toFixed(2);
  const side = (dir) => {
    const x = (r) => (cx + dir * r).toFixed(2);
    return { x0: x(R0), x0c: x(R0 + (R1 - R0) * 0.9), x1: x(R1), xn: x(Rn), xl: x(Rl) };
  };
  const r = side(1);
  const l = side(-1);
  return `M${l.x0} ${y(0)} L${r.x0} ${y(0)} C${r.x0c} ${y(0.01)} ${r.x1} ${y(0.15)} ${r.x1} ${y(0.34)} C${r.x1} ${y(0.56)} ${r.xn} ${y(0.6)} ${r.xn} ${y(0.74)} L${r.xn} ${y(0.96)} L${r.xl} ${y(1)} L${l.xl} ${y(1)} L${l.xn} ${y(0.96)} L${l.xn} ${y(0.74)} C${l.xn} ${y(0.6)} ${l.x1} ${y(0.56)} ${l.x1} ${y(0.34)} C${l.x1} ${y(0.15)} ${l.x0c} ${y(0.01)} ${l.x0} ${y(0)} Z`;
}

export default function mount(root, options, ctx) {
  const { shop } = content;
  const vase = shop.products.find((p) => p.id === 'tide-vase');
  let cfg = { ...options };
  const state = { size: 'm', units: cfg.units };

  // The celadon bottle vase from the shared set when it is there, else another ceramic; the drawn stand-in last.
  const pick = [photo('obj-celadon-vase'), ...[['ceramic'], ['object', 'product']].map((tags) => photos({ tags, count: 1, seed: 'ss-vase' })[0])];
  const pic = pick.find((p) => !p.drawn) || pick[0];

  root.className = 'ss';
  root.innerHTML = html`
    <header class="ac-bar ss__bar">
      <a class="ac-brand" href="#top">${shop.name}</a>
      <nav aria-label="Shop"><a href="#top" aria-current="page">Ceramics</a><a href="#top">Lighting</a><a href="#top">Textiles</a><a href="#top">Journal</a></nav>
      <a class="ss__bag" href="#top">Bag <span class="ss__count" data-bag>0</span></a>
    </header>
    <main class="ss__page ac-wrap">
      <section class="ss__spec" aria-labelledby="ss-title">
        <figure class="ss__fig">
          <div class="ac-media ss__photo">${raw(imageHTML(pic, { sizes: '(min-width: 760px) 50vw, 100vw', eager: true, alt: pic.drawn ? '' : pic.alt }))}</div>
          <figcaption class="ss__draw" data-draw>
            <svg viewBox="0 0 220 250" aria-hidden="true">
              <defs><linearGradient id="ss-glaze" x1="0" x2="1"><stop offset="0" class="ss__glaze-lo"/><stop offset="0.38" class="ss__glaze-hi"/><stop offset="1" class="ss__glaze-lo"/></linearGradient></defs>
              <rect class="ss__ground" x="12" y="226" width="196" height="1"/>
              <path class="ss__vase" data-g="vase"/>
              <rect class="ss__dim" data-g="vline" x="188" width="1"/>
              <rect class="ss__dim" data-g="vtop" x="183" width="11" height="1"/>
              <rect class="ss__dim" data-g="vbot" x="183" y="226" width="11" height="1"/>
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
              <p class="ac-label">Ceramics · Celadon glaze</p>
              <h1 class="ac-h1" id="ss-title">${vase.name}</h1>
              <p class="ac-body">A bottle vase thrown in one piece, with a narrow neck that holds a single stem upright. The celadon pools pale green where the glaze runs thick.</p>
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
                <p class="ac-body">Watertight and food-safe, so it can hold water for weeks. Wash it by hand with a bottle brush; the dishwasher will not hurt the glaze, but the felt under the foot will not survive it. Change the water every few days and the celadon stays clear.</p>
              </details>
              <details>
                <summary><span>Delivery and returns</span><span class="ss__plus" aria-hidden="true"></span></summary>
                <p class="ac-body">Thrown and fired in Os, then sent in a moulded pulp cradle within 3–5 working days. Delivery is free in the EU on orders over ${formatPrice(shop.freeShippingFrom)}. Return it unused within 30 days, in the cradle it came in.</p>
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

  // The drawing, at one scale for every size (the tallest is 172 units), so S, M and L read as the sizes they are.
  // Geometry goes in as CSS (`d`, `x`, `y`, `width`) so a size change transitions, and as attributes as a fallback.
  const set = (el, props) => {
    for (const [k, v] of Object.entries(props)) {
      el.setAttribute(k, v);
      el.style.setProperty(k, `${v}px`);
    }
  };
  const draw = () => {
    const s = SIZES[state.size];
    const k = 172 / TALLEST;
    const ground = 226;
    const cx = 92;
    const H = s.height * k;
    const top = ground - H;
    const r = (s.diameter / 2) * k;
    const d = profile(s, k, cx, ground);
    g.vase.setAttribute('d', d);
    g.vase.style.setProperty('d', `path("${d}")`);
    set(g.vline, { y: top, height: H });
    set(g.vtop, { y: top });
    set(g.hline, { x: cx - r, y: top - 14, width: r * 2 });
    set(g.hl, { x: cx - r, y: top - 19 });
    set(g.hr, { x: cx + r, y: top - 19 });
    g.vlabel.style.transform = `translate(204px, ${(top + H / 2).toFixed(1)}px) rotate(-90deg)`;
    g.hlabel.style.transform = `translate(${cx}px, ${(top - 24).toFixed(1)}px)`;
    g.vlabel.textContent = plain(length(s.height, state.units));
    g.hlabel.textContent = `Ø ${plain(length(s.diameter, state.units))}`;
    drawCaption.textContent = `Size ${s.label} · ${state.units === 'imperial' ? 'inches' : 'centimetres'}`;
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
    status.textContent = `Added: ${vase.name}, ${SIZES[state.size].name}, ${formatPrice(SIZES[state.size].price)}.`;
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
