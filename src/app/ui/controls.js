// The tweak panel: one consistent UI for every component's meta.controls. Native inputs underneath (range, radio,
// select, switch button, colour, text) so keyboard and screen readers work without extra code. A control's help
// shows beside the info button next to its label while that button is hovered or keyboard-focused (a tap on touch
// screens), and is always its input's accessible description.
// Demo actions live in the preview toolbar, not here.
// createControls(c, values, { onChange(values, id), footer }) → { el, set(values), values }
import { html, raw, escapeHTML } from '../dom.js';
import { icon } from '../icons.js';
import { normaliseOptions, formatValue, coerce, same, isVisible, changedControls } from '../../registry/options.js';

const uid = (() => { let n = 0; return (p) => `${p}-${++n}`; })();

function fill(control, value) {
  const min = control.min ?? 0;
  const max = control.max ?? 1;
  return `${((Number(value) - min) / (max - min || 1)) * 100}%`;
}

function useSegmented(control) {
  const opts = normaliseOptions(control);
  if (control.display === 'dropdown') return false;
  if (control.display === 'segmented') return true;
  return opts.length <= 4 && opts.reduce((n, o) => n + String(o.label).length, 0) <= 26;
}

function row(control, value, id) {
  const changed = !same(value, control.default);
  const reset = html`<button class="tw-reset" type="button" data-reset="${control.id}" title="Reset to ${formatValue(control, control.default)}" aria-label="Reset ${control.label} to ${formatValue(control, control.default)}">${raw(icon('reset', { size: 12 }))}</button>`;
  const help = control.help ? html`<p class="tw-help" id="${id}-help" role="tooltip" hidden>${control.help}</p>` : '';
  const info = control.help ? html`<button class="tw-info" type="button" aria-label="About ${control.label}" aria-describedby="${id}-help" data-help="${id}-help">${raw(icon('info', { size: 14 }))}</button>` : '';
  const described = control.help ? ` aria-describedby="${id}-help"` : '';
  let body = '';
  let head = '';
  switch (control.type) {
    case 'range': {
      const unit = control.unit ? `<span class="tw-unit">${escapeHTML(control.unit)}</span>` : '';
      head = html`<label for="${id}">${control.label}</label>${raw(info)}${raw(reset)}<span class="tw-val"><input class="tw-num" type="number" inputmode="decimal" aria-label="${control.label} value" min="${control.min}" max="${control.max}" step="${control.step ?? 1}" value="${value}" data-num="${control.id}">${raw(unit)}</span>`;
      body = html`<input class="tw-range" id="${id}" type="range" min="${control.min}" max="${control.max}" step="${control.step ?? 1}" value="${value}" data-input="${control.id}" style="--fill:${fill(control, value)}"${raw(described)}>`;
      break;
    }
    case 'select': {
      const opts = normaliseOptions(control);
      head = html`<span class="tw-label" id="${id}-l">${control.label}</span>${raw(info)}${raw(reset)}`;
      body = useSegmented(control)
        ? html`<div class="seg seg--fill" role="radiogroup" aria-labelledby="${id}-l"${raw(described)}>${opts.map((o) => raw(html`<label><input type="radio" name="${id}" value="${String(o.value)}" ${same(o.value, value) ? raw('checked') : ''} data-input="${control.id}"><span>${o.label}</span></label>`))}</div>`
        : html`<div class="tw-select"><select aria-labelledby="${id}-l" data-input="${control.id}"${raw(described)}>${opts.map((o) => raw(html`<option value="${String(o.value)}" ${same(o.value, value) ? raw('selected') : ''}>${o.label}</option>`))}</select>${raw(icon('chevronDown', { size: 14 }))}</div>`;
      break;
    }
    case 'toggle':
      head = html`<span class="tw-label" id="${id}-l">${control.label}</span>${raw(info)}${raw(reset)}<button class="switch" type="button" role="switch" aria-checked="${value ? 'true' : 'false'}" aria-labelledby="${id}-l" data-input="${control.id}"${raw(described)}><span></span></button>`;
      break;
    case 'color': {
      const opts = normaliseOptions(control);
      const custom = control.custom !== false;
      const isCustom = !opts.some((o) => o.value === value);
      head = html`<span class="tw-label" id="${id}-l">${control.label}</span>${raw(info)}${raw(reset)}<span class="tw-val tw-val--text" data-colour-name>${formatValue(control, value).replace(/ \(.*\)$/, '')}</span>`;
      body = html`<div class="swatches" role="radiogroup" aria-labelledby="${id}-l"${raw(described)}>${opts.map((o) => raw(html`<label class="sw" style="--sw:${o.hex || `var(--${o.value})`}" title="${o.label}"><input type="radio" name="${id}" value="${o.value}" ${o.value === value ? raw('checked') : ''} data-input="${control.id}"><span class="sr-only">${o.label}</span></label>`))}${custom ? raw(html`<label class="sw sw--custom" title="Custom colour" style="--sw:${isCustom ? value : 'transparent'}"><input type="color" value="${isCustom ? value : '#ff5420'}" data-input="${control.id}" data-custom aria-label="Custom colour"></label>`) : ''}</div>`;
      break;
    }
    case 'text':
      head = html`<label for="${id}">${control.label}</label>${raw(info)}${raw(reset)}`;
      body = html`<input class="tw-text" id="${id}" type="text" value="${value}" maxlength="${control.maxLength || 80}" placeholder="${control.placeholder || ''}" data-input="${control.id}" spellcheck="false"${raw(described)}>`;
      break;
    default:
  }
  return html`<div class="tw-row tw-row--${control.type}" data-row="${control.id}" ${changed ? raw('data-changed') : ''}><div class="tw-row__head">${raw(head)}</div>${raw(body)}${raw(help)}</div>`;
}

