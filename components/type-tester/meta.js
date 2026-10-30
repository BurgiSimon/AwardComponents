export default {
  id: 'type-tester',
  title: 'Type tester',
  category: 'text',
  summary: 'A brand book’s type tester: type your own line, drag weight, width and size, or set it in one of the family’s three registers: poster, editorial and technical.',
  recipe: 'typography-specimen',
  deps: [],
  tags: ['typography', 'specimen', 'variable-font', 'tester', 'hierarchy', 'css'],
  added: '2026-10-28',
  order: 30,
  preview: { height: 520, hint: 'Type in the sample, drag the axes' },
  useCases: [
    'The typography page of a brand book or design system',
    'A foundry’s tester for a variable family',
    'A style guide showing editors how one sentence reads in each layout the site uses',
  ],
  notes: [
    'The sample is a real labelled textarea and each axis a native range input with a visible value, so the tester works by keyboard and screen reader.',
    'The three register buttons load a setting into the same line and mark the one that is set with aria-pressed: the voice changes, never the words. Nothing is masked, clipped or revealed by script.',
    'Nothing moves, so reduced motion changes nothing; the size is capped by the width of the card, so the line never overflows on a phone and the readout shows the size actually set.',
  ],
  controls: [
    { id: 'sample', label: 'Sample text', type: 'text', default: 'Sound you can stop noticing.', maxLength: 80, group: 'Tester', prompt: false },
    { id: 'weight', label: 'Weight', type: 'range', min: 200, max: 900, step: 10, default: 760, group: 'Tester', prompt: 'Tester weight: {value} (default {default})' },
    { id: 'width', label: 'Width', type: 'range', min: 75, max: 125, step: 1, default: 118, unit: '%', group: 'Tester', prompt: 'Tester width: {value} (default {default})' },
    { id: 'size', label: 'Size', type: 'range', min: 16, max: 160, step: 2, default: 96, unit: 'px', group: 'Tester', help: 'Capped by the viewport on narrow screens; the readout shows the size actually set.', prompt: 'Tester size: {value}, capped at 10 % of the box width + 12 px (default {default})' },
  ],
  prompt: {
    skill: 'component',
    ask: 'Build a type tester for {target}.',
    target: 'the brand typeface on our typography page',
    brief: 'An editable sample line set live from three native range inputs with visible readouts: the face’s weight and width axes (here 200–900 and 75–125 %, starting at 760 and 118 %) and the size (96 px, capped at 10 % of the box width + 12 px so the line never overflows). Tracking and leading follow the size, from −0.005 em / 1.3 at 16 px to −0.045 em / 0.94 at 128 px and up. A button per register loads its setting into the tester: poster (weight 840, 125 % wide, 128 px), editorial (weight 380, 100 %, 64 px) and technical (weight 600, 82 % wide, 40 px).',
    keep: [
      'the same words in every register; only weight, width, size, tracking and leading change.',
      'a labelled textarea and native ranges with visible values; register buttons with aria-pressed; nothing masked or script-revealed.',
    ],
  },
};
