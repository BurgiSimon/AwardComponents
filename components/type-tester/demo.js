// Type tester — the typography page of a speaker brand's brand book. A labelled textarea is set live from three
// native range inputs (weight 200–900, width 75–125 %, size), with tracking and leading derived from the size so
// big type closes up the way a typographer would set it. Below, the same words in three registers (the recipe's
// poster / editorial / technical specimens): only hierarchy changes, never the copy. Nothing moves, nothing is
// masked; the registers are ARIA tabs with arrow-key navigation.
import './demo.css';
import { on, html, raw, clamp, smoothstep, content } from '../../src/demo-kit/index.js';

const REGISTERS = [
  { id: 'poster', label: 'Poster', note: 'One thought, held at scale', preset: { weight: 840, width: 125, size: 128 } },
  { id: 'editorial', label: 'Editorial', note: 'Pause, then read on', preset: { weight: 380, width: 100, size: 64 } },
  { id: 'technical', label: 'Technical', note: 'From statement to detail', preset: { weight: 600, width: 82, size: 40 } },
];
const AXES = [
  { id: 'weight', label: 'Weight', min: 200, max: 900, step: 10, unit: '' },
  { id: 'width', label: 'Width', min: 75, max: 125, step: 1, unit: '%' },
  { id: 'size', label: 'Size', min: 16, max: 160, step: 2, unit: 'px' },
];

// Optical setting: tracking and leading close up as the size grows (16 px: −0.005 em / 1.3; 128 px+: −0.045 em / 0.94).
const optical = (px) => {
  const t = smoothstep(clamp((px - 16) / 112, 0, 1));
  return { ls: -0.005 - 0.04 * t, lh: 1.3 - 0.36 * t };
};

