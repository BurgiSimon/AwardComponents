// Motion tiers, never a blanket kill (same policy as the awards recipes):
//   full     the authored motion
//   reduced  no spatial movement; opacity, colour and state changes stay
//   static   everything settled on load
// The preview toolbar can force a tier; otherwise prefers-reduced-motion decides. The runtime writes the result to
// <html data-motion> and passes it to mount() as ctx.motion, and re-mounts the demo when it changes.
const mq = matchMedia('(prefers-reduced-motion: reduce)');

export function motionTier() {
  const forced = document.documentElement.dataset.motionForced;
  if (forced === 'full' || forced === 'reduced' || forced === 'static') return forced;
  return mq.matches ? 'reduced' : 'full';
}

export const fullMotion = () => motionTier() === 'full';

// Fine pointer with hover: the only place pointer-follow effects (magnetism, cursors, tilt, trails) switch on.
export const finePointer = () => matchMedia('(pointer: fine) and (hover: hover)').matches;
