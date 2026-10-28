// Browser features a component may need (meta.requires). Each has a test the shell runs on the visitor's browser
// and a note shown as a label when the test fails. Add a feature here before naming it in a meta.js.
export const features = {
  webgl: {
    label: 'WebGL',
    note: 'Needs WebGL. Without it the demo shows its fallback.',
    test: () => {
      try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
    },
  },
  webgl2: {
    label: 'WebGL 2',
    note: 'Needs WebGL 2. Without it the demo shows its fallback.',
    test: () => {
      try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
    },
  },
  'view-transitions': {
    label: 'View Transitions',
    note: 'Uses the View Transitions API; other browsers change pages without the morph.',
    test: () => typeof document.startViewTransition === 'function',
  },
  'scroll-timeline': {
    label: 'Scroll-driven CSS',
    note: 'Uses CSS scroll-driven animations; other browsers get the script fallback.',
    test: () => CSS.supports('animation-timeline: view()'),
  },
  'offscreen-canvas': {
    label: 'OffscreenCanvas',
    note: 'Draws in a Worker through OffscreenCanvas; other browsers draw on the main thread.',
    test: () => typeof HTMLCanvasElement !== 'undefined' && 'transferControlToOffscreen' in HTMLCanvasElement.prototype,
  },
  'web-audio': {
    label: 'Web Audio',
    note: 'Plays synthesised sound through the Web Audio API, only after a press.',
    test: () => typeof (window.AudioContext || window.webkitAudioContext) === 'function',
  },
  webcodecs: {
    label: 'WebCodecs',
    note: 'Decodes video frames with WebCodecs; other browsers draw the same frames from stills.',
    test: () => typeof window.VideoDecoder === 'function' && typeof window.EncodedVideoChunk === 'function',
  },
  'field-sizing': {
    label: 'field-sizing',
    note: 'Blanks grow with their text through field-sizing: content; elsewhere they keep a fixed width.',
    test: () => CSS.supports('field-sizing: content'),
  },
};

export function unsupported(requires = []) {
  return requires.filter((key) => features[key] && !safe(features[key].test));
}

function safe(fn) {
  try { return fn(); } catch { return false; }
}
