// Field reference: docs/authoring.md. Plain data, no imports.
export default {
  id: 'auto-scroll',
  title: 'Auto-scroll takeover',
  category: 'scroll',
  summary: 'A long walk-through page with an Auto toggle that advances it at a steady pace; any wheel, touch, press, key or scrollbar use hands control back at once, announced politely.',
  description: 'The page never moves until the visitor asks. Auto drives the document at a fixed rate in pixels per second of real time, so a 30 Hz phone reads at the same pace as a 120 Hz laptop and a stalled frame cannot jump a paragraph.\n\nEvery road back is heard first, in the capture phase: the wheel, a touch, a pointer press, any key (Tab included) and a scroll the drive did not write, such as a scrollbar drag, find-in-page or a link. Reaching the end stops it too. Each change is announced once in a polite status line.',
  recipe: 'auto-drive-manual-takeover',
  deps: ['gsap', 'lenis'],
  tags: ['scroll', 'auto-scroll', 'lenis', 'accessibility', 'status', 'toggle', 'story'],
  added: '2026-10-28',
  order: 60,
  preview: { height: 700, scroll: true, hint: 'Press Auto, then touch anything', capture: { action: 'auto', wait: 1600 } },
  useCases: [
    'A walk-through, a route or a timeline that reads well hands-free',
    'A long manifesto, credits roll or lyric sheet with an optional steady pace',
    'A kiosk or presentation page, where the visitor can always take the page back',
  ],
  notes: [
    'A real button with aria-pressed, off on every visit; its description says what it does, and one polite status line reports each change with the reason.',
    'Any key hands back, Tab included, so a keyboard user is never chasing a moving page; the toggle’s own Enter and Space are left to it.',
    'Under reduced motion the toggle stays in the tab order, aria-disabled, with the reason written beside it; nothing ever starts by itself.',
  ],
  controls: [
    { id: 'speed', label: 'Speed', type: 'range', min: 30, max: 240, step: 10, default: 90, unit: 'px/s', group: 'Drive', help: 'Pixels per second of real time, whatever the frame rate.', prompt: 'Drive rate: {value} of ticker time, frame time clamped to 100 ms (default {default})' },
    { id: 'delay', label: 'Start delay', type: 'range', min: 0, max: 5, step: 0.5, default: 0, unit: 's', group: 'Drive', help: 'A countdown on the toggle before the page starts moving; any input during it cancels.', prompt: (v) => (v ? `Start ${v} s after the press, with a countdown ring on the toggle; any input during the countdown cancels it` : 'Start at once on the press') },
    { id: 'dock', label: 'Dock', type: 'select', options: [{ value: 'card', label: 'Card in its own lane' }, { value: 'bar', label: 'Bar along the bottom' }], default: 'card', group: 'Layout', help: 'Below 1024 px the dock is always a bar.', prompt: (v) => (v === 'bar' ? 'The toggle sits in a bar along the bottom of the viewport' : 'On wide screens the toggle sits in a narrow card in its own lane beside the text; a bar below 1024 px') },
  ],
  actions: [{ id: 'auto', label: 'Toggle auto scroll' }],
  prompt: {
    skill: 'component',
    ask: 'Give {target} an optional auto-scroll that hands control back at once.',
    target: 'the long story page',
    brief: 'An Auto toggle, off on every visit, advances the document through the smooth scroll at a fixed 90 px per second of ticker time (dt clamped to 100 ms, with a float accumulator). The first wheel, touch, pointer press or key, heard in the capture phase, hands control straight back, as does a scroll more than 3 px from where the drive put the page, and reaching the end. Each change is announced once in a polite status line, with the reason.',
    keep: ['a real button with aria-pressed and a description; any key hands back; under reduced motion the toggle is aria-disabled with the reason beside it and nothing moves by itself.'],
  },
};
