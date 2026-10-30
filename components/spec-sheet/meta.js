export default {
  id: 'spec-sheet',
  title: 'Specification sheet',
  category: 'commerce',
  summary: 'A vase’s facts as a real description list beside a dimensioned drawing: switch the size or metric and imperial units and both update in place.',
  recipe: 'product-specification',
  deps: [],
  tags: ['product', 'specification', 'description-list', 'units', 'responsive', 'accessibility'],
  added: '2026-10-28',
  order: 10,
  preview: { height: 600, hint: 'Switch the size or the units' },
  useCases: [
    'The facts block of a ceramics, furniture or hardware product page',
    'A technical sheet where buyers in two markets read different units',
    'A furniture or lighting page where one size choice changes every measurement',
  ],
  notes: [
    'The facts are one <dl> of term and description pairs with the units as real text, so they read and copy as written.',
    'Size and units are native radio groups, so arrows, Space and screen readers work as they always do.',
    'Changed values rise into place; under reduced motion they only fade, and the drawing changes without moving.',
  ],
  controls: [
    { id: 'units', label: 'Units', type: 'select', options: [{ value: 'metric', label: 'Metric (cm, l, kg)' }, { value: 'imperial', label: 'Imperial (in, fl oz, lb)' }], default: 'metric', group: 'Content', prompt: (v) => (v === 'imperial' ? 'Open in imperial units (in, fl oz, lb), derived from the stored metric values; the switch stays on the page' : 'Open in metric units (cm, l, kg); the switch stays on the page') },
    { id: 'drawing', label: 'Dimension drawing', type: 'toggle', default: true, group: 'Content', prompt: { on: 'A dimensioned line drawing beside the facts that follows the size and the units', off: 'No dimension drawing; the list carries the measurements alone' } },
    { id: 'change', label: 'Value change', type: 'select', options: [{ value: 'rise', label: 'Rise' }, { value: 'fade', label: 'Fade' }, { value: 'none', label: 'Instant' }], default: 'rise', group: 'Motion', help: 'How a value that changed with the size or the units comes in.', prompt: (v) => ({ rise: 'Changed values rise 0.45 em into place over 420 ms, 30 ms apart; they only fade under reduced motion', fade: 'Changed values fade in over 280 ms, 30 ms apart, without rising', none: 'Changed values swap in place with no animation' })[v] },
  ],
  prompt: {
    skill: 'component',
    ask: 'Build the specification block of {target}.',
    target: 'the product page',
    brief: 'A ruled <dl> of term and description pairs with the units as real text, beside a dimensioned profile drawing of the product. A size choice and a metric/imperial switch (native radios) rewrite the values in place, each changed value rising 0.45 em into place over 420 ms, 30 ms apart, and the drawing, at one shared scale, follows both. One column on phones, drawing first.',
    keep: ['term/description pairs in reading order; native radios; values fade only under reduced motion.'],
  },
};
