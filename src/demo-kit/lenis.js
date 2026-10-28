// Smooth scroll for page-like demos: Lenis driven by GSAP's ticker (Lenis 1.3 defaults to autoRaf: false; a Lenis
// without a clock swallows wheel events and the page looks frozen), wired to ScrollTrigger, destroyed on cleanup.
// Skipped under reduced motion and static: native scroll is the reduced path.
import Lenis from 'lenis';
import { gsap, ScrollTrigger } from './gsap.js';

export function useLenis(ctx, options = {}) {
  if (ctx.motion !== 'full') return null;
  const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, ...options, autoRaf: false });
  const raf = (time) => lenis.raf(time * 1000);
  gsap.ticker.add(raf);
  gsap.ticker.lagSmoothing(0);
  lenis.on('scroll', ScrollTrigger.update);
  // Sections that grow after Lenis measured the page (a rail or a tunnel sized in script) would cap the scroll at
  // the old height: re-measure whenever ScrollTrigger refreshes.
  const remeasure = () => lenis.resize();
  ScrollTrigger.addEventListener('refresh', remeasure);
  window.lenis = lenis;
  ctx.onCleanup(() => {
    ScrollTrigger.removeEventListener('refresh', remeasure);
    gsap.ticker.remove(raf);
    lenis.destroy();
    if (window.lenis === lenis) delete window.lenis;
  });
  return lenis;
}
