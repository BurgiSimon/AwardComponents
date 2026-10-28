// Vite plugin: `virtual:ac-index`, the light component index the shell bundles (sidebar, search, cards, labels,
// changelog). It holds only listing fields; the full meta (controls, prompt, notes) is loaded on the component page.
// Built in Node from every components/<id>/meta.js; in dev a meta edit, addition or removal reloads the page.
import path from 'node:path';
import { componentIds, loadMeta, COMPONENTS_DIR } from './components.js';
import { normalize } from '../../src/registry/normalize.js';

const ID = 'virtual:ac-index';
const RESOLVED = `\0${ID}`;
const LIGHT = ['id', 'title', 'category', 'summary', 'tags', 'deps', 'recipe', 'recipes', 'added', 'updated', 'changelog', 'featured', 'order', 'status', 'labels', 'requires', 'theme', 'keywords'];

export function componentIndex() {
  let server = null;
  return {
    name: 'ac-index',
    resolveId(id) { return id === ID ? RESOLVED : null; },
    async load(id) {
      if (id !== RESOLVED) return null;
      // One broken meta.js (mid-edit in dev) must not take the whole shell down: skip it and say so.
      const all = [];
      for (const cid of componentIds()) {
        try { all.push(normalize(await loadMeta(cid, { fresh: true }))); } catch (e) { this.warn(`components/${cid}/meta.js skipped: ${e.message}`); }
      }
      const light = all.map((c) => {
        const out = {};
        for (const k of LIGHT) if (c[k] !== undefined) out[k] = c[k];
        out.controlCount = (c.controls || []).length;
        out.actionCount = (c.actions || []).length;
        return out;
      });
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
