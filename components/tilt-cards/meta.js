export default {
  id: 'tilt-cards',
  title: 'Tilt cards',
  category: 'galleries',
  summary: 'A banking app’s plans, each shown as its physical card: the face turns toward a mouse pointer, a shine follows the pointer and a shade gathers on the raised side.',
  recipe: 'pointer-tilt-shine',
  deps: ['gsap'],
  tags: ['tilt', 'pointer', 'hover', 'shine', 'cards', 'quickto', 'pricing'],
  added: '2026-10-28',
  order: 30,
  preview: { height: 640, hint: 'Move the mouse over a card', capture: { pointer: [0.46, 0.5], wait: 1100 } },
  useCases: [
    'A pricing section where each plan comes with a physical card',
    'Product, membership or ticket cards that should feel like objects',
    'A small grid of featured work where a hover deserves a little depth',
  ],
  notes: [
    'Each card is a real link with a text name; the link never moves (only the face inside it rotates), so its hit area and focus outline stay put.',
    'Only a mouse tilts the cards. Touch, pens and keyboard get the flat card with everything on it visible; focus shows a clear outline.',
    'Scrolling holds every card where it is until the page settles, so a card sliding under a still pointer does not twitch. Reduced motion: flat cards, no light layers.',
  ],
  controls: [
    { id: 'tilt', label: 'Max tilt', type: 'range', min: 2, max: 16, step: 1, default: 7, unit: '°', group: 'Tilt', help: 'Rotation on each axis at the card’s edge; the corner under the pointer sinks.', prompt: 'Max tilt: {value} on each axis at the edge, through one gsap.quickTo per property (0.6 s, power3.out) (default {default})' },
    { id: 'perspective', label: 'Perspective', type: 'range', min: 400, max: 1600, step: 50, default: 800, unit: 'px', group: 'Tilt', help: 'Set on the link; lower is more dramatic.', prompt: 'Perspective: {value} on the link (default {default})' },
    { id: 'shine', label: 'Shine strength', type: 'range', min: 0, max: 0.7, step: 0.02, default: 0.32, group: 'Light', help: 'Opacity of the light hot spot that follows the pointer (screen blend).', prompt: 'Shine: a screen-blended hot spot at {value} opacity under the pointer, the shade opposite at 0.6 × the tilt (default {default})' },
    { id: 'lift', label: 'Lift on hover', type: 'toggle', default: false, group: 'Tilt', prompt: { on: 'Lift the hovered card toward the viewer (translateZ 28 px) as it tilts', off: 'No lift; the face only rotates' } },
  ],
  prompt: {
    skill: 'component',
    ask: 'Make {target} tilt toward the pointer.',
    target: 'the plan cards',
    brief: 'Each card turns toward a mouse pointer: its offset from the centre, normalised to −1…1, maps to rotateY 7° × nx and rotateX −7° × ny, so the corner under the pointer sinks. A shine twice the face size follows the pointer by translate only and a shade gathers on the raised side, its opacity scaled by the tilt. The link carries the perspective and never transforms; only the face inside it rotates.',
    keep: [
      'mouse pointers only (pointerType, fine pointer with hover, full motion tier); quickTo tweens that write nothing until the first aim.',
      'scrolling locks every card until 140 ms of quiet; reduced motion and touch get flat cards without the light layers.',
    ],
  },
};
