// Two entries: index.html (the library shell, a client-routed app) and play.html (the demo runtime the shell
// frames). After the build, routes.js writes one HTML file per route with its own title and description, so deep
// links answer 200 on a static host and share well; SITE_URL adds canonicals, og:url and a sitemap.
// BASE_PATH sets the public base (e.g. /AwardComponents/ on a GitHub project page).
import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { routes } from './scripts/lib/routes.js';
import { componentIndex } from './scripts/lib/index-plugin.js';
import { componentSources } from './scripts/lib/sources-plugin.js';

const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  appType: 'spa',
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        play: resolve(import.meta.dirname, 'play.html'),
      },
    },
  },
  server: { port: 5173 },
  plugins: [componentIndex(), componentSources(), routes({ base, siteUrl: process.env.SITE_URL || '' })],
});
