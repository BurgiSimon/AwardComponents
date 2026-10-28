// Light / dark for the shell and every open demo frame. No stored choice → follow the system, live.
import { themePref } from './prefs.js';

const mq = matchMedia('(prefers-color-scheme: dark)');
const listeners = new Set();

export const currentTheme = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

function apply(theme) {
  if (theme === currentTheme()) return;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0c0c0d' : '#f4f4f1');
  for (const fn of listeners) fn(theme);
}

export function initTheme() {
  apply(themePref.get() || (mq.matches ? 'dark' : 'light'));
  mq.addEventListener('change', () => { if (!themePref.get()) apply(mq.matches ? 'dark' : 'light'); });
  // Another tab changed it.
  window.addEventListener('storage', (e) => { if (e.key === 'ac:theme') apply(themePref.get() || (mq.matches ? 'dark' : 'light')); });
}

export function setTheme(theme) {
  // Choosing the system's own theme clears the stored choice, so the page keeps following the system.
  themePref.set(theme === (mq.matches ? 'dark' : 'light') ? null : theme);
  const swap = () => apply(theme);
  if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.classList.add('theme-swap');
    const vt = document.startViewTransition(swap);
    vt.ready.catch(() => {});
    vt.finished.catch(() => {}).finally(() => document.documentElement.classList.remove('theme-swap'));
  } else swap();
}

export const toggleTheme = () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark');

export function onThemeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
