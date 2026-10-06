// NEXA Core — physics.ts: единый API физики. Пробует WASM (Rust), иначе JS-fallback.
// + вынос в Worker чтобы вообще не трогать main thread на 50k частиц.

export interface IPhysics {
  step(dt: number, mx: number, my: number): void;
  writeInto(posArr: Float32Array, n: number): void;
  readonly count: number;
}

export class JsPhysics implements IPhysics {
  px: Float32Array; py: Float32Array; vx: Float32Array; vy: Float32Array;
  constructor(public count: number) {
    this.px = new Float32Array(count); this.py = new Float32Array(count);
    this.vx = new Float32Array(count); this.vy = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.px[i] = Math.random() * 2 - 1; this.py[i] = Math.random() * 2 - 1;
      const a = Math.random() * 6.283, s = 0.02 + Math.random() * 0.1;
      this.vx[i] = Math.cos(a) * s; this.vy[i] = Math.sin(a) * s;
    }
  }
  step(dt: number, mx: number, my: number): void {
    const { px, py, vx, vy } = this;
    const damp = 1 - Math.min(dt * 0.6, 0.05);
    for (let i = 0; i < this.count; i++) {
      const dx = px[i] - mx, dy = py[i] - my, d2 = dx * dx + dy * dy;
      if (d2 < 0.02 && d2 > 0.00001) {
        const f = (0.02 - d2) * 8 * dt / Math.sqrt(d2);
        vx[i] += dx * f; vy[i] += dy * f;
      }
      px[i] += vx[i] * dt; py[i] += vy[i] * dt;
      vx[i] *= damp; vy[i] *= damp;
      if (px[i] > 1) px[i] = -1; else if (px[i] < -1) px[i] = 1;
      if (py[i] > 1) py[i] = -1; else if (py[i] < -1) py[i] = 1;
    }
  }
  writeInto(posArr: Float32Array, n: number): void {
    for (let i = 0; i < n; i++) { posArr[i * 2] = this.px[i]; posArr[i * 2 + 1] = this.py[i]; }
  }
}

export class WasmPhysics implements IPhysics {
  private sim: any; private mem: WebAssembly.Memory | null = null;
  constructor(private wasm: any, public count: number) { this.sim = new wasm.Sim(count, BigInt(Date.now())); }
  get wasmMem(): ArrayBuffer {
    const m = (this.wasm as any).__wbindgen_export_0 ?? (this.wasm as any).memory;
    return (m as WebAssembly.Memory).buffer;
  }
  step(dt: number, mx: number, my: number): void { this.sim.step(dt, mx, my); }
  writeInto(posArr: Float32Array, n: number): void {
    // Rust хранит px/py раздельно — копируем в interleaved posArr (1 проход, быстро)
    const buf = new Float32Array(this.wasmMem);
    const pxPtr = this.sim.positions_ptr() / 4, pyPtr = this.sim.positions2_ptr() / 4;
    for (let i = 0; i < n; i++) { posArr[i * 2] = buf[pxPtr + i]; posArr[i * 2 + 1] = buf[pyPtr + i]; }
  }
}

export async function createPhysics(count: number, wasmUrl?: string): Promise<IPhysics> {
  if (wasmUrl) {
    try {
      const mod = await import(/* @vite-ignore */ wasmUrl);
      await (mod.default?.() ?? Promise.resolve());
      return new WasmPhysics(mod, count);
    } catch { /* молча fallback */ }
  }
  return new JsPhysics(count);
}