export function createControls(c, initial, { onChange, footer = '' } = {}) {
  const controls = c.controls;
  let values = { ...initial };
  const el = document.createElement('section');
  el.className = 'tweaks';
  const titleId = uid('tw-title');
  el.setAttribute('aria-labelledby', titleId);

  const body = [];
  let lastGroup = null;
  for (const control of controls) {
    if (control.group && control.group !== lastGroup) {
      body.push(html`<h3 class="tw-group">${control.group}</h3>`);
      lastGroup = control.group;
    }
    body.push(row(control, values[control.id], uid(`tw-${control.id}`)));
  }
  el.innerHTML = html`
    <header class="tweaks__head">
      <h2 id="${titleId}">${raw(icon('sliders', { size: 15 }))}Customize</h2>
      <span class="tweaks__count" data-count hidden></span>
      <button class="tweaks__reset" type="button" data-reset-all aria-disabled="true">Reset</button>
    </header>
    <div class="tweaks__body">
      ${controls.length ? raw(body.join('')) : raw(`<p class="tw-empty">Nothing to tune here: the behaviour is the point, and the prompt rebuilds it as shown.${c.actions?.length ? ' The buttons above the preview run it.' : ''}</p>`)}
    </div>
    ${footer ? raw(`<footer class="tweaks__foot">${footer}</footer>`) : ''}`;

  const byId = new Map(controls.map((x) => [x.id, x]));

  // Help popover. It opens while the pointer rests on an info button (or the button has keyboard focus), stays
  // while the pointer moves onto it, and closes on leaving, Escape, a scroll or a tap elsewhere (WCAG 1.4.13).
  // Touch has no hover, so a tap toggles it. It is fixed-positioned, clear of the panel's scroll box, but the text
  // stays in its row, so it remains the input's description.
  let tip = null; // { btn, box }
  let showTimer = 0;
  let hideTimer = 0;
  let lastPointer = 'mouse';
  const place = ({ btn, box }) => {
    const row = btn.closest('.tw-row').getBoundingClientRect();
    const head = btn.closest('.tw-row__head').getBoundingClientRect();
    const b = btn.getBoundingClientRect();
    box.style.left = `${row.left}px`;
    box.style.width = `${row.width}px`;
    const h = box.offsetHeight;
    const minTop = document.fullscreenElement ? 8 : 68; // under the sticky top bar
    const below = head.bottom + 8;
    const up = below + h > innerHeight - 8 && head.top - 8 - h >= minTop;
    box.style.top = `${up ? head.top - 8 - h : below}px`;
    box.dataset.side = up ? 'above' : 'below';
    box.style.setProperty('--arrow-x', `${b.left + b.width / 2 - row.left}px`);
  };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeTip(); } };
  const onAway = (e) => { if (tip && !tip.btn.contains(e.target) && !tip.box.contains(e.target)) closeTip(); };
  function closeTip() {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    if (!tip) return;
    tip.box.hidden = true;
    tip.btn.classList.remove('is-on');
    tip = null;
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('pointerdown', onAway, true);
    window.removeEventListener('scroll', closeTip, true);
    window.removeEventListener('resize', closeTip);
  }
  function openTip(btn) {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    if (tip?.btn === btn || !btn.isConnected) return;
    closeTip();
    const box = el.querySelector(`#${btn.dataset.help}`);
    if (!box) return;
    tip = { btn, box };
    box.hidden = false;
    btn.classList.add('is-on');
    place(tip);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onAway, true);
    // Capture, so a scroll of the panel's own body closes it as well as the page's.
    window.addEventListener('scroll', closeTip, true);
    window.addEventListener('resize', closeTip);
  }
  const inTip = (node) => !!tip && !!node && (tip.btn.contains(node) || tip.box.contains(node));
  el.addEventListener('pointerdown', (e) => { lastPointer = e.pointerType; });
  el.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    const btn = e.target.closest('[data-help]');
    if (btn) {
      clearTimeout(hideTimer);
      if (tip?.btn !== btn) {
        clearTimeout(showTimer);
        // A short rest before the first one opens, so sweeping across the panel does not flash popovers.
        showTimer = setTimeout(() => openTip(btn), tip ? 0 : 90);
      }
    } else if (inTip(e.target)) clearTimeout(hideTimer);
  });
  el.addEventListener('pointerout', (e) => {
    if (e.pointerType === 'touch') return;
    const from = e.target.closest('[data-help]') || (inTip(e.target) ? e.target : null);
    if (!from || inTip(e.relatedTarget) || from.contains(e.relatedTarget)) return;
    clearTimeout(showTimer);
    if (tip && !tip.btn.matches(':focus-visible')) hideTimer = setTimeout(closeTip, 160);
  });
  el.addEventListener('focusin', (e) => {
    const btn = e.target.closest?.('[data-help]');
    if (btn?.matches(':focus-visible')) openTip(btn);
  });
  el.addEventListener('focusout', (e) => {
    if (tip && e.target === tip.btn && !tip.btn.matches(':hover')) closeTip();
  });

  const sync = () => {
    for (const control of controls) {
      const r = el.querySelector(`[data-row="${control.id}"]`);
      if (!r) continue;
      r.hidden = !isVisible(control, values);
      r.toggleAttribute('data-changed', !same(values[control.id], control.default));
    }
    const n = changedControls(c, values).length;
    const count = el.querySelector('[data-count]');
    count.hidden = n === 0;
    count.textContent = `${n} changed`;
    // aria-disabled, not disabled: a focused Reset that becomes disabled would drop focus to <body>.
    el.querySelector('[data-reset-all]').setAttribute('aria-disabled', String(n === 0));
  };

  const paint = (id) => {
    const control = byId.get(id);
    const v = values[id];
    const r = el.querySelector(`[data-row="${id}"]`);
    if (!r) return;
    if (control.type === 'range') {
      const range = r.querySelector('.tw-range');
      const num = r.querySelector('.tw-num');
      range.value = v;
      range.style.setProperty('--fill', fill(control, v));
      if (document.activeElement !== num) num.value = v;
    } else if (control.type === 'select') {
      r.querySelectorAll('input[type="radio"]').forEach((i) => { i.checked = same(coerce(control, i.value), v); });
      const sel = r.querySelector('select');
      if (sel) sel.value = String(v);
    } else if (control.type === 'toggle') {
      r.querySelector('.switch').setAttribute('aria-checked', String(!!v));
    } else if (control.type === 'color') {
      r.querySelectorAll('input[type="radio"]').forEach((i) => { i.checked = i.value === v; });
      const customInput = r.querySelector('[data-custom]');
      const custom = customInput?.closest('.sw');
      const isCustom = /^#/.test(v) && !normaliseOptions(control).some((o) => o.value === v);
      if (custom) custom.style.setProperty('--sw', isCustom ? v : 'transparent');
      custom?.classList.toggle('is-on', isCustom);
      if (customInput && isCustom) customInput.value = v;
      r.querySelector('[data-colour-name]').textContent = formatValue(control, v).replace(/ \(.*\)$/, '');
    } else if (control.type === 'text') {
      const t = r.querySelector('.tw-text');
      if (document.activeElement !== t) t.value = v;
    }
  };

  const set = (id, raw, { emit = true } = {}) => {
    const control = byId.get(id);
    const v = coerce(control, raw);
    if (same(v, values[id])) { paint(id); return; }
    values = { ...values, [id]: v };
    paint(id);
    sync();
    if (emit) onChange?.(values, id);
  };

  el.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.input) {
      const control = byId.get(t.dataset.input);
      if (control.type === 'range') set(control.id, Number(t.value));
      else if (control.type === 'text' || t.dataset.custom !== undefined) set(control.id, t.value);
    }
    if (t.dataset.num) {
      if (t.value === '' || Number.isNaN(Number(t.value))) return;
      set(t.dataset.num, Number(t.value));
    }
  });
  el.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.input && (t.type === 'radio' || t.tagName === 'SELECT')) set(t.dataset.input, t.value);
    if (t.dataset.num) paint(t.dataset.num);
  });
  el.addEventListener('click', (e) => {
    const sw = e.target.closest('.switch');
    if (sw) { set(sw.dataset.input, sw.getAttribute('aria-checked') !== 'true'); return; }
    const info = e.target.closest('[data-help]');
    if (info) {
      // Hover already shows it; a tap on a touch screen toggles it.
      if (lastPointer === 'touch' && tip?.btn === info) closeTip();
      else openTip(info);
      return;
    }
    const r = e.target.closest('[data-reset]');
    if (r) {
      const control = byId.get(r.dataset.reset);
      set(control.id, control.default);
      // The reset button hides once the value is back at its default: hand focus to the control itself.
      el.querySelector(`[data-row="${control.id}"] [data-input]`)?.focus();
      return;
    }
    const all = e.target.closest('[data-reset-all]');
    if (all && all.getAttribute('aria-disabled') === 'true') return;
    if (all) {
      values = Object.fromEntries(controls.map((x) => [x.id, x.default]));
      controls.forEach((x) => paint(x.id));
      sync();
      onChange?.(values, null);
    }
  });
  // Double-clicking a label resets that control, as in most design tools.
  el.addEventListener('dblclick', (e) => {
    const head = e.target.closest('.tw-row__head label, .tw-row__head .tw-label');
    if (!head) return;
    const control = byId.get(head.closest('[data-row]').dataset.row);
    set(control.id, control.default);
  });

  sync();

  return {
    el,
    get values() { return { ...values }; },
    set(next) {
      values = { ...values, ...next };
      controls.forEach((x) => paint(x.id));
      sync();
    },
  };
}
