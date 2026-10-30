// Field reference: docs/authoring.md. Plain data, no imports.
export default {
  id: 'woven-close',
  title: 'Woven footage close',
  category: 'closers',
  summary: 'An observatory’s close: tonight’s shows and a ticket link beside the Earth from deep space and an orbit horizon, both woven live into the section’s own ink as bars or ASCII glyphs.',
  description: 'The last screen of Meridian Observatory’s site. Two clips graded on black, the whole Earth filmed from a million miles out and a time-lapse horizon from the space station, sit as layers on one raw-WebGL canvas over a generated star field. Black is the matte: a cell whose footage is near-black drops out, so each clip lands as a cut-out with no alpha channel. Every other cell is redrawn as a vertical bar as wide as the cell is dark, or as a glyph from an ASCII ramp sorted by how much ink each character really has in the mono face.\n\nEach layer is a plain object (cell grid, black and white points, bar range, ground and ink opacity, develop) that GSAP tweens, so scrolling develops every layer from blank while its slot comes into view. The canvas renders only when a clip frame, a tween value, the size, the theme or a setting changed, at 30 fps at most, and never while the close is off screen. Every word, link and button sits beside the weave, never under it.',
  recipe: 'gl-video-dither-layers',
  deps: ['gsap'],
  tags: ['webgl', 'shader', 'video', 'footer', 'mask', 'scrub', 'gsap', 'scrolltrigger', 'ascii', 'dither', 'reduced-motion'],
  requires: ['webgl'],
  added: '2026-10-28',
  labels: ['new'], // added on the launch day after the launch set; expires like any New label
  order: 60,
  preview: { height: 760, scroll: true, hint: 'Scroll to the close', capture: { scroll: 1, wait: 2600 } },
  useCases: [
    'The close of a museum, planetarium or festival site, where the last screen carries tonight’s programme and one ticket action',
    'A footer that turns mixed footage (drone, archive, product renders) into one texture in the brand’s own ink',
    'A campaign end screen where a film shot on black is woven beside the call to action',
  ],
  notes: [
    'The canvas is aria-hidden and a visible caption names the footage; the show list, visit facts, ticket link and credits are DOM beside the weave, never under it.',
    'Pause footage is a real button whose label stays put while aria-pressed carries the state; the clips also stop whenever the close leaves the screen.',
    'Under reduced motion and static the weave is one developed still from the clips’ posters: no clock, no video, no pause button.',
    'Without WebGL, or after a lost context, the posters sit in the same slots as a striped, masked still and the copy does not move.',
  ],
  controls: [
    {
      id: 'weave', label: 'Weave', type: 'select', default: 'bars', group: 'Weave',
      options: [{ value: 'bars', label: 'Bars' }, { value: 'glyphs', label: 'Glyphs' }],
      help: 'Bars: one vertical bar per cell, as wide as the cell is dark. Glyphs: “ .:-=+*%#@” sorted by measured ink in JetBrains Mono.',
      prompt: (v) => (v === 'glyphs'
        ? 'Weave as glyphs: each cell draws one character of the ramp “ .:-=+*%#@”, sorted light to heavy by its measured ink in the monospace face before upload, in cells about 0.6 as wide as tall and never under 9 CSS px'
        : 'Weave as bars: one vertical bar per cell, its width from −2 % to 102 % of the cell by tone'),
    },
    { id: 'cell', label: 'Cell size', type: 'range', min: 5, max: 14, step: 1, default: 7, unit: 'px', group: 'Weave', help: 'Bar cells are never under 5 px; glyph cells take 1.5× and never under 9 px.', prompt: 'Bar cells {value} wide in CSS px, never under 5 px; glyph cells 1.5× that and never under 9 px (default {default})' },
    { id: 'key', label: 'Key threshold', type: 'range', min: 2, max: 30, step: 1, default: 4, unit: '%', group: 'Weave', help: 'A cell whose footage is this dark or darker drops out as the matte; the orbit keys 5 points higher for its blue-black sky. Raise it until only cloud and land are left.', prompt: 'Key: a footage cell drops out when its brightest channel is at or below {value} (default {default}), the orbit’s blue-black sky 5 points higher' },
    { id: 'ink', label: 'Ink', type: 'color', options: ['ink', 'accent', 'sky', 'clay'], default: 'ink', group: 'Look', help: 'The ground is the section’s own; the levels flip with the ink, so the picture stays positive on either theme.', prompt: 'Weave ink: {value} on the section’s ground token (default {default})' },
    { id: 'negative', label: 'Negative weave', type: 'toggle', default: false, group: 'Look', help: 'The footage cells become a solid plate of ink and the bars are cut out of it.', prompt: { on: 'Negative weave on the footage layers: ground opacity 1 in the ink colour and ink opacity 0, so the picture is cut out of a solid plate (the plate’s opacity develops with the scroll)', off: 'Positive weave: ink bars on the section ground' } },
    { id: 'band', label: 'Horizon band', type: 'toggle', default: true, group: 'Layers', help: 'The orbit time-lapse, keyed and woven full width along the bottom of the close.', prompt: { on: 'A second clip, the orbit horizon, keyed and woven full width in its own band, cropped per band shape rather than scaled', off: 'One footage layer only: the Earth disc over the star field' } },
  ],
  actions: [
    { id: 'replay', label: 'Replay the develop' },
    { id: 'pause', label: 'Pause or play the footage' },
  ],
  prompt: {
    skill: 'webgl',
    ask: 'Weave keyed footage into {target}.',
    target: 'the closing section of the site',
    brief: 'Clips graded on black (black is the matte) are composited as layers on one raw-WebGL canvas, one quad per layer sized to its slot: an Earth disc beside the show list, an orbit horizon cropped into a full-width band, and a generated star field behind both. Each cell reads its clip once at the centre and is dropped when the centre or four points at ±0.35 cell are near-black (at or below 4 %, 9 % for the orbit’s blue-black sky; the star field tests its centre alone so single-texel stars survive); every other cell draws a vertical bar as wide as the cell is dark (−2 % to 102 % of the cell, box-filtered over one device pixel; on a light ground the Earth keeps a 14 % hairline so white cloud at the limb does not fray the disc) or a glyph from a ramp sorted by measured ink, in the section’s own ground and ink tokens, with the levels inverted whenever the ink is lighter than the ground. Each layer’s cell scale, black and white points, bar range, ground and ink opacity and develop live in one plain object, the GSAP tween target: a scrubbed timeline per slot takes develop from 0 to 1 (levels from blank) while the slot enters, and clips upload once per decoded frame. Render only on change, at 30 fps at most and only while the close is on screen; cells never under 5 CSS px (9 for glyphs); DPR at most 1.5.',
    keep: [
      'every word, link and control in the DOM beside the weave, never under it; the canvas aria-hidden with a visible caption naming the footage',
      'a Pause footage button (aria-pressed, label unchanged) while clips loop; one developed still under reduced motion, with no clock and no video',
      'nothing allocated until the close is near, no frames off screen, and a designed poster still with the copy when WebGL is missing or the context is lost',
    ],
  },
};
