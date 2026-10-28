// Node-side registry: every components/<id>/meta.js imported directly, normalised by the shell's own function.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { normalize } from '../../src/registry/normalize.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const COMPONENTS_DIR = path.join(ROOT, 'components');

export function componentIds() {
  if (!fs.existsSync(COMPONENTS_DIR)) return [];
  return fs.readdirSync(COMPONENTS_DIR).filter((d) => !d.startsWith('_') && !d.startsWith('.') && fs.statSync(path.join(COMPONENTS_DIR, d)).isDirectory()).sort();
}

export async function loadMeta(id, { fresh = false } = {}) {
  const file = path.join(COMPONENTS_DIR, id, 'meta.js');
  const url = pathToFileURL(file).href + (fresh ? `?t=${Date.now()}` : '');
  const mod = await import(url);
  return mod.default;
}

export async function loadComponents({ fresh = false } = {}) {
  const out = [];
  for (const id of componentIds()) {
    if (!fs.existsSync(path.join(COMPONENTS_DIR, id, 'meta.js'))) continue;
    out.push(normalize(await loadMeta(id, { fresh })));
  }
  return out;
}

// --only a,b,c from argv.
// The text files a component is made of, as the Code tab lists them: demo.js, demo.css and meta.js first, then any
// other module or stylesheet in the folder (a shader, a worker, an authoring script). Binary assets are left out.
export const SOURCE_FILE = /^[a-z0-9][\w.-]*\.(?:js|mjs|css)$/i;
const MAIN_FILES = ['demo.js', 'demo.css', 'meta.js'];
export function sourceFiles(id) {
  const dir = path.join(COMPONENTS_DIR, id);
  const present = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => SOURCE_FILE.test(f)) : [];
  return [...MAIN_FILES.filter((f) => present.includes(f)), ...present.filter((f) => !MAIN_FILES.includes(f)).sort()];
}

export function onlyArg(argv = process.argv) {
  const i = argv.indexOf('--only');
  return i > -1 && argv[i + 1] ? argv[i + 1].split(',').map((s) => s.trim()).filter(Boolean) : null;
}
