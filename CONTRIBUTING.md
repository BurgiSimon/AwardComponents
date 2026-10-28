# Contributing

Thanks for adding to the library. The full guide is [docs/authoring.md](docs/authoring.md); this is the checklist.

1. Pick an awards recipe (`npm run check` lists the ones no component covers yet) or a new use case for one that is covered.
2. `npm run new -- <id> --recipe <recipe-id>` and write `meta.js`, `demo.js`, `demo.css`.
3. Keep to the theme: tokens for colour, the demo-kit primitives for type and controls, the content cast and the shared pictures.
4. Give it every path: keyboard, touch, reduced motion, and a no-WebGL still for GL demos.
5. Choose three to seven controls that change the feel, and write prompt lines for them.
6. `npm run check -- --only <id>`, `npm run smoke -- --only <id>`, `npm run frames -- --only <id>`.
7. Look at it in light, dark and at 390 px wide before opening a pull request.

Commit the component folder and its four frames in `public/frames/`.
