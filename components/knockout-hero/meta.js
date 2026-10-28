export default {
  id: 'knockout-hero',
  title: 'Knockout wordmark',
  category: 'heroes',
  summary: 'A festival name cut out of the page as a window: the solid ground is one masked SVG rect, and soft stage-light colour drifts behind the letters on a fixed canvas.',
  recipe: 'knockout-wordmark-window',
  deps: [],
  tags: ['hero', 'svg', 'mask', 'wordmark', 'canvas', 'knockout', 'scroll'],
  added: '2026-10-28',
  order: 20,
  preview: { height: 640, scroll: true, hint: 'Scroll — the letters slide over a ground that stays put', capture: { wait: 1200 } },
  useCases: [
    'A festival, gallery or studio name as the whole first screen',
    'A campaign hero where the brand colour lives only inside the logotype',
    'A section seam or card gutter that opens onto the same moving ground',
  ],
  notes: [
    'The heading carries the name as visually hidden text; the SVG and the canvas are aria-hidden. Copy only ever sits on the solid paint, never on the moving ground.',
    'The ground draws only while the hero is on screen, from a backing store a sixth of the viewport; the browser’s upscale is the softness.',
    'Under reduced motion and in the static tier the ground is one composed still frame; the word stays a window.',
  ],
  controls: [
    { id: 'word', label: 'Word', type: 'text', default: 'Signal', maxLength: 14, group: 'Wordmark', help: 'Set in Mona Sans at full width and weight; the SVG box fits the word.', prompt: false },
    { id: 'palette', label: 'Palette', type: 'select', options: [{ value: 'stage', label: 'Stage' }, { value: 'harbour', label: 'Harbour' }, { value: 'ember', label: 'Ember' }], default: 'stage', group: 'Ground', prompt: (v) => ({ stage: 'Ground: a near-black base (plum in dark mode) under vivid accent, plum, sky and sand light', harbour: 'Ground: a near-black base (moss in dark mode) under vivid sky, moss and sand light', ember: 'Ground: a plum base under vivid accent, clay and sand light' })[v] },
    { id: 'speed', label: 'Drift speed', type: 'range', min: 0, max: 2.5, step: 0.1, default: 1, unit: '×', group: 'Ground', help: '0 holds the composed still frame.', prompt: 'Ground drift at {value} the base speed (blobs at 0.30–0.66 rad/s; default {default})' },
    { id: 'folds', label: 'Light folds', type: 'toggle', default: true, group: 'Ground', prompt: { on: 'Three light and shade folds slide across the ground', off: 'No light folds on the ground' } },
  ],
  prompt: {
    skill: 'component',
    ask: 'Turn {target} into a knockout window onto a moving ground.',
    target: 'the wordmark in the hero',
    brief: 'The hero has no background: one SVG rect filled with the page colour and masked by the letters (white rect, black glyphs) paints it, overflowing the word’s box by thousands of units while the hero clips it. Behind the page a fixed canvas at a sixth of the viewport draws four soft radial blobs on Lissajous paths plus light folds, so the colour shows only through the letters and stays put while they scroll past.',
    keep: [
      'the name as visually hidden text in the h1; the SVG and canvas aria-hidden; copy only on the solid paint; a ground far enough from the page colour that the letters read at their edges.',
      'the loop runs only while the hero is visible; one still frame under reduced motion.',
    ],
  },
};
