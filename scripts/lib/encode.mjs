// Encode images to WebP inside Chromium (canvas.toBlob), so the repository needs no native image tooling.
// encodeWebp(page, pngBuffer, { width, quality }) → Buffer. `page` is any Playwright page (about:blank is fine).
export async function encodeWebp(page, input, { width = 0, height = 0, quality = 0.82, filter = '' } = {}) {
  const b64 = Buffer.from(input).toString('base64');
  const out = await page.evaluate(async ({ b64, width, height, quality, filter }) => {
    const blob = await (await fetch(`data:application/octet-stream;base64,${b64}`)).blob();
    const bitmap = await createImageBitmap(blob);
    let w = bitmap.width;
    let h = bitmap.height;
    if (width && w > width) { h = Math.round((h * width) / w); w = width; }
    if (height && h > height) { w = Math.round((w * height) / h); h = height; }
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    if (filter) ctx.filter = filter;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const webp = await canvas.convertToBlob({ type: 'image/webp', quality });
    const buf = new Uint8Array(await webp.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { data: btoa(s), w, h };
  }, { b64, width, height, quality, filter });
  return { buffer: Buffer.from(out.data, 'base64'), width: out.w, height: out.h };
}
