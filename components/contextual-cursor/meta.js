export default {
  id: 'contextual-cursor',
  title: 'Contextual cursor',
  category: 'cursors-buttons',
  summary: 'A dot and a lagging ring for a cursor over a project tile, a reel and a sideways strip; over each, the ring grows into a badge that names the gesture.',
  recipe: 'cursor-two-speed',
  deps: [],
  tags: ['cursor', 'pointer', 'hover', 'badge', 'damping', 'portfolio'],
  added: '2026-10-28',
  order: 20,
  preview: { height: 620, hint: 'Move the pointer over the work', capture: { pointer: [0.3, 0.36], wait: 1100 } },
  useCases: [
    'A portfolio grid where every tile opens a case study and one tile plays the reel',
    'A drag-to-scroll strip that needs to say “drag” before the visitor presses',
    'A gallery or a shop where links, media and sliders sit side by side and each needs its own affordance',
  ],
  notes: [
    'The cursor layer is aria-hidden and ignores the pointer; every tile underneath is a real link or button with its own focus ring.',
    'It is only created for a fine pointer with hover. Touch, pens without hover and keyboard users get the ordinary page; the reel keeps its visible play button and the strip scrolls natively.',
    'Under reduced motion the ring stops lagging and both parts sit on the pointer; the badge appears by fading, without growing.',
  ],
  controls: [
    { id: 'ringLerp', label: 'Ring follow', type: 'range', min: 0.06, max: 0.6, step: 0.02, default: 0.22, group: 'Motion', help: 'Share of the gap the ring closes each 60 fps frame. Lower trails further; the dot stays at 0.75.', prompt: 'Ring follow: lerp {value} per 60 fps frame, through framerate-independent damping; the dot stays at 0.75 (default {default})' },
    { id: 'ringSize', label: 'Ring size', type: 'range', min: 24, max: 72, step: 2, default: 40, unit: 'px', group: 'Look', prompt: 'Ring diameter: {value} at rest, 1.35× over links and buttons (default {default})' },
    { id: 'badge', label: 'Badge style', type: 'select', options: [{ value: 'disc', label: 'Disc' }, { value: 'tag', label: 'Tag' }], default: 'disc', group: 'Look', help: 'Disc: the ring grows into a labelled disc. Tag: a small label rides beside the dot.', prompt: (v) => (v === 'tag' ? 'Badge: a small pill label offset 14 px from the dot while the ring grows to 1.35× (default: the ring grows into a labelled disc)' : 'Badge: the ring grows into a labelled disc') },
    { id: 'blend', label: 'Blend', type: 'select', options: [{ value: 'normal', label: 'Normal' }, { value: 'difference', label: 'Difference' }], default: 'normal', group: 'Look', prompt: (v) => (v === 'difference' ? 'Draw the ring and the dot light with mix-blend-mode: difference, so they invert whatever they pass over; the badge keeps a normal fill so its label stays legible (default: ink, normal blending)' : 'Draw the cursor in ink with normal blending') },
    { id: 'badgeColour', label: 'Badge colour', type: 'color', default: 'accent', group: 'Look', prompt: 'Badge fill: {value}, its label in whichever of light or dark ink contrasts more (default {default})' },
  ],
  prompt: {
    skill: 'component',
    ask: 'Add a contextual cursor to {target}.',
    target: 'the work index',
    brief: 'A dot follows a fine pointer almost at once (lerp 0.75 per 60 fps frame) and a ring trails it (lerp 0.22), both through framerate-independent damping, so the gap between them reads as mass. Over links and buttons the ring grows to 1.35× and the dot shrinks to 0.7×; over elements tagged data-cursor="view|play|drag" the ring grows into a 92 px filled disc that names the gesture with a word and an icon. The loop sleeps once both parts have settled.',
    keep: [
      'never created for coarse pointers or without hover; cursor: none comes from a class, so the system cursor returns when the module is off or the pointer leaves the window.',
      'an aria-hidden layer with pointer-events: none over real links and buttons; under reduced motion both parts snap to the pointer.',
    ],
  },
};
