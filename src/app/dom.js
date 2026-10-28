// Tiny DOM helpers for the shell. Markup is built with the escaping html`` tag and turned into nodes with frag().
export { html, raw, escapeHTML } from '../demo-kit/util.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function frag(markup) {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content;
}

export function el(markup) {
  return frag(markup).firstElementChild;
}

export const BASE = import.meta.env.BASE_URL || '/';
export const href = (path = '') => BASE + String(path).replace(/^\//, '');

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const finePointer = () => matchMedia('(hover: hover) and (pointer: fine)').matches;

export function debounce(fn, ms) {
  let t = 0;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
