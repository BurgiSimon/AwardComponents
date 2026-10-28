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
export function onlyArg(argv = process.argv) {
  const i = argv.indexOf('--only');
  return i > -1 && argv[i + 1] ? argv[i + 1].split(',').map((s) => s.trim()).filter(Boolean) : null;
}
