export default {
  id: 'image-trail',
  title: 'Image trail',
  category: 'cursors-buttons',
  summary: 'A photographer’s hero where a moving mouse lays her pictures along its path, one every 80 px of travel; they grow in, hold, fade in order and never land on her name.',
  recipe: 'image-trail-cursor',
  deps: [],
  tags: ['cursor', 'pointer', 'trail', 'images', 'hero', 'velocity', 'portfolio'],
  added: '2026-10-28',
  order: 30,
  preview: { height: 540, hint: 'Move the mouse across the open ground', capture: { wait: 600 } },
  useCases: [
    'The first screen of a photographer’s or an illustrator’s portfolio',
    'A studio or agency hero that wants the work to show before the first scroll',
    'A campaign landing page with a dozen product shots and one short headline',
  ],
  notes: [
    'The trail layer is aria-hidden, inert and never under the pointer; it holds no text or focusable element, so links and focus are untouched.',
    'The native cursor stays. The trail is armed only for a fine pointer with hover, in the full motion tier, while the hero is on screen.',
    'Touch screens and reduced motion get the rest frame: three pictures placed by the design, which on a phone sit above the name so they never cover it.',
  ],
  controls: [
    { id: 'spacing', label: 'Spacing', type: 'range', min: 40, max: 200, step: 10, default: 80, unit: 'px', group: 'Trail', help: 'Travel along the pointer’s path between two pictures.', prompt: 'Spacing: one picture every {value} of pointer travel, placed along the path (default {default})' },
    { id: 'pool', label: 'Pool size', type: 'range', min: 6, max: 20, step: 1, default: 12, group: 'Trail', help: 'How many picture elements exist; the next one reuses the oldest.', prompt: 'Pool: {value} picture elements, recycled oldest first (default {default})' },
    { id: 'hold', label: 'Hold', type: 'range', min: 0.2, max: 1.6, step: 0.1, default: 0.5, unit: 's', group: 'Trail', help: 'Time from a picture’s birth until it starts to fade; fades stay at least 60 ms apart, in arrival order.', prompt: 'Hold: {value} from birth before a picture fades, at least 60 ms after the one before it (default {default})' },
    { id: 'size', label: 'Picture width', type: 'range', min: 80, max: 220, step: 10, default: 120, unit: 'px', group: 'Look', help: 'The base width: a slow hand lays pictures at 0.8× of it, a fast one at up to 1.25×.', prompt: 'Picture width: {value} (4:5), laid from 0.8× for a slow hand to 1.25× at 2 px/ms and faster (default {default})' },
    { id: 'tilt', label: 'Tilt', type: 'range', min: 0, max: 16, step: 1, default: 8, unit: '°', group: 'Look', help: 'Largest tilt from horizontal speed, before a small sway.', prompt: 'Tilt: 6° per px/ms of horizontal speed, clamped to ±{value} (default {default})' },
  ],
  prompt: {
    skill: 'component',
    ask: 'Add an image trail to {target}.',
    target: 'the portfolio hero',
    brief: 'As a mouse crosses the hero, pictures land along its path: one every 80 px of travel, placed on the segment between pointer events so fast and slow hands leave the same density. Each grows in, holds for half a second and fades in arrival order, from a fixed pool of twelve recycled oldest first. A faster hand leaves larger, more tilted pictures inside a clamp, and a picture that would touch the heading or the copy is skipped.',
    keep: [
      'the native cursor; armed only for a fine pointer with hover, only while the hero is on screen, and the ticker runs only while a picture is alive.',
      'the layer is aria-hidden, inert and pointer-events: none; touch and reduced motion get three still pictures placed by the design.',
    ],
  },
};
