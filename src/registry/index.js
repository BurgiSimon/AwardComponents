// The component registry for the shell. Listing fields come from `virtual:ac-index` (scripts/lib/index-plugin.js),
// built from every components/<id>/meta.js; the full meta (controls, prompt, notes) loads per page through
// loadComponent(id). Adding a component needs no edit here: create the folder and it appears.
import index from 'virtual:ac-index';
import { categories } from './categories.js';
import { normalize } from './normalize.js';

const full = import.meta.glob('/components/*/meta.js', { import: 'default' });
const loaded = new Map();

const byCategory = new Map(categories.map((c, i) => [c.id, i]));

export const components = index
  .map(normalize)
  .sort((a, b) =>
    (byCategory.get(a.category) ?? 99) - (byCategory.get(b.category) ?? 99) ||
    (a.order ?? 50) - (b.order ?? 50) ||
    a.title.localeCompare(b.title));

export const byId = new Map(components.map((c) => [c.id, c]));

export const groups = categories
  .map((cat) => ({ ...cat, items: components.filter((c) => c.category === cat.id) }))
  .filter((g) => g.items.length);

export const featured = components.filter((c) => c.featured);

// Newest first by the later of added / updated.
export const recent = components
  .slice()
  .sort((a, b) => (b.updated || b.added || '').localeCompare(a.updated || a.added || '') || a.title.localeCompare(b.title));

export { categories };

// The full, normalised meta of one component (cached).
export async function loadComponent(id) {
  if (loaded.has(id)) return loaded.get(id);
  const loader = full[`/components/${id}/meta.js`];
  if (!loader) return null;
  const c = normalize(await loader());
  loaded.set(id, c);
  return c;
}
