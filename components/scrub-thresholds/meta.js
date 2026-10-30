export default {
  id: 'scrub-thresholds',
  title: 'Scrub thresholds',
  category: 'scroll',
  summary: 'A lamp launch where the scroll scrubs the light from off to evening glow, while the copy is never scrubbed: whole lines play in at a threshold and leave faster at the next.',
  recipe: 'scrub-threshold-timelines',
  deps: ['gsap', 'lenis'],
  tags: ['scroll', 'scrub', 'timeline', 'threshold', 'copy', 'sticky', 'scrolltrigger', 'gsap', 'lenis', 'product'],
  added: '2026-10-28',
  order: 90,
  preview: { height: 620, scroll: true, hint: 'Scroll slowly, then fast: the words always arrive whole', capture: { scroll: 0.42, wait: 1600 } },
  useCases: [
    'A product launch scene where the picture follows the scroll and the claims must stay legible',
    'An explainer whose diagram scrubs while short captions appear at set beats',
    'Any scrubbed story that used to leave half-faded text wherever the visitor stopped',
  ],
  notes: [
    'The copy is real text in the DOM, readable without script; the lamp and its light are aria-hidden decoration.',
    'Each line is a paused timeline played or reversed once per crossing, so it always finishes on its own clock however fast the scroll moves.',
    'Under reduced motion the light still brightens with the scroll but nothing moves: the glow does not grow, the dial does not turn and the copy only fades. The static tier sets each line at its crossing.',
  ],
  controls: [
    { id: 'copyIn', label: 'Copy in at', type: 'range', min: 10, max: 50, step: 1, default: 30, unit: '%', group: 'Thresholds', prompt: 'The first lines play in at {value} of the scrub (default {default})' },
    { id: 'copyOut', label: 'Copy out at', type: 'range', min: 40, max: 75, step: 1, default: 60, unit: '%', group: 'Thresholds', prompt: 'The first lines reverse out at {value} of the scrub (default {default})' },
    { id: 'finalAt', label: 'Final line at', type: 'range', min: 65, max: 95, step: 1, default: 81, unit: '%', group: 'Thresholds', prompt: 'The final line plays in at {value} and stays to the end (default {default})' },
    { id: 'inSpeed', label: 'Play speed', type: 'range', min: 0.5, max: 3, step: 0.25, default: 1.5, unit: '×', group: 'Speeds', help: 'timeScale of the entrance: 0.7 s power3.out, 0.12 s stagger at 1×.', prompt: 'Entrance timeScale: {value}, the final line at 0.83 of it (default {default})' },
    { id: 'outSpeed', label: 'Reverse speed', type: 'range', min: 1, max: 6, step: 0.5, default: 3.5, unit: '×', group: 'Speeds', help: 'Leave faster than you arrive, so the outgoing line never holds up the picture.', prompt: 'Exit timeScale: {value}, faster than the entrance (default {default})' },
  ],
  prompt: {
    skill: 'component',
    ask: 'Play the copy in {target} at scroll thresholds instead of scrubbing it.',
    target: 'the scroll-driven product scene',
    brief: 'One linear timeline scrubs the picture across a 400 svh sticky stage (scrub: true). The copy is never scrubbed: each block is a paused timeline (autoAlpha 0 → 1, yPercent 60 → 0, 0.7 s power3.out, stagger 0.12) and the scrub’s onUpdate only checks which side of its window the progress is on. On a change of side it plays (timeScale 1.5; 1.25 for the final line) or reverses faster (timeScale 3.5): first lines in [0.3, 0.6), the final line from 0.81 to the end. Once played, a line runs on its own clock, so it always arrives whole however fast the visitor scrolls.',
    keep: [
      'one call per crossing, not per frame; on refresh snap each line with progress(0|1); reduced motion fades without the rise, static sets each line.',
      'the copy is real DOM text, readable without script; the scrubbed picture is aria-hidden decoration.',
    ],
  },
};
