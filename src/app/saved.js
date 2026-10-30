// The visitor's saved components: a short list kept in localStorage, so someone shortlisting moves for one project
// can come back to them. The component page toggles it; the browse page filters by it.
import { prefs } from './prefs.js';
import { byId } from '../registry/index.js';

const listeners = new Set();

export function savedIds() {
  return prefs.get('saved', []).filter((id) => byId.has(id));
}

export function isSaved(id) {
  return savedIds().includes(id);
}

export function toggleSaved(id) {
  const now = !isSaved(id);
  prefs.set('saved', now ? [id, ...savedIds()] : savedIds().filter((x) => x !== id));
  listeners.forEach((fn) => fn(id, now));
  return now;
}

export function onSavedChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
