export default {
  id: 'settle-snap',
  title: 'Idle settle snap',
  category: 'scroll',
  summary: 'A full-height project cover that, when a wheel scroll stops partway through it, waits a beat and eases to the nearer end: back to the cover or on to the story. It never locks.',
  recipe: 'idle-settle-snap',
  deps: ['lenis', 'gsap'],
  tags: ['scroll', 'snap', 'wheel', 'hero', 'lenis', 'case-study'],
  added: '2026-10-28',
  order: 30,
  preview: { height: 640, scroll: true, hint: 'Scroll a little with the wheel, then stop' },
  useCases: [
    'A full-bleed case-study cover that should never be left half gone',
    'A landing page whose first viewport is a picture and whose story starts under it',
    'Any transitional band (a cover, an intro card) where resting halfway reads as a mistake',
  ],
  notes: [
    'Only a wheel arms it. Keyboard, find-in-page, focus and scrollbar scrolls are left exactly where they land, so assistive technology keeps the chosen position.',
    'A pressed pointer holds it and stops a settle in place; a wheel during a settle takes over at once. Nothing is ever locked.',
    'Off for coarse pointers and under reduced motion, where the wheel is native and instant.',
  ],
  controls: [
    { id: 'quiet', label: 'Quiet window', type: 'range', min: 60, max: 600, step: 20, default: 160, unit: 'ms', group: 'Settle', help: 'How long the scroll must be still before the resting position is judged.', prompt: 'Judge the resting position after {value} without movement, counted in ticker time (default {default})' },
    { id: 'dead', label: 'Dead zone', type: 'range', min: 0, max: 20, step: 1, default: 6, unit: '%', group: 'Settle', help: 'Within this share of either end, a resting position is left alone.', prompt: 'Dead zone: leave a rest within {value} of either end alone (default {default})' },
    { id: 'duration', label: 'Settle duration', type: 'range', min: 0.3, max: 1.6, step: 0.05, default: 0.7, unit: 's', group: 'Settle', help: 'The ease to the nearer end (ease-out cubic). The guard before it can arm again is this plus 0.2 s.', prompt: 'Settle: ease to the nearer end over {value}, ease-out cubic, with a guard of the duration plus 0.2 s before it can arm again (default {default})' },
    { id: 'gauge', label: 'Show the gauge', type: 'toggle', default: true, group: 'Demo', help: 'A readout of where the rest sits in the cover and what the settle is doing.', prompt: false },
  ],
  prompt: {
    skill: 'component',
    ask: 'Add an idle settle to {target}.',
    target: 'the full-height cover',
    brief: 'When a wheel scroll comes to rest partway through the first viewport, wait for 160 ms of quiet and ease (0.7 s, ease-out cubic, through lenis.scrollTo without lock) to the nearer end: back to the cover or on to the first chapter. A 6 % dead zone at each end is left alone, and a 900 ms guard stops it re-arming on its own motion.',
    keep: [
      'only a wheel arms it (Lenis virtual-scroll); native scrolls (keys, find-in-page, focus, scrollbar) disarm it; a pressed pointer holds it and stops a settle in place.',
      'off for coarse pointers and under reduced motion.',
    ],
  },
};
