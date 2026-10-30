export default {
  id: 'clip-door',
  title: 'Clip-path door',
  category: 'scroll',
  summary: 'A project page you walk into: a hole in the page grows with the scroll from a small framed picture to the full-bleed building while its name parts to the edges.',
  recipe: 'clip-path-scrub-door',
  deps: ['gsap', 'lenis'],
  tags: ['scroll', 'clip-path', 'mask', 'scrub', 'sticky', 'scrolltrigger', 'gsap', 'lenis', 'reveal'],
  added: '2026-10-28',
  order: 30,
  preview: { height: 640, scroll: true, hint: 'Scroll to open the door', capture: { scroll: 0.18, wait: 1200 } },
  useCases: [
    'The way into a case study from a portfolio index',
    'A chapter break in a long product story: the next scene opens through a frame',
  ],
  notes: [
    'The veil and its two words are decoration (aria-hidden, no pointer events); the project heading underneath is ordinary HTML, always in the accessibility tree.',
    'The door is a sticky stage inside a 200 svh section, so nothing is pinned and the scrollbar stays honest.',
    'Under reduced motion there is no clip anywhere: the door stands open and the section is one screen tall.',
  ],
  controls: [
    { id: 'hole', label: 'Start hole', type: 'range', min: 10, max: 50, step: 2, default: 20, unit: '%', group: 'Door', help: 'The hole’s width at the top of the section, as a share of the stage (its height is 1.2× that share).', prompt: 'Hole at progress 0: {value} of the stage width and 1.2× that share of its height, centred (default {default})' },
    { id: 'radius', label: 'Corner radius', type: 'range', min: 0, max: 48, step: 2, default: 14, unit: 'px', group: 'Door', help: 'Rounds the hole with a path() subpath; it eases to square as the hole reaches the edges.', prompt: 'Round the hole’s corners to {value} with a path(evenodd, …) subpath, easing to square at full bleed (default {default})' },
    { id: 'labels', label: 'Door words', type: 'text', default: 'Tern Library', maxLength: 28, group: 'Door', help: 'Split in two: the first half parts left, the rest right (up and down on a phone).', prompt: false },
    { id: 'scrub', label: 'Scrub catch-up', type: 'range', min: 0, max: 1.5, step: 0.1, default: 0, unit: 's', group: 'Scroll', help: '0 is scrub: true — Lenis already smooths the scroll. Higher values trail behind.', prompt: (v) => (v > 0 ? `Scrub with ${v} s of catch-up (scrub: ${v}) instead of the default scrub: true, where Lenis does the smoothing` : 'scrub: true: Lenis does the smoothing') },
  ],
  prompt: {
    skill: 'component',
    ask: 'Open {target} through a scroll-scrubbed clip-path door.',
    target: 'the first screen of a case-study page',
    brief: 'A 200 svh section with a 100 svh sticky stage: the content underneath is covered by a veil in the page’s ground, cut by one path(evenodd, …) clip-path (the frame, then a hole whose 14 px corners ease to square as it opens). A plain { p } proxy is scrubbed linearly from top top to bottom bottom and onUpdate writes the path: the hole grows from 20 % × 24 % of the stage, centred, to the full frame, while two words on the veil part ±50 vw (±50 svh, up and down, on a portrait stage).',
    keep: ['the veil is aria-hidden with no pointer events; the real heading lives underneath; under reduced motion no clip at all, the door open and the section one screen tall.'],
  },
};
