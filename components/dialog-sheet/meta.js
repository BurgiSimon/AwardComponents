export default {
  id: 'dialog-sheet',
  title: 'Long-read dialog',
  category: 'navigation',
  summary: 'A magazine’s “Read the full story” opens a native dialog that scrolls on its own smooth scroll while the page stays put; on a phone it docks as a sheet you drag away.',
  recipe: 'dialog-nested-lenis-sheet',
  deps: ['gsap', 'lenis'],
  tags: ['dialog', 'overlay', 'lenis', 'bottom-sheet', 'drag', 'editorial', 'gsap'],
  added: '2026-10-28',
  order: 40,
  preview: { height: 640, hint: 'Open the story, then scroll inside it', capture: { action: 'open', wait: 1200 } },
  actions: [{ id: 'open', label: 'Open story' }],
  useCases: [
    'A full article, a case study or an interview read without leaving the index page',
    'Studio information, credits or terms that are long but belong to one page',
    'A product’s full details on a shop card, as a sheet on the phone',
  ],
  notes: [
    'A native <dialog> opened with showModal(): the page behind is inert, focus goes to Close, Escape closes with the same animation, and focus returns to the button that opened it.',
    'The story is in the HTML from the start, so find-in-page, crawlers and readers without script get every word.',
    'The sheet is dragged only from its header, so touch scrolling in the text is never taken over; Escape and Close are the keyboard equivalents. Under reduced motion it opens and closes at once and scrolls natively.',
  ],
  controls: [
    { id: 'width', label: 'Dialog width', type: 'range', min: 560, max: 960, step: 20, default: 760, unit: 'px', group: 'Dialog', prompt: 'Dialog width: up to {value}, the panel 86 % of the viewport tall (default {default})' },
    { id: 'blur', label: 'Backdrop blur', type: 'range', min: 0, max: 16, step: 1, default: 6, unit: 'px', group: 'Dialog', prompt: 'Blur the page behind the scrim by {value} (default {default})' },
    { id: 'breakpoint', label: 'Sheet below', type: 'range', min: 480, max: 1024, step: 8, default: 768, unit: 'px', group: 'Sheet', help: 'Viewport width under which the dialog opens as a bottom sheet.', prompt: 'Open as a bottom sheet below {value} of viewport width (default {default})' },
    { id: 'dismiss', label: 'Drag to dismiss', type: 'range', min: 10, max: 50, step: 5, default: 25, unit: '%', group: 'Sheet', help: 'Share of the sheet’s height a drag must pass to close it; a flick faster than 0.6 px/ms also closes.', prompt: 'Drag past {value} of the sheet’s height, or flick faster than 0.6 px/ms, to dismiss; shorter drags spring back (default {default})' },
  ],
  prompt: {
    skill: 'component',
    ask: 'Open {target} in a long-read dialog.',
    target: 'the full article',
    brief: 'A native <dialog> opened with showModal() holds the whole story and scrolls on a second Lenis bound to its own scroller, ticked by the same clock as the page Lenis, which stops while it is open; data-lenis-prevent keeps the two apart. The panel rises 48 px and fades in over 0.66 s (expo.out) and leaves over 0.42 s. Below 768 px the same markup docks as a bottom sheet that can be dragged away from its header.',
    keep: [
      'the content server-rendered in the dialog, not injected on open; Escape arrives as cancel and is animated; every close path restores focus to the opener.',
      'an inner pane with data-lenis-prevent scrolls natively; reduced motion opens and closes at once with native scrolling.',
    ],
  },
};
