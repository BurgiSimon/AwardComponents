// Start the site for a script: the Vite dev server (default) or a preview of dist/ (--dist), on a free port.
import { createServer, preview } from 'vite';
import { ROOT } from './components.js';

export async function startServer({ dist = false } = {}) {
  if (dist) {
    const server = await preview({ root: ROOT, logLevel: 'error', preview: { port: 0, host: '127.0.0.1' } });
    return { url: server.resolvedUrls.local[0].replace(/\/$/, ''), close: () => new Promise((r) => server.httpServer.close(r)) };
  }
  const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 0, host: '127.0.0.1', hmr: false, watch: null, forwardConsole: false } });
  await server.listen();
  return { url: server.resolvedUrls.local[0].replace(/\/$/, ''), close: () => server.close() };
}
