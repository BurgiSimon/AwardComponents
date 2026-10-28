// Small helpers shared by demos.

// A colour control's value → a CSS colour. Token names ('accent', 'clay', …) become var(--name); hex passes through.
export function colour(value, fallback = 'var(--accent)') {
  if (!value) return fallback;
  if (/^#|^rgb|^hsl|^oklch|^color\(/.test(value)) return value;
  return `var(--${value})`;
}

// The computed value of a token, for canvas and WebGL code that cannot read var(): readToken('--accent').
export function readToken(name, el = document.documentElement) {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// Tagged template that escapes interpolations. Nested html`` results and values wrapped in raw() pass through
// unescaped; arrays are joined (their items follow the same rule). The result is a String object, so it can be
// assigned to innerHTML directly or nested in another html``.
const RAW = Symbol('raw');
const mark = (s) => Object.assign(new String(s), { [RAW]: true });
export const raw = (s) => mark(s);
const part = (v) => (v && v[RAW] ? String(v) : escapeHTML(v));
export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((v, i) => {
    out += (Array.isArray(v) ? v.map(part).join('') : part(v)) + strings[i + 1];
  });
  return mark(out);
}
