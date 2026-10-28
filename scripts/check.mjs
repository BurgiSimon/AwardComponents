#!/usr/bin/env node
// Validate every component folder: meta fields and vocabularies, controls, declared libraries against the demo's
// real imports, the prompt, frames, and which awards recipes no component covers yet. Runs before every build.
// Usage: node scripts/check.mjs [--only id,id] [--strict] [--json]
//   --strict  missing frames and uncovered recipes become errors (use before a release)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, COMPONENTS_DIR, componentIds, loadMeta, onlyArg } from './lib/components.js';
import { categories } from '../src/registry/categories.js';
import { features } from '../src/registry/features.js';
import { labelKinds } from '../src/registry/labels.js';
import { coerce, normaliseOptions, RESERVED_PARAMS, same } from '../src/registry/options.js';
import { buildPrompt } from '../src/registry/prompt.js';
import { normalize } from '../src/registry/normalize.js';

const argv = process.argv.slice(2);
const strict = argv.includes('--strict');
const asJson = argv.includes('--json');
const only = onlyArg();
const recipes = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/registry/recipes.json'), 'utf8')).recipes;
const categoryIds = new Set(categories.map((c) => c.id));
const SKILLS = new Set(['component', 'motion', 'webgl', 'stack', 'craft', 'concept', 'system', 'structure']);
const TYPES = new Set(['range', 'select', 'toggle', 'color', 'text']);
const REFLEX = /\b(elevate|seamless(ly)?|supercharge|unlock|unleash|empower|effortless(ly)?|cutting-edge|world-class|next-gen|next-level|revolutioni[sz]e|game-chang|reimagine|immersive experience|unparalleled|state-of-the-art|best-in-class|harness the power)\b/i;
const LIBS = new Set(['gsap', 'lenis', 'three', 'ogl', 'postprocessing', 'matter-js', 'animejs', '@unseenco/taxi']);
// Demo-kit modules that pull a library in on the demo's behalf.
const KIT_LIBS = { 'gsap.js': ['gsap'], 'lenis.js': ['lenis', 'gsap'], 'three.js': ['three'] };
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const results = [];
const all = componentIds();
const ids = only ? all.filter((id) => only.includes(id)) : all;
if (only) for (const id of only) if (!all.includes(id)) results.push({ id, errors: [`no folder components/${id}`], warnings: [] });

function importsOf(dir) {
  const libs = new Set();
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js') && f !== 'meta.js');
  for (const f of files) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of src.matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g)) {
      const spec = m[1] || m[2] || m[3];
      if (spec.startsWith('.')) {
        const base = path.basename(spec);
        if (spec.includes('demo-kit/') && KIT_LIBS[base]) KIT_LIBS[base].forEach((l) => libs.add(l));
        continue;
      }
      const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
      libs.add(pkg);
    }
  }
  return libs;
}

