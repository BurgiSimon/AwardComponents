// Field reference: docs/authoring.md. Plain data, no imports.
export default {
  id: 'custom-scrollbar',
  title: 'Drawn scrollbar',
  category: 'navigation',
  summary: 'A long help guide with a themed thumb on the right edge that mirrors the scroll, drags and jumps on a track press, with ticks for each section; the native bar and keys stay.',
  description: 'The thumb never owns the scroll position. It reads how far down the page is once a frame and moves by transform, so the wheel, Page Down, Home and End, anchors, find-in-page and the browser’s own scrollbar all move it. Dragging writes the scroll back; pressing the track centres the thumb on the pointer and drags from there.\n\nTicks mark where each section starts, placed where the thumb’s centre will be when that section reaches the top, and a bubble names the section under the pointer or under the thumb while dragging.',
  recipe: 'scrollbar-thumb-drag',
  deps: ['gsap', 'lenis'],
  tags: ['scrollbar', 'scroll', 'drag', 'pointer', 'docs', 'navigation', 'lenis'],
  added: '2026-10-28',
  order: 40,
  preview: { height: 680, scroll: true, hint: 'Drag the thumb on the right edge', capture: { scroll: 0.3, hover: '[data-track]', wait: 1000 } },
  useCases: [
    'Long documentation, guides and terms, where ticks show how the page is divided',
    'A portfolio or long read with a themed bar that matches the brand colour',
    'Any page that hides nothing: the drawn thumb sits beside the browser’s own scrollbar, not instead of it',
  ],
  notes: [
    'The browser’s scrollbar stays and no key is intercepted, so keyboard, switch and screen-reader scrolling are untouched.',
    'The drawn track is aria-hidden and holds nothing focusable: it duplicates a control that already exists, for pointers only.',
    'Hidden on touch and coarse pointers. Under reduced motion there is no smooth scroll and the thumb sits exactly on the position with no easing.',
  ],
  controls: [
    { id: 'width', label: 'Thumb width', type: 'range', min: 2, max: 8, step: 1, default: 4, unit: 'px', group: 'Thumb', help: 'At rest; it grows by 4 px under the pointer and while dragging (scaled, not resized).', prompt: 'Thumb line: {value} wide at rest, 4 px wider on hover and drag by scale (default {default})' },
    { id: 'colour', label: 'Colour', type: 'color', default: 'accent', group: 'Thumb', prompt: 'Thumb colour: {value} (default {default})' },
    { id: 'ease', label: 'Follow damping', type: 'range', min: 0, max: 30, step: 1, default: 14, group: 'Thumb', help: 'How the thumb catches up with jumps (keys, anchors). 0 sits exactly on the scroll; it always does while dragging.', prompt: (v) => (v === 0 ? 'No easing: the thumb sits exactly on the scroll position (default: damping 14)' : `The thumb eases towards keyboard and anchor jumps with framerate-independent damping ${v} (default 14); exact while dragging`) },
    { id: 'ticks', label: 'Section ticks', type: 'toggle', default: true, group: 'Track', prompt: { on: 'Ticks on the track where each section starts, and a bubble naming the section under the pointer', off: 'No section ticks; the bubble still names the section under the pointer' } },
    { id: 'autoHide', label: 'Auto-hide', type: 'toggle', default: false, group: 'Track', prompt: { on: 'The track fades out 1.2 s after scrolling stops and returns on scroll or with the pointer near the edge', off: 'The track stays visible' } },
  ],
  prompt: {
    skill: 'component',
    ask: 'Add a drawn scrollbar thumb to {target}.',
    target: 'the long documentation pages',
    brief: 'A themed thumb on the right edge mirrors scrollY / (scrollHeight − innerHeight) once a frame, on the same clock as the smooth scroll, and moves by transform; its height is max(48 px, track × viewport / document), and it is a 4 px line scaled to 8 px on hover and drag. It eases towards jumps (keys, anchors) with framerate-independent damping 14 and sits exactly on the scroll while dragging. Dragging maps the thumb’s offset over its free travel to a scroll position; pressing the track centres the thumb on the pointer and keeps dragging. Ticks mark where each section starts, and a bubble names the section under the pointer.',
    keep: ['the native scrollbar and every key path stay; the drawn track is aria-hidden, pointer-only and hidden on coarse pointers; no easing under reduced motion.'],
  },
};