export default function mount(root, options, ctx) {
  const { product } = content;
  let cfg = { ...options };
  const state = { weight: cfg.weight, width: cfg.width, size: cfg.size };
  const copy = {
    lead: 'A speaker that measures the room in eight seconds, then stays out of the way.',
    heading: 'Built to be opened',
    body: 'Eight screws hold Kova One together and none of them is hidden. Every part is sold on its own for ten years, so a tired driver or a worn grille is a repair, not a reason to replace the speaker.',
    list: ['Recycled aluminium enclosure', 'Wool-blend grille, replaceable', 'Room tuning in eight seconds'],
    facts: [['Height', '214 mm'], ['Width', '168 mm'], ['Weight', '3.1 kg']],
    caption: `${product.name}, chalk finish. Measured without the base.`,
  };

  const spec = (r) => html`
    <section class="tt-spec tt-spec--${r.id}" role="tabpanel" id="tt-panel-${r.id}" aria-labelledby="tt-tab-${r.id}" tabindex="0">
      <div class="tt-spec__intro">
        <h3 class="tt-spec__title" data-sample>${cfg.sample}</h3>
        <p class="tt-spec__lead">${copy.lead}</p>
      </div>
      <div class="tt-spec__body">
        <div class="tt-spec__reading">
          <h4 class="tt-spec__heading">${copy.heading}</h4>
          <p class="tt-spec__copy">${copy.body}</p>
          <ul class="tt-spec__list">${copy.list.map((li) => html`<li>${li}</li>`)}</ul>
        </div>
        <figure class="tt-spec__figure">
          <dl class="tt-spec__facts">${copy.facts.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>
          <figcaption>${copy.caption}</figcaption>
        </figure>
      </div>
      <p class="tt-spec__glyphs" aria-label="Diagnostic glyphs: g y p q j, A with ring, E with acute, figures and the price">gypqj ÅÉ 0123 €690</p>
    </section>`;

  root.className = 'tt';
  root.innerHTML = html`
    <header class="ac-bar tt__bar">
      <a class="ac-brand" href="#top">${product.maker}<span class="tt__book">Brand book</span></a>
      <nav aria-label="Brand book">${['Logo', 'Colour', 'Typography', 'Voice'].map((n) => html`<a href="#top" ${n === 'Typography' ? raw('aria-current="page"') : ''}>${n}</a>`)}</nav>
    </header>
    <main class="tt__page ac-wrap">
      <header class="tt__head">
        <div>
          <p class="ac-label">03 — Typography</p>
          <h1 class="ac-h1">One family, three registers</h1>
        </div>
        <p class="ac-body">Mona Sans is variable in weight (200–900) and width (75–125 %). Wide and heavy for posters, upright and light for reading, narrow with mono figures for specifications.</p>
      </header>

      <section class="tt__tester" aria-labelledby="tt-tester-h">
        <div class="tt__row">
          <h2 class="ac-label tt__tester-h" id="tt-tester-h">Tester</h2>
          <div class="tt__presets" role="group" aria-label="Load a register’s setting">
            ${REGISTERS.map((r) => html`<button type="button" class="tt__preset" data-preset="${r.id}" aria-pressed="false">${r.label}</button>`)}
          </div>
        </div>
        <label class="sr-only" for="tt-sample">Sample text</label>
        <textarea class="tt__sample" id="tt-sample" rows="1" maxlength="120" spellcheck="false" autocomplete="off">${cfg.sample}</textarea>
        <div class="tt__axes">
          ${AXES.map((a) => html`<div class="tt__axis">
            <label class="ac-label" for="tt-${a.id}">${a.label}</label>
            <output class="ac-num" for="tt-${a.id}" data-out="${a.id}"></output>
            <input type="range" id="tt-${a.id}" data-axis="${a.id}" min="${a.min}" max="${a.max}" step="${a.step}" value="${state[a.id]}">
          </div>`)}
          <code class="tt__css" data-css aria-label="CSS for this setting"></code>
        </div>
      </section>

      <section class="tt__registers" aria-labelledby="tt-reg-h">
        <div class="tt__row">
          <h2 class="ac-label" id="tt-reg-h">Same words, three registers</h2>
          <div class="tt__tabs" role="tablist" aria-label="Registers">
            ${REGISTERS.map((r) => html`<button type="button" role="tab" class="tt__tab" id="tt-tab-${r.id}" aria-controls="tt-panel-${r.id}" aria-selected="false" tabindex="-1" data-tab="${r.id}"><span>${r.label}</span><small>${r.note}</small></button>`)}
          </div>
        </div>
        ${REGISTERS.map(spec)}
      </section>
    </main>`;
  root.querySelectorAll('a[href="#top"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const sample = root.querySelector('#tt-sample');
  const inputs = Object.fromEntries([...root.querySelectorAll('[data-axis]')].map((el) => [el.dataset.axis, el]));
  const outs = Object.fromEntries([...root.querySelectorAll('[data-out]')].map((el) => [el.dataset.out, el]));
  const cssOut = root.querySelector('[data-css]');
  const titles = [...root.querySelectorAll('[data-sample]')];
  const tabs = [...root.querySelectorAll('[data-tab]')];
  const presets = [...root.querySelectorAll('[data-preset]')];
  const tester = root.querySelector('.tt__tester');

  // The tester never sets a line wider than its box can hold: the size is capped at 10 % of the box width + 12 px.
  const setType = () => {
    const box = sample.clientWidth || tester.clientWidth;
    const px = Math.round(Math.min(state.size, Math.max(16, box * 0.1 + 12)));
    const { ls, lh } = optical(px);
    sample.style.fontWeight = String(state.weight);
    sample.style.fontStretch = `${state.width}%`;
    sample.style.fontSize = `${px}px`;
    sample.style.letterSpacing = `${ls.toFixed(3)}em`;
    sample.style.lineHeight = lh.toFixed(2);
    for (const a of AXES) {
      inputs[a.id].value = String(state[a.id]);
      outs[a.id].textContent = a.id === 'size' && px < state.size ? `${px} px of ${state.size}` : `${state[a.id]}${a.unit ? (a.unit === '%' ? ' %' : ` ${a.unit}`) : ''}`;
    }
    cssOut.textContent = `font: ${state.weight} ${px}px/${lh.toFixed(2)} "Mona Sans"; font-stretch: ${state.width}%; letter-spacing: ${ls.toFixed(3)}em;`;
    presets.forEach((b) => {
      const p = REGISTERS.find((r) => r.id === b.dataset.preset).preset;
      b.setAttribute('aria-pressed', String(p.weight === state.weight && p.width === state.width && p.size === state.size));
    });
    fit();
  };
  // Grow the textarea to its content (field-sizing where supported, this everywhere).
  const fit = () => {
    sample.style.height = 'auto';
    sample.style.height = `${sample.scrollHeight}px`;
  };

  const setSample = (text) => {
    const t = text.trim() || cfg.sample || 'Sound you can stop noticing.';
    titles.forEach((h) => { h.textContent = t; });
  };

  const select = (id, focus = false) => {
    tabs.forEach((t) => {
      const on_ = t.dataset.tab === id;
      t.setAttribute('aria-selected', String(on_));
      t.tabIndex = on_ ? 0 : -1;
      if (on_ && focus) t.focus();
    });
    REGISTERS.forEach((r) => { root.querySelector(`#tt-panel-${r.id}`).hidden = r.id !== id; });
  };

  for (const a of AXES) on(ctx, inputs[a.id], 'input', () => { state[a.id] = Number(inputs[a.id].value); setType(); });
  on(ctx, sample, 'input', () => { setSample(sample.value); fit(); });
  presets.forEach((b) => on(ctx, b, 'click', () => { Object.assign(state, REGISTERS.find((r) => r.id === b.dataset.preset).preset); setType(); }));
  tabs.forEach((t, i) => {
    on(ctx, t, 'click', () => select(t.dataset.tab));
    on(ctx, t, 'keydown', (e) => {
      const n = tabs.length;
      const to = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      select(tabs[to].dataset.tab, true);
    });
  });
  on(ctx, window, 'resize', setType);
  document.fonts?.ready.then(() => { if (!ctx.signal.aborted) fit(); });

  setType();
  select(cfg.register);

  return {
    update(next, changed) {
      cfg = { ...next };
      if (changed.includes('sample')) { sample.value = cfg.sample; setSample(cfg.sample); }
      for (const a of AXES) if (changed.includes(a.id)) state[a.id] = cfg[a.id];
      if (changed.includes('register')) select(cfg.register);
      setType();
    },
  };
}
