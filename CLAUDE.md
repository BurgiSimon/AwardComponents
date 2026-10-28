# CLAUDE.md

Guidance for Claude Code (and other agents) working in this repository.

## What this is

AwardComponents: a component library site (Vite, vanilla JavaScript) whose components are new, production-shaped demos of the recipes in the awards plugin (`../awards/plugins/awards/recipes/` when the awards repository is checked out beside this one; https://github.com/BurgiSimon/awards). Each component has a live demo, controls, and a prompt for `/awards:<skill>`.

## Commands

```bash
npm run dev                                   # shell + demos with HMR
npm run check [-- --only id,id] [--strict]    # validate component metas (runs before build)
npm run smoke [-- --only id,id]               # headless Chromium: mount, options, actions, reduced motion, phone
npm run frames [-- --only id,id] [--missing]  # capture preview frames into public/frames/
npm run new -- <id> --recipe <recipe-id>      # scaffold a component
npm run sync-recipes -- --awards ../awards    # refresh src/registry/recipes.json
npm run build                                 # check + vite build + per-route HTML
```

Playwright is pinned in package.json; `scripts/lib/browser.mjs` falls back to `AC_CHROMIUM` or a preinstalled Chromium when Playwright's own browser build is missing.

## Adding or changing a component

Read `docs/authoring.md` first; it is the contract. In short:

- One folder `components/<id>/` with `meta.js` (plain data, no imports), `demo.js` (`export default function mount(root, options, ctx)`), `demo.css`. Nothing else is registered by hand.
- Colours are tokens (`src/styles/tokens.css`); type and primitives come from `src/demo-kit/base.css`; content from `src/demo-kit/content.js`; pictures from `src/demo-kit/media.js`.
- Everything a demo starts stops through `ctx` (`ctx.signal`, `ctx.onCleanup`, `useGsap`, `useLenis`, `useRenderer`, `onFrame`).
- Every motion has a reduced path (`ctx.motion`), pointer effects only for fine pointers, WebGL demos have a no-WebGL still.
- `meta.deps` must equal what `demo.js` imports; `check` enforces it.
- Run `check`, `smoke` and `frames` for the component before committing.

## Conventions

- Do not edit `src/registry/recipes.json` by hand (generated) or files in `public/frames/` (captured).
- Shell code lives in `src/app/`; shared demo code in `src/demo-kit/`; the options model and prompt builder in `src/registry/` (pure, also imported by Node scripts).
- No model identifiers in code, docs or commit messages.
- Copy is plain and specific; the awards reflex list (elevate, seamless, unlock, "Get started", "Learn more" …) is rejected by `check`.
