# Authoring a component

A component is one folder in `components/<id>/` with three files. The folder is the whole registration: the sidebar, search, browse page, changelog, prompt builder, route files and sitemap all find it by glob. Nothing else needs editing.

```
components/logo-marquee/
  meta.js    what it is, its controls and its prompt (plain data)
  demo.js    mount(root, options, ctx): the live demo
  demo.css   its styles, on top of the shared tokens and primitives
```

Each component is a new, production-shaped demo of one recipe from the [awards plugin](https://github.com/BurgiSimon/awards/tree/main/plugins/awards/recipes). The recipe is the principle (the verified mechanism, its numbers and its accessibility paths); the demo puts it in a real use case, in this library's theme, with controls.

## Quick start

```bash
npm run new -- logo-marquee --recipe marquee-raf-mask   # scaffold, pre-filled from the recipe
npm run dev                                             # http://localhost:5173/components/logo-marquee/
npm run check -- --only logo-marquee                    # meta, controls, deps, prompt
npm run smoke -- --only logo-marquee                    # headless: mount, options, actions, reduced motion, phone
npm run frames -- --only logo-marquee                   # capture the preview frames (both themes)
```

Read the recipe first: `README.md` (why it is built that way, its parameters, its accessibility notes) and `main.js` in the awards repository's `plugins/awards/recipes/<recipe>/`. Keep its mechanism and numbers unless the use case needs others; rewrite everything else.

## Design rules

These keep 96 demos reading as one library.

1. **One theme.** Every colour is a token from `src/styles/tokens.css` (`--bg`, `--surface`, `--ink`, `--ink-2`, `--muted`, `--line`, `--accent`, the content materials `--clay`, `--moss`, `--sky`, `--sand`, `--plum`, `--night`, and for copy on photographs `--on-media`, `--on-media-2`, `--media-scrim`, which stay light in both themes). `data-theme="dark"` or `"light"` on any element re-themes that subtree, for a dark band on a light page. No hex values in `demo.css` except inside a gradient built from tokens with `color-mix()`. Canvas and WebGL code read tokens with `readToken('--accent')`.
2. **One type system.** Mona Sans for everything (its width axis gives the display voice: `font-stretch: var(--wide)`), JetBrains Mono for labels and numbers. Use the primitives `.ac-display`, `.ac-h1`, `.ac-h2`, `.ac-h3`, `.ac-lede`, `.ac-body`, `.ac-label`, `.ac-small`. An editorial demo may opt into Bodoni Moda with `import '../../src/demo-kit/serif.css'` and `var(--font-serif)`.
3. **Shared primitives.** `.ac-wrap`, `.ac-section`, `.ac-btn` (`--accent`, `--ghost`, `--sm`, `--lg`), `.ac-chip`, `.ac-input`, `.ac-card`, `.ac-bar` + `.ac-brand`, `.ac-media`, `.ac-link`, `.ac-kbd` — all in `src/demo-kit/base.css`.
4. **A real use case.** The demo is a section of a believable site, not a diagram of the technique. Use the cast in `src/demo-kit/content.js`: Halden (architecture studio), Ostra (ceramics shop), Fieldnote (magazine), Kova (speaker), Signal (festival), Parallel (banking app). Extend it there when you need more.
5. **Real pictures.** `photo(id)`, `photos({ tags, count, seed, exclude })`, `image()` / `imageHTML()` from `src/demo-kit/media.js` give credited public-domain pictures (`src/demo-kit/media.json`, `CREDITS.md`). Unknown ids fall back to drawn colour fields, so a demo never breaks. The component page credits every picture a demo used.
6. **One signature move.** The recipe's move is the point; everything around it is calm, well-set content.
7. **The first screen is the thumbnail.** Frames are captured at 1280 × 800 after the demo is ready. Compose the first viewport so it tells the story on its own; use `meta.preview.capture` to scroll, point or trigger an action first.
8. **Both themes and the phone.** Check light, dark and 390 px. Nothing may scroll sideways on a phone (`smoke` fails it).
9. **Copy.** Specific and plain. Never "elevate", "seamless", "unlock", "Get started", "Learn more" (`check` rejects the reflex list in `summary` and `prompt.brief`).

## meta.js

Plain data with no imports: Node scripts, the shell and the play runtime all read it.

| Field | Required | What it is |
|---|---|---|
| `id` | yes | Equals the folder name. Lowercase slug. |
| `title` | yes | ≤ 48 characters, sentence case: "Logo marquee". |
| `category` | yes | An id from `src/registry/categories.js`. |
| `summary` | yes | 30–190 characters: what a visitor sees and does. Shown on cards, the hover preview and as the page description. |
| `description` | no | Longer prose for the Overview tab; paragraphs split on blank lines. |
| `recipe` | yes | The awards recipe id. `recipes: [...]` adds more. |
| `deps` | yes | The libraries `demo.js` imports (`gsap`, `lenis`, `three`, `ogl`, `postprocessing`, `matter-js`, `animejs`, `@unseenco/taxi`). `check` compares it with the real imports, counting what demo-kit helpers pull in (`gsap.js` → gsap; `lenis.js` → lenis + gsap; `three.js` → three). |
| `tags` | yes | Free words for search; prefer the awards vocabulary (`scroll`, `pointer`, `marquee`, `webgl` …). `canvas` and `webgl` also set the tech label. |
| `added` | yes | `YYYY-MM-DD`. A component added after `site.launch` gets the **New** label for `site.newForDays` days. |
| `updated` | no | `YYYY-MM-DD` of a meaningful change → **Updated** label for `site.updatedForDays` days. |
| `changelog` | no | `[{ date, note }]`, listed on the changelog page. |
| `featured` | no | `true` puts it on the welcome page and at the front of the wall. |
| `order` | no | Sort key inside its category (default 50; lower first). |
| `status` | no | `'experimental'` adds a label. |
| `labels` | no | Extra label kinds from `src/registry/labels.js`. |
| `requires` | no | Browser features from `src/registry/features.js` (`webgl`, `webgl2`, `view-transitions`, `scroll-timeline`, `offscreen-canvas`, `web-audio`, `field-sizing`). The page warns visitors whose browser lacks one. |
| `theme` | no | `'dark'` or `'light'` locks the demo to one theme (one frame pair, theme toggles ignored). Default follows the site. |
| `preview` | no | `{ height, scroll, hint, capture, remountOnTheme }`. `height` 320–1200 (default 600). `scroll: true` shows "Scroll inside the preview". `hint` is a short instruction ("Drag the divider"). `capture: { wait, scroll, pointer: [x, y], hover, action, tier }` sets the frame's moment. `remountOnTheme: true` re-mounts on a theme change instead of calling `ctx.onTheme` listeners. |
| `useCases` | yes (2+) | Where it fits, one line each. |
| `notes` | yes (2+) | Accessibility and motion paths, one line each. |
| `controls` | no | The tweak panel; see below. |
| `actions` | no | `[{ id, label, icon? }]` buttons in the toolbar and panel (Replay, Open the menu, Add to bag). `demo.js` handles them in `action(id)`. |
| `prompt` | yes | See [The prompt](#the-prompt). |

## Controls

```js
controls: [
  { id: 'speed', label: 'Speed', type: 'range', min: 10, max: 220, step: 5, default: 70, unit: 'px/s', group: 'Motion',
    help: 'Shown under the control.', prompt: 'Base speed: {value} (default {default})' },
  { id: 'direction', label: 'Direction', type: 'select', options: [{ value: 'left', label: '← Left' }, { value: 'right', label: 'Right →' }], default: 'left' },
  { id: 'pause', label: 'Pause on hover', type: 'toggle', default: true, prompt: { on: 'Pause on hover and focus', off: 'Keep moving on hover' } },
  { id: 'accent', label: 'Colour', type: 'color', default: 'accent' },            // token swatches; options: [...] to narrow
  { id: 'headline', label: 'Headline', type: 'text', default: 'We design spaces', maxLength: 40 },
  { id: 'interval', label: 'Interval', type: 'range', min: 0.6, max: 4, step: 0.1, default: 1.8, unit: 's', when: { mode: ['reel', 'typed'] } },
]
```

- **Pick the three to seven values that change the feel**: speed, distance, stiffness, a variant, a colour. Not every recipe constant deserves a slider. A component with nothing worth tuning has no controls; the panel says so.
- **Units**: `%`, `×` and `°` attach to the number; anything else gets a space (`70 px/s`, `0.6 s`).
- `group` adds a section heading in the panel. `when` shows a control only while another matches.
- **Prompt lines**: only changed values reach the prompt. `prompt` is a template (`{label}`, `{value}`, `{default}`; without `{default}` the default is appended), a toggle's `{ on, off }`, a function `(value, control) => string`, or `false` for demo-only aids (a field overlay, a debug readout).
- Ids are camelCase and must not be `c`, `theme`, `motion`, `embed`, `capture`, `tier`, `viewport` or `frame` (URL parameters of the preview).
- Values live in the URL (`?speed=120&pause=0`), so a link shares a setup.

## demo.js

```js
import './demo.css';
import { on, onFrame, html, photos, content } from '../../src/demo-kit/index.js';
import { useGsap } from '../../src/demo-kit/gsap.js';     // only if you use GSAP
import { useLenis } from '../../src/demo-kit/lenis.js';   // only for page-like scroll demos

export default function mount(root, options, ctx) {
  root.className = 'lm';
  root.innerHTML = html`<section class="ac-wrap">…</section>`;
  let cfg = { ...options };
  // … build, then:
  return {
    update(next, changed) { cfg = { ...next }; /* apply live */ },  // return false to ask for a re-mount
    action(id) { if (id === 'replay') replay(); },
  };
}
```

**`ctx`** — `{ id, meta, motion, theme, signal, onCleanup(fn), onTheme(fn), capture, embedded, emit(type, data) }`.

- `motion` is `'full' | 'reduced' | 'static'`. Full: the authored motion. Reduced: no spatial movement (opacity, colour and state changes stay). Static: everything settled at once. The preview toolbar can force reduced; the runtime re-mounts on a change and writes `data-motion` on `<html>` for CSS.
- `signal` aborts on unmount: pass it to every `addEventListener` (`on(ctx, target, type, fn)` does).
- `onCleanup(fn)` runs on unmount, in reverse order.
- `onTheme(fn)` is called on a light/dark change. CSS custom properties update by themselves; canvas and WebGL code re-read tokens here (or set `preview.remountOnTheme`).
- `capture` is true while `scripts/frames.mjs` takes the thumbnail: hide instructions that only make sense live, and hold a representative moment instead of relying on pointer timing (under headless SwiftShader a pointer move can take seconds, so a short-lived trail or wake may be gone before the shot). Set the state the frame should show when `ctx.capture` is true. Headless clocks also run slow (a few frames per second under load), so step simulations such as physics or particles ahead synchronously in capture mode, and give any wait on a WAAPI `finished` promise a timer fallback.

**The returned instance** (all optional): `update(options, changedIds)` applies values live (return `false` to have the runtime re-mount, debounced); `action(id)` runs a `meta.actions` entry; `destroy()` for extra teardown.

**Lifecycle helpers** — `src/demo-kit/`:

| Helper | From | Does |
|---|---|---|
| `on(ctx, target, type, fn, opts)` | `index.js` | Listener removed on unmount |
| `onFrame(ctx, fn(dt, t))` | `index.js` | Shared ticker subscription; returns an unsubscribe |
| `whileVisible(ctx, el, start, stop)` | `index.js` | Run only while on screen |
| `observeResize`, `observeIntersection`, `later`, `every` | `index.js` | Observers and timers torn down on unmount |
| `damp`, `lerp`, `clamp`, `mapRange`, `smoothstep` | `index.js` | Framerate-independent maths |
| `finePointer()`, `motionTier()` | `index.js` | Pointer-follow effects only for fine pointers with hover |
| `qualityTier()` | `index.js` | One-time device probe → `{ name, dpr, pixels, particles }` |
| `webglAvailable()`, `webgl2Available()` | `index.js` | Feature checks without loading a GL library (also re-exported by `three.js`) |
| `html`, `raw`, `escapeHTML` | `index.js` | Escaping template tag; nested `html` results pass through, trusted markup needs `raw()` |
| `colour(value)`, `readToken(name)` | `index.js` | A colour control's value → CSS; a token's computed value |
| `photo`, `photos`, `image`, `imageHTML`, `loadImage`, `art`, `videos` | `index.js` | The shared picture set |
| `content` | `index.js` | The fictional cast |
| `useGsap(ctx, scope, setup?)` | `gsap.js` | A `gsap.context` reverted on unmount (kills tweens and ScrollTriggers) |
| `useLenis(ctx, opts)` | `lenis.js` | Lenis on GSAP's ticker, wired to ScrollTrigger; `null` unless motion is full |
| `useRenderer(ctx, host, opts)` | `three.js` | Sized `WebGLRenderer` with capped DPR, disposed and context-lost on unmount (`detached: true` keeps the canvas off the page); `disposeScene(root)` |
| `textureFrom(ctx, item, { small, maxSize })` | `three.js` | An sRGB texture from a media item, drawn stand-ins included, disposed on unmount |

**Rules the runtime relies on**

- The demo owns the frame: window scroll, the cursor and the viewport are its own. Everything it starts must stop through `ctx` (the runtime also removes nodes appended to `<body>` and restores attributes on `<html>` and `<body>`).
- Respect every path the recipe has: keyboard, coarse pointer, reduced motion, no WebGL. A WebGL demo must render something without WebGL (a drawn still or a DOM version).
- Don't burn frames off-screen or at rest: stop the ticker when nothing moves, gate canvas loops with `whileVisible`.
- Tweens and ScrollTriggers created after `useGsap` returns (in a promise callback, a rebuild after `update()`) are only reverted on unmount when made inside `context.add(() => { … })`.
- Mount synchronously and arm heavy work afterwards (frames to render, textures to load): the runtime reports ready when `mount()` resolves, and the frame and smoke scripts wait at most 30 s.
- Make the page's final height known before `useLenis`, or call `ScrollTrigger.refresh()` after changing it; Lenis re-measures on every refresh.
- Storage access goes inside `try { } catch { }`.
- Focus moved by script shows a ring only when the visitor is using the keyboard: call `el.focus({ focusVisible: false })` unless the opener was pressed with a key (`event.detail === 0` on a click).
- Don't move focus from `action(id)`: actions are pressed in the shell's toolbar, and a `focus()` inside the frame pulls the visitor out of it. Move focus only from the demo's own controls (a menu button opening its menu).
- Real elements: links are `<a href>`, actions are `<button>`, disclosures have `aria-expanded`, decorative canvases are `aria-hidden`.

## demo.css

Scope everything under the class you give `root` (short: `.lm` for logo-marquee). The runtime loads fonts, tokens and the demo-kit base first. Use tokens for every colour. Key CSS-only motion off `:root[data-motion='reduced']`.

## The prompt

```js
prompt: {
  skill: 'component',                                    // or 'motion', 'webgl', 'stack', 'craft'
  ask: 'Add a looping marquee to {target}.',             // one imperative sentence with the {target} slot
  target: 'the client logos under the hero',             // shown as [placeholder] until the visitor names theirs
  brief: 'Items drift sideways in an endless loop …',    // the behaviour to rebuild, with the numbers that matter
  keep: ['one readable list for assistive tech …'],      // what must survive the adaptation
}
```

The prompt names the skill command (`/awards:component` in Claude Code, `$awards:component` in Codex), the recipe id, the brief, every changed control as a sentence, the keep-lines and a link back to the exact setup. Write the brief as you would brief a senior developer who has the recipe open: behaviour, feel, the one or two numbers that define it. Use `webgl` for GL-first components, `motion` for motion-policy and easing foundations, `stack` for boot and scroll infrastructure.

## Labels, dates and the changelog

- `added` sets **New** automatically for components added after launch; nothing to remove later.
- Bump `updated` and add a `changelog` entry when a demo changes meaningfully.
- **WebGL** and **CSS only** come from `deps` and `tags`.
- A new label kind is one entry in `src/registry/labels.js`; a new category one entry in `src/registry/categories.js` (with an icon from `src/app/icons.js`); a new browser feature one entry in `src/registry/features.js`.

## Verification

- `npm run check` — every meta field and vocabulary, controls (valid defaults, units, `when`), declared libraries against the real imports, the prompt for every control at a non-default value, frames, and which awards recipes are not covered yet. Runs before every build; `--strict` turns missing frames and uncovered recipes into errors.
- `npm run smoke` — headless Chromium with SwiftShader WebGL: mounts each demo, changes every control, runs every action, scrolls, re-mounts, then loads it under reduced motion, on a dark 390 px touch phone (coarse pointer) and, for WebGL demos, with WebGL off (`?nogl`, which also works in the browser to look at the fallback). Fails on page errors, console errors, a demo that never becomes ready and sideways scroll on the phone. Report in `.ac/smoke.json`.
- `npm run frames` — captures `public/frames/<id>-<theme>.webp` (960 × 600) and `-sm.webp` (480 × 300). Re-run when a demo's look changes.

SwiftShader proves a demo correct, not fast: check WebGL work on a real device.

## When the awards plugin adds recipes

```bash
npm run sync-recipes -- --awards ../awards   # refresh src/registry/recipes.json
npm run check                                # lists the recipes no component covers yet
npm run new -- <id> --recipe <new-recipe>
```
