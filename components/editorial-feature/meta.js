// Field reference: docs/authoring.md. Plain data, no imports.
export default {
  id: 'editorial-feature',
  title: 'Editorial feature',
  category: 'blocks',
  summary: 'A magazine long read set as a spread: a lead picture beside an asymmetric reading column, a pull quote hung into the margin and a small figure in the text.',
  description: 'The picture is the first evidence and the column explains it. The caption stays inside its figure, directly under the image; the column is held at a measure in characters, so the type sets the width and the picture takes the rest.\n\nThe pull quote floats out of the column with a negative margin as wide as itself, so it sits in the picture’s margin without the text wrapping round it. On a phone the spread becomes one column in document order, and the quote and the small figure come back into the text.',
  recipe: 'editorial-image-text',
  deps: [],
  tags: ['editorial', 'layout', 'image', 'typography', 'magazine', 'responsive', 'static', 'serif'],
  added: '2026-10-28',
  order: 20,
  preview: { height: 720, scroll: true, hint: 'Scroll to read' },
  useCases: [
    'A feature or long read on a magazine, journal or studio site',
    'A product story where one photograph carries the argument and the text explains it',
    'Any picture-led section that has to keep its order and captions on a phone',
  ],
  notes: [
    'Figure and caption come before the text in the markup, so a phone and a screen reader read the same order the layout shows.',
    'The pull quote repeats a line from the text as an aside, in a blockquote with its source; it never carries words found nowhere else.',
    'Nothing moves. Captions are real figcaptions attached to their pictures, and the next-article close is one link.',
  ],
  controls: [
    { id: 'side', label: 'Picture', type: 'select', options: [{ value: 'left', label: 'Left of the text' }, { value: 'right', label: 'Right of the text' }, { value: 'above', label: 'Across the top' }], default: 'left', group: 'Layout', prompt: (v) => ({ left: 'Lead picture on the left, the reading column on the right', right: 'Lead picture on the right, the reading column on the left', above: 'Lead picture across the top at 21:9; the title held in the left margin beside the text' })[v] },
    { id: 'measure', label: 'Column measure', type: 'range', min: 44, max: 72, step: 1, default: 58, unit: 'ch', group: 'Layout', help: 'The reading column’s width in characters; the picture takes the rest.', prompt: 'Reading measure: {value} (default {default})' },
    { id: 'quote', label: 'Pull quote', type: 'select', options: [{ value: 'hang', label: 'Hung in the margin' }, { value: 'inline', label: 'In the column' }], default: 'hang', group: 'Layout', prompt: (v) => (v === 'inline' ? 'Pull quote inside the column between two rules' : 'Pull quote hung out of the column into the picture’s margin') },
    { id: 'serif', label: 'Serif headings', type: 'toggle', default: true, group: 'Type', prompt: { on: 'Title, dek and pull quote in a high-contrast serif; the text in the grotesque', off: 'Title in the grotesque at an expanded width; the serif only for the dek and the quote' } },
    { id: 'dropCap', label: 'Drop cap', type: 'toggle', default: true, group: 'Type', prompt: { on: 'A three-line drop cap opens the text', off: 'No drop cap' } },
  ],
  prompt: {
    skill: 'component',
    ask: 'Lay out {target} as an editorial image-and-text spread.',
    target: 'the feature article',
    brief: 'A lead figure, caption attached directly under it, sits beside an asymmetric reading column with top edges aligned: the column is held at a measure of about 58ch and the picture takes the rest (roughly 1.2 to 1). The pull quote hangs out of the column into the picture’s margin through a float whose negative margin equals its width, and a smaller figure floats inside the text. Below 760 px everything stacks in document order.',
    keep: ['figure and figcaption before the text in the markup; phone order is reading order; the pull quote repeats a line from the text.'],
  },
};
