// The docs: one layout for every page (the docs menu, the page, its own contents and the pager), and a renderer per
// page in ./start.js, ./plugin.js, ./judging.js and ./reference.js. The order and titles come from
// src/registry/docs.js; the facts from the plugin snapshot (src/registry/plugin.json and plugin-ref.json).
import { DOC_GROUPS, docBySlug, docPath } from '../../../registry/docs.js';
import { loadPlugin, loadRef, pluginFile, longDate } from '../../../registry/plugin.js';
import { site } from '../../../registry/site.js';
import { html, raw, href } from '../../dom.js';
import { icon } from '../../icons.js';
import { bindBlocks } from '../../ui/plugin-bits.js';
import notFound from '../not-found.js';
import * as start from './start.js';
import * as plugin from './plugin.js';
import * as judging from './judging.js';
import * as reference from './reference.js';

const RENDER = {
  '': start.overview,
  install: start.install,
  'first-build': start.firstBuild,
  components: start.components,
  skills: plugin.skills,
  flow: plugin.flow,
  modes: plugin.modes,
  'project-files': plugin.projectFiles,
  jury: judging.jury,
  audit: judging.audit,
  corpus: judging.corpus,
  scripts: reference.scripts,
  hooks: reference.hooks,
  faq: reference.faq,
};
// Pages that print the long tables wait for the second file too.
const NEEDS_REF = new Set(['audit', 'corpus']);

const ORDER = DOC_GROUPS.flatMap((g) => g.slugs);
const groupOf = (slug) => DOC_GROUPS.find((g) => g.slugs.includes(slug))?.title || '';

function menu(core, current, skillId) {
  return html`
    <nav class="dnav" aria-label="Docs">
      <button class="dnav__toggle" type="button" aria-expanded="false" aria-controls="dnav-list">${raw(icon('list', { size: 16 }))}<span>Docs menu</span><span class="dnav__here">${skillId ? `awards:${skillId}` : docBySlug.get(current)?.title}</span>${raw(icon('chevronDown', { size: 16 }))}</button>
      <div class="dnav__list" id="dnav-list">
        ${DOC_GROUPS.map((g) => raw(html`
        <div class="dnav__group">
          <p class="dnav__h">${g.title}</p>
          <ul role="list">
            ${g.slugs.map((slug) => raw(html`<li><a href="${href(docPath(slug))}" ${raw(slug === current && !skillId ? 'aria-current="page"' : slug === current ? 'aria-current="true"' : '')}>${docBySlug.get(slug).title}</a>
              ${slug === 'skills' && current === 'skills' ? raw(html`<ul class="dnav__sub" role="list">${core.skills.map((s) => raw(html`<li><a href="${href(`/docs/skills/${s.id}/`)}" ${raw(s.id === skillId ? 'aria-current="page"' : '')}><code>${s.id}</code></a></li>`))}</ul>`) : ''}</li>`))}
          </ul>
        </div>`))}
      </div>
    </nav>`;
}

function pager(prev, next) {
  const link = (p, dir) => (p ? html`<a class="dpager__link dpager__link--${dir}" href="${href(p.to)}"><span class="dpager__k">${raw(dir === 'prev' ? icon('arrowLeft', { size: 14 }) : '')}${dir === 'prev' ? 'Previous' : 'Next'}${raw(dir === 'next' ? icon('arrowRight', { size: 14 }) : '')}</span><span class="dpager__t">${p.title}</span></a>` : '<span></span>');
  return html`<nav class="dpager" aria-label="Previous and next">${raw(link(prev, 'prev'))}${raw(link(next, 'next'))}</nav>`;
}

