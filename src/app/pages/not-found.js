import { html, href } from '../dom.js';
import { site } from '../../registry/site.js';

export default function notFound() {
  const node = document.createElement('div');
  node.className = 'nf';
  node.innerHTML = html`
    <p class="eyebrow">404</p>
    <h1 tabindex="-1">Nothing lives at this address.</h1>
    <p class="page-head__lede">The page may have moved: the docs now have a page per topic, and components keep their names. Search for it, or start from the docs or the full list.</p>
    <div class="nf__actions"><button class="btn btn--accent" type="button" data-palette-open>Search</button><a class="btn btn--ghost" href="${href('/docs/')}">The docs</a><a class="btn btn--ghost" href="${href('/components/')}">All components</a></div>`;
  node.querySelector('[data-palette-open]').addEventListener('click', () => document.querySelector('[data-palette]')?.click());
  return { node, title: `Not found — ${site.name}`, layout: 'wide' };
}
