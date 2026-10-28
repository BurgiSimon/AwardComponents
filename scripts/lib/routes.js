// Vite plugin: after the build, one HTML file per route (copies of index.html with their own <title>, description,
// canonical and Open Graph tags), a 404.html for static hosts, and sitemap.xml + robots.txt when SITE_URL is set.
import fs from 'node:fs';
import path from 'node:path';
import { loadComponents } from './components.js';
import { site } from '../../src/registry/site.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export function routes({ base = '/', siteUrl = '' } = {}) {
  let outDir = 'dist';
  return {
    name: 'ac-routes',
    apply: 'build',
    configResolved(config) { outDir = path.resolve(config.root, config.build.outDir); },
    async closeBundle() {
      const template = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
      const components = await loadComponents({ fresh: true });
      const abs = (route) => (siteUrl ? new URL(route.replace(/^\//, ''), siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`).href : '');
      const page = (route, title, description, image) => {
        let out = template
          .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
          .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(description)}$2`)
          .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(title)}$2`)
          .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(description)}$2`);
        if (siteUrl) {
          const extra = [
            `<link rel="canonical" href="${abs(route)}">`,
            `<meta property="og:url" content="${abs(route)}">`,
            image ? `<meta property="og:image" content="${abs(image)}">` : '',
          ].filter(Boolean).join('\n    ');
          out = out.replace('</head>', `    ${extra}\n  </head>`);
        }
        return out;
      };
      const write = (route, html) => {
        const file = route.endsWith('.html') ? path.join(outDir, route) : path.join(outDir, route, 'index.html');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, html);
      };

      const list = [
        ['/', `${site.name} — award-league components you can prompt`, site.description],
        ['/components/', `All components — ${site.name}`, `${components.length} components with live demos, controls and a prompt for the awards plugin.`],
        ['/docs/', `Getting started — ${site.name}`, 'Install the awards plugin, tune a component and paste its prompt into Claude Code or Codex.'],
        ['/changelog/', `Changelog — ${site.name}`, 'Every component added or changed, newest first.'],
      ];
      for (const c of components) {
        list.push([`/components/${c.id}/`, `${c.title} — ${site.name}`, c.summary, `frames/${c.id}-light.webp`]);
      }
      for (const [route, title, description, image] of list) {
        if (route === '/') fs.writeFileSync(path.join(outDir, 'index.html'), page(route, title, description, 'og.png'));
        else write(route, page(route, title, description, image || 'og.png'));
      }
      write('404.html', page('/404', `Not found — ${site.name}`, site.description));

      if (siteUrl) {
        const urls = list.map(([route]) => `  <url><loc>${abs(route)}</loc></url>`).join('\n');
        fs.writeFileSync(path.join(outDir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
        fs.writeFileSync(path.join(outDir, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: ${base}play.html\nSitemap: ${abs('/sitemap.xml')}\n`);
      }
      console.log(`ac-routes: ${list.length + 1} route files${siteUrl ? ' + sitemap' : ''}`);
    },
  };
}
