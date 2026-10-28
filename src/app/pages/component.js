// A component page: header, the workbench (live preview + tweak panel), the prompt, details and code.
import { byId, components } from '../../registry/index.js';
import { categoryById } from '../../registry/categories.js';
import { resolve, fromParams, toParams } from '../../registry/options.js';
import { features, unsupported } from '../../registry/features.js';
import { TECH_LABELS } from '../../registry/normalize.js';
import recipesData from '../../registry/recipes.json';
import { site } from '../../registry/site.js';
import { html, raw, href, debounce, escapeHTML } from '../dom.js';
import { icon } from '../icons.js';
import { labelChips } from '../layout.js';
import { setQuery } from '../router.js';
import { createPreview } from '../ui/preview.js';
import { createControls } from '../ui/controls.js';
import { createPromptPanel } from '../ui/prompt-panel.js';
import { highlight } from '../ui/highlight.js';
import { bindCopy } from '../ui/copy.js';
import { frameImg } from '../frames.js';
import { prefs } from '../prefs.js';
import notFound from './not-found.js';

const sources = import.meta.glob('/components/*/{demo.js,demo.css,meta.js}', { query: '?raw', import: 'default' });

function list(items) {
  return items?.length ? `<ul class="ticks">${items.map((t) => `<li>${escapeHTML(t)}</li>`).join('')}</ul>` : '';
}

function recipeCard(id) {
  const r = recipesData.recipes[id];
  if (!r) return '';
  const seen = r.seen;
  return html`
    <a class="recipe-card" href="${site.awards.recipesPath}/${id}" target="_blank" rel="noopener" data-external>
      <span class="recipe-card__k">${raw(icon('book', { size: 14 }))} awards recipe · ${r.tier}</span>
      <span class="recipe-card__t"><code>${id}</code></span>
      <span class="recipe-card__s">${r.title}</span>
      <span class="recipe-card__f">${seen ? `Seen in ${seen} award-winning site${seen > 1 ? 's' : ''} in the corpus` : 'A composition from the corpus'}${r.verified ? ` · verified ${r.verified}` : ''}</span>
      ${raw(icon('arrowUpRight', { size: 16, className: 'recipe-card__go' }))}
    </a>`;
}

