export default {
  id: 'interruptible-menu',
  title: 'Interruptible mega menu',
  category: 'navigation',
  summary: 'A shop’s mega menu run by one paused timeline with a hinge: close it halfway open and it rewinds from where it is; close it once open and it plays its own exit.',
  recipe: 'two-phase-interruptible-timeline',
  deps: ['gsap'],
  tags: ['menu', 'mega-menu', 'timeline', 'gsap', 'interruptible', 'disclosure', 'shop'],
  added: '2026-10-28',
  order: 30,
  preview: { height: 620, hint: 'Press Shop twice quickly', capture: { action: 'toggle', wait: 1400 } },
  actions: [{ id: 'toggle', label: 'Toggle menu' }],
  useCases: [
    'A shop header whose Shop item opens categories and a featured product',
    'Any open and close pair a visitor can double-press: drawers, sheets, accordions, filters',
    'A docs or app header with a products panel that should never land half-built',
  ],
  notes: [
    'A disclosure, not a dialog: the Shop button carries aria-expanded and aria-controls, the panel is inert from the moment a close is asked for, Escape closes and returns focus to the button, and choosing a link closes it.',
    'Closed is the stylesheet’s own state (hidden, clipped), so nothing flashes before the script runs.',
    'Reduced motion keeps the same hinge with opacity only; the static tier jumps straight to open or closed.',
  ],
  controls: [
    { id: 'openDur', label: 'Open duration', type: 'range', min: 0.3, max: 1.4, step: 0.05, default: 0.7, unit: 's', group: 'Timing', help: 'The panel’s clip-path wipe; links and picture follow inside it.', prompt: 'Open half: the panel wipes down over {value} (expo.inOut) while the links rise out of masks 0.035 s apart, each column 0.05 s after the last (default {default})' },
    { id: 'closeDur', label: 'Close duration', type: 'range', min: 0.2, max: 1.2, step: 0.05, default: 0.5, unit: 's', group: 'Timing', prompt: 'Close half: the links leave from the end, then the panel wipes up over {value} (power3.inOut) (default {default})' },
    { id: 'hinge', label: 'After the hinge', type: 'select', options: [{ value: 'exit', label: 'Own exit' }, { value: 'mirror', label: 'Rewind' }], default: 'exit', group: 'Timing', help: 'What a close does once the menu is fully open. A close before the hinge always rewinds.', prompt: (v) => (v === 'mirror' ? 'After the hinge a close also rewinds the open half, so the exit mirrors the entrance (default: plays its own exit forward)' : 'After the hinge a close plays the authored exit forward') },
    { id: 'slow', label: 'Slow motion', type: 'toggle', default: false, group: 'Demo', help: 'Plays the timeline at 0.3× so an interrupted open is easy to catch.', prompt: false },
  ],
  prompt: {
    skill: 'component',
    ask: 'Drive {target} with one interruptible timeline.',
    target: 'the Shop mega menu',
    brief: 'Open and close are one paused GSAP timeline: the open half (the panel wipes down with clip-path over 0.7 s, expo.inOut, as its columns of links rise out of masks), then addPause() at its end (the hinge, 1.06 s with these timings), then the close half (the links leave from the end and the panel wipes up over 0.5 s, power3.inOut). Closing calls tl.time() < hinge ? tl.reverse() : tl.play(), so a close that arrives mid-open rewinds from where it is instead of starting a separate exit from a half-built state, and a close after the hinge plays the authored exit. Reopening during the close half reverses back to the hinge; onComplete returns the playhead to 0.',
    keep: [
      'aria-expanded and aria-controls on the toggle; the panel inert as soon as a close is asked for; Escape returns focus to the toggle; visibility hidden at rest from the stylesheet and the timeline.',
      'reduced motion: the same hinge, opacity only; static: pause at the hinge or at 0, no tween.',
    ],
  },
};
