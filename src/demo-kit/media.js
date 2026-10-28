// The shared picture set (CC0 / public domain, credited in CREDITS.md and on each component page).
// photo('id', { fallbackTags }) → { src, srcSm, alt, width, height, focus, credit, tags } with URLs resolved against
// the site base. Ask only for pictures the demo shows: every returned picture is credited on the component page.
// photos({ tags: ['object'], count: 6, seed: 'shop', exclude: ['id', …] }) → a deterministic pick by tag; exclude keeps
// separate calls from returning the same picture (pass the ids of an earlier pick).
// image(item, { sizes, eager, className }) → an <img> with srcset, decoding async, lazy unless eager.
// Unknown ids and empty picks fall back to drawn stand-ins, so a demo never breaks on a missing file.
import manifest from './media.json';

const BASE = import.meta.env.BASE_URL || '/';
const url = (p) => (p ? BASE + p.replace(/^\//, '') : p);

const ART = [
  ['#c9744b', '#6b4968', '#e3d2b1'],
  ['#6e7b4c', '#1b1d24', '#d9d4c3'],
  ['#8db1d6', '#2b3a55', '#eef0ea'],
  ['#e3d2b1', '#c9744b', '#f4f1ea'],
  ['#6b4968', '#8db1d6', '#ece4ea'],
  ['#1b1d24', '#ff5420', '#2a2c33'],
];

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// A drawn stand-in: soft colour fields as an SVG data URL, deterministic per seed.
export function art(seed = 'art', { width = 1200, height = 1500 } = {}) {
  const h = hash(String(seed));
  const [a, b, c] = ART[h % ART.length];
  const x = 15 + (h % 60);
  const y = 10 + ((h >> 8) % 50);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="g1" cx="${x}%" cy="${y}%" r="75%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${a}" stop-opacity="0"/></radialGradient><radialGradient id="g2" cx="${100 - x}%" cy="${100 - y / 2}%" r="70%"><stop offset="0" stop-color="${b}"/><stop offset="1" stop-color="${b}" stop-opacity="0"/></radialGradient></defs><rect width="100%" height="100%" fill="${c}"/><rect width="100%" height="100%" fill="url(#g1)"/><rect width="100%" height="100%" fill="url(#g2)"/></svg>`;
  const src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  return { id: `art-${seed}`, src, srcSm: src, alt: '', width, height, smWidth: width, smHeight: height, focus: '50% 50%', credit: '', tags: ['art'], drawn: true };
}

const items = (manifest.items || []).map((m) => ({ ...m, src: url(m.src), srcSm: url(m.srcSm || m.src) }));
const byId = new Map(items.map((m) => [m.id, m]));
export const videos = (manifest.videos || []).map((v) => ({ ...v, src: url(v.src), poster: url(v.poster) }));

export const allPhotos = () => items.slice();

// Pictures a demo actually used, read by the play runtime so the component page can credit them.
const used = (window.__acMedia ||= new Set());

// photo('id', { fallbackTags: ['ceramic'] }): a named picture, else the first match for the tags, else drawn art.
export function photo(id, { fallbackTags } = {}) {
  let hit = byId.get(id);
  if (!hit && fallbackTags?.length) hit = items.find((m) => fallbackTags.every((t) => m.tags?.includes(t)));
  if (hit) used.add(hit.id);
  return hit || art(id);
}

export function photos({ tags = [], not = [], count = 6, seed = 'x', orientation, exclude = [] } = {}) {
  const skip = new Set(exclude.map((e) => (typeof e === 'string' ? e : e?.id)));
  let pool = items.filter((m) => !skip.has(m.id) && tags.every((t) => m.tags?.includes(t)) && !not.some((t) => m.tags?.includes(t)));
  if (orientation === 'portrait') pool = pool.filter((m) => m.height > m.width * 1.05);
  if (orientation === 'landscape') pool = pool.filter((m) => m.width > m.height * 1.05);
  const s = hash(String(seed));
  pool = pool
    .map((m, i) => ({ m, k: hash(m.id + s + i) }))
    .sort((p, q) => p.k - q.k)
    .map((p) => p.m);
  const out = pool.slice(0, count);
  out.forEach((m) => used.add(m.id));
  for (let i = out.length; i < count; i++) out.push(art(`${seed}-${i}`));
  return out;
}

export function image(item, { sizes = '100vw', eager = false, className = '', alt } = {}) {
  const img = document.createElement('img');
  img.src = item.srcSm && !eager ? item.srcSm : item.src;
  if (!item.drawn && item.srcSm) {
    img.srcset = `${item.srcSm} ${item.smWidth || 640}w, ${item.src} ${item.width || 1800}w`;
    img.sizes = sizes;
  }
  img.alt = alt ?? item.alt ?? '';
  img.width = item.width || 1200;
  img.height = item.height || 1500;
  img.decoding = 'async';
  if (!eager) img.loading = 'lazy';
  if (item.focus) img.style.objectPosition = item.focus;
  if (className) img.className = className;
  return img;
}

// Markup string version for template literals.
export function imageHTML(item, { sizes = '100vw', eager = false, className = '', alt } = {}) {
  const a = String(alt ?? item.alt ?? '').replace(/"/g, '&quot;');
  const srcset = !item.drawn && item.srcSm ? ` srcset="${item.srcSm} ${item.smWidth || 640}w, ${item.src} ${item.width || 1800}w" sizes="${sizes}"` : '';
  const style = item.focus ? ` style="object-position:${item.focus}"` : '';
  return `<img src="${eager ? item.src : item.srcSm || item.src}"${srcset} alt="${a}" width="${item.width || 1200}" height="${item.height || 1500}" decoding="async"${eager ? '' : ' loading="lazy"'}${className ? ` class="${className}"` : ''}${style}>`;
}

// Load a picture into an HTMLImageElement and resolve when decoded (for canvas / WebGL textures).
export async function loadImage(item, { small = false } = {}) {
  const img = new Image();
  img.decoding = 'async';
  img.src = small ? item.srcSm : item.src;
  await img.decode().catch(() => {});
  return img;
}
