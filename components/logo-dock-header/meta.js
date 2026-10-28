export default {
  id: 'logo-dock-header',
  title: 'Wordmark to header',
  category: 'navigation',
  summary: 'A shop’s giant name across the hero is the header logo: as the hero scrolls away it shrinks and travels into its slot, and the nav underline eases to the chapter in view.',
  recipe: 'wordmark-header-handoff',
  deps: ['lenis', 'gsap'],
  tags: ['header', 'logo', 'wordmark', 'scroll', 'navigation', 'underline', 'lenis'],
  added: '2026-10-28',
  order: 20,
  preview: { height: 640, scroll: true, hint: 'Scroll the page', capture: { wait: 900 } },
  useCases: [
    'A brand or shop home page that opens on its own name and keeps it as the logo',
    'A portfolio whose header logo should feel like the hero, not a second copy of it',
    'A one-page site whose header underline tracks the chapter being read',
  ],
  notes: [
    'The giant name and the header logo are one link with one accessible name and one focus ring; the hero’s heading is a separate sentence.',
    'Only a 2D transform moves the logo, on a painted (not composited) element, so the word is drawn sharp at every size it passes through.',
    'Under reduced motion the logo sits in the header from the start, a decorative copy fills the hero and fades out when the hero is half gone, and the underline jumps instead of easing.',
  ],
  controls: [
    { id: 'dock', label: 'Dock distance', type: 'range', min: 30, max: 100, step: 5, default: 60, unit: '%', group: 'Hand-off', help: 'Share of the hero’s height scrolled before the name reaches the header.', prompt: 'The name docks once {value} of the hero has scrolled, cubic in-out (default {default})' },
    { id: 'stiffness', label: 'Underline stiffness', type: 'range', min: 4, max: 24, step: 1, default: 10, unit: '/s', group: 'Underline', help: 'Both edges close 1 − e^(−k·dt) of the gap each frame.', prompt: 'Underline: both edges ease toward the active link at 1 − e^(−{value}·dt) and snap the last 0.05 px (default 10 /s)' },
    { id: 'word', label: 'Wordmark', type: 'text', default: 'Ostra', maxLength: 14, group: 'Look', prompt: false },
    { id: 'face', label: 'Wordmark face', type: 'select', options: [{ value: 'wide', label: 'Wide sans' }, { value: 'serif', label: 'Serif italic' }], default: 'wide', group: 'Look', prompt: false },
  ],
  prompt: {
    skill: 'component',
    ask: 'Hand {target} off into the header logo as the page scrolls.',
    target: 'the hero wordmark',
    brief: 'The giant name in the hero and the small logo in the header are the same link: it is laid out in the header slot (position: fixed), and a 2D transform draws it over a reference box in the hero. Over the first 60 % of the hero the transform eases (cubic in-out) back to identity, so the name shrinks and travels into the bar. A nav underline eases both edges toward the link of the chapter in view.',
    keep: [
      'one link, one accessible name, one focus ring; no will-change on the logo, so it is repainted sharp rather than stretched from a small raster.',
      'under reduced motion the logo stays in the bar, an aria-hidden copy fills the hero and fades (opacity only), and the underline jumps.',
    ],
  },
};
