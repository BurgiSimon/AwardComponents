// Labels shown on cards, in the sidebar and on component pages. One table, so a new kind of label is one entry.
// A label is computed from meta (dates, flags, deps) at runtime, so "New" expires without a rebuild.
import { site } from './site.js';

export const labelKinds = {
  new: { text: 'New', tone: 'accent', title: 'Added in the last weeks' },
  updated: { text: 'Updated', tone: 'info', title: 'Changed recently' },
  featured: { text: 'Featured', tone: 'neutral', title: 'Picked for the front page' },
  experimental: { text: 'Experimental', tone: 'warn', title: 'Works, but the API or the browser support may still move' },
  webgl: { text: 'WebGL', tone: 'neutral', title: 'Draws with WebGL and ships a no-GL fallback' },
  css: { text: 'CSS only', tone: 'neutral', title: 'No script library: CSS and a few lines of JavaScript' },
};

const DAY = 864e5;
const daysSince = (iso, now) => (now - Date.parse(`${iso}T00:00:00Z`)) / DAY;

// → array of label kinds for a normalised component, most important first.
export function labelsFor(c, now = Date.now()) {
  const out = [];
  const launched = Date.parse(`${site.launch}T00:00:00Z`);
  if (c.added && Date.parse(`${c.added}T00:00:00Z`) > launched && daysSince(c.added, now) <= site.newForDays) out.push('new');
  else if (c.updated && daysSince(c.updated, now) <= site.updatedForDays) out.push('updated');
  if (c.status === 'experimental') out.push('experimental');
  if (c.tech.includes('webgl')) out.push('webgl');
  else if (c.tech.length === 0 || (c.tech.length === 1 && c.tech[0] === 'css')) out.push('css');
  for (const extra of c.labels || []) if (labelKinds[extra] && !out.includes(extra)) out.push(extra);
  return out;
}
