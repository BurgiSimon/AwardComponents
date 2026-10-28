// The demo kit's light half: everything a demo may import without pulling a library in.
// Heavy helpers live in their own modules: './gsap.js', './lenis.js', './three.js'.
export { ticker, lerp, damp, clamp, mapRange, smoothstep } from './ticker.js';
export { motionTier, fullMotion, finePointer } from './motion.js';
export { onFrame, on, observeIntersection, observeResize, later, every, whileVisible } from './lifecycle.js';
export { photo, photos, image, imageHTML, loadImage, art, allPhotos, videos } from './media.js';
export { qualityTier } from './quality.js';
export { colour, readToken, escapeHTML, html, raw } from './util.js';
export * as content from './content.js';
export { formatPrice } from './content.js';