export default function componentPage({ params, query }) {
  const c = byId.get(params[0]);
  if (!c) return notFound();
  const index = components.indexOf(c);
  const prev = components[index - 1];
  const next = components[index + 1];
  const cat = categoryById.get(c.category);
  let values = resolve(c, fromParams(c, query));
  const missing = unsupported(c.requires);
  const hasPanel = c.controls.length > 0 || c.actions.length > 0;
  let panelOpen = prefs.get('panel', true);

  const node = document.createElement('article');
  node.className = 'cpage';
  node.innerHTML = html`
    <nav class="crumbs" aria-label="Breadcrumb"><a href="${href('/components/')}">Components</a>${raw(icon('chevronRight', { size: 13 }))}<a href="${href(`/components/?cat=${c.category}`)}">${c.categoryTitle}</a></nav>
    <header class="cpage__head">
      <div class="cpage__title">
        <h1 tabindex="-1">${c.title}</h1>
        <div class="labels">${raw(labelChips(c, { max: 4 }))}</div>
      </div>
      <p class="cpage__summary">${c.summary}</p>
      <div class="cpage__meta">
        ${c.tech.map((t) => raw(`<span class="tech">${TECH_LABELS[t] || t}</span>`))}
        ${c.recipes.map((r) => raw(html`<a class="tech tech--link" href="${site.awards.recipesPath}/${r}" target="_blank" rel="noopener" data-external>${raw(icon('book', { size: 12 }))}${r}</a>`))}
        <a class="tech tech--link" href="#prompt">${raw(icon('sparkle', { size: 12 }))}Prompt</a>
      </div>
      ${missing.length ? raw(`<p class="notice">${icon('info', { size: 15 })}<span>${missing.map((k) => escapeHTML(features[k].note)).join(' ')}</span></p>`) : ''}
    </header>

    <section class="workbench${hasPanel ? '' : ' workbench--solo'}" style="--stage-h:${c.preview.height}px" data-panel="${hasPanel && panelOpen ? 'open' : 'closed'}" aria-label="Live demo">
      <div class="workbench__stage" data-slot="preview"></div>
      ${hasPanel ? raw('<div class="workbench__panel" data-slot="controls"></div>') : ''}
      ${hasPanel ? raw(html`<button class="workbench__toggle" type="button" aria-expanded="${panelOpen}" data-panel-toggle>${raw(icon('sliders', { size: 15 }))}<span>${panelOpen ? 'Hide controls' : 'Customize'}</span></button>`) : ''}
    </section>

    <div data-slot="prompt"></div>

    <section class="details" aria-label="Details">
      <div class="tabs" role="tablist" aria-label="Details">
        <button role="tab" id="tab-overview" aria-controls="panel-overview" aria-selected="true" type="button">Overview</button>
        <button role="tab" id="tab-code" aria-controls="panel-code" aria-selected="false" tabindex="-1" type="button">Demo source</button>
      </div>
      <div class="tabpanel" id="panel-overview" role="tabpanel" aria-labelledby="tab-overview">
        <div class="overview">
          <div class="overview__main">
            ${c.description ? raw(`<div class="prose">${c.description.split(/\n\n+/).map((p) => `<p>${escapeHTML(p)}</p>`).join('')}</div>`) : ''}
            ${c.useCases?.length ? raw(`<h3>Where it fits</h3>${list(c.useCases)}`) : ''}
            ${c.notes?.length ? raw(`<h3>Accessibility &amp; motion</h3>${list(c.notes)}`) : ''}
            <div data-slot="credits"></div>
          </div>
          <aside class="overview__side">
            <h3>Built from</h3>
            ${raw(c.recipes.map(recipeCard).join(''))}
            ${c.deps.length ? raw(`<h3>Libraries in the demo</h3><ul class="deps">${c.deps.map((d) => `<li><code>${escapeHTML(d)}</code></li>`).join('')}</ul>`) : raw('<h3>Libraries in the demo</h3><p class="muted">None — plain CSS and a little JavaScript.</p>')}
            ${c.tags.length ? raw(`<h3>Tags</h3><p class="tags">${c.tags.map((t) => `<a class="tag" href="${href(`/components/?q=${encodeURIComponent(t)}`)}">${escapeHTML(t)}</a>`).join('')}</p>`) : ''}
          </aside>
        </div>
      </div>
      <div class="tabpanel" id="panel-code" role="tabpanel" aria-labelledby="tab-code" hidden>
        <p class="muted code-note">The demo as it runs above. To use it, copy the prompt: the awards plugin rebuilds it inside your project's own tokens and stack instead of pasting this file.</p>
        <div class="code">
          <div class="code__bar">
            <div class="code__files" role="tablist" aria-label="Files">
              ${['demo.js', 'demo.css', 'meta.js'].map((f, i) => raw(`<button type="button" role="tab" aria-selected="${i === 0}" data-file="${f}">${f}</button>`))}
            </div>
            <button class="icon-btn icon-btn--sm" type="button" data-copy-code aria-label="Copy this file">${raw(icon('copy', { size: 15 }))}</button>
          </div>
          <pre class="code__body"><code data-code>Loading…</code></pre>
        </div>
      </div>
    </section>

    <nav class="pager" aria-label="More components">
      ${prev ? raw(html`<a class="pager__link" href="${href(`/components/${prev.id}/`)}" rel="prev"><span class="pager__k">${raw(icon('arrowLeft', { size: 14 }))} Previous</span><span class="pager__t">${prev.title}</span>${raw(frameImg(prev.id, { size: 'sm' }))}</a>`) : raw('<span></span>')}
      ${next ? raw(html`<a class="pager__link pager__link--next" href="${href(`/components/${next.id}/`)}" rel="next"><span class="pager__k">Next ${raw(icon('arrowRight', { size: 14 }))}</span><span class="pager__t">${next.title}</span>${raw(frameImg(next.id, { size: 'sm' }))}</a>`) : raw('<span></span>')}
    </nav>`;

  const syncUrl = debounce(() => setQuery(toParams(c, values)), 250);

  const preview = createPreview(c, () => values, {
    onReady: (msg) => renderCredits(node.querySelector('[data-slot="credits"]'), msg.media || []),
  });
  node.querySelector('[data-slot="preview"]').append(preview.el);

  const prompt = createPromptPanel(c, () => values);
  node.querySelector('[data-slot="prompt"]').append(prompt.el);

  let controls = null;
  if (hasPanel) {
    controls = createControls(c, values, {
      onChange(next) {
        values = next;
        preview.setValues(values);
        prompt.update();
        syncUrl();
      },
      onAction(id) { preview.el.querySelector(`[data-action="${id}"]`)?.click() || preview.iframe.contentWindow?.postMessage({ type: 'ac:action', action: id }, location.origin); },
      footer: `<button class="btn btn--accent btn--block" type="button" data-copy-panel>${icon('copy', { size: 15 })}<span data-label>Copy prompt</span></button><a class="btn btn--ghost btn--block" href="#prompt">${icon('arrowRight', { size: 15 })}<span>See the prompt</span></a>`,
    });
    node.querySelector('[data-slot="controls"]').append(controls.el);
    bindCopy(controls.el.querySelector('[data-copy-panel]'), () => prompt.text, { message: 'Prompt copied — paste it into your agent' });
    const bench = node.querySelector('.workbench');
    const toggle = node.querySelector('[data-panel-toggle]');
    toggle.addEventListener('click', () => {
      panelOpen = bench.dataset.panel !== 'open';
      bench.dataset.panel = panelOpen ? 'open' : 'closed';
      toggle.setAttribute('aria-expanded', String(panelOpen));
      toggle.querySelector('span').textContent = panelOpen ? 'Hide controls' : 'Customize';
      prefs.set('panel', panelOpen);
    });
  }

  // Tabs (roving focus).
  const tabs = [...node.querySelectorAll('.details [role="tab"]')];
  const selectTab = (tab) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      node.querySelector(`#${t.getAttribute('aria-controls')}`).hidden = !on;
    });
    if (tab.id === 'tab-code') loadFile(node.querySelector('[data-file][aria-selected="true"]').dataset.file);
  };
  tabs.forEach((t) => t.addEventListener('click', () => selectTab(t)));
  node.querySelector('.details .tabs').addEventListener('keydown', (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const t = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      t.focus();
      selectTab(t);
    }
  });

  // Code tab: sources load on first open.
  let codeText = '';
  async function loadFile(file) {
    const loader = sources[`/components/${c.id}/${file}`];
    const box = node.querySelector('[data-code]');
    node.querySelectorAll('[data-file]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.file === file)));
    if (!loader) { box.textContent = `${file} is not part of this component.`; codeText = ''; return; }
    codeText = await loader();
    box.innerHTML = highlight(codeText, file.endsWith('.css') ? 'css' : 'js');
  }
  node.querySelector('.code__files').addEventListener('click', (e) => {
    const b = e.target.closest('[data-file]');
    if (b) loadFile(b.dataset.file);
  });
  bindCopy(node.querySelector('[data-copy-code]'), () => codeText, { message: 'File copied' });

  return {
    node,
    title: `${c.title} — ${site.name}`,
    layout: 'library',
    componentId: c.id,
    mounted() {
      if (cat) document.querySelector('meta[name="description"]')?.setAttribute('content', c.summary);
    },
    destroy() {
      preview.destroy();
      prompt.destroy();
    },
  };
}

async function renderCredits(slot, ids) {
  if (!slot || !ids.length) return;
  const { default: manifest } = await import('../../demo-kit/media.json');
  const items = ids.map((id) => manifest.items.find((m) => m.id === id)).filter(Boolean);
  if (!items.length) return;
  slot.innerHTML = `<h3>Pictures in the demo</h3><ul class="credits">${items.map((m) => `<li><a href="${escapeHTML(m.page)}" target="_blank" rel="noopener" data-external>${escapeHTML(m.credit || m.id)}</a></li>`).join('')}</ul><p class="muted">Public domain or CC0, from open museum and agency collections. Your project brings its own pictures; the prompt does not copy these.</p>`;
}
