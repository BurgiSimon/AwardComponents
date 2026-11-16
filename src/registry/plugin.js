// The awards plugin as the site prints it: plugin.json (core facts: install, skills, jury, phases, the showcase
// record) and plugin-ref.json (the long tables: rules, corpus, patterns, recipe details, release notes), both written
// by scripts/sync-plugin.mjs. Each loads as its own chunk the first time a page asks, then stays cached.
let core = null;
let ref = null;

export const loadPlugin = () => (core ??= import('./plugin.json').then((m) => m.default));
export const loadRef = () => (ref ??= import('./plugin-ref.json').then((m) => m.default));

// The jury's four words, in the order the juror tests them, with the tone each takes on the page.
export const VERDICTS = {
  ship: { tone: 'ship', label: 'ship' },
  fix: { tone: 'fix', label: 'fix' },
  rebuild: { tone: 'rebuild', label: 'rebuild' },
  recapture: { tone: 'recapture', label: 'recapture' },
};

export const AXES = [
  { key: 'd', name: 'Design', weight: 0.4 },
  { key: 'u', name: 'Usability', weight: 0.3 },
  { key: 'c', name: 'Creativity', weight: 0.2 },
  { key: 'co', name: 'Content', weight: 0.1 },
];

export const ROUND_KINDS = {
  component: 'Component pass',
  page: 'Page round',
  verdict: 'Verdict pass',
  baseline: 'Re-judged',
};

// Score formatting: two places when the log has them, one otherwise (7.2, 7.26).
export const score = (n) => (n == null ? '—' : Number.isInteger(n * 10) ? n.toFixed(1) : n.toFixed(2));

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const longDate = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
export const shortDate = (iso) => { if (!iso) return ''; const [, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1].slice(0, 3)}`; };

// Inline Markdown from the plugin's own files (code, bold, italics, links) → escaped HTML. Links to repository files
// resolve against the plugin on GitHub; external links open in a new tab.
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export function md(text, { base = 'https://github.com/BurgiSimon/awards/blob/main/plugins/awards/' } = {}) {
  const codes = [];
  let s = String(text ?? '').replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = esc(s)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
      const abs = /^https?:/.test(url) ? url : new URL(url.replace(/^(\.\.\/)+/, ''), base).href;
      return `<a href="${abs}" target="_blank" rel="noopener" data-external>${label}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s.,;:)]|$)/g, '$1<em>$2</em>')
    .replace(/(^|[\s(])_([^_\s][^_]*?)_(?=[\s.,;:)]|$)/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[+i])}</code>`);
}

// Plain text of the same (for titles, search and aria labels).
export const plain = (text) => String(text ?? '').replace(/`([^`]+)`/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

// A file in the plugin (`skills/craft/SKILL.md`), or in the repository when it starts with a slash (`/README.md`).
export const pluginFile = (core, file) => `${core.plugin.repository}/blob/main/${file.startsWith('/') ? file.slice(1) : `plugins/awards/${file}`}`;
