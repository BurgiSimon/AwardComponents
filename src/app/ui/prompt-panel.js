// The prompt panel: the text a visitor pastes into Claude Code or Codex. It rebuilds on every tweak, highlights
// the settings that differ from the defaults and the slot for the visitor's own target, and copies plain text.
import { html, raw, href, escapeHTML } from '../dom.js';
import { icon } from '../icons.js';
import { prefs } from '../prefs.js';
import { buildPrompt, CLIENTS } from '../../registry/prompt.js';
import { toParams } from '../../registry/options.js';
import { bindCopy } from './copy.js';

export function setupUrl(c, values) {
  const q = toParams(c, values).toString();
  return `${location.origin}${href(`/components/${c.id}/`)}${q ? `?${q}` : ''}`;
}

export function createPromptPanel(c, getValues, { compact = false } = {}) {
  let client = prefs.get('client', 'claude');
  let link = prefs.get('promptLink', true);
  const targets = prefs.get('targets', {});
  let target = targets[c.id] || '';

  const el = document.createElement('section');
  el.className = `prompt-panel${compact ? ' prompt-panel--compact' : ''}`;
  el.id = compact ? '' : 'prompt';
  // Full: the agent switch, the link option and Copy sit on the box itself, above the text they change. Compact
  // (the welcome page): the text, then a bar with what changed and Copy.
  const copyBtn = html`<button class="btn btn--accent" type="button" data-copy>${raw(icon('copy', { size: 15 }))}<span data-label>Copy prompt</span></button>`;
  el.innerHTML = compact
    ? html`
    <div class="prompt-box">
      <pre class="prompt-box__text" tabindex="0" aria-label="Prompt text"><code data-text></code></pre>
      <div class="prompt-box__bar">
        <span class="prompt-box__meta" data-meta></span>
        ${raw(copyBtn)}
      </div>
    </div>`
    : html`
    <div class="prompt-panel__head">
      <h2 class="section-title">Prompt</h2>
      <p class="prompt-panel__lede">Paste it into Claude Code or Codex inside your project, with the <a href="${href('/docs/')}">awards plugin</a> installed. Only the settings you changed are written in.</p>
    </div>
    <div class="prompt-panel__target">
      <label for="target-${c.id}">Where does it go? <span>Optional — names your element in the prompt</span></label>
      <input class="field" id="target-${c.id}" type="text" value="${target}" placeholder="${c.prompt?.target ? `e.g. ${c.prompt.target}` : 'e.g. the hero on the home page'}" maxlength="120" data-target spellcheck="false">
    </div>
    <div class="prompt-box">
      <div class="prompt-box__bar prompt-box__bar--top">
        <div class="seg" role="radiogroup" aria-label="Agent">
          ${Object.entries(CLIENTS).map(([k, v]) => raw(html`<label><input type="radio" name="client-${c.id}" value="${k}" ${k === client ? raw('checked') : ''} data-client><span>${v.label}</span></label>`))}
        </div>
        <label class="check"><input type="checkbox" ${link ? raw('checked') : ''} data-link><span>Link to this setup</span></label>
        ${raw(copyBtn)}
      </div>
      <pre class="prompt-box__text" tabindex="0" aria-label="Prompt text"><code data-text></code></pre>
    </div>`;

  const code = el.querySelector('[data-text]');
  const meta = el.querySelector('[data-meta]');
  let last = { text: '' };

  const render = () => {
    const values = getValues();
    last = buildPrompt(c, values, { client, target, url: link ? setupUrl(c, values) : '', link });
    code.innerHTML = last.lines.map((segs) => segs.map((s) => `<span class="pt pt--${s.k}">${escapeHTML(s.t)}</span>`).join('')).join('\n');
    if (!meta) return;
    const n = last.changed.length;
    meta.innerHTML = `${icon('sparkle', { size: 13 })}<span>${n ? `${n} setting${n > 1 ? 's' : ''} changed` : 'Default settings'} · <code>${escapeHTML(last.command)}</code></span>`;
  };

  el.addEventListener('change', (e) => {
    if (e.target.matches('[data-client]')) { client = e.target.value; prefs.set('client', client); render(); syncClients(); }
    if (e.target.matches('[data-link]')) { link = e.target.checked; prefs.set('promptLink', link); render(); }
  });
  el.addEventListener('input', (e) => {
    if (e.target.matches('[data-target]')) {
      target = e.target.value;
      const all = prefs.get('targets', {});
      if (target) all[c.id] = target; else delete all[c.id];
      prefs.set('targets', all);
      render();
    }
  });
  bindCopy(el.querySelector('[data-copy]'), () => last.text, { message: 'Prompt copied — paste it into your agent' });

  // Keep other prompt panels on the page (the tweak panel's copy button uses this one) on the same client.
  const syncClients = () => window.dispatchEvent(new CustomEvent('ac:client', { detail: client }));
  const onClient = (e) => {
    if (e.detail === client) return;
    client = e.detail;
    el.querySelectorAll('[data-client]').forEach((i) => { i.checked = i.value === client; });
    render();
  };
  window.addEventListener('ac:client', onClient);

  render();
  return {
    el,
    update: render,
    get text() { return last.text; },
    destroy() { window.removeEventListener('ac:client', onClient); },
  };
}
