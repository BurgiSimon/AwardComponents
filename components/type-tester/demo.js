// Type tester — the tester card from Kova's brand book, alone on the stage. A labelled textarea is set live from three
// native range inputs (weight 200–900, width 75–125 %, size), with tracking and leading derived from the size so big
// type closes up the way a typographer would set it. Three register buttons (the recipe's poster / editorial /
// technical voices) load their setting into the tester and show with aria-pressed which one is set. Nothing moves,
// nothing is masked.
import './demo.css';
import { on, html, clamp, smoothstep, content } from '../../src/demo-kit/index.js';

const REGISTERS = [
  { id: 'poster', label: 'Poster', preset: { weight: 840, width: 125, size: 128 } },
  { id: 'editorial', label: 'Editorial', preset: { weight: 380, width: 100, size: 64 } },
  { id: 'technical', label: 'Technical', preset: { weight: 600, width: 82, size: 40 } },
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
  root.className = 'tt';
  root.innerHTML = html`
    <section class="ac-stage tt__stage" aria-labelledby="tt-tester-h">
      <div class="tt__tester">
        <div class="tt__row">
          <h2 class="ac-label tt__tester-h" id="tt-tester-h">Mona Sans</h2>
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
      </div>
      <p class="ac-stage__note"><span>${product.maker} · brand book</span></p>
    </section>`;

  const sample = root.querySelector('#tt-sample');
  const inputs = Object.fromEntries([...root.querySelectorAll('[data-axis]')].map((el) => [el.dataset.axis, el]));
  const outs = Object.fromEntries([...root.querySelectorAll('[data-out]')].map((el) => [el.dataset.out, el]));
  const cssOut = root.querySelector('[data-css]');
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

  for (const a of AXES) on(ctx, inputs[a.id], 'input', () => { state[a.id] = Number(inputs[a.id].value); setType(); });
  on(ctx, sample, 'input', fit);
  presets.forEach((b) => on(ctx, b, 'click', () => { Object.assign(state, REGISTERS.find((r) => r.id === b.dataset.preset).preset); setType(); }));
  on(ctx, window, 'resize', setType);
  document.fonts?.ready.then(() => { if (!ctx.signal.aborted) fit(); });

  setType();

  return {
    update(next, changed) {
      cfg = { ...next };
      if (changed.includes('sample')) sample.value = cfg.sample;
      for (const a of AXES) if (changed.includes(a.id)) state[a.id] = cfg[a.id];
      setType();
    },
  };
}
