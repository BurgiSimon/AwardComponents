export default {
  id: 'hover-preview-list',
  title: 'Hover preview list',
  category: 'galleries',
  summary: 'An architecture studio’s archive as a ruled list of title, place, year and discipline; hovering a row brings up its picture, which chases the pointer and swaps from project to project.',
  recipe: 'hover-preview-list',
  deps: [],
  tags: ['list', 'archive', 'hover', 'pointer', 'preview', 'portfolio', 'damping'],
  added: '2026-10-28',
  featured: true,
  order: 40,
  preview: { height: 640, scroll: true, hint: 'Hover or Tab through the rows', capture: { pointer: [0.49, 0.58], wait: 1000 } },
  useCases: [
    'A portfolio index or a full project archive',
    'A list of articles, releases or events that each have one strong picture',
    'A team page where each name shows a portrait',
  ],
  notes: [
    'Every row is a real link with its text in reading order; the preview is aria-hidden and never takes the pointer.',
    'Keyboard focus shows the same preview, anchored beside the focused row, so the affordance is never hover-only.',
    'Coarse pointers get a plain list with small inline thumbnails; under reduced motion the preview still appears but does not trail or tilt.',
  ],
  controls: [
    { id: 'size', label: 'Preview size', type: 'range', min: 14, max: 32, step: 1, default: 22, unit: 'vw', group: 'Preview', prompt: 'Preview width: {value} of the viewport (default {default})' },
    { id: 'lerp', label: 'Follow', type: 'range', min: 0.05, max: 0.6, step: 0.01, default: 0.25, group: 'Preview', help: 'Share of the gap the preview closes each 60 fps frame. Lower trails further.', prompt: 'Follow: lerp {value} per 60 fps frame toward the pointer, through framerate-independent damping (default {default})' },
    { id: 'rotate', label: 'Rotation from speed', type: 'range', min: 0, max: 14, step: 1, default: 5, unit: '°', group: 'Preview', help: 'The preview leans with the pointer’s horizontal speed, up to this angle, and settles upright.', prompt: (v) => (v ? `Lean the preview with the pointer’s horizontal speed, up to ${v}°, settling upright when it stops` : 'No lean: the preview stays upright') },
    { id: 'shape', label: 'Shape', type: 'select', options: [{ value: 'portrait', label: 'Portrait 4:5' }, { value: 'landscape', label: 'Landscape 4:3' }], default: 'portrait', group: 'Preview', prompt: 'Preview shape: {value} (default {default})' },
  ],
  prompt: {
    skill: 'component',
    ask: 'Turn {target} into a hover preview list.',
    target: 'the project archive',
    brief: 'A ruled list where every row is a link (title, place, year, discipline). Hovering a row shows its picture in a 22 vw, 4:5 preview that chases the pointer with a lerp of 0.25 per 60 fps frame through framerate-independent damping and leans up to 5° with the lag, cross-fading between rows instead of hiding; the row’s title shifts 0.15 em. The loop runs only while the preview is out.',
    keep: [
      'keyboard focus shows the same preview anchored beside the focused row; the preview is aria-hidden and pointer-events: none.',
      'coarse pointers get a plain list; reduced motion keeps the preview without the trail or the lean.',
    ],
  },
};
