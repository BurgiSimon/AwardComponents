// The changelog, derived from the components themselves: each one's `added` date, `updated` date and optional
// `changelog: [{ date, note }]` entries. Adding a component adds its line here.
import { components } from '../../registry/index.js';
import { site } from '../../registry/site.js';
import { html, raw, href } from '../dom.js';
import { labelChips } from '../layout.js';

export default function changelogPage() {
  const days = new Map();
  const push = (date, entry) => { if (!date) return; if (!days.has(date)) days.set(date, []); days.get(date).push(entry); };
  for (const c of components) {
    push(c.added, { c, kind: 'added' });
    for (const e of c.changelog || []) push(e.date, { c, kind: 'changed', note: e.note });
    if (c.updated && !(c.changelog || []).some((e) => e.date === c.updated)) push(c.updated, { c, kind: 'changed' });
  }
  const sorted = [...days.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const fmt = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const node = document.createElement('div');
  node.className = 'changelog';
  node.innerHTML = html`
    <header class="page-head page-head--doc">
      <p class="eyebrow">Changelog</p>
      <h1 tabindex="-1">What changed</h1>
      <p class="page-head__lede">New components carry a <span class="label label--accent">New</span> label for ${site.newForDays} days, changed ones an <span class="label label--info">Updated</span> label for ${site.updatedForDays}.</p>
    </header>
    <ol class="log">
      ${sorted.map(([date, entries]) => {
        const launch = date === site.launch;
        // On the launch day, components marked `labels: ['new']` joined after the launch set: listed on their own.
        const late = (e) => launch && e.c.ownLabels.includes('new');
        const opened = entries.filter((e) => e.kind === 'added' && !late(e));
        const joined = entries.filter((e) => e.kind === 'added' && late(e));
        const changed = entries.filter((e) => e.kind === 'changed');
        const list = (items) => raw(html`<ul class="log__list">${items.map((e) => raw(html`<li><a href="${href(`/components/${e.c.id}/`)}">${e.c.title}</a><span>${e.c.categoryTitle}</span>${raw(labelChips(e.c, { max: 1, only: ['new'] }))}</li>`))}</ul>`);
        return raw(html`
        <li class="log__day">
          <div class="log__date"><time datetime="${date}">${fmt(date)}</time>${launch ? raw('<span class="label label--neutral">Launch</span>') : ''}</div>
          <div class="log__body">
            ${joined.length ? raw(html`<h2>${joined.length} new component${joined.length > 1 ? 's' : ''}</h2>${list(joined)}`) : ''}
            ${opened.length ? raw(html`<h2>${launch ? `The library opens with ${opened.length} components` : `${opened.length} new component${opened.length > 1 ? 's' : ''}`}</h2>${list(opened)}`) : ''}
            ${changed.length ? raw(html`<h2>Changed</h2><ul class="log__list">${changed.map((e) => raw(html`<li><a href="${href(`/components/${e.c.id}/`)}">${e.c.title}</a><span>${e.note || 'Updated'}</span></li>`))}</ul>`) : ''}
          </div>
        </li>`);
      })}
    </ol>`;
  return { node, title: `Changelog — ${site.name}`, layout: 'wide' };
}