// The page frame shared by every docs page. `page` is { heading, lede, body, sources, mount }.
function frame(core, { slug, skillId, heading, lede, body, sources = [], prev, next, crumb }) {
  const node = document.createElement('div');
  node.className = 'dpage';
  node.innerHTML = html`
    ${raw(menu(core, slug, skillId))}
    <article class="dbody">
      <header class="dhead">
        <p class="crumbs"><a href="${href('/docs/')}">Docs</a>${raw(crumb ? html`<span aria-hidden="true">/</span><a href="${href(crumb.to)}">${crumb.title}</a>` : slug ? html`<span aria-hidden="true">/</span><span>${groupOf(slug)}</span>` : '')}</p>
        <h1 tabindex="-1">${raw(heading)}</h1>
        ${lede ? raw(html`<p class="page-head__lede">${raw(lede)}</p>`) : ''}
      </header>
      <div class="prose dprose">${raw(body)}</div>
      <footer class="dfoot">
        <p class="dsrc">${raw(icon('file', { size: 13 }))}<span>${sources.length ? raw(html`Read from ${raw(sources.map((f) => html`<a href="${pluginFile(core, f)}" target="_blank" rel="noopener" data-external><code>${f.replace(/^\//, '')}</code></a>`).join(', '))}`) : 'Written for this site'} · awards ${core.plugin.version}, synced ${longDate(core.synced)}</span></p>
        ${raw(pager(prev, next))}
      </footer>
    </article>
    <nav class="dtoc" aria-label="On this page"><p>On this page</p><ul role="list" data-toc></ul></nav>`;

  // On this page: every h2 with an id.
  const heads = [...node.querySelectorAll('.dprose h2[id]')];
  const toc = node.querySelector('[data-toc]');
  toc.innerHTML = heads.map((h) => html`<li><a href="#${h.id}">${h.textContent}</a></li>`).join('');
  if (heads.length < 2) node.querySelector('.dtoc').hidden = true;

  // The docs menu folds away on narrow screens.
  const toggle = node.querySelector('.dnav__toggle');
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    node.querySelector('.dnav').toggleAttribute('data-open', open);
  });

  // The section being read is marked in the contents.
  let io = null;
  if (heads.length > 1) {
    const links = new Map([...toc.querySelectorAll('a')].map((a) => [decodeURIComponent(a.hash.slice(1)), a]));
    const seen = new Set();
    io = new IntersectionObserver((entries) => {
      for (const e of entries) e.isIntersecting ? seen.add(e.target.id) : seen.delete(e.target.id);
      const first = heads.find((h) => seen.has(h.id));
      if (!first) return;
      for (const [id, a] of links) a.toggleAttribute('data-active', id === first.id);
    }, { rootMargin: '-80px 0px -60% 0px' });
    heads.forEach((h) => io.observe(h));
  }
  bindBlocks(node);
  return { node, cleanup: () => io?.disconnect() };
}

export default async function docsPage({ params, query, url }) {
  const slug = params[0] ?? '';
  const doc = docBySlug.get(slug);
  if (!doc) return notFound({ params, query, url });
  const [core, ref] = await Promise.all([loadPlugin(), NEEDS_REF.has(slug) ? loadRef() : null]);
  const page = await RENDER[slug](core, ref, { query });
  const i = ORDER.indexOf(slug);
  const at = (j) => (ORDER[j] !== undefined ? { to: docPath(ORDER[j]), title: docBySlug.get(ORDER[j]).title } : null);
  // Skills sits between its neighbours, but its own pages come next: the pager walks into craft.
  const next = slug === 'skills' ? { to: `/docs/skills/${core.skills[0].id}/`, title: `awards:${core.skills[0].id}` } : at(i + 1);
  const prev = slug === 'flow' ? { to: `/docs/skills/${core.skills.at(-1).id}/`, title: `awards:${core.skills.at(-1).id}` } : at(i - 1);
  const { node, cleanup } = frame(core, { slug, heading: page.heading || doc.heading, lede: page.lede ?? doc.description, body: page.body, sources: page.sources, prev, next });
  const off = page.mount?.(node);
  return {
    node,
    title: slug ? `${doc.title} · Docs — ${site.name}` : `Docs — ${site.name}`,
    layout: 'wide',
    destroy() { cleanup(); off?.(); },
  };
}

export async function skill({ params, query, url }) {
  const core = await loadPlugin();
  const i = core.skills.findIndex((s) => s.id === params[0]);
  if (i < 0) return notFound({ params, query, url });
  const s = core.skills[i];
  const page = plugin.skillPage(core, s);
  const at = (j) => (core.skills[j] ? { to: `/docs/skills/${core.skills[j].id}/`, title: `awards:${core.skills[j].id}` } : null);
  const prev = at(i - 1) || { to: '/docs/skills/', title: 'Skills' };
  const next = at(i + 1) || { to: '/docs/flow/', title: docBySlug.get('flow').title };
  const { node, cleanup } = frame(core, { slug: 'skills', skillId: s.id, heading: page.heading, lede: page.lede, body: page.body, sources: page.sources, prev, next, crumb: { to: '/docs/skills/', title: 'Skills' } });
  return { node, title: `awards:${s.id} · Skills — ${site.name}`, layout: 'wide', destroy: cleanup };
}
