// Field reference: docs/authoring.md. Plain data, no imports.
export default {
  id: 'woven-story',
  title: 'Woven long-read',
  category: 'webgl',
  summary: 'A magazine long read where every picture is a dither woven by one WebGL context: five in-flow scenes, pooled footage, levels that slide with the season and the theme.',
  description: 'Fieldnote’s weather issue, with its five pictures (a hero, two chapters, a glyph interlude and the close) all woven by the same compositor. One raw WebGL context lives on a detached canvas; each scene is an ordinary 2D canvas in its section, so it scrolls natively and sits under the section’s text. The compositor draws a scene into the top-left slice of a shared buffer that only grows, then copies that slice across with drawImage in the same task.\n\nThe three clips (the turning Earth, an orbit time-lapse, desert cloud) and one drawn sleet loop are pooled: each is one texture, uploaded at most once per new frame however many scenes show it, and plays only while a visible scene does. A scene redraws only on screen and only when something it shows changed, at 30 fps at most. Light grounds weave on normal levels, dark grounds on inverted ones. The season switch in chapter one moves two layers of the same footage by their levels, and a theme change redevelops each flipped section at its new levels, never a cross-fade between two pictures. The readout in the top bar shows the one context at work: scenes drawn and clip uploads this frame, and per clip, uploads never above frames.',
  recipe: 'gl-dither-scene-pool',
  deps: ['gsap'],
  tags: ['webgl', 'shader', 'dither', 'video', 'canvas', 'scroll', 'scrub', 'gsap', 'theme', 'editorial', 'magazine', 'performance', 'reduced-motion'],
  requires: ['webgl'],
  added: '2026-10-28',
  labels: ['new'], // added on the launch day after the launch set; expires like any New label
  order: 56,
  preview: { height: 720, scroll: true, hint: 'Scroll the story; switch the season in chapter one', capture: { wait: 2600 } },
  useCases: [
    'An editorial or long-read page where every picture shares one treatment and one GPU budget',
    'A brand site with many woven or dithered pictures that would otherwise each hold their own WebGL context',
    'Any page that shows the same footage in several places and should decode and upload it once',
  ],
  notes: [
    'Every scene canvas is aria-hidden; each figure keeps its poster as an <img> with alt text (empty where it repeats a picture already described) and a visible caption with its credit; all text is DOM.',
    'Pause footage sits in the top bar from the first screen and stops every clip (aria-pressed carries the state); the season switch is a pair of aria-pressed buttons with 44 px targets.',
    'Reduced motion and static: one developed still per scene from the posters, drawn when it comes into view; no clock, no footage, no pause button, and the season switch is instant.',
    'Without WebGL the posters show as greyscale pictures (the planet cut out of its black square), with no context made at all, and the captions and readout say so.',
    'The compositor readout is a details disclosure in the top bar, so it never covers the article; its panel closes with Escape (focus returns to it) or a press outside.',
  ],
  controls: [
    { id: 'cell', label: 'Cell size', type: 'range', min: 5, max: 14, step: 1, default: 6, unit: 'px', group: 'Weave', help: 'One bar’s cell in CSS px (glyph cells are 1.6 times wider, never under 9 px).', prompt: 'Bar cells {value} wide (CSS), glyph cells 1.6 times that and never under 9 px (default {default})' },
    { id: 'contrast', label: 'Levels contrast', type: 'range', min: 0.6, max: 2, step: 0.1, default: 1, unit: '×', group: 'Weave', help: 'Moves the black and white points toward the middle (higher, punchier) or apart (lower, softer).', prompt: 'Levels contrast {value}: each black and white point’s distance from 127.5 divided by it (normal 20 / 235 and inverted 225 / 35 at 1×; default {default})' },
    { id: 'ink', label: 'Weave ink', type: 'color', options: ['ink', 'accent', 'clay', 'moss', 'plum'], default: 'ink', group: 'Weave', prompt: (v) => `Weave in the ${v} token instead of ink, read per section so a dark band takes its dark-theme value` },
    { id: 'interlude', label: 'Interlude', type: 'select', options: [{ value: 'glyphs', label: 'Glyphs' }, { value: 'bars', label: 'Bars' }], default: 'glyphs', group: 'Scenes', help: 'The pull-quote scene woven as a glyph ramp or as bars like the rest.', prompt: (v) => (v === 'bars' ? 'The interlude is woven in bars like the other scenes' : 'The interlude is woven as a glyph ramp sorted by measured ink') },
    { id: 'fps', label: 'Draw cap', type: 'select', options: [{ value: 15, label: '15 fps' }, { value: 24, label: '24 fps' }, { value: 30, label: '30 fps' }, { value: 60, label: '60 fps' }], default: 30, group: 'Budget', help: 'The most scene redraws per second; footage frames in between are skipped, never queued.', prompt: 'Scenes redraw at {value} at most (default {default})' },
    { id: 'readout', label: 'Compositor readout', type: 'toggle', default: true, group: 'Budget', help: 'The line in the top bar: contexts, scenes drawn and uploads this frame, the cap; open it for the per-clip table.', prompt: false },
  ],
  actions: [
    { id: 'season', label: 'Switch season' },
    { id: 'pause', label: 'Pause footage' },
  ],
  prompt: {
    skill: 'webgl',
    ask: 'Weave every picture in {target} from one WebGL context.',
    target: 'the long-read article template',
    brief: 'One raw WebGL context on a detached canvas draws every woven picture. Each scene is an in-flow 2D canvas in its section (so it scrolls natively and stacks under the text); the pool renders it into the top-left slice of a shared buffer that only grows (viewport(0, H − h, w, h)) and drawImage()s that slice into the scene canvas in the same task, with no preserveDrawingBuffer. Clips are pooled: one texture each, uploaded at most once per new frame (requestVideoFrameCallback) however many scenes show it, playing only while a visible scene shows them; a scene redraws only when visible (10 % root margin) and when a clip frame or a setting changed, at 30 fps at most, DPR ≤ 1.5. Cells never under 5 CSS px (9 for glyphs); light grounds take normal levels 20 / 235, dark grounds inverted 225 / 35; the hero develops 1.6 s after arrival, the rest from the figure’s top at the viewport bottom to its centre at 60 %; seasons are layers of one scene swapped by their levels over 1.2 s, and a theme change redevelops a flipped section at its new polarity, never a cross-fade.',
    keep: [
      'scene canvases aria-hidden, every figure with a poster <img> carrying alt text and a visible caption and credit; all text stays DOM',
      'one page-level Pause footage button in the top bar (aria-pressed) that stops every clip, so nothing loops past five seconds unbidden',
      'reduced motion and static draw one developed still per scene with no clock and no footage; without WebGL the posters show and no context is made; the context is released on unmount',
    ],
  },
};
