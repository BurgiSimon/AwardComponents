// Specification sheet — the facts block of Ostra's Tide Vase: a dimensioned drawing beside one <dl> of term/
// description pairs with the units as real text. A size choice (S / M / L) and a units switch (metric / imperial)
// are native radio groups that rewrite the values in place. A value that changed rises ~0.45 em into place (30 ms
// stagger) through WAAPI; the profile drawing, at one shared scale, follows both switches. No script library.
// Reduced motion: values fade, the drawing changes without moving. Static: everything swaps.
import './demo.css';
import { on, html, content } from '../../src/demo-kit/index.js';

// The vase in three sizes, in centimetres, litres and kilograms. Imperial is derived, never stored.
const SIZES = {
  s: { label: 'S', height: 24, diameter: 11, opening: 3, capacity: 0.8, weight: 0.9 },
  m: { label: 'M', height: 32, diameter: 14, opening: 3.5, capacity: 1.6, weight: 1.4 },
  l: { label: 'L', height: 40, diameter: 17, opening: 4, capacity: 2.9, weight: 2.3 },
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

  root.className = 'ss';
  root.innerHTML = html`
    <section class="ac-stage ss__stage" aria-label="${vase.name} specification">
      <div class="ss__spec">
        <div class="ss__side">
          <figure class="ss__draw" data-draw>
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
            <figcaption class="ac-label" data-draw-caption></figcaption>
          </figure>
          <fieldset class="ss__seg ss__seg--size">
            <legend class="sr-only">Size</legend>
            ${Object.entries(SIZES).map(([id, s]) => html`<label><input type="radio" name="ss-size" value="${id}"><span>${s.label}</span></label>`)}
          </fieldset>
        </div>

        <div class="ss__sheet">
          <div class="ss__head">
            <h2 class="ac-h3" id="ss-spec">${vase.name}</h2>
            <fieldset class="ss__seg ss__seg--units">
              <legend class="sr-only">Units</legend>
              <label><input type="radio" name="ss-units" value="metric"><span>cm · kg</span></label>
              <label><input type="radio" name="ss-units" value="imperial"><span>in · lb</span></label>
            </fieldset>
          </div>
          <dl class="ss__dl" aria-labelledby="ss-spec">
            ${ROWS.map(([term], i) => html`<dt>${term}</dt><dd><span class="ss__val" data-row="${i}"></span></dd>`)}
          </dl>
        </div>
      </div>
      <p class="ac-stage__note"><span>${shop.name} · product page</span></p>
    </section>`;

  const vals = [...root.querySelectorAll('[data-row]')];
  const g = Object.fromEntries([...root.querySelectorAll('[data-g]')].map((el) => [el.dataset.g, el]));
  const drawCaption = root.querySelector('[data-draw-caption]');
  const sizeRadios = [...root.querySelectorAll('input[name="ss-size"]')];
  const unitRadios = [...root.querySelectorAll('input[name="ss-units"]')];

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
    sizeRadios.forEach((r) => { r.checked = r.value === state.size; });
    unitRadios.forEach((r) => { r.checked = r.value === state.units; });
    draw();
  };

  sizeRadios.forEach((r) => on(ctx, r, 'change', () => { state.size = r.value; render(true); }));
  unitRadios.forEach((r) => on(ctx, r, 'change', () => { state.units = r.value; render(true); }));

  const apply = () => {
    root.querySelector('[data-draw]').hidden = !cfg.drawing;
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
