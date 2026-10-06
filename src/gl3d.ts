// NEXA Core — gl3d.ts: настоящий 3D-рендер на GPU.
// Инстансинг кубов: 1 draw call на всю сцену, угол считается В ШЕЙДЕРЕ (u_time),
// CPU в кадре вообще ничего не делает — только adaptive режет activeCount.
// Параллакс от мыши, depth buffer для правильного перекрытия, LOD через skip.

export interface CubeOpts {
  canvas: HTMLCanvasElement;
  count?: number;
}

const VS = `
attribute vec3 a_v; attribute vec3 a_n;
attribute vec3 a_p; attribute vec3 a_c;
attribute vec2 a_rr; // x=base angle, y=speed
uniform float u_time, u_aspect, u_mx, u_my;
varying vec3 v_c; varying float v_d; varying float v_h;
void main(){
  float a = a_rr.x + u_time * a_rr.y;
  float ca = cos(a), sa = sin(a);
  // поворот вершины и нормали вокруг Y
  vec3 v = vec3(a_v.x*ca + a_v.z*sa, a_v.y, -a_v.x*sa + a_v.z*ca);
  vec3 n = vec3(a_n.x*ca + a_n.z*sa, a_n.y, -a_n.x*sa + a_n.z*ca);
  float s = 0.16;
  vec3 wp = vec3(v.x*s + a_p.x*1.5 + u_mx*0.3*a_p.z, v.y*s + a_p.y + u_my*0.2*a_p.z, a_p.z);
  float f = 2.4;
  float ndc = (wp.z - 2.0) / 6.0;
  gl_Position = vec4(wp.x*f*u_aspect, wp.y*f, (ndc*2.0-1.0)*wp.z, wp.z);
  vec3 L = normalize(vec3(0.5, 0.8, 0.6));
  v_d = 0.35 + 0.65*max(dot(n, L), 0.0);
  v_h = wp.y; // высота для земляной тени
  v_c = a_c;
}`;

const FS = `
precision mediump float; varying vec3 v_c; varying float v_d; varying float v_h;
void main(){
 float ao = 0.45 + 0.55*smoothstep(-1.3, 0.5, v_h); // тень у «земли», 0 ALU на CPU
 gl_FragColor = vec4(v_c * v_d * ao, 1.0); }`;

// куб: 36 вершин (12 треугольников), позиции + нормали
function cubeGeo(): { v: Float32Array; n: Float32Array } {
  const F: number[][] = [
    [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
  ];
  const v: number[] = [], n: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[], fn: number[]) => {
    for (const p of [a, b, c, a, c, d]) { v.push(p[0] * 0.5, p[1] * 0.5, p[2] * 0.5); n.push(fn[0], fn[1], fn[2]); }
  };
  quad([1, 1, 1], [1, -1, 1], [1, -1, -1], [1, 1, -1], F[0]);
  quad([-1, 1, -1], [-1, -1, -1], [-1, -1, 1], [-1, 1, 1], F[1]);
  quad([-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1], F[2]);
  quad([-1, -1, 1], [1, -1, 1], [1, -1, -1], [-1, -1, -1], F[3]);
  quad([-1, 1, 1], [1, 1, 1], [1, -1, 1], [-1, -1, 1], F[4]);
  quad([1, 1, -1], [-1, 1, -1], [-1, -1, -1], [1, -1, -1], F[5]);
  return { v: new Float32Array(v), n: new Float32Array(n) };
}

export class GLCubeField {
  activeCount: number;
  lastDraws = 0; lastTris = 0; // статистика для Profiler (stat fps)
  private gl: WebGLRenderingContext;
  private prog: WebGLProgram;
  private mx = 0; private my = 0;

  constructor(private opts: CubeOpts) {
    const gl = opts.canvas.getContext('webgl', { antialias: false, depth: true }) as WebGLRenderingContext | null;
    if (!gl) throw new Error('WebGL not supported');
    this.gl = gl;
    const count = opts.count ?? 120;
    this.activeCount = count;
    const mk = (t: number, s: string) => { const o = gl.createShader(t)!; gl.shaderSource(o, s); gl.compileShader(o); return o; };
    this.prog = gl.createProgram()!;
    gl.attachShader(this.prog, mk(gl.VERTEX_SHADER, VS));
    gl.attachShader(this.prog, mk(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(this.prog);
    gl.useProgram(this.prog);
    gl.enable(gl.DEPTH_TEST);

    const { v, n } = cubeGeo();
    const per = (fn: (i: number) => number[], size: number) => {
      const arr = new Float32Array(36 * count * size);
      for (let inst = 0; inst < count; inst++)
        for (let k = 0; k < 36; k++) {
          const c = fn(inst);
          for (let j = 0; j < size; j++) arr[(inst * 36 + k) * size + j] = c[j];
        }
      return arr;
    };
    const rnd = (i: number, s: number) => {
      const x = Math.sin(i * 78.233 + s * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    };
    const buf = (loc: string, size: number, data: Float32Array, dynamic = false) => {
      const l = gl.getAttribLocation(this.prog, loc);
      const b = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
      gl.enableVertexAttribArray(l);
      gl.vertexAttribPointer(l, size, gl.FLOAT, false, 0, 0);
    };
    buf('a_v', 3, v);
    buf('a_n', 3, n);
    buf('a_p', 3, per((i) => [rnd(i, 1) * 2 - 1, rnd(i, 2) * 2 - 1, 2.5 + rnd(i, 3) * 5], 3));
    buf('a_c', 3, per((i) => { const t = rnd(i, 4); return [0.3 + t * 0.7, 0.6 + rnd(i, 5) * 0.4, 1.0]; }, 3));
    buf('a_rr', 2, per((i) => [rnd(i, 6) * 6.28, 0.2 + rnd(i, 7) * 0.8], 2));

    addEventListener('pointermove', (e) => {
      const r = opts.canvas.getBoundingClientRect();
      this.mx = ((e.clientX - r.left) / r.width) * 2 - 1;
      this.my = -(((e.clientY - r.top) / r.height) * 2 - 1);
    }, { passive: true });
    this.fit();
    addEventListener('resize', () => this.fit(), { passive: true });
  }

  private fit(): void {
    const c = this.opts.canvas;
    c.width = innerWidth; c.height = innerHeight;
    this.gl.viewport(0, 0, c.width, c.height);
  }

  setQuality(n: number): void {
    this.activeCount = Math.min(n, 100000);
  }

  render(time: number): void {
    const gl = this.gl;
    gl.useProgram(this.prog);
    const set = (name: string, v: number) => {
      const u = gl.getUniformLocation(this.prog, name);
      if (u) gl.uniform1f(u, v);
    };
    set('u_time', time / 1000);
    set('u_aspect', this.opts.canvas.height / Math.max(this.opts.canvas.width, 1));
    set('u_mx', this.mx * 0.15);
    set('u_my', this.my * 0.15);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, this.activeCount * 36);
    this.lastDraws = 1; this.lastTris = this.activeCount * 12;
  }
}
