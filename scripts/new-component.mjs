#!/usr/bin/env node
// Scaffold a component folder, pre-filled from the awards recipe it is built on.
// Usage: npm run new -- <id> --recipe <recipe-id> [--category <category-id>] [--title "Title"]
// Then: edit meta.js, write demo.js and demo.css, run npm run check, npm run smoke -- --only <id>,
// npm run frames -- --only <id>. Nothing else needs registering.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, COMPONENTS_DIR } from './lib/components.js';
import { categories } from '../src/registry/categories.js';
import { site } from '../src/registry/site.js';

const argv = process.argv.slice(2);
const flag = (name) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : undefined);
const id = argv.find((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
const recipeId = flag('recipe');
if (!id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
  console.error('usage: npm run new -- <id> --recipe <recipe-id> [--category <id>] [--title "Title"]\n  <id> is a lowercase slug, e.g. logo-marquee');
  process.exit(1);
}
const dir = path.join(COMPONENTS_DIR, id);
if (fs.existsSync(dir)) { console.error(`components/${id} already exists`); process.exit(1); }
const { recipes } = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/registry/recipes.json'), 'utf8'));
const recipe = recipes[recipeId];
if (!recipe) { console.error(`unknown recipe "${recipeId}". Known ids are in src/registry/recipes.json (npm run sync-recipes refreshes it).`); process.exit(1); }

const GROUP_TO_CATEGORY = {
  foundations: 'foundations', 'arrival-and-chrome': 'navigation', 'heroes-and-type': 'heroes', 'scroll-set-pieces': 'scroll',
  'galleries-and-lists': 'galleries', 'evidence-blocks': 'commerce', 'the-close-and-beyond': 'closers', 'webgl-surfaces': 'webgl', compositions: 'blocks',
};
const category = flag('category') || GROUP_TO_CATEGORY[recipe.group] || 'foundations';
if (!categories.some((c) => c.id === category)) { console.error(`unknown category "${category}"`); process.exit(1); }
const title = flag('title') || id.split('-').map((w, i) => (i ? w : w[0].toUpperCase() + w.slice(1))).join(' ');
const today = new Date().toISOString().slice(0, 10);
const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'meta.js'), `// Field reference: docs/authoring.md. Plain data, no imports.
export default {
  id: ${q(id)},
  title: ${q(title)},
  category: ${q(category)},
  summary: ${q('TODO: one sentence, 30–190 characters, on what a visitor sees and does.')},
  recipe: ${q(recipeId)},
  deps: [], // libraries demo.js imports (check.mjs verifies); the recipe uses: ${recipe.deps.join(', ') || 'none'}
  tags: [${recipe.tags.slice(0, 6).map(q).join(', ')}],
  added: ${q(today)},${today === site.launch ? `\n  labels: ['new'], // added on the launch day after the launch set; expires like any New label` : ''}
  preview: { height: 600 },
  useCases: [
    'TODO: a real place this fits',
    'TODO: another',
  ],
  notes: [
    'TODO: keyboard and screen-reader path',
    'TODO: reduced-motion and touch path',
  ],
  controls: [
    // { id: 'speed', label: 'Speed', type: 'range', min: 0.2, max: 2, step: 0.1, default: 1, unit: '×', prompt: 'Speed: {value} (default {default})' },
  ],
  prompt: {
    skill: 'component',
    ask: ${q(`Add ${title.toLowerCase()} to {target}.`)},
    target: 'TODO: the element or section it belongs to',
    brief: ${q('TODO: the behaviour to rebuild, in plain words.')},
    keep: [],
  },
};
`);
fs.writeFileSync(path.join(dir, 'demo.js'), `// ${title} — built from the awards recipe \`${recipeId}\`: ${recipe.title}.
// Contract: docs/authoring.md. Render into root, read options, clean up through ctx (signal, onCleanup).
import './demo.css';
import { on, html, content } from '../../src/demo-kit/index.js';

export default function mount(root, options, ctx) {
  root.className = '${id.split('-').map((w) => w[0]).join('')}';
  // Stage the move, not a site (authoring rule 4): the component alone on the stage, a plate line for context.
  root.innerHTML = html\`
    <section class="ac-stage">
      <h1 class="ac-h1">${title}</h1>
      <p class="ac-stage__note"><span>\${content.studio.name} · where it lives</span></p>
    </section>\`;

  // ctx.motion is 'full' | 'reduced' | 'static'. Under reduced: no spatial movement; under static: settled at once.

  return {
    update(next, changed) {
      // Apply live; return false to ask the runtime for a re-mount instead.
      return false;
    },
  };
}
`);
fs.writeFileSync(path.join(dir, 'demo.css'), `/* ${title}. Tokens and primitives come from src/demo-kit/base.css; use var(--…) for every colour. */
.${id.split('-').map((w) => w[0]).join('')} {
  overflow: clip;
}
`);
console.log(`created components/${id}/ (meta.js, demo.js, demo.css) from recipe ${recipeId}, category ${category}.
next: write the demo, then
  npm run check -- --only ${id}
  npm run smoke -- --only ${id}
  npm run frames -- --only ${id}`);
