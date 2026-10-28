// three.js inside a demo frame: a renderer sized to its element, capped DPR from the quality tier, colour
// management left at three's defaults (sRGB output), and a teardown that disposes the scene and drops the context.
// Custom ShaderMaterials must include <colorspace_fragment>, or sRGB textures render dark.
import * as THREE from 'three';
import { qualityTier } from './quality.js';
import { observeResize } from './lifecycle.js';

export { webglAvailable, webgl2Available } from './gl.js';

// useRenderer(ctx, host, options) → { renderer, canvas, size, onResize(fn), tier }
// host: the element the canvas fills (positioned by the demo's CSS). The canvas is appended to it, unless
// options.detached is true (host may then be null). Other options: alpha, antialias, dprCap, preserveDrawingBuffer.
export function useRenderer(ctx, host, options = {}) {
  const tier = qualityTier();
  const renderer = new THREE.WebGLRenderer({
    antialias: options.antialias ?? tier.name !== 'low',
    alpha: options.alpha ?? true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: options.preserveDrawingBuffer ?? false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, options.dprCap ?? tier.dpr));
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  // detached: the canvas stays off the page (one renderer drawing into many 2D canvases); size it with setSize.
  if (!options.detached) host.appendChild(canvas);

  const size = { width: 1, height: 1 };
  const listeners = new Set();
  const measure = () => {
    if (options.detached) return;
    const r = host.getBoundingClientRect();
    size.width = Math.max(1, Math.round(r.width));
    size.height = Math.max(1, Math.round(r.height));
    renderer.setSize(size.width, size.height, false);
    for (const fn of listeners) fn(size);
  };
  measure();
  if (!options.detached) observeResize(ctx, host, measure);

  ctx.onCleanup(() => {
    renderer.setAnimationLoop(null);
    renderer.renderLists.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  });

  return {
    THREE,
    renderer,
    canvas,
    size,
    tier,
    onResize(fn) { listeners.add(fn); fn(size); return () => listeners.delete(fn); },
  };
}

// Dispose everything a scene holds (geometries, materials, textures). Call from ctx.onCleanup.
export function disposeScene(root) {
  root.traverse((obj) => {
    obj.geometry?.dispose?.();
    const mats = [].concat(obj.material || []);
    for (const m of mats) {
      for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
      m.dispose?.();
    }
  });
}

// A texture from a media item (photo() / photos()), drawn stand-ins included: an SVG data URL fed straight to
// three.js renders black, so every source is drawn into a 2D canvas first. sRGB, mipmapped, disposed on cleanup.
// textureFrom(ctx, item, { small, maxSize }) → Promise<THREE.Texture>
export async function textureFrom(ctx, item, { small = false, maxSize = 2048 } = {}) {
  const img = new Image();
  img.decoding = 'async';
  img.crossOrigin = 'anonymous';
  img.src = small ? item.srcSm || item.src : item.src;
  await img.decode().catch(() => {});
  const w0 = img.naturalWidth || item.width || 1200;
  const h0 = img.naturalHeight || item.height || 1500;
  const k = Math.min(1, maxSize / Math.max(w0, h0));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w0 * k));
  canvas.height = Math.max(1, Math.round(h0 * k));
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.userData.aspect = canvas.width / canvas.height;
  ctx.onCleanup(() => texture.dispose());
  return texture;
}

export { THREE };
