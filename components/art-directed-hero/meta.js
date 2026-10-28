export default {
  id: 'art-directed-hero',
  title: 'Art-directed hero',
  category: 'heroes',
  summary: 'A studio hero that swaps a wide and a portrait composition with picture and source, keeps the subject on its focal point and sets the headline where the picture is quiet.',
  recipe: 'responsive-art-directed-hero',
  deps: [],
  tags: ['hero', 'picture', 'art-direction', 'responsive', 'image', 'object-position', 'css'],
  added: '2026-10-28',
  order: 10,
  preview: { height: 640, hint: 'Resize the preview to switch compositions' },
  useCases: [
    'The first screen of a portfolio, a hotel or a product with one strong photograph',
    'A campaign page that needs a different crop on phones without a second template',
    'Any hero where the headline must never land on the subject’s face',
  ],
  notes: [
    'Copy and actions come before the picture in the DOM and in the visual order at every size; no CSS order reversal gives keyboard users a different sequence.',
    'The browser picks the composition from the picture’s sources, so the switch needs no script, and the frame’s ratio is reserved before the file decodes.',
    'Text over a photograph always sits on a scrim from the quiet side; nothing moves, so reduced motion changes nothing.',
  ],
  controls: [
    { id: 'layout', label: 'Layout', type: 'select', options: [{ value: 'overlay', label: 'Overlay' }, { value: 'split', label: 'Split' }, { value: 'stacked', label: 'Stacked' }], default: 'overlay', group: 'Composition', help: 'Each layout chooses the composition its frame needs: wide for overlay and stacked, portrait for split and every phone.', prompt: 'Layout: {value} (default {default})' },
    { id: 'focusX', label: 'Focal point across', type: 'range', min: 0, max: 100, step: 1, default: 64, unit: '%', group: 'Composition', help: 'Where the subject sits in the picture. In the overlay the copy moves to the quiet side.', prompt: 'Subject’s focal point at {value} across (object-position; default {default})' },
    { id: 'focusY', label: 'Focal point down', type: 'range', min: 0, max: 100, step: 1, default: 45, unit: '%', group: 'Composition', prompt: 'Subject’s focal point at {value} down (default {default})' },
    { id: 'scrim', label: 'Scrim strength', type: 'range', min: 0, max: 90, step: 5, default: 60, unit: '%', group: 'Look', when: { layout: 'overlay' }, help: 'Peak opacity of the gradient behind the copy.', prompt: 'A scrim from the copy’s side, peaking at {value} (default {default})' },
    { id: 'marks', label: 'Show the focal point', type: 'toggle', default: false, group: 'Look', help: 'A tuning aid: object-position maps the picture’s x %/y % onto the frame’s x %/y %.', prompt: false },
  ],
  prompt: {
    skill: 'component',
    ask: 'Art-direct {target} with separate wide and portrait compositions.',
    target: 'the homepage hero',
    brief: 'A picture element with a portrait source below 48rem and a wide image above it (two compositions of the subject, not one file at two sizes), the frame ratio reserved before decode (8:5 wide, 4:5 portrait) and object-fit cover with an object-position set to the subject’s focal point. Over a full-bleed picture the headline and actions sit on the quiet side behind a gradient scrim; beside it they share a two-column split.',
    keep: [
      'copy and the action first in the DOM and on screen at every size; no CSS reordering.',
      'width, height and fetchpriority high on the hero image, never lazy; text over the photograph always on a scrim.',
    ],
  },
};
