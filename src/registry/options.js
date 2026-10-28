// Controls: the tweakable options a component declares in meta.controls, and everything that turns values into
// URL parameters, readable text and prompt lines. Pure functions: the shell, the play runtime and the Node
// scripts (check, smoke, frames) all import this file.
//
// A control:
//   { id, label, type, default, group?, help?, when?, prompt? }
//   type 'range'  → min, max, step, unit?            value: number
//   type 'select' → options: [{ value, label }] | ['a','b']   value: string (segmented when ≤ 4 short options)
//   type 'toggle' →                                    value: boolean
//   type 'color'  → options?: [{ value, label }]       value: a token name ('accent', 'clay', …) or a hex string
//   type 'text'   → maxLength?, placeholder?            value: string
//   when:   { otherId: value | [values] } shows the control only while another control matches
//   prompt: the line written into the prompt when the value is not the default. A template with {label}, {value}
//           and {default}; for a toggle, { on: '…', off: '…' }; or a function (value, control) → string.
//           Without one: "{label}: {value} (default {default})". prompt: false keeps a demo-only control (a debug
//           overlay, a replay speed) out of the prompt.

export const RESERVED_PARAMS = ['c', 'theme', 'motion', 'embed', 'capture', 'tier', 'viewport', 'frame'];

export const SWATCHES = [
  { value: 'accent', label: 'Vermilion', hex: '#f94c16' },
  { value: 'ink', label: 'Ink', hex: '#121211' },
  { value: 'clay', label: 'Clay', hex: '#c9744b' },
  { value: 'moss', label: 'Moss', hex: '#6e7b4c' },
  { value: 'sky', label: 'Sky', hex: '#8db1d6' },
  { value: 'sand', label: 'Sand', hex: '#e3d2b1' },
  { value: 'plum', label: 'Plum', hex: '#6b4968' },
];

export function normaliseOptions(control) {
  if (control.type === 'color') {
    return (control.options || SWATCHES).map((o) => (typeof o === 'string' ? SWATCHES.find((s) => s.value === o) || { value: o, label: o, hex: o } : o));
  }
  return (control.options || []).map((o) => (typeof o === 'string' || typeof o === 'number' ? { value: o, label: String(o) } : o));
}

const decimals = (step) => {
  const s = String(step ?? 1);
  return s.includes('.') ? s.split('.')[1].length : 0;
};

export function coerce(control, raw) {
  const fallback = control.default;
  switch (control.type) {
    case 'range': {
      const n = typeof raw === 'number' ? raw : Number.parseFloat(raw);
      if (!Number.isFinite(n)) return fallback;
      const min = control.min ?? -Infinity;
      const max = control.max ?? Infinity;
      const step = control.step ?? 1;
      const base = Number.isFinite(control.min) ? control.min : 0;
      const stepped = Math.round((Math.min(max, Math.max(min, n)) - base) / step) * step + base;
      return Number(stepped.toFixed(decimals(step)));
    }
    case 'toggle':
      if (typeof raw === 'boolean') return raw;
      if (raw === '1' || raw === 'true' || raw === 'on') return true;
      if (raw === '0' || raw === 'false' || raw === 'off') return false;
      return fallback;
    case 'select': {
      const opts = normaliseOptions(control);
      const hit = opts.find((o) => String(o.value) === String(raw));
      return hit ? hit.value : fallback;
    }
    case 'color': {
      const opts = normaliseOptions(control);
      if (opts.some((o) => o.value === raw)) return raw;
      if (control.custom !== false && typeof raw === 'string' && /^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
      return fallback;
    }
    case 'text': {
      if (raw === undefined || raw === null) return fallback;
      const s = String(raw).replace(/[\u0000-\u001f]/g, '');
      return control.maxLength ? s.slice(0, control.maxLength) : s;
    }
    default:
      return raw ?? fallback;
  }
}

export function defaults(meta) {
  return Object.fromEntries((meta.controls || []).map((c) => [c.id, c.default]));
}

export function resolve(meta, values = {}) {
  const out = {};
  for (const c of meta.controls || []) out[c.id] = coerce(c, values[c.id] ?? c.default);
  return out;
}

export const same = (a, b) => (typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-9 : a === b);

// Controls whose value differs from the default (and that are visible under `when`).
export function changedControls(meta, values) {
  return (meta.controls || []).filter((c) => isVisible(c, values) && !same(values[c.id], c.default));
}

export function isVisible(control, values) {
  if (!control.when) return true;
  return Object.entries(control.when).every(([id, want]) => [].concat(want).some((w) => same(values[id], w)));
}

export function fromParams(meta, params) {
  const values = {};
  for (const c of meta.controls || []) values[c.id] = params.has(c.id) ? coerce(c, params.get(c.id)) : c.default;
  return values;
}

// Only non-default values, so a shared link is short and readable: ?radius=2.2&style=outline
export function toParams(meta, values, params = new URLSearchParams()) {
  for (const c of meta.controls || []) {
    params.delete(c.id);
    const v = values[c.id];
    if (v === undefined || same(v, c.default)) continue;
    params.set(c.id, c.type === 'toggle' ? (v ? '1' : '0') : String(v));
  }
  return params;
}

const ATTACHED_UNITS = new Set(['%', '×', 'x', '°', '′', '″']);

export function formatValue(control, value) {
  switch (control.type) {
    case 'range': {
      const n = Number(value).toFixed(decimals(control.step));
      if (!control.unit) return n;
      return ATTACHED_UNITS.has(control.unit) ? `${n}${control.unit}` : `${n} ${control.unit}`;
    }
    case 'toggle':
      return value ? 'on' : 'off';
    case 'select': {
      const o = normaliseOptions(control).find((x) => same(x.value, value));
      return o ? o.label : String(value);
    }
    case 'color': {
      const o = normaliseOptions(control).find((x) => x.value === value);
      if (o) return o.hex ? `${o.label} (${o.hex})` : o.label;
      return String(value);
    }
    case 'text':
      return `“${value}”`;
    default:
      return String(value);
  }
}

// One prompt line for a changed control.
export function promptLine(control, value) {
  const p = control.prompt;
  if (typeof p === 'function') return p(value, control);
  if (control.type === 'toggle' && p && typeof p === 'object') return value ? p.on : p.off;
  const template = typeof p === 'string' ? p : '{label}: {value}';
  const line = template
    .replaceAll('{label}', control.label)
    .replaceAll('{value}', formatValue(control, value))
    .replaceAll('{default}', formatValue(control, control.default));
  return template.includes('{default}') ? line : `${line} (default ${formatValue(control, control.default)})`;
}
