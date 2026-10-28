// The shell's entry: theme, layout, routes.
import '../styles/fonts.css';
import '../styles/tokens.css';
import '../styles/app.css';
import { initTheme } from './theme.js';
import { initFrameSwap } from './frames.js';
import { mountShell } from './layout.js';
import { startRouter } from './router.js';
import { initToast } from './ui/toast.js';
import welcome from './pages/welcome.js';
import browse from './pages/browse.js';
import component from './pages/component.js';
import notFound from './pages/not-found.js';

initTheme();
initFrameSwap();

const shell = mountShell(document.getElementById('app'));
initToast();

startRouter(
  [
    [/^\/$/, welcome],
    [/^\/components\/?$/, browse],
    [/^\/components\/([a-z0-9-]+)\/?$/, ({ params, query }) => component({ params, query })],
    [/^\/docs\/?$/, (ctx) => import('./pages/docs.js').then((m) => m.default(ctx))],
    [/^\/changelog\/?$/, (ctx) => import('./pages/changelog.js').then((m) => m.default(ctx))],
    [/^\/404$/, notFound],
  ],
  (result, info) => {
    shell.render(result, info);
    if (!info.initial) result.node.querySelector('h1')?.focus({ preventScroll: true });
  },
);
