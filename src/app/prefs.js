// Visitor preferences in localStorage. Every read and write is guarded: private windows and blocked storage
// fall back to defaults, and nothing in the library depends on a stored value to work.
const PREFIX = 'ac:';

export const prefs = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(PREFIX + key);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  },
};

// The theme is stored as a bare string so the play frame's head script can read it without JSON.
export const themePref = {
  get() {
    try { const v = localStorage.getItem('ac:theme'); return v === 'dark' || v === 'light' ? v : null; } catch { return null; }
  },
  set(v) {
    try { if (v) localStorage.setItem('ac:theme', v); else localStorage.removeItem('ac:theme'); } catch { /* storage unavailable */ }
  },
};
