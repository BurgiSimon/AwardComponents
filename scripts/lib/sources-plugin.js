// Vite plugin: each component's text sources (demo.js, demo.css, meta.js and any other module or stylesheet in its
// folder) as plain text at source/<id>/<file>.txt, for the component page's "Demo source" tab. Served from components/ in dev and emitted as assets in the build, so the
// shell bundles no per-component source map.
import fs from 'node:fs';
import path from 'node:path';
import { componentIds, COMPONENTS_DIR, SOURCE_FILE, sourceFiles } from './components.js';

export function componentSources() {
  return {
    name: 'ac-sources',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const base = server.config.base || '/';
        const m = req.url && decodeURIComponent(req.url.split('?')[0]).match(new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}source/([a-z0-9-]+)/([^/]+)\\.txt$`));
        if (!m || !SOURCE_FILE.test(m[2])) return next();
        const file = path.join(COMPONENTS_DIR, m[1], m[2]);
        if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('not found'); }
        res.setHeader('content-type', 'text/plain; charset=utf-8');
        res.end(fs.readFileSync(file, 'utf8'));
      });
    },
    generateBundle() {
      for (const id of componentIds()) {
        for (const f of sourceFiles(id)) {
          this.emitFile({ type: 'asset', fileName: `source/${id}/${f}.txt`, source: fs.readFileSync(path.join(COMPONENTS_DIR, id, f), 'utf8') });
        }
      }
    },
  };
}
