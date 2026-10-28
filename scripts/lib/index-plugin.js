// Vite plugin: `virtual:ac-index`, the light component index the shell bundles (sidebar, search, cards, labels,
// changelog). It holds only listing fields; the full meta (controls, prompt, notes) is loaded on the component page.
// Built in Node from every components/<id>/meta.js; in dev a meta edit, addition or removal reloads the page.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { componentIds, COMPONENTS_DIR } from './components.js';
import { normalize } from '../../src/registry/normalize.js';

const ID = 'virtual:ac-index';
const RESOLVED = `\0${ID}`;
// labels is not copied from the normalised meta (that holds labels computed at build time, so New would never
// expire); the author's own extra labels are taken from the raw meta instead.
const LIGHT = ['id', 'title', 'category', 'summary', 'tags', 'deps', 'recipe', 'recipes', 'added', 'updated', 'changelog', 'featured', 'order', 'status', 'requires', 'theme', 'keywords'];

// Re-import a meta.js only when its file changed: the URL carries its mtime, so Node keeps one module record per
// version instead of one per rebuild.
const cache = new Map();
async function readMeta(id) {
  const file = path.join(COMPONENTS_DIR, id, 'meta.js');
  const mtime = fs.statSync(file).mtimeMs;
  const hit = cache.get(id);
  if (hit && hit.mtime === mtime) return hit.meta;
  const meta = (await import(`${pathToFileURL(file).href}?v=${mtime}`)).default;
  cache.set(id, { mtime, meta });
  return meta;
}

export function componentIndex() {
  let server = null;
  return {
    name: 'ac-index',
    resolveId(id) { return id === ID ? RESOLVED : null; },
    async load(id) {
      if (id !== RESOLVED) return null;
      // One broken meta.js (mid-edit in dev) must not take the whole shell down: skip it and say so.
      const light = [];
      const ids = componentIds();
      for (const cid of [...cache.keys()]) if (!ids.includes(cid)) cache.delete(cid);
      for (const cid of ids) {
        try {
          const raw = await readMeta(cid);
          const c = normalize(raw);
          const out = {};
          for (const k of LIGHT) if (c[k] !== undefined) out[k] = c[k];
          if (raw.labels) out.labels = raw.labels;
          out.controlCount = (c.controls || []).length;
          out.actionCount = (c.actions || []).length;
          light.push(out);
        } catch (e) {
          this.warn(`components/${cid}/meta.js skipped: ${e.message}`);
        }
      }
      return `export default ${JSON.stringify(light)};`;
    },
    configureServer(s) {
      server = s;
      const onChange = (file) => {
        if (!file.startsWith(COMPONENTS_DIR + path.sep) || !file.endsWith(`${path.sep}meta.js`) && !file.endsWith(path.sep)) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      s.watcher.on('change', onChange);
      s.watcher.on('add', onChange);
      s.watcher.on('unlink', onChange);
      s.watcher.on('unlinkDir', (dir) => onChange(dir + path.sep));
    },
  };
}
