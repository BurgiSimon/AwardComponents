// Field reference: docs/authoring.md. Plain data, no imports.
export default {
  id: 'koi-pond-hero',
  title: 'Koi pond hero',
  category: 'heroes',
  summary: 'A project hero that is a pond seen from above: koi swim beneath the headline and under lily pads, come over to a slow pointer, scatter from a fast one and race for the pellet a click drops.',
  description: 'The first screen of an architecture studio’s project page is the project’s water. Six koi of different sizes swim on one canvas beneath the headline; each is a ten-point spine dragged behind its head, with a width profile, fins, a forked tail and a swimming wave, and some carry patches clipped to the body. Soft shadows on the pond floor and lily pads floating above give the water three depths.\n\nThe pond notices the visitor. A slow pointer draws the koi over and they loiter beside it; a fast one scatters them and skims small rings off the surface. A click drops a pellet: four wide rings travel out, the pads they reach drift and turn, and each koi races for the pellet nearest to it. The Feed button does the same from the keyboard.',
  recipe: 'living-scene-canvas2d',
  deps: [],
  tags: ['hero', 'canvas', 'pointer', 'koi', 'steering', 'procedural', 'ripples', 'toy'],
  added: '2026-11-16',
  order: 42,
  preview: { height: 640, hint: 'Point at the koi, click the water to feed them', capture: { wait: 300 } },
  actions: [{ id: 'feed', label: 'Feed the koi' }],
  useCases: [
    'A project hero for an architecture or landscape studio whose project is about water',
    'The first screen of a hotel, spa, bathhouse or garden site, where calm is the message',
    'A campaign or 404 page that gives the visitor one quiet thing to play with',
  ],
  notes: [
    'The canvas is aria-hidden under a real <h1>; the Feed button is a real <button> that drops a pellet from the keyboard, and small copy sits on water-coloured tape so no koi shows through it.',
    'Pointer curiosity, startle and surface rings run only for a fine pointer with hover; on touch the koi wander on their own and a tap feeds them (a click event, so a scroll that starts on the water feeds nothing). Phones get at most four koi and four pads.',
    'The loop runs only while the hero is on screen, on a canvas capped at a device pixel ratio of 2. Under reduced motion and in the static tier the pond is drawn once in settled poses; a feed re-draws it at the pellet, with no movement in between.',
  ],
  controls: [
    { id: 'count', label: 'Koi', type: 'range', min: 3, max: 8, step: 1, default: 6, group: 'Pond', help: 'Phones show at most four.', prompt: 'Koi in the pond: {value}, at most four on a phone (default {default})' },
    { id: 'pads', label: 'Lily pads', type: 'range', min: 0, max: 7, step: 1, default: 6, group: 'Pond', help: 'They keep to the edges, clear of the headline.', prompt: 'Lily pads: {value}, kept to the edges and clear of the headline (default {default})' },
    { id: 'speed', label: 'Cruise speed', type: 'range', min: 0.5, max: 2, step: 0.1, default: 1, unit: '×', group: 'Pond', help: '1 is a cruise of 24 px/s for a koi of size 1; larger koi are faster in proportion.', prompt: 'Cruise at {value} the base 24 px/s per unit of size (default {default})' },
    { id: 'reach', label: 'Curiosity reach', type: 'range', min: 0, max: 420, step: 10, default: 220, unit: 'px', group: 'Pointer', help: 'How far away a slow pointer draws a koi over. At 0 they ignore it and only startle.', prompt: 'A slow pointer draws koi over from {value} away (default {default})' },
    { id: 'ripple', label: 'Ripple reach', type: 'range', min: 120, max: 480, step: 20, default: 260, unit: 'px', group: 'Pointer', help: 'How far a click’s rings travel at 80 px/s before they fade. Pads inside that reach are pushed.', prompt: 'A click’s rings travel {value} at 80 px/s before fading (default {default})' },
  ],
  prompt: {
    skill: 'component',
    ask: 'Make {target} a koi pond seen from above.',
    target: 'the project hero',
    brief: 'A full-viewport hero whose ground is water: one aria-hidden 2D canvas under a real headline. Six koi of sizes 1–2 swim beneath the type; each is a ten-point spine dragged behind its head (5.4 px apart per unit of size), drawn as a body from a half-width profile, two pectoral fins, a forked tail and a swimming wave that grows toward the tail, some with patches clipped to the body. Steering sums a heading, a slow wander, a sidestep from close koi and a pull to the water’s middle line once a probe 40 px ahead leaves the safe box. Shadows of koi and pads are drawn opaque to a 1/5-size layer and scaled up with one alpha, which softens them. Six lily pads float above the koi near the edges on soft springs. A slow fine pointer within 220 px draws koi over to loiter; one faster than 0.9 px/ms startles koi within 130 px for 0.7 s and leaves small rings. A click drops a pellet (at most 8) with four rings that travel 260 px at 80 px/s, push the pads they reach and turn them a little; each koi races to its nearest pellet at 2.2–5.5 × cruise.',
    keep: [
      'the canvas aria-hidden under a real heading, a real button that feeds from the keyboard, and click (not pointerdown) so a touch scroll never feeds',
      'the loop only while the hero is on screen and the canvas capped at DPR 2; one settled still under reduced motion, re-drawn at the pellet after a feed; pointer effects for fine pointers only; fewer koi and pads on a phone',
    ],
  },
};
