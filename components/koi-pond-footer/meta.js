// Field reference: docs/authoring.md. Plain data, no imports.
export default {
  id: 'koi-pond-footer',
  title: 'Koi pond footer',
  category: 'closers',
  summary: 'A studio footer with a small pond seen from above: three koi wander, come over to a slow pointer, scatter from a fast one and race for the pellet a click drops.',
  description: 'The close of an architecture studio’s site, with the studio’s pond in it. Three koi swim on one small canvas: each is a ten-point spine dragged behind its head, with a width profile, two pectoral fins, a forked tail and a swimming wave that grows toward the tail. They wander, step around each other and turn back for the middle of the pond before they reach a bank.\n\nA slow pointer draws them over and they loiter beside it; a fast one startles the koi near it for a moment. A click drops a pellet with three ripple rings, and each koi races for the pellet nearest to it. The Feed button does the same from the keyboard. Nothing in the footer depends on the pond: the statement, the links and the address are plain text around it.',
  recipe: 'living-scene-canvas2d',
  deps: [],
  tags: ['footer', 'canvas', 'pointer', 'toy', 'koi', 'steering', 'procedural', 'close'],
  added: '2026-11-16',
  order: 22,
  preview: { height: 560, hint: 'Point at the koi, click to feed them', capture: { wait: 300 } },
  actions: [{ id: 'feed', label: 'Feed the koi' }],
  useCases: [
    'The close of a studio, hotel or garden site, where a small living thing rewards reaching the end',
    'A footer for a restaurant, spa or bathhouse that wants calm instead of a link dump',
    'A quiet toy above the legal line of a portfolio, with the brand’s own colours for the fish',
  ],
  notes: [
    'The canvas is aria-hidden and nothing depends on it; the Feed button is a real <button> that drops a pellet from the keyboard, and the links and statement are plain DOM.',
    'Pointer curiosity and startle run only for a fine pointer with hover; on touch the koi wander on their own and a tap feeds them (a click event, so a scroll that starts on the pond feeds nothing).',
    'The loop runs only while the pond is on screen. Under reduced motion and in the static tier the koi are drawn once in settled poses; a feed re-draws them at the pellet, with no movement in between.',
  ],
  controls: [
    { id: 'count', label: 'Koi', type: 'range', min: 1, max: 6, step: 1, default: 3, group: 'Pond', prompt: 'Koi in the pond: {value} (default {default})' },
    { id: 'speed', label: 'Cruise speed', type: 'range', min: 0.5, max: 2, step: 0.1, default: 1, unit: '×', group: 'Pond', help: '1 is a cruise of 24 px/s, a little faster and slower in turn. Racing for a pellet multiplies it by 2.2 to 5.5.', prompt: 'Cruise at {value} the base 24 px/s (default {default})' },
    { id: 'reach', label: 'Curiosity reach', type: 'range', min: 0, max: 320, step: 10, default: 170, unit: 'px', group: 'Pointer', help: 'How far away a slow pointer draws a koi over. At 0 they ignore it and only startle.', prompt: 'A slow pointer draws koi over from {value} away (default {default})' },
    { id: 'tone', label: 'Lead koi', type: 'color', default: 'clay', options: ['clay', 'accent', 'plum', 'sky', 'moss'], group: 'Look', help: 'The first koi takes this colour; the others take the remaining content colours in order.', prompt: 'Lead koi in {value}, the others in the remaining content colours (default {default})' },
  ],
  prompt: {
    skill: 'component',
    ask: 'Add a koi pond to {target}.',
    target: 'the site footer',
    brief: 'A footer with one statement, a rounded pond band 150–340 px tall and a row of links. The pond is one aria-hidden 2D canvas seen from above with three koi. Each koi is a ten-point spine dragged behind its head (5.4 px apart), drawn as a body from a half-width profile, two pectoral fins, a forked tail and a swimming wave that grows toward the tail. Steering sums a heading, a slow wander, a sidestep from koi within 70 px and a pull to the pond’s middle line once a probe 40 px ahead leaves the safe box; the turn rate is capped by a 26 px turning circle. Cruise is 24 px/s. A slow fine pointer within 170 px draws koi over to loiter at 34–48 px; one moving faster than 0.9 px/ms startles koi within 90 px for 0.7 s. A click drops a pellet (at most 6) with three ripple rings and each koi races to its nearest pellet at 2.2–5.5 × cruise.',
    keep: [
      'the canvas aria-hidden, a real button that feeds from the keyboard, and click (not pointerdown) so a touch scroll never feeds',
      'the loop only while the pond is on screen; one settled still under reduced motion, re-drawn at the pellet after a feed; pointer curiosity for fine pointers only',
    ],
  },
};
