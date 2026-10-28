// The shell's entry: theme, layout, routes.
import '../styles/fonts.css';
import '../styles/tokens.css';
import '../styles/app.css';
import { initTheme } from './theme.js';
import { initFrameSwap } from './frames.js';
import { mountShell } from './layout.js';
import { startRouter } from './router.js';
import welcome from './pages/welcome.js';
import browse from './pages/browse.js';
import component from './pages/component.js';
import docs from './pages/docs.js';
import changelog from './pages/changelog.js';
import notFound from './pages/not-found.js';

initTheme();
initFrameSwap();

const shell = mountShell(document.getElementById('app'));

startRouter(
  [
    [/^\/$/, welcome],
    [/^\/components\/?$/, browse],
    [/^\/components\/([a-z0-9-]+)\/?$/, ({ params, query }) => component({ params, query })],
    [/^\/docs\/?$/, docs],
    [/^\/changelog\/?$/, changelog],
    [/^\/404$/, notFound],
  ],
  (result, info) => {
    shell.render(result, info);
    if (!info.initial) result.node.querySelector('h1')?.focus({ preventScroll: true });
  },
);
