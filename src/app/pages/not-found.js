import { html, href } from '../dom.js';
import { site } from '../../registry/site.js';

export default function notFound() {
  const node = document.createElement('div');
  node.className = 'nf';
  node.innerHTML = html`
    <p class="eyebrow">404</p>
    <h1 tabindex="-1">Nothing lives at this address.</h1>
    <p class="page-head__lede">The component may have been renamed. Search for it, or start from the full list.</p>
    <div class="nf__actions"><a class="btn btn--accent" href="${href('/components/')}">All components</a><button class="btn btn--ghost" type="button" data-palette-open>Search</button></div>`;
  node.querySelector('[data-palette-open]').addEventListener('click', () => document.querySelector('[data-palette]')?.click());
  return { node, title: `Not found — ${site.name}`, layout: 'wide' };
}
