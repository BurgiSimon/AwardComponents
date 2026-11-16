// What changed, in two logs. The plugin's release notes come from the awards repository's CHANGELOG.md (through
// scripts/sync-plugin.mjs); the library's log is derived from the components themselves: each one's `added` date,
// `updated` date and optional `changelog: [{ date, note }]` entries, so adding a component adds its line here.
// ?log=library opens the library's log; the plugin's is the default.
import { components } from '../../registry/index.js';
import { site } from '../../registry/site.js';
import { loadRef, md, longDate } from '../../registry/plugin.js';
import { setQuery } from '../router.js';
import { html, raw, href } from '../dom.js';
import { labelChips } from '../layout.js';

function libraryLog() {
  const days = new Map();
  const push = (date, entry) => { if (!date) return; if (!days.has(date)) days.set(date, []); days.get(date).push(entry); };
  for (const c of components) {
    push(c.added, { c, kind: 'added' });
    for (const e of c.changelog || []) push(e.date, { c, kind: 'changed', note: e.note });
    if (c.updated && !(c.changelog || []).some((e) => e.date === c.updated)) push(c.updated, { c, kind: 'changed' });
  }
  const sorted = [...days.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  return html`
    <p class="clog__intro">New components carry a <span class="label label--accent">New</span> label for ${site.newForDays} days, changed ones an <span class="label label--info">Updated</span> label for ${site.updatedForDays}.</p>
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
          <div class="log__date"><time datetime="${date}">${longDate(date)}</time>${launch ? raw('<span class="label label--neutral">Launch</span>') : ''}</div>
          <div class="log__body">
            ${joined.length ? raw(html`<h2>${joined.length} new component${joined.length > 1 ? 's' : ''}</h2>${list(joined)}`) : ''}
            ${opened.length ? raw(html`<h2>${launch ? `The library opens with ${opened.length} components` : `${opened.length} new component${opened.length > 1 ? 's' : ''}`}</h2>${list(opened)}`) : ''}
            ${changed.length ? raw(html`<h2>Changed</h2><ul class="log__list">${changed.map((e) => raw(html`<li><a href="${href(`/components/${e.c.id}/`)}">${e.c.title}</a><span>${e.note || 'Updated'}</span></li>`))}</ul>`) : ''}
          </div>
        </li>`);
      })}
    </ol>`;
}

function pluginLog(ref, repo) {
  return html`
    <p class="clog__intro">Release notes for the awards plugin, newest first, from its <a href="${repo}/blob/main/CHANGELOG.md" target="_blank" rel="noopener" data-external>CHANGELOG.md</a>. Unreleased work is merged but not yet in a tagged version.</p>
    <ol class="log rel">
      ${ref.releases.map((r, i) => raw(html`
      <li class="log__day" id="v-${r.version.toLowerCase().replace(/[^a-z0-9]+/g, '-')}">
        <div class="log__date"><h2 class="rel__v">${r.version === 'Unreleased' ? 'Unreleased' : `awards ${r.version}`}</h2>${r.date ? raw(html`<time datetime="${r.date}">${longDate(r.date)}</time>`) : ''}</div>
        <div class="log__body">
          ${r.intro.map((p) => raw(html`<p class="rel__intro">${raw(md(p))}</p>`))}
          ${i < 2
            ? raw(html`<ul class="rel__items">${r.items.map((it) => raw(html`<li>${it.title ? raw(html`<strong>${raw(md(it.title))}.</strong> `) : ''}${raw(md(it.body))}</li>`))}</ul>`)
            : raw(html`<details class="rel__more"><summary>${r.items.length} changes</summary><ul class="rel__items">${r.items.map((it) => raw(html`<li>${it.title ? raw(html`<strong>${raw(md(it.title))}.</strong> `) : ''}${raw(md(it.body))}</li>`))}</ul></details>`)}
        </div>
      </li>`))}
    </ol>`;
}

export default async function changelogPage({ query }) {
  const ref = await loadRef();
  const repo = site.awards.repo;
  let tab = query.get('log') === 'library' ? 'library' : 'plugin';
  const node = document.createElement('div');
  node.className = 'changelog';
  node.innerHTML = html`
    <header class="page-head page-head--doc">
      <h1 tabindex="-1">What changed</h1>
      <p class="page-head__lede">Two logs: the awards plugin’s releases, and the components added to or changed in this library.</p>
    </header>
    <div class="clog__tabs" role="tablist" aria-label="Log">
      <button type="button" role="tab" id="tab-plugin" aria-controls="log-plugin" data-tab="plugin">The plugin</button>
      <button type="button" role="tab" id="tab-library" aria-controls="log-library" data-tab="library">The library</button>
    </div>
    <section id="log-plugin" role="tabpanel" aria-labelledby="tab-plugin">${raw(pluginLog(ref, repo))}</section>
    <section id="log-library" role="tabpanel" aria-labelledby="tab-library">${raw(libraryLog())}</section>`;

  const tabs = [...node.querySelectorAll('[role="tab"]')];
  const show = (id, { focus = false, push = true } = {}) => {
    tab = id;
    for (const t of tabs) {
      const on = t.dataset.tab === id;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      node.querySelector(`#${t.getAttribute('aria-controls')}`).hidden = !on;
      if (on && focus) t.focus();
    }
    if (push) setQuery(new URLSearchParams(id === 'library' ? { log: 'library' } : {}), { path: '/changelog/' });
  };
  node.querySelector('.clog__tabs').addEventListener('click', (e) => { const t = e.target.closest('[role="tab"]'); if (t) show(t.dataset.tab); });
  node.querySelector('.clog__tabs').addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const i = tabs.findIndex((t) => t.dataset.tab === tab);
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    show(tabs[j].dataset.tab, { focus: true });
  });
  show(tab, { push: false });
  return { node, title: `Changelog — ${site.name}`, layout: 'wide' };
}
