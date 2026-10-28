// Field reference: docs/authoring.md. Plain data, no imports.
export default {
  id: 'next-case-handoff',
  title: 'Next case hand-off',
  category: 'loaders-transitions',
  summary: 'A studio’s case pages that close on the next case’s hero, hinged under a Next case label. Follow it and the frame rises to become that hero, its film still running.',
  description: 'Each of Halden’s three case pages ends on the next case’s hero, drawn in the hero’s own geometry and clipped under a Next case label, its title card hinged on its top-right corner while the close scrolls in (−10° to −5°). The end of one case is already the opening of the next.\n\nFollowing the link lifts that frame out of its clip, fixed at its own rectangle, and raises it to the top of the screen while the card unwinds to level on the same one-second expo-out clock. Then the page swaps underneath and the frame’s film, a canvas drifting over the project photograph with a running timecode, is moved into the new hero as the same element. Watch the timecode: it never resets, because nothing was copied.\n\nThe arrived page skips its own entrance, the scroll is at the top, focus is on the new heading, the URL records the case and Back swaps without the lift. In this preview the three pages are rendered from data; on a real site the same module fetches the next document and swaps its <main>.',
  recipe: 'next-case-handoff',
  deps: ['gsap'],
  tags: ['transition', 'router', 'case-study', 'scrub', 'scrolltrigger', 'canvas', 'history', 'gsap'],
  added: '2026-10-28',
  labels: ['new'], // added on the launch day after the launch set; expires like any New label
  order: 45,
  preview: { height: 720, scroll: true, hint: 'Scroll to the close, then follow Next case', capture: { scroll: 1, wait: 1400 } },
  useCases: [
    'The end of a project page in a studio, agency or architect’s portfolio, leading into the next project',
    'Chaptered long reads or product stories whose next chapter opens on the same picture',
    'Any list of cases visited one after another, where the reader should not have to go back to the index',
  ],
  notes: [
    'The close is a nav named Next case holding one real link (“Next case: Tern Library”); modified clicks open the page in a new tab.',
    'After a hand-off the page has one main and one h1, the title names the case, focus is on the heading (ring only after a key) and the scroll is at the top.',
    'Reduced and static motion swap the page at once: no hinge, no lift, no entrance, and each film shows one still frame.',
    'Films paint only while on screen, and the canvas is aria-hidden; every picture carries its credit on the page.',
  ],
  controls: [
    { id: 'hingeFrom', label: 'Hinge from', type: 'range', min: -20, max: 0, step: 0.5, default: -10, unit: '°', group: 'Hinge', help: 'The card’s angle as the close enters, turning on its top-right corner.', prompt: 'The next case’s card starts at {value} as the close enters the viewport (default {default})' },
    { id: 'hingeTo', label: 'Hinge to', type: 'range', min: -15, max: 0, step: 0.5, default: -5, unit: '°', group: 'Hinge', help: 'Reached at the very end of the page (scrub 0.5).', prompt: 'It hinges to {value} by the end of the page, scrubbed at 0.5 (default {default})' },
    { id: 'closeHeight', label: 'Close height', type: 'range', min: 50, max: 90, step: 1, default: 72, unit: 'svh', group: 'Hinge', help: 'How much of the next hero shows under the label. Phones use 8 less.', prompt: 'The close is {value} tall: the label, then the next hero clipped under it; phones 8 svh less (default {default})' },
    { id: 'lift', label: 'Lift duration', type: 'range', min: 0.4, max: 2, step: 0.05, default: 1, unit: 's', group: 'Hand-off', help: 'The rise and the unwind share this one clock.', prompt: 'The frame rises to the top and the card unwinds to 0° on one {value} clock (default {default})' },
    { id: 'ease', label: 'Lift ease', type: 'select', options: [{ value: 'expo.out', label: 'Expo out' }, { value: 'power3.out', label: 'Power3 out' }, { value: 'power2.inOut', label: 'Power2 in-out' }, { value: 'sine.inOut', label: 'Sine in-out' }], default: 'expo.out', group: 'Hand-off', prompt: 'Lift and unwind ease: {value} (default {default})' },
    { id: 'prefetch', label: 'Prefetch on intent', type: 'toggle', default: true, group: 'Hand-off', help: 'Builds the next page and starts its pictures when the link is pointed at or focused. Nothing visible changes.', prompt: { on: 'Prefetch the next document on pointerenter and focus of the link', off: 'Fetch the next document only on click' } },
    { id: 'timecode', label: 'Show timecode', type: 'toggle', default: true, group: 'Film', help: 'The running timecode makes the continuity visible: it never resets across the swap.', prompt: { on: 'A running timecode on the moved media shows it never restarts', off: 'No timecode on the media' } },
  ],
  actions: [
    { id: 'next', label: 'Next case', icon: 'arrowRight' },
    { id: 'back', label: 'Back', icon: 'arrowLeft' },
  ],
  prompt: {
    skill: 'component',
    ask: 'Close {target} on the next case’s hero and hand its live media to the next page.',
    target: 'each case-study page',
    brief: 'The last section is the next case’s hero in the hero’s own geometry (100svh, the same card position), clipped under a Next case label (72svh, 64 on phones). Its title card hinges on its top-right corner as the close scrolls in: rotation −10° → −5°, xPercent −12 → −6, yPercent 24 → −4, trigger the frame, top bottom → max, scrub 0.5. Prefetch the next page on the link’s pointerenter and focus. On click, kill that scrub, fix the frame at its own rect out of the clip, then raise it by −rect.top while the card unwinds to 0°, both 1 s expo.out. Then swap <main>, replaceWith the frame’s live media node (a playing <video> or a painted canvas) into the new hero, scroll to 0, pushState, update the title and focus the new h1. The arrived hero skips its entrance (a normal load rises from yPercent 30, rotation 4); Back swaps without the lift and wins over a lift in flight.',
    keep: [
      'one real link per close, named from its visible label; modified clicks, reduced motion, a failed fetch or no History API navigate for real',
      'only the media node moves, never a copy: a video keeps its currentTime, a canvas its pixels; the arrived page brings its own h1, title and one main',
      'reduced and static motion: no hinge, no lift, no entrance; media paints only while on screen and the old page’s tweens and triggers are reverted on swap',
    ],
  },
};
