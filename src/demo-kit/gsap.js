// GSAP inside a demo frame: one gsap.context per mount, reverted on cleanup, so every tween, timeline and
// ScrollTrigger the demo makes is killed and its inline styles removed before the next mount.
// Usage:  const { gsap, ScrollTrigger, ctx: g } = useGsap(ctx, root);  g.add(() => { ...tweens... });
//         or just create tweens inside useGsap(ctx, root, (gsap) => { ... }).
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function useGsap(ctx, scope, setup) {
  const g = gsap.context(() => { if (setup) setup(gsap, ScrollTrigger); }, scope);
  ctx.onCleanup(() => g.revert());
  return { gsap, ScrollTrigger, context: g };
}

export { gsap, ScrollTrigger };
