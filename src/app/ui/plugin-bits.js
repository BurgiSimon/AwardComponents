// Small pieces the plugin pages share: the install ticket (both clients' commands with Copy), a verdict chip, a
// build's trail of rounds as dots, a terminal-style command block and the docs' callout.
import { html, raw, escapeHTML } from '../dom.js';
import { icon } from '../icons.js';
import { bindCopy } from './copy.js';
import { ROUND_KINDS, score } from '../../registry/plugin.js';

const CLIENTS = [['claude', 'Claude Code'], ['codex', 'Codex']];

// One command per line, each with its own Copy. `both` stacks the two clients; otherwise they are tabs.
export function installTicket(core, { id, both = false } = {}) {
  const lines = (k) => html`<ol class="cmds" role="list">${core.install[k].map((c) => raw(html`<li class="cmd"><code>${c}</code><button class="cmd__copy" type="button" data-copy-line="${c}" aria-label="Copy: ${c}">${raw(icon('copy', { size: 14 }))}<span data-label>Copy</span></button></li>`))}</ol>`;
  if (both) {
    return html`
      <div class="ticket ticket--both" data-ticket>
        ${CLIENTS.map(([k, name]) => raw(html`<div class="ticket__panel"><p class="ticket__k">${name}</p>${raw(lines(k))}</div>`))}
      </div>`;
  }
  return html`
    <div class="ticket" data-ticket>
      <div class="ticket__tabs" role="tablist" aria-label="Install in">
        ${CLIENTS.map(([k, name], i) => raw(html`<button type="button" role="tab" id="tab-${id}-${k}" aria-controls="panel-${id}-${k}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-client="${k}">${name}</button>`))}
        <span class="ticket__ver">awards ${core.plugin.version}</span>
      </div>
      ${CLIENTS.map(([k], i) => raw(html`<div class="ticket__panel" role="tabpanel" id="panel-${id}-${k}" aria-labelledby="tab-${id}-${k}" ${i ? raw('hidden') : ''}>${raw(lines(k))}</div>`))}
    </div>`;
}

// Tabs follow the ARIA tabs pattern (arrows, Home, End); the choice is shared by every ticket on the page.
export function bindTicket(root) {
  root.querySelectorAll('[data-copy-line]').forEach((b) => bindCopy(b, b.dataset.copyLine, { message: 'Command copied' }));
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  if (!tabs.length) return null;
  const select = (tab, focus) => {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      root.querySelector(`#${t.getAttribute('aria-controls')}`).hidden = !on;
    }
    if (focus) tab.focus();
  };
  const onClick = (e) => { const t = e.target.closest('[role="tab"]'); if (t) select(t); };
  const onKey = (e) => {
    const i = tabs.indexOf(e.target);
    if (i < 0) return;
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    select(tabs[(next + tabs.length) % tabs.length], true);
  };
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKey);
  return () => { root.removeEventListener('click', onClick); root.removeEventListener('keydown', onKey); };
}

export const verdictChip = (word) => `<span class="vchip vchip--${escapeHTML(word)}">${escapeHTML(word)}</span>`;

// A build's rounds as a row of dots, one per round, coloured by the word it ended on; read as one image.
export function trailDots(trail) {
  const label = `Rounds: ${trail.map((r) => `${ROUND_KINDS[r.kind].toLowerCase()} ${r.word} ${score(r.w)}`).join(', ')}`;
  return html`<span class="trail" role="img" aria-label="${label}">${trail.map((r) => raw(html`<span class="trail__dot trail__dot--${r.word}${r.kind === 'component' ? ' trail__dot--part' : ''}"></span>`))}</span>`;
}

// A shell command block with one Copy for the whole block.
export function commandBlock(lines, { label = '' } = {}) {
  const text = [].concat(lines).join('\n');
  return html`<div class="term">${label ? raw(html`<p class="term__k">${label}</p>`) : ''}<pre><code>${text}</code></pre><button class="icon-btn icon-btn--sm" type="button" data-copy-block="${text}" aria-label="Copy ${label || 'the commands'}">${raw(icon('copy', { size: 15 }))}</button></div>`;
}
export function bindBlocks(root) {
  root.querySelectorAll('[data-copy-block]').forEach((b) => bindCopy(b, b.dataset.copyBlock, { message: 'Copied' }));
}
