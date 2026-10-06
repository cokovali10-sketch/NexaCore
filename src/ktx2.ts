// NEXA Core — ktx2.ts: детект сжатых текстур + выбор формата под GPU.
// Полный Basis-декодер — внешняя опция (чтобы ядро осталось ≤9kb).
// Этот модуль решает ЧТО грузить: .ktx2 (ASTC/ETC2/S3TC) или fallback .webp.

export type CompressedFmt = 'astc' | 'etc2' | 's3tc' | 'none';

export function detectCompressed(gl: WebGLRenderingContext | WebGL2RenderingContext | null): CompressedFmt {
  if (!gl) return 'none';
  const exts = gl.getSupportedExtensions() ?? [];
  // Порядок — от лучшего сжатия к худшему
  if (exts.some((e) => /WEBGL_compressed_texture_astc/i.test(e))) return 'astc';
  if (exts.some((e) => /WEBGL_compressed_texture_etc/i.test(e))) return 'etc2';
  if (exts.some((e) => /WEBGL_compressed_texture_s3tc/i.test(e))) return 's3tc';
  return 'none';
}

// URL вида "hero.{fmt}.ktx2" → подменяем под GPU, иначе hero.webp
export function pickTextureUrl(base: string, fmt: CompressedFmt): string {
  if (fmt === 'none') return base.replace('{fmt}', 'fallback').replace('.ktx2', '.webp');
  return base.replace('{fmt}', fmt);
}
