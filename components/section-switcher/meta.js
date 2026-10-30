export default {
  id: 'section-switcher',
  title: 'Section switcher',
  category: 'scroll',
  summary: 'A full-screen deck of projects, one picture and name per screen, where the page never scrolls: the wheel fills a ring that commits one step at a threshold; keys, swipes and buttons step too.',
  recipe: 'section-switcher-wheel-commit',
  deps: ['gsap'],
  tags: ['deck', 'wheel', 'observer', 'fullscreen', 'case-study', 'gsap', 'keyboard'],
  added: '2026-10-28',
  order: 40,
  preview: { height: 640, hint: 'Wheel, swipe or press the arrow keys' },
  useCases: [
    'A portfolio’s selected work, one project per screen',
    'A product tour or an annual-report summary of four to six chapters',
    'A launch page that tells its story in a fixed number of steps',
  ],
  notes: [
    'Every road reaches every panel: wheel, swipe, arrow and Page keys, Home and End, and Prev and Next. Each change is announced once in a polite live region.',
    'Only the active panel is reachable; the others are inert. Prev and Next use aria-disabled at the ends so a focused button keeps focus.',
    'Under reduced motion the wheel, keys and swipe still step, the panels swap in place and the ring jumps instead of easing.',
  ],
  controls: [
    { id: 'threshold', label: 'Commit threshold', type: 'range', min: 200, max: 1200, step: 50, default: 500, unit: 'px', group: 'Wheel', help: 'Summed wheel distance for one step. Stop short and the ring drains after a second.', prompt: 'Commit threshold: {value} of summed |deltaY| for one step, draining back after 1 s idle (default {default})' },
    { id: 'lock', label: 'Lock after commit', type: 'range', min: 300, max: 1600, step: 50, default: 900, unit: 'ms', group: 'Wheel', help: 'The wheel is swallowed for this long after a step, so trackpad inertia cannot spend two.', prompt: 'Lock the wheel for {value} after a commit (default {default})' },
    { id: 'ring', label: 'Show the ring', type: 'toggle', default: true, group: 'Look', prompt: { on: 'Show the commit ring filling with the summed wheel', off: 'No visible ring; the wheel still commits at the threshold' } },
    { id: 'transition', label: 'Transition', type: 'select', options: [{ value: 'slide', label: 'Slide' }, { value: 'fade', label: 'Fade' }], default: 'slide', group: 'Look', prompt: (v) => (v === 'fade' ? 'Transition: the incoming panel fades in over the outgoing one while its picture settles from 1.06×, copy rising after' : 'Transition: the incoming panel slides in (yPercent ±100 → 0, 0.9 s expo.inOut) while the outgoing one drifts 30 % the other way') },
  ],
  prompt: {
    skill: 'component',
    ask: 'Turn {target} into a full-screen section switcher.',
    target: 'the selected work',
    brief: 'A DOM deck where the document never scrolls. GSAP Observer sums wheel deltas into a visible ring that commits exactly one step at 500 px, then swallows the wheel for 900 ms; an idle second drains the ring, and reversing starts a fresh sum. Swipe (> 55 px on release), arrow and Page keys, Home and End and Prev and Next buttons step the same index, and the panel travels in over 0.9 s (expo.inOut) with its copy rising after.',
    keep: [
      'inactive panels inert; a polite live region announces each change once, not on load; aria-disabled at the ends; the ring is a progressbar with a value.',
      'under reduced motion every input still steps and panels swap in place; without script the panels are ordinary sections on a scrolling page.',
    ],
  },
};