for (const id of ids) {
  const dir = path.join(COMPONENTS_DIR, id);
  const errors = [];
  const warnings = [];
  const r = { id, errors, warnings };
  results.push(r);
  for (const f of ['meta.js', 'demo.js']) if (!fs.existsSync(path.join(dir, f))) errors.push(`missing ${f}`);
  if (errors.length) continue;
  if (!fs.existsSync(path.join(dir, 'demo.css'))) warnings.push('no demo.css');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) errors.push('folder name must be a lowercase slug');

  const metaSrc = fs.readFileSync(path.join(dir, 'meta.js'), 'utf8');
  if (/^\s*import\s/m.test(metaSrc)) errors.push('meta.js must not import anything (it is read by Node and the shell as plain data)');
  const demoSrc = fs.readFileSync(path.join(dir, 'demo.js'), 'utf8');
  if (!/export\s+default\s/.test(demoSrc)) errors.push('demo.js needs a default export: mount(root, options, ctx)');
  if (/localStorage|sessionStorage/.test(demoSrc) && !/try\s*{/.test(demoSrc)) warnings.push('storage access without try/catch');

  let meta;
  try { meta = await loadMeta(id); } catch (e) { errors.push(`meta.js failed to load: ${e.message}`); continue; }
  if (!meta || typeof meta !== 'object') { errors.push('meta.js must export default an object'); continue; }

  // Identity and vocabularies.
  if (meta.id !== id) errors.push(`meta.id "${meta.id}" must equal the folder name`);
  if (!meta.title || meta.title.length > 48) errors.push('title is required, at most 48 characters');
  if (!categoryIds.has(meta.category)) errors.push(`category "${meta.category}" is not in src/registry/categories.js`);
  if (!meta.summary || meta.summary.length < 30 || meta.summary.length > 190) errors.push(`summary must be 30–190 characters (has ${meta.summary?.length || 0})`);
  const recipeIds = [].concat(meta.recipe || [], meta.recipes || []);
  if (!recipeIds.length) errors.push('recipe is required (the awards recipe id it is built from)');
  for (const rid of recipeIds) if (!recipes[rid]) errors.push(`recipe "${rid}" is not in src/registry/recipes.json (run npm run sync-recipes)`);
  if (!Array.isArray(meta.tags) || !meta.tags.length) errors.push('tags must be a non-empty array');
  if (!DATE.test(meta.added || '')) errors.push('added must be a YYYY-MM-DD date');
  if (meta.updated && !DATE.test(meta.updated)) errors.push('updated must be a YYYY-MM-DD date');
  for (const e of meta.changelog || []) if (!DATE.test(e.date || '') || !e.note) errors.push('changelog entries need { date: YYYY-MM-DD, note }');
  if (meta.status && !['stable', 'experimental'].includes(meta.status)) errors.push('status must be stable or experimental');
  if (meta.theme && !['auto', 'light', 'dark'].includes(meta.theme)) errors.push('theme must be auto, light or dark');
  for (const l of meta.labels || []) if (!labelKinds[l]) errors.push(`label "${l}" is not in src/registry/labels.js`);
  for (const f of meta.requires || []) if (!features[f]) errors.push(`requires "${f}" is not in src/registry/features.js`);
  const h = meta.preview?.height;
  if (h !== undefined && (typeof h !== 'number' || h < 320 || h > 1200)) errors.push('preview.height must be a number between 320 and 1200');
  for (const field of ['useCases', 'notes']) {
    if (!Array.isArray(meta[field]) || meta[field].length < 2) warnings.push(`${field} should list at least two items`);
  }
  for (const [field, text] of [['summary', meta.summary], ['prompt.brief', meta.prompt?.brief], ['description', meta.description]]) {
    const m = text && String(text).match(REFLEX);
    if (m) errors.push(`${field} uses the reflex word "${m[0]}" (see the awards reflex-copy list); say what it does instead`);
  }

  // Libraries: declared deps must match what demo.js actually imports.
  const used = importsOf(dir);
  const declared = new Set((meta.deps || []).map((d) => d.replace(/@[\d.]+$/, '')));
  for (const lib of used) {
    if (!LIBS.has(lib)) errors.push(`demo imports "${lib}", which is not one of the library's pinned dependencies`);
    else if (!declared.has(lib)) errors.push(`demo uses "${lib}" but meta.deps does not list it`);
  }
  for (const lib of declared) if (!used.has(lib)) errors.push(`meta.deps lists "${lib}" but the demo does not import it`);

  // Controls.
  const controlIds = new Set();
  for (const c of meta.controls || []) {
    const where = `control "${c.id}"`;
    if (!c.id || !/^[a-z][a-zA-Z0-9]*$/.test(c.id)) errors.push(`${where}: id must be camelCase letters and digits`);
    if (controlIds.has(c.id)) errors.push(`${where}: duplicate id`);
    controlIds.add(c.id);
    if (RESERVED_PARAMS.includes(c.id)) errors.push(`${where}: "${c.id}" is reserved for the preview URL`);
    if (!TYPES.has(c.type)) { errors.push(`${where}: unknown type "${c.type}"`); continue; }
    if (!c.label) errors.push(`${where}: label is required`);
    if (c.type === 'range') {
      if (!(typeof c.min === 'number' && typeof c.max === 'number' && c.min < c.max)) errors.push(`${where}: range needs numeric min < max`);
      if (!(c.step > 0)) errors.push(`${where}: range needs a positive step`);
    }
    if ((c.type === 'select') && !normaliseOptions(c).length) errors.push(`${where}: select needs options`);
    if (c.default === undefined) errors.push(`${where}: default is required`);
    else if (!same(coerce(c, c.default), c.default)) errors.push(`${where}: default ${JSON.stringify(c.default)} is not a valid value (coerces to ${JSON.stringify(coerce(c, c.default))})`);
    if (c.prompt !== undefined && c.prompt !== false && !['string', 'function', 'object'].includes(typeof c.prompt)) errors.push(`${where}: prompt must be a string, { on, off }, a function or false`);
    if (c.type === 'toggle' && c.prompt && typeof c.prompt === 'object' && !(c.prompt.on && c.prompt.off)) errors.push(`${where}: toggle prompt object needs on and off`);
  }
  for (const c of meta.controls || []) {
    for (const dep of Object.keys(c.when || {})) if (!controlIds.has(dep)) errors.push(`control "${c.id}": when refers to unknown control "${dep}"`);
  }
  const actionIds = new Set();
  for (const a of meta.actions || []) {
    if (!a.id || !a.label) errors.push('actions need { id, label }');
    if (actionIds.has(a.id)) errors.push(`duplicate action "${a.id}"`);
    actionIds.add(a.id);
  }
  if ((meta.actions || []).length && !/action\s*\(/.test(demoSrc)) warnings.push('meta.actions declared but demo.js has no action(id) handler');

  // Prompt.
  const p = meta.prompt || {};
  if (!p.ask) errors.push('prompt.ask is required');
  else if (!p.ask.includes('{target}')) warnings.push('prompt.ask has no {target} slot');
  if (!p.brief || p.brief.length < 40) errors.push('prompt.brief is required (at least 40 characters)');
  if (p.skill && !SKILLS.has(p.skill)) errors.push(`prompt.skill "${p.skill}" is not an awards skill`);
  try {
    const c = normalize(meta);
    const changedValues = Object.fromEntries(c.controls.map((x) => [x.id, x.type === 'range' ? x.max : x.type === 'toggle' ? !x.default : x.default]));
    const out = buildPrompt(c, changedValues, { url: 'https://example.test/x' });
    for (const rid of recipeIds) if (!out.text.includes(rid)) errors.push(`prompt does not name recipe ${rid}`);
    if (out.text.includes('undefined') || out.text.includes('[object')) errors.push('prompt text contains undefined or [object …]');
  } catch (e) {
    errors.push(`prompt failed to build: ${e.message}`);
  }

  // Frames.
  const themes = meta.theme === 'dark' || meta.theme === 'light' ? [meta.theme] : ['light', 'dark'];
  const missing = themes.flatMap((t) => [`${id}-${t}.webp`, `${id}-${t}-sm.webp`]).filter((f) => !fs.existsSync(path.join(ROOT, 'public/frames', f)));
  if (missing.length) (strict ? errors : warnings).push(`missing frames: ${missing.join(', ')} (npm run frames -- --only ${id})`);
}

// Coverage: recipes without a component.
const covered = new Set();
for (const id of all) {
  try {
    const m = await loadMeta(id);
    [].concat(m.recipe || [], m.recipes || []).forEach((r) => covered.add(r));
  } catch { /* reported above */ }
}
const uncovered = Object.keys(recipes).filter((r) => !covered.has(r));

const errorCount = results.reduce((n, r) => n + r.errors.length, 0);
const warnCount = results.reduce((n, r) => n + r.warnings.length, 0);
if (asJson) {
  console.log(JSON.stringify({ components: results.length, errors: errorCount, warnings: warnCount, uncovered, results }, null, 2));
} else {
  for (const r of results) {
    if (!r.errors.length && !r.warnings.length) continue;
    console.log(`\n${r.id}`);
    for (const e of r.errors) console.log(`  ✗ ${e}`);
    for (const w of r.warnings) console.log(`  · ${w}`);
  }
  console.log(`\n${results.length} component${results.length === 1 ? '' : 's'} checked: ${errorCount} error${errorCount === 1 ? '' : 's'}, ${warnCount} warning${warnCount === 1 ? '' : 's'}.`);
  if (!only) console.log(`${covered.size} of ${Object.keys(recipes).length} awards recipes covered${uncovered.length ? `; uncovered: ${uncovered.length > 12 ? `${uncovered.slice(0, 12).join(', ')} … (+${uncovered.length - 12})` : uncovered.join(', ')}` : '.'}`);
}
if (strict && !only && uncovered.length) process.exitCode = 1;
if (errorCount) process.exitCode = 1;
