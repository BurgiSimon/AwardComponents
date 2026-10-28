// The component registry for the shell: every components/<id>/meta.js, found by glob, normalised and ordered.
// Adding a component needs no edit here: create the folder and it appears.
import { categories } from './categories.js';
import { normalize } from './normalize.js';

const modules = import.meta.glob('/components/*/meta.js', { eager: true, import: 'default' });

const byCategory = new Map(categories.map((c, i) => [c.id, i]));

export const components = Object.values(modules)
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
