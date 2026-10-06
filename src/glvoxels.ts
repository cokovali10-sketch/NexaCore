// NEXA Core — glvoxels.ts: 3D-частицы (воксели) на GPU.
// GL_POINTS с перспективой: размер и яркость зависят от глубины, вращение орбит —
// в шейдере по u_time. 1 draw call, 0 CPU в кадре. Аддитивное смешивание поверх кубов.

export interface VoxelOpts {
  canvas: HTMLCanvasElement;
  count?: number;
}

const VS = `
attribute vec3 a_p; attribute vec3 a_c; attribute vec2 a_sd; attribute float a_s;
uniform float u_time, u_aspect, u_mx, u_my, u_h;
varying vec3 v_c; varying float v_a;
void main(){
  float a = a_sd.x + u_time * a_sd.y;
  float ca = cos(a), sa = sin(a);
  vec3 rp = vec3(a_p.x*ca + a_p.z*sa*0.2, a_p.y, -a_p.x*sa*0.2 + a_p.z);
  vec3 wp = vec3(rp.x + u_mx*0.4*rp.z*0.2, rp.y + u_my*0.3*rp.z*0.2, rp.z);
  float f = 2.4;
  gl_Position = vec4(wp.x*f*u_aspect, wp.y*f, ((wp.z-2.0)/6.0*2.0-1.0)*wp.z, wp.z);
  gl_PointSize = a_s * u_h * 0.05 / wp.z;
  v_a = (1.0 - (wp.z - 2.0) / 6.0) * 0.85 + 0.15; // дальние гаснут
  v_c = a_c;
}`;

const FS = `
precision mediump float; varying vec3 v_c; varying float v_a;
void main(){
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;
  float glow = smoothstep(0.5, 0.05, d);
  gl_FragColor = vec4(v_c * glow, v_a * glow);
}`;

export class GLVoxelField {
  activeCount: number;
  lastDraws = 0; lastTris = 0; // points считаем как 1 tri-equiv для stat fps
  private gl: WebGLRenderingContext;
  private prog: WebGLProgram;
  private mx = 0; private my = 0;

  constructor(private opts: VoxelOpts) {
    const gl = opts.canvas.getContext('webgl', { antialias: false, depth: true }) as WebGLRenderingContext | null;
    if (!gl) throw new Error('WebGL not supported');
    this.gl = gl;
    const count = opts.count ?? 4000;
    this.activeCount = count;
    const mk = (t: number, s: string) => { const o = gl.createShader(t)!; gl.shaderSource(o, s); gl.compileShader(o); return o; };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, mk(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    this.prog = prog;
    gl.useProgram(prog);
    const rnd = (i: number, s: number) => {
      const x = Math.sin(i * 91.17 + s * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    };
    const per = (fn: (i: number) => number[], size: number) => {
      const arr = new Float32Array(count * size);
      for (let i = 0; i < count; i++) {
        const c = fn(i);
        for (let j = 0; j < size; j++) arr[i * size + j] = c[j];
      }
      return arr;
    };
    const buf = (loc: string, size: number, data: Float32Array) => {
      const l = gl.getAttribLocation(prog, loc);
      const b = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(l);
      gl.vertexAttribPointer(l, size, gl.FLOAT, false, 0, 0);
    };
    buf('a_p', 3, per((i) => [rnd(i, 1) * 3 - 1.5, rnd(i, 2) * 2 - 1, 2.5 + rnd(i, 3) * 5], 3));
    buf('a_c', 3, per((i) => { const t = rnd(i, 4); return [0.3 + t * 0.7, 0.6 + rnd(i, 5) * 0.4, 1.0]; }, 3));
    buf('a_sd', 2, per((i) => [rnd(i, 6) * 6.28, 0.05 + rnd(i, 7) * 0.25], 2));
    buf('a_s', 1, per((i) => [0.6 + rnd(i, 8) * 2.4], 1));
    addEventListener('pointermove', (e) => {
      const r = opts.canvas.getBoundingClientRect();
      this.mx = ((e.clientX - r.left) / r.width) * 2 - 1;
      this.my = -(((e.clientY - r.top) / r.height) * 2 - 1);
    }, { passive: true });
  }

  setQuality(n: number): void {
    this.activeCount = Math.min(n, 100000);
  }

  render(time: number, heightPx: number, aspect: number): void {
    const gl = this.gl, prog = this.prog;
    gl.useProgram(prog);
    const set = (name: string, v: number) => {
      const u = gl.getUniformLocation(prog, name);
      if (u) gl.uniform1f(u, v);
    };
    set('u_time', time / 1000);
    set('u_aspect', aspect);
    set('u_mx', this.mx * 0.15); set('u_my', this.my * 0.15);
    set('u_h', heightPx);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // аддитив поверх кубов
    gl.depthMask(false); // воксели не портят depth кубов
    gl.drawArrays(gl.POINTS, 0, this.activeCount);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    this.lastDraws = 1; this.lastTris = this.activeCount;
  }
}
