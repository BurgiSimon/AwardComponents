# AwardComponents

The home of the [awards plugin](https://github.com/BurgiSimon/awards) for Claude Code and Codex, and of the component library built from its recipes. One site for both:

- **The plugin** — what it is and how to install it, a multi-page docs section (install, a first build, the eleven skills with a page each, how a build runs, modes, project files, the jury, every audit rule, the corpus, scripts, hooks and settings, questions), the showcase of sites it built with every jury round, all of its recipes, and its release notes.
- **The library** — award-league web moves (scroll set-pieces, cursors, loaders, menus, galleries, WebGL surfaces) rebuilt from the plugin's recipes, each with a live demo, controls and a prompt.

Every component has:

- **a live demo** that stages the component on its own, or with only the content it acts on, using real names and pictures (a studio's contact disc, a shop's bag, a magazine's long read), all in one theme, light and dark;
- **controls** for the values that change its feel, with the setup kept in the URL;
- **a prompt** that rebuilds it inside your own project with the awards plugin, naming the recipe and only the settings you changed.

The recipes are the principle (verified in a real browser, with keyboard, touch and reduced-motion paths); the demos here are new, production-shaped applications of them.

## The pages

| Route | What it is |
|---|---|
| `/` | The home: the plugin's claim and install, a jury slip that steps through a real build's rounds, the two ways in (a whole site, one component), the nine phases, the jury's terms, the record of every build, the live component bench, what the plugin carries |
| `/docs/…` | The docs, one page per topic, with a page per skill under `/docs/skills/<id>/` |
| `/recipes/` | Every recipe in the plugin, grouped and filterable, each with the component built on it |
| `/showcase/`, `/showcase/<id>/` | The sites the plugin built, each with its first screen, the juror's memory sentence, a chart of its score and every round with the juror's fixes |
| `/library/` | The library's own front page |
| `/components/`, `/components/<id>/` | Browse, and one component's workbench |
| `/changelog/` | The plugin's release notes and the library's changes |

Everything the plugin pages print (counts, commands, skills, rules, jury terms, corpus rows, verdicts, release notes) is read from the awards repository by `npm run sync-plugin` into `src/registry/plugin.json` and `plugin-ref.json`, so the pages cannot drift from the plugin; re-run it when the plugin changes.

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

## Keeping the plugin pages current

```bash
npm run sync-plugin -- --awards ../awards    # skills, rules, jury, corpus, recipes, showcase records, release notes
npm run builds -- --awards ../awards         # first screens of showcase builds that have no frame yet (public/builds/)
npm run sync-recipes -- --awards ../awards   # the lean recipe snapshot the component pages use
```

## How it is checked

- `npm run check` validates every component's meta, controls, declared libraries against the demo's real imports and its prompt, and reports which awards recipes no component covers yet.
- `npm run smoke` runs every demo in headless Chromium: mount, every control changed, every action, scroll, re-mount, reduced motion, a 390 px touch phone and, for WebGL demos, WebGL switched off.
- The shell is axe-core clean (WCAG 2.2 A/AA) on every page in both themes, the plugin pages included, at desktop and phone widths.

## Add a component

One folder, three files, no registration: see **[docs/authoring.md](docs/authoring.md)**.

```bash
npm run new -- <id> --recipe <awards-recipe-id>
npm run check -- --only <id>
npm run smoke -- --only <id>
npm run frames -- --only <id>
```

## How it is built

- `index.html` + `src/app/` — the shell: a small history router, the sidebar with hover previews, the home, library, browse, component, recipes, showcase, docs (`src/app/pages/docs/`) and changelog pages, the ⌘K palette (components, docs, skills and builds), the preview frame, the tweak panel and the prompt panel. Vanilla JavaScript; no framework.
- `play.html` + `src/play/runtime.js` — the demo runtime. The shell shows each demo in an iframe, so a demo can own the scroll, the cursor or a WebGL context, and leaving the page ends it. Controls talk to it by `postMessage`; nothing reloads on a tweak.
- `components/<id>/` — `meta.js` (data), `demo.js` (`mount(root, options, ctx)`), `demo.css`.
- `src/demo-kit/` — what demos share: the base styles and primitives, the ticker and damping maths, motion tiers, lifecycle helpers, GSAP / Lenis / three.js wrappers that clean up after themselves, the fictional content cast and the picture set.
- `src/registry/` — categories, labels, browser features, site settings, the options model and the prompt builder, the docs' page list (`docs.js`); `recipes.json` is a snapshot of the awards recipes (`npm run sync-recipes`), `plugin.json` and `plugin-ref.json` a snapshot of the plugin itself (`npm run sync-plugin`).
- `scripts/` — `check`, `smoke`, `frames`, `shot`, `new-component`, `sync-recipes`, `sync-plugin`, `builds`, `media`, `og`, and the Vite plugins (light component index, demo sources, route files). `scripts/data/builds.js` names the showcase builds and says what each one is; everything else about them is read.
- `public/builds/` — the showcase builds' first screens (copied from the awards site, or captured by `npm run builds`).
- `public/frames/` — captured previews (both themes, two sizes) used by cards, the hover preview, the palette and as the demo's poster while it loads. Only the open component runs live, so the library stays light with a hundred components.

## Credits and licence

MIT ([LICENSE](LICENSE)). Demo pictures are public-domain or CC0 works from open collections, listed in [CREDITS.md](CREDITS.md) and credited on each component page. Fonts: Mona Sans, JetBrains Mono and Bodoni Moda, all under the SIL Open Font License, installed from Fontsource.
