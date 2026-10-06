// NEXA Core — gl.ts: общий фундамент WebGL-слоёв.
// Один раз написанные компиляция шейдеров, инстансинг, сиды и палитра —
// вместо 5 копий в particles/gl3d/glvoxels/glmodel/postfx. Меньше вес, больше мощи.

export function compileProg(gl: WebGLRenderingContext | WebGL2RenderingContext, vsSrc: string, fsSrc: string): WebGLProgram {
  const mk = (t: number, s: string) => {
    const o = gl.createShader(t)!;
    gl.shaderSource(o, s); gl.compileShader(o);
    return o;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, mk(gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(prog);
  return prog;
}

export function attrBuf(
  gl: WebGLRenderingContext | WebGL2RenderingContext, prog: WebGLProgram,
  loc: string, size: number, data: Float32Array, dynamic = false,
): WebGLBuffer {
  const l = gl.getAttribLocation(prog, loc);
  const b = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, data, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
  gl.enableVertexAttribArray(l);
  gl.vertexAttribPointer(l, size, gl.FLOAT, false, 0, 0);
  return b;
}

// Детерминированный сид [0,1) — одинаковые сцены на всех устройствах
export function srand(i: number, s: number): number {
  const x = Math.sin(i * 91.17 + s * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// Фирменная палитра NEXA: циан → фиолет → белый
export function palette(i: number): [number, number, number] {
  const t = srand(i, 4);
  return [0.3 + t * 0.7, 0.6 + srand(i, 5) * 0.4, 1.0];
}

// Размножить per-instance данные на каждую вершину: 1 draw call из коробки
export function instanced(count: number, perVert: number, size: number, fn: (i: number) => number[]): Float32Array {
  const arr = new Float32Array(count * perVert * size);
  for (let i = 0; i < count; i++)
    for (let k = 0; k < perVert; k++) {
      const c = fn(i);
      for (let j = 0; j < size; j++) arr[(i * perVert + k) * size + j] = c[j];
    }
  return arr;
}

export function flat(count: number, size: number, fn: (i: number) => number[]): Float32Array {
  const arr = new Float32Array(count * size);
  for (let i = 0; i < count; i++) {
    const c = fn(i);
    for (let j = 0; j < size; j++) arr[i * size + j] = c[j];
  }
  return arr;
}

export function fitCanvas(canvas: HTMLCanvasElement, pr = 1): void {
  canvas.width = Math.floor(innerWidth * pr);
  canvas.height = Math.floor(innerHeight * pr);
}

export function trackPointer(canvas: HTMLCanvasElement, cb: (x: number, y: number) => void): void {
  addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    cb(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
  }, { passive: true });
}
