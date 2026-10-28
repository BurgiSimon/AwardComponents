# AwardComponents

A component library of award-league web moves — scroll set-pieces, cursors, loaders, menus, galleries, WebGL surfaces — rebuilt from the recipes of the [awards plugin](https://github.com/BurgiSimon/awards) for Claude Code and Codex.

Every component has:

- **a live demo** in a real use case (a studio's contact section, a shop's bag, a magazine's long read), all in one theme, light and dark;
- **controls** for the values that change its feel, with the setup kept in the URL;
- **a prompt** that rebuilds it inside your own project with the awards plugin, naming the recipe and only the settings you changed.

The recipes are the principle (verified in a real browser, with keyboard, touch and reduced-motion paths); the demos here are new, production-shaped applications of them.

## Use a prompt

1. Install the awards plugin once:
   - Claude Code: `/plugin marketplace add burgisimon/awards`, then `/plugin install awards@awards`
   - Codex: `codex plugin marketplace add burgisimon/awards`, then `codex plugin add awards@awards`
2. Open a component, tune it, optionally name where it goes, and copy the prompt.
3. Paste it into a session started in your project's folder.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # check, then dist/ with one HTML file per route
npm run preview
```

Node 22.12+ or 24. `BASE_PATH=/AwardComponents/` builds for a GitHub project page; `SITE_URL=https://…/` adds canonicals, Open Graph URLs and a sitemap.

## How it is checked

- `npm run check` validates every component's meta, controls, declared libraries against the demo's real imports and its prompt, and reports which awards recipes no component covers yet (all 96 are covered).
- `npm run smoke` runs every demo in headless Chromium: mount, every control changed, every action, scroll, re-mount, reduced motion, a 390 px touch phone and, for WebGL demos, WebGL switched off.
- The shell is axe-core clean (WCAG 2.2 A/AA) on every page in both themes.

## Add a component

One folder, three files, no registration: see **[docs/authoring.md](docs/authoring.md)**.

```bash
npm run new -- <id> --recipe <awards-recipe-id>
npm run check -- --only <id>
npm run smoke -- --only <id>
npm run frames -- --only <id>
```

## How it is built

- `index.html` + `src/app/` — the library shell: a small history router, the sidebar with hover previews, the welcome, browse, component, docs and changelog pages, the ⌘K palette, the preview frame, the tweak panel and the prompt panel. Vanilla JavaScript; no framework.
- `play.html` + `src/play/runtime.js` — the demo runtime. The shell shows each demo in an iframe, so a demo can own the scroll, the cursor or a WebGL context, and leaving the page ends it. Controls talk to it by `postMessage`; nothing reloads on a tweak.
- `components/<id>/` — `meta.js` (data), `demo.js` (`mount(root, options, ctx)`), `demo.css`.
- `src/demo-kit/` — what demos share: the base styles and primitives, the ticker and damping maths, motion tiers, lifecycle helpers, GSAP / Lenis / three.js wrappers that clean up after themselves, the fictional content cast and the picture set.
- `src/registry/` — categories, labels, browser features, site settings, the options model and the prompt builder; `recipes.json` is a snapshot of the awards recipes (`npm run sync-recipes`).
- `scripts/` — `check`, `smoke`, `frames`, `shot`, `new-component`, `sync-recipes`, `media`, `og`, and the Vite plugins (light component index, demo sources, route files).
- `public/frames/` — captured previews (both themes, two sizes) used by cards, the hover preview, the palette and as the demo's poster while it loads. Only the open component runs live, so the library stays light with a hundred components.

## Credits and licence

MIT ([LICENSE](LICENSE)). Demo pictures are public-domain or CC0 works from open collections, listed in [CREDITS.md](CREDITS.md) and credited on each component page. Fonts: Mona Sans, JetBrains Mono and Bodoni Moda, all under the SIL Open Font License, installed from Fontsource.
