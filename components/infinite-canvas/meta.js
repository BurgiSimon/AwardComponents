export default {
  id: 'infinite-canvas',
  title: 'Infinite canvas',
  category: 'galleries',
  summary: 'A studio’s whole index on a plane you pull in any direction by drag, wheel, finger or keys; it coasts on release and wraps on both axes without a hole or a clone.',
  description: 'The 24 list items are the list and the pool at once: each sits at a modulo of its column and row pitch plus the offset, so a tile that leaves one side comes back on the other and nothing is created or destroyed. The pitch never drops below the stage divided by one less than the count, so one sheet always covers the stage plus a tile.\n\nEvery tile is a real link in reading order. When Tab or find-in-page reaches one off the stage, the browser scrolls a parked, hidden scroll container instead of the page; the script takes that scroll back and glides the plane by the same amount.',
  recipe: 'drag-pan-infinite-grid',
  deps: [],
  tags: ['drag', 'pan', 'inertia', 'wheel', 'grid', 'wrap', 'pointer', 'keyboard'],
  added: '2026-10-28',
  order: 40,
  preview: { height: 520, hint: 'Drag, flick or scroll the plane' },
  useCases: [
    'An architecture or design studio’s full archive as one field of work',
    'A shop’s whole collection as an explorable wall before the filtered grid',
    'An exhibition or festival archive where browsing matters more than order',
  ],
  notes: [
    'Every tile is a link in reading order; Tab glides an off-stage tile 32 px inside (and clear of the fade at the foot), the arrows step to the neighbour by exactly one pitch, Home and End centre the first and last project, and a skip link jumps past all 24.',
    'A press is a click until it travels 6 px; touch-action: none is set on the stage only. Until the stage sits wholly in the window a vertical wheel scrolls the page instead.',
    'Reduced motion keeps the drag and the wheel (direct manipulation) but never coasts, and keys land at once; static shows the same links as a plain grid.',
  ],
  controls: [
    { id: 'friction', label: 'Friction', type: 'range', min: 1.5, max: 12, step: 0.5, default: 4, unit: '/s', group: 'Motion', help: 'Decay of the coast: a flick travels its release speed divided by this.', prompt: 'Coast decay k: {value}, so a flick travels v0 / k px (default {default})' },
    { id: 'gap', label: 'Gap', type: 'range', min: 8, max: 72, step: 2, default: 28, unit: 'px', group: 'Layout', prompt: 'Gap between tiles: {value} (default {default})' },
    { id: 'stagger', label: 'Column stagger', type: 'range', min: 0, max: 0.5, step: 0.05, default: 0.5, group: 'Layout', help: 'Odd columns sit this share of a row lower.', prompt: 'Column stagger: odd columns {value} of a row lower (default {default})' },
    { id: 'size', label: 'Tile width', type: 'range', min: 140, max: 320, step: 10, default: 190, unit: 'px', group: 'Layout', prompt: 'Tile width: {value} (default {default})' },
  ],
  prompt: {
    skill: 'component',
    ask: 'Turn {target} into an infinite plane you can drag, flick and scroll.',
    target: 'the project index',
    brief: 'A fixed pool of link tiles on a 6 × 4 sheet, placed by transform at mod(c·pitch + x0 + offset + pitch, span) − pitch on each axis (odd columns half a row lower), so the plane wraps with no clones; the pitch is at least stage / (count − 1), so no hole opens. A drag is direct; the release velocity (last 100 ms, clamped to 4000 px/s) coasts by the exact integral of v·e^(−4t). The wheel pans both axes, eased at k = 16.',
    keep: [
      'every tile a real link in order, with a skip link past them; a parked overflow: hidden stage turns focus and find-in-page reveals into glides; arrows step one pitch; no coast under reduced motion, a plain grid when static.',
      'touch-action: none on the stage only, so a finger scrolls the page everywhere else; a vertical wheel scrolls the page until the stage sits wholly in the window.',
    ],
  },
};
