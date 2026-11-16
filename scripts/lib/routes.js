// Vite plugin: after the build, one HTML file per route (copies of index.html with their own <title>, description,
// canonical and Open Graph tags), a 404.html for static hosts, and sitemap.xml + robots.txt when SITE_URL is set.
import fs from 'node:fs';
import path from 'node:path';
import { loadComponents } from './components.js';
import { site } from '../../src/registry/site.js';
import { DOCS } from '../../src/registry/docs.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export function routes({ base = '/', siteUrl = '' } = {}) {
  let outDir = 'dist';
  return {
    name: 'ac-routes',
    apply: 'build',
    configResolved(config) { outDir = path.resolve(config.root, config.build.outDir); },
    async writeBundle(_options, bundle) {
      // A component page needs its meta chunk before it can render: preload it from that route's HTML.
      const metaChunk = new Map();
      for (const out of Object.values(bundle)) {
        const m = out.type === 'chunk' && out.facadeModuleId?.replace(/\\/g, '/').match(/\/components\/([a-z0-9-]+)\/meta\.js$/);
        if (m) metaChunk.set(m[1], out.fileName);
      }
      const template = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
      const components = await loadComponents({ fresh: true });
      const abs = (route) => (siteUrl ? new URL(route.replace(/^\//, ''), siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`).href : '');
      const page = (route, title, description, image, preload) => {
        let out = template
          .replace(/<title>[^<]*<\/title>/, () => `<title>${esc(title)}</title>`)
          .replace(/(<meta name="description" content=")[^"]*(")/, (_, a, b) => `${a}${esc(description)}${b}`)
          .replace(/(<meta property="og:title" content=")[^"]*(")/, (_, a, b) => `${a}${esc(title)}${b}`)
          .replace(/(<meta property="og:description" content=")[^"]*(")/, (_, a, b) => `${a}${esc(description)}${b}`);
        if (preload) out = out.replace('</head>', () => `    <link rel="modulepreload" crossorigin href="${base}${preload}">\n  </head>`);
        if (siteUrl) {
          const extra = [
            `<link rel="canonical" href="${abs(route)}">`,
            `<meta property="og:url" content="${abs(route)}">`,
            image ? `<meta property="og:image" content="${abs(image)}">` : '',
          ].filter(Boolean).join('\n    ');
          out = out.replace('</head>', () => `    ${extra}\n  </head>`);
        }
        return out;
      };
      const write = (route, html) => {
        const file = route.endsWith('.html') ? path.join(outDir, route) : path.join(outDir, route, 'index.html');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, html);
      };

      // The plugin's pages read the same snapshot the shell does (scripts/sync-plugin.mjs).
      const plugin = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../src/registry/plugin.json'), 'utf8'));
      const list = [
        ['/', `${site.name} — the awards plugin and its component library`, site.description],
        ['/library/', `The library — ${site.name}`, `${components.length} award-league components, each with live controls and a prompt that rebuilds it in your project with the awards plugin.`],
        ['/components/', `All components — ${site.name}`, `${components.length} components with live demos, controls and a prompt for the awards plugin.`],
        ['/recipes/', `Recipes — ${site.name}`, `All ${plugin.counts.recipes} recipes in the awards plugin, each a verified Vite page, with the component built on it.`],
        ['/showcase/', `Showcase — ${site.name}`, `${plugin.builds.length} sites the awards plugin built from a brief, and what its jury said about each, round by round.`],
        ['/changelog/', `Changelog — ${site.name}`, 'The awards plugin’s release notes and every component added to or changed in the library, newest first.'],
      ];
      for (const d of DOCS) list.push([d.slug ? `/docs/${d.slug}/` : '/docs/', d.slug ? `${d.title} · Docs — ${site.name}` : `Docs — ${site.name}`, d.description]);
      for (const sk of plugin.skills) list.push([`/docs/skills/${sk.id}/`, `awards:${sk.id} · Skills — ${site.name}`, sk.short]);
      for (const b of plugin.builds) list.push([`/showcase/${b.id}/`, `${b.name} · Showcase — ${site.name}`, `${b.what} Judged ${b.rounds} times by the awards jury; last verdict ${b.last.word}, ${b.last.w} weighted.`, b.frame || undefined]);
      for (const c of components) {
        list.push([`/components/${c.id}/`, `${c.title} — ${site.name}`, c.summary, `frames/${c.id}-light.webp`, metaChunk.get(c.id)]);
      }
      for (const [route, title, description, image, preload] of list) {
        if (route === '/') fs.writeFileSync(path.join(outDir, 'index.html'), page(route, title, description, 'og.png', metaChunk.get('magnetic-button')));
        else write(route, page(route, title, description, image || 'og.png', preload));
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
