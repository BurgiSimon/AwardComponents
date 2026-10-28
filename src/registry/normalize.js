// Normalise a component's meta.js into the shape the shell uses. Pure; check.mjs runs the same function in Node.
import { categoryById } from './categories.js';
import { labelsFor } from './labels.js';

const LIB = {
  gsap: 'gsap',
  lenis: 'lenis',
  three: 'webgl',
  ogl: 'webgl',
  postprocessing: 'webgl',
  'matter-js': 'physics',
  animejs: 'anime',
  '@unseenco/taxi': 'taxi',
};

export const TECH_LABELS = {
  gsap: 'GSAP',
  lenis: 'Lenis',
  webgl: 'WebGL',
  physics: 'Physics',
  anime: 'anime.js',
  taxi: 'taxi',
  canvas: 'Canvas',
  css: 'CSS',
};

export function normalize(meta) {
  const deps = (meta.deps || []).map((d) => d.replace(/@[\d.]+$/, ''));
  const tech = [...new Set(deps.map((d) => LIB[d]).filter(Boolean))];
  if (!tech.includes('webgl') && (meta.tags || []).includes('webgl')) tech.push('webgl');
  if (!tech.length && (meta.tags || []).includes('canvas')) tech.push('canvas');
  const category = categoryById.get(meta.category);
  const recipes = [].concat(meta.recipe || [], meta.recipes || []).filter((v, i, a) => a.indexOf(v) === i);
  const c = {
    ...meta,
    deps,
    tech,
    recipes,
    categoryTitle: category?.title || meta.category,
    preview: { height: 600, scroll: false, ...(meta.preview || {}) },
    controls: meta.controls || [],
    actions: meta.actions || [],
    controlCount: meta.controlCount ?? (meta.controls || []).length,
    actionCount: meta.actionCount ?? (meta.actions || []).length,
    tags: meta.tags || [],
  };
  c.labels = labelsFor(c);
  c.search = [c.title, c.summary, c.categoryTitle, ...c.tags, ...recipes, ...(meta.keywords || [])].join(' ').toLowerCase();
  return c;
}
