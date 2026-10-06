// NEXA Core — gpu.ts: единый бэкенд WebGPU-first / WebGL2-fallback / Canvas2D-last.
// Как в AAA: выбираем самый быстрый API устройства, dynamic resolution из Adaptive.

export type GpuApi = 'webgpu' | 'webgl2' | 'webgl' | 'cpu';

export interface GpuContext {
  api: GpuApi;
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext | WebGL2RenderingContext | null;
  device: GPUDevice | null;
  pixelRatio: number;
}

export async function initGpu(canvas: HTMLCanvasElement, pixelRatio: number): Promise<GpuContext> {
  const nav = navigator as any;
  // 1. WebGPU
  if (nav.gpu) {
    try {
      const adapter = await nav.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (adapter) {
        const device = await adapter.requestDevice();
        const ctx = canvas.getContext('webgpu') as any;
        if (ctx) {
          ctx.configure({ device, format: nav.gpu.getPreferredCanvasFormat(), alphaMode: 'premultiplied' });
          return { api: 'webgpu', canvas, gl: null, device, pixelRatio };
        }
      }
    } catch { /* fallback ниже */ }
  }
  // 2. WebGL2
  const gl2 = canvas.getContext('webgl2', { antialias: false, powerPreference: 'high-performance' }) as WebGL2RenderingContext | null;
  if (gl2) return { api: 'webgl2', canvas, gl: gl2, device: null, pixelRatio };
  // 3. WebGL1
  const gl1 = canvas.getContext('webgl', { antialias: false }) as WebGLRenderingContext | null;
  if (gl1) return { api: 'webgl', canvas, gl: gl1, device: null, pixelRatio };
  return { api: 'cpu', canvas, gl: null, device: null, pixelRatio: 1 };
}

export function applyResolution(ctx: GpuContext, w: number, h: number, pixelRatio: number): void {
  ctx.pixelRatio = pixelRatio;
  ctx.canvas.width = Math.floor(w * pixelRatio);
  ctx.canvas.height = Math.floor(h * pixelRatio);
  if (ctx.gl) ctx.gl.viewport(0, 0, ctx.canvas.width, ctx.canvas.height);
}
