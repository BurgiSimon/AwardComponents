// meta.js is plain data (no imports): the shell, the play runtime and the Node scripts all read it.
// Field reference: docs/authoring.md.
export default {
  id: 'magnetic-button',
  title: 'Magnetic button',
  category: 'cursors-buttons',
  summary: 'A call to action that leans toward a fine pointer inside a radius, its label leaning further than the body so it reads as an object with depth.',
  recipe: 'magnetic-button',
  deps: ['gsap'],
  tags: ['pointer', 'hover', 'button', 'quickto', 'gsap'],
  added: '2026-10-28',
  featured: true,
  order: 10,
  preview: { height: 500, hint: 'Move the pointer near a button', capture: { pointer: [0.56, 0.4], wait: 700 } },
  useCases: [
    'The one primary action in a hero or a contact section',
    'A round “Play reel” or “Start a project” disc in a studio portfolio',
    'Social and contact icons in a footer, where a little pull rewards a precise hover',
  ],
  notes: [
    'A real link or button; the pull is decoration on top and never moves its hit area out from under the pointer.',
    'Only fine pointers with hover get the pull. Touch, pens and reduced motion get an ordinary button.',
    'Focus shows the full hover state, so keyboard users see the same affordance.',
  ],
  controls: [
    { id: 'radius', label: 'Field radius', type: 'range', min: 1, max: 3, step: 0.1, default: 1.6, unit: '×', group: 'Pull', help: 'How far the pull reaches, as a multiple of the button’s diagonal.', prompt: 'Field radius: {value} the button’s diagonal (default {default})' },
    { id: 'pull', label: 'Strength', type: 'range', min: 0.1, max: 0.7, step: 0.05, default: 0.35, group: 'Pull', help: 'Share of the pointer’s offset the button follows at the centre.', prompt: 'Pull strength: the body follows {value} of the pointer’s offset (default {default})' },
    { id: 'label', label: 'Label parallax', type: 'range', min: 0, max: 1, step: 0.05, default: 0.45, group: 'Pull', prompt: 'Label parallax: the label shifts a further {value} × the body’s travel inside it (default {default})' },
    { id: 'duration', label: 'Settle time', type: 'range', min: 0.2, max: 1.4, step: 0.05, default: 0.6, unit: 's', group: 'Feel', prompt: 'Settle time: {value} with expo-out (default {default})' },
    { id: 'style', label: 'Primary style', type: 'select', options: [{ value: 'disc', label: 'Disc' }, { value: 'pill', label: 'Pill' }, { value: 'outline', label: 'Outline' }], default: 'disc', group: 'Look', prompt: (v) => `Primary button shape: ${{ disc: 'a filled disc about 15vw across (132–188 px)', pill: 'a filled pill 64 px tall with the label on one line', outline: 'an outlined disc that fills with its colour while the pointer is near or it has focus' }[v]} (default: a filled disc)` },
    { id: 'accent', label: 'Colour', type: 'color', default: 'accent', group: 'Look', prompt: 'Primary button colour: {value}, for its fill or outline (default {default})' },
    { id: 'field', label: 'Show the field', type: 'toggle', default: false, group: 'Look', help: 'Draws each button’s pull radius. A tuning aid, left out of the prompt.', prompt: false },
  ],
  prompt: {
    skill: 'component',
    ask: 'Make {target} magnetic.',
    target: 'the primary call to action',
    brief: 'Inside a field of 1.6 × its diagonal, the button follows 0.35 of a fine pointer’s offset from its centre, with a smoothstep falloff to zero at the edge, and its label shifts a further 0.45 × that travel inside it, so the face reads as standing in front of the body. One gsap.quickTo per axis (0.6 s, expo-out) is retargeted on every move; leaving the field eases it home on the same curve.',
    keep: ['the pull listeners attached only for a fine pointer with hover in the full motion tier, so touch screens and reduced motion get an ordinary button; a real link or button; focus shows the full hover state.'],
  },
};
