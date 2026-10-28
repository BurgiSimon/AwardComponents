// The prompt a visitor copies into Claude Code or Codex. Built from the component's meta.prompt, its recipe ids
// and only the controls that differ from their defaults. Pure: the shell renders it, check.mjs builds every one.
//
// meta.prompt:
//   skill   the awards skill that should take it: 'component' (default), 'motion', 'webgl', 'stack' or 'craft'
//   ask     one imperative sentence with a {target} slot: 'Add a magnetic call-to-action button to {target}.'
//   target  what {target} says until the visitor names their own element: 'the primary call to action'
//   brief   one or two sentences on what to rebuild: the behaviour the demo shows, in plain words
//   keep    optional lines that must survive the adaptation (paths, limits, accessibility)
import { changedControls, promptLine } from './options.js';

export const CLIENTS = {
  claude: { label: 'Claude Code', command: (skill) => `/awards:${skill}` },
  codex: { label: 'Codex', command: (skill) => `$awards:${skill}` },
};

// → { text, lines } where lines is an array of segment arrays: [{ t: text, k: kind }]
// kinds: cmd, target, placeholder, plain, muted, setting, value, link
export function buildPrompt(meta, values, { client = 'claude', target = '', url = '', link = true } = {}) {
  const p = meta.prompt || {};
  const skill = p.skill || 'component';
  const command = (CLIENTS[client] || CLIENTS.claude).command(skill);
  const named = String(target || '').trim();
  const recipes = [].concat(meta.recipe || [], meta.recipes || []).filter((v, i, a) => a.indexOf(v) === i);
  const lines = [];

  // 1. The command and the ask, with the target slot.
  const ask = p.ask || `Add ${meta.title.toLowerCase()} to {target}.`;
  const [before, after = ''] = ask.split('{target}');
  const first = [{ t: `${command} `, k: 'cmd' }, { t: before, k: 'plain' }];
  if (ask.includes('{target}')) {
    first.push(named ? { t: named, k: 'target' } : { t: `[${p.target || 'where it goes in your site'}]`, k: 'placeholder' });
  }
  first.push({ t: after, k: 'plain' });
  lines.push(first, []);

  // 2. What to rebuild.
  if (p.brief) lines.push([{ t: p.brief, k: 'plain' }], []);

  // 3. Where to start.
  if (recipes.length) {
    const ids = recipes.map((r) => `\`${r}\``);
    const list = ids.length === 1 ? ids[0] : `${ids.slice(0, -1).join(', ')} and ${ids.at(-1)}`;
    lines.push([{ t: `Start from the awards recipe${ids.length > 1 ? 's' : ''} ${list} and adapt it to this project's tokens, type and motion library rather than pasting it.`, k: 'plain' }], []);
  }

  // 4. Only the settings the visitor changed.
  const changed = changedControls(meta, values).filter((c) => c.prompt !== false);
  if (changed.length) {
    lines.push([{ t: 'Match these settings (tuned on AwardComponents):', k: 'plain' }]);
    for (const c of changed) lines.push([{ t: '- ', k: 'muted' }, { t: promptLine(c, values[c.id]), k: 'setting' }]);
    lines.push([]);
  }

  // 5. What must survive.
  const keep = [].concat(p.keep || []);
  if (keep.length) {
    for (const k of keep) lines.push([{ t: 'Keep: ', k: 'muted' }, { t: k, k: 'plain' }]);
  }

  // 6. A link back to the exact demo state.
  if (link && url) {
    if (keep.length) lines.push([]);
    lines.push([{ t: 'Reference: ', k: 'muted' }, { t: url, k: 'link' }]);
  }

  while (lines.length && lines.at(-1).length === 0) lines.pop();
  const text = lines.map((segs) => segs.map((s) => s.t).join('')).join('\n');
  return { text, lines, changed: changed.map((c) => c.id), skill, command };
}
