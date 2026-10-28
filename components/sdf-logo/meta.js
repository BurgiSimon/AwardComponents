// Field reference: docs/authoring.md. Plain data, no imports.
export default {
  id: 'sdf-logo',
  title: 'Extruded logo',
  category: 'webgl',
  summary: 'TODO: one sentence, 30–190 characters, on what a visitor sees and does.',
  recipe: 'gl-sdf-extruded-symbol',
  deps: [], // libraries demo.js imports (check.mjs verifies); the recipe uses: none
  tags: ['webgl', 'shader', 'raymarch', 'sdf', 'procedural'],
  added: '2026-10-28',
  preview: { height: 600 },
  useCases: [
    'TODO: a real place this fits',
    'TODO: another',
  ],
  notes: [
    'TODO: keyboard and screen-reader path',
    'TODO: reduced-motion and touch path',
  ],
  controls: [
    // { id: 'speed', label: 'Speed', type: 'range', min: 0.2, max: 2, step: 0.1, default: 1, unit: '×', prompt: 'Speed: {value} (default {default})' },
  ],
  prompt: {
    skill: 'component',
    ask: 'Add extruded logo to {target}.',
    target: 'TODO: the element or section it belongs to',
    brief: 'TODO: the behaviour to rebuild, in plain words.',
    keep: [],
  },
};
