# CLAUDE.md

Guidance for Claude Code (and other agents) working in this repository.

## What this is

AwardComponents: the home of the awards plugin and of its component library, one site (Vite, vanilla JavaScript). The plugin side (home, docs, recipes, showcase, release notes) prints facts read from the awards repository (`../awards` when it is checked out beside this one; https://github.com/BurgiSimon/awards). The library side holds components that are new, production-shaped demos of the plugin's recipes (`../awards/plugins/awards/recipes/`); each has a live demo, controls, and a prompt for `/awards:<skill>`.

## Commands

```bash
npm run dev                                   # shell + demos with HMR
npm run check [-- --only id,id] [--strict]    # validate component metas (runs before build)
npm run smoke [-- --only id,id]               # headless Chromium: mount, options, actions, reduced motion, phone
npm run frames [-- --only id,id] [--missing]  # capture preview frames into public/frames/
npm run new -- <id> --recipe <recipe-id>      # scaffold a component
npm run shot -- <id> [--size 800x620] [--theme dark] [--steps "scroll:0.5,action:open"] [--params "k=v"]   # screenshot one demo
npm run sync-recipes -- --awards ../awards    # refresh src/registry/recipes.json
npm run sync-plugin -- --awards ../awards     # refresh src/registry/plugin.json + plugin-ref.json and copy showcase frames
npm run builds -- --awards ../awards [--only id] [--force]   # capture showcase first screens into public/builds/
npm run media [-- --only id] [--force]        # rebuild the shared photo set and CREDITS.md from scripts/data/media-sources.json
npm run og                                    # redraw public/og.png from the frames
npm run build                                 # check + vite build + per-route HTML
```

`play.html?c=<id>&nogl` shows a WebGL demo's no-WebGL path; smoke loads every GL demo that way.

Playwright is pinned in package.json; `scripts/lib/browser.mjs` falls back to `AC_CHROMIUM` or a preinstalled Chromium when Playwright's own browser build is missing.

## Adding or changing a component

Read `docs/authoring.md` first; it is the contract. In short:

- One folder `components/<id>/` with `meta.js` (plain data, no imports), `demo.js` (`export default function mount(root, options, ctx)`), `demo.css`. Nothing else is registered by hand.
- Stage the move, not a site: the component alone on `.ac-stage`, or with only the content it acts on; a page only when the move is the page. No nav bar, eyebrow, lede or footer for their own sake (authoring rule 4).
- Colours are tokens (`src/styles/tokens.css`); type and primitives come from `src/demo-kit/base.css`; content from `src/demo-kit/content.js`; pictures from `src/demo-kit/media.js`.
- Everything a demo starts stops through `ctx` (`ctx.signal`, `ctx.onCleanup`, `useGsap`, `useLenis`, `useRenderer`, `onFrame`).
- Every motion has a reduced path (`ctx.motion`), pointer effects only for fine pointers, WebGL demos have a no-WebGL still.
- `meta.deps` must equal what `demo.js` imports; `check` enforces it.
- Run `check`, `smoke` and `frames` for the component before committing.

## Conventions

- Do not edit `src/registry/recipes.json`, `plugin.json` or `plugin-ref.json` by hand (generated), or files in `public/frames/` and `public/builds/` (captured).
- The plugin pages take counts, commands, skills, rules, jury terms and verdicts from `plugin.json` / `plugin-ref.json`, never typed in; the prose that explains them is authored in the page. A docs page is an entry in `src/registry/docs.js` plus a renderer in `src/app/pages/docs/`; `scripts/lib/routes.js` writes its HTML file from the same list.
- Showcase builds are named in `scripts/data/builds.js`; their verdicts, scores, fixes and memory sentences are read by `sync-plugin` from each build's `AWARDS.md` and `.awards/jury/`.
- Shell code lives in `src/app/` (the plugin pages' styles in `src/styles/plugin.css`); shared demo code in `src/demo-kit/`; the options model, prompt builder and docs list in `src/registry/` (pure, also imported by Node scripts).
- No model identifiers in code, docs or commit messages.
- Copy is plain and specific; the awards reflex list (elevate, seamless, unlock, "Get started", "Learn more" …) is rejected by `check`.
