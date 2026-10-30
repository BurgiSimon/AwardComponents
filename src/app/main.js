// The shell's entry: theme, layout, routes.
import '../styles/fonts.css';
import '../styles/tokens.css';
import '../styles/app.css';
import '../styles/plugin.css';
import { initTheme } from './theme.js';
import { initFrameSwap } from './frames.js';
import { mountShell } from './layout.js';
import { startRouter } from './router.js';
import { initToast } from './ui/toast.js';
import browse from './pages/browse.js';
import component from './pages/component.js';
import notFound from './pages/not-found.js';

initTheme();
initFrameSwap();

const shell = mountShell(document.getElementById('app'));
initToast();

startRouter(
  [
    // The site's home: the awards plugin and this library together.
    [/^\/$/, (ctx) => import('./pages/home.js').then((m) => m.default(ctx))],
    // The component library.
    [/^\/library\/?$/, (ctx) => import('./pages/welcome.js').then((m) => m.default(ctx))],
    [/^\/components\/?$/, browse],
    [/^\/components\/([a-z0-9-]+)\/?$/, ({ params, query }) => component({ params, query })],
    // The plugin: recipes, the builds it made, the docs.
    [/^\/recipes\/?$/, (ctx) => import('./pages/recipes.js').then((m) => m.default(ctx))],
    [/^\/showcase\/?$/, (ctx) => import('./pages/showcase.js').then((m) => m.default(ctx))],
    [/^\/showcase\/([a-z0-9-]+)\/?$/, (ctx) => import('./pages/showcase.js').then((m) => m.build(ctx))],
    [/^\/docs\/?$/, (ctx) => import('./pages/docs/index.js').then((m) => m.default({ ...ctx, params: [''] }))],
    [/^\/docs\/skills\/([a-z]+)\/?$/, (ctx) => import('./pages/docs/index.js').then((m) => m.skill(ctx))],
    [/^\/docs\/([a-z-]+)\/?$/, (ctx) => import('./pages/docs/index.js').then((m) => m.default(ctx))],
    [/^\/changelog\/?$/, (ctx) => import('./pages/changelog.js').then((m) => m.default(ctx))],
    [/^\/404$/, notFound],
  ],
  (result, info) => {
    shell.render(result, info);
    if (!info.initial) result.node.querySelector('h1')?.focus({ preventScroll: true });
  },
);
