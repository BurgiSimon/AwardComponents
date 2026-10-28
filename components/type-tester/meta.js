export default {
  id: 'type-tester',
  title: 'Type tester',
  category: 'text',
  summary: 'A brand book’s typography page: type your own line, drag weight, width and size, then read the same words set as poster, editorial and technical.',
  recipe: 'typography-specimen',
  deps: [],
  tags: ['typography', 'specimen', 'variable-font', 'tester', 'hierarchy', 'css'],
  added: '2026-10-28',
  order: 30,
  preview: { height: 720, scroll: true, hint: 'Type in the sample, drag the axes' },
  useCases: [
    'The typography page of a brand book or design system',
    'A foundry’s tester for a variable family',
    'A style guide showing editors how one sentence reads in each layout the site uses',
  ],
  notes: [
    'The sample is a real labelled textarea and each axis a native range input with a visible value, so the tester works by keyboard and screen reader.',
    'The three registers share identical words: they change hierarchy (size, weight, width, measure, space), never the argument. Nothing in them is masked, clipped or revealed by script.',
    'Nothing moves, so reduced motion changes nothing; the registers are tabs with arrow-key navigation, and every panel is in the page without script.',
  ],
  controls: [
    { id: 'sample', label: 'Sample text', type: 'text', default: 'Sound you can stop noticing.', maxLength: 80, group: 'Tester', prompt: 'Sample text: “{value}”' },
    { id: 'weight', label: 'Weight', type: 'range', min: 200, max: 900, step: 10, default: 760, group: 'Tester', prompt: 'Tester weight: {value} (default {default})' },
    { id: 'width', label: 'Width', type: 'range', min: 75, max: 125, step: 1, default: 118, unit: '%', group: 'Tester', prompt: 'Tester width: {value} (default {default})' },
    { id: 'size', label: 'Size', type: 'range', min: 16, max: 160, step: 2, default: 96, unit: 'px', group: 'Tester', help: 'Capped by the viewport on narrow screens; the readout shows the size actually set.', prompt: 'Tester size: {value}, capped by the viewport width (default {default})' },
    { id: 'register', label: 'Register', type: 'select', options: [{ value: 'poster', label: 'Poster' }, { value: 'editorial', label: 'Editorial' }, { value: 'technical', label: 'Technical' }], default: 'poster', group: 'Specimen', prompt: 'Open the specimen on the {value} register (default {default})' },
  ],
  prompt: {
    skill: 'component',
    ask: 'Build a type tester and specimen for {target}.',
    target: 'the brand typeface on our typography page',
    brief: 'An editable sample line set live from three native range inputs (weight, width, size) with readouts, tracking and leading derived from the size (tighter and closer as it grows). Below it the same words, lead, heading, paragraph, list and dimensions set in three registers: poster (wide, heavy, about 9× body size, offset lead), editorial (light, two columns, 1.7 leading) and technical (narrow, ruled, tabular mono figures).',
    keep: [
      'identical copy in every register; only hierarchy changes. A diagnostic line (gypqj ÅÉ) in each to check descenders and accents.',
      'a labelled textarea and native ranges with visible values; registers as ARIA tabs; nothing masked or script-revealed.',
    ],
  },
};
