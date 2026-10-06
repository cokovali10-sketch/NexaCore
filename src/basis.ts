// NEXA Core — basis.ts: загрузчик Basis Universal (опциональный, без веса в ядре).
// Basis-декодер (~100kb wasm) грузится ТОЛЬКО если: есть .ktx2/.basis И GPU сжал текстуры.
// Иначе — обычный .webp. Вызов: const tex = await loadTexture(gl, 'hero.{fmt}.ktx2').

import { detectCompressed, pickTextureUrl } from './ktx2.js';

declare const globalThis: any;

async function getBasisDecoder(): Promise<any> {
  if (globalThis.__nexaBasis) return globalThis.__nexaBasis;
  // Официальный transcoder из CDN (кешируется браузером, грузится один раз на сайт)
  const mod = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/basis_universal@1.0.0/basis_transcoder.js');
  await mod.default?.();
  globalThis.__nexaBasis = mod;
  return mod;
}

export async function loadTexture(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  baseUrl: string,
): Promise<{ texture: WebGLTexture; width: number; height: number; compressed: boolean }> {
  const fmt = detectCompressed(gl as any);
  const url = pickTextureUrl(baseUrl, fmt);
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  if (fmt === 'none' || url.endsWith('.webp') || url.endsWith('.png')) {
    const img = await (async () => {
      const r = await fetch(url); const b = await r.blob();
      return createImageBitmap(b);
    })();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    return { texture: tex, width: (img as any).width, height: (img as any).height, compressed: false };
  }
  // сжатый путь: Basis → transcode в родной формат GPU
  const basis = await getBasisDecoder();
  const r = await fetch(url);
  const data = new Uint8Array(await r.arrayBuffer());
  const img = basis.decode(data, fmt); // {data, width, height, glFormat}
  gl.compressedTexImage2D(gl.TEXTURE_2D, 0, img.glFormat, img.width, img.height, 0, img.data);
  return { texture: tex, width: img.width, height: img.height, compressed: true };
}
