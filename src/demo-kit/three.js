// three.js inside a demo frame: a renderer sized to its element, capped DPR from the quality tier, colour
// management left at three's defaults (sRGB output), and a teardown that disposes the scene and drops the context.
// Custom ShaderMaterials must include <colorspace_fragment>, or sRGB textures render dark.
import * as THREE from 'three';
import { qualityTier } from './quality.js';
import { observeResize } from './lifecycle.js';

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

// useRenderer(ctx, host, options) → { renderer, canvas, size, onResize(fn), render(scene, camera) }
// host: the element the canvas fills (positioned by the demo's CSS). The canvas is appended to it.
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
  host.appendChild(canvas);

  const size = { width: 1, height: 1 };
  const listeners = new Set();
  const measure = () => {
    const r = host.getBoundingClientRect();
    size.width = Math.max(1, Math.round(r.width));
    size.height = Math.max(1, Math.round(r.height));
    renderer.setSize(size.width, size.height, false);
    for (const fn of listeners) fn(size);
  };
  measure();
  observeResize(ctx, host, measure);

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

export { THREE };
