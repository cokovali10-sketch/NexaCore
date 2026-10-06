// NEXA Core — ParticleField: 50k частиц на одном draw call.
// Секрет: вся физика в типизированных массивах (Float32Array), ноль объектов в кадре,
// рендер через WebGL POINTS, размер/цвет считаются в вершинном шейдере.

export interface ParticleOpts {
  canvas: HTMLCanvasElement;
  count?: number;
  interactive?: boolean;
}

const VS = `
attribute vec2 a_pos; attribute float a_size; attribute vec3 a_col; attribute float a_alpha;
varying vec3 v_col; varying float v_alpha;
void main(){ v_col=a_col; v_alpha=a_alpha;
gl_PointSize = a_size;
gl_Position = vec4(a_pos, 0.0, 1.0); }`;

const FS = `
precision mediump float; varying vec3 v_col; varying float v_alpha;
void main(){
vec2 uv = gl_PointCoord - 0.5;
float d = length(uv);
if(d > 0.5) discard;
float glow = smoothstep(0.5, 0.0, d);
gl_FragColor = vec4(v_col, v_alpha * glow); }`;

export class ParticleField {
  private gl: WebGLRenderingContext | null;
  private count: number;
  private px!: Float32Array; private py!: Float32Array;
  private vx!: Float32Array; private vy!: Float32Array;
  private size!: Float32Array; private alpha!: Float32Array;
  private col!: Float32Array;
  private mx = 999; private my = 999;
  private posBuf!: WebGLBuffer; private sizeBuf!: WebGLBuffer;
  private colBuf!: WebGLBuffer; private alphaBuf!: WebGLBuffer;
  private posArr!: Float32Array;
  activeCount: number;

  constructor(private opts: ParticleOpts) {
    const canvas = opts.canvas;
    this.gl = canvas.getContext('webgl', { antialias: false, alpha: true }) as WebGLRenderingContext;
    this.count = opts.count ?? 20000;
    this.activeCount = this.count;
    if (!this.gl) throw new Error('WebGL not supported');
    this.alloc(this.count);
    this.initGL();
    if (opts.interactive !== false) {
      addEventListener('pointermove', (e) => {
        const r = canvas.getBoundingClientRect();
        this.mx = ((e.clientX - r.left) / r.width) * 2 - 1;
        this.my = -(((e.clientY - r.top) / r.height) * 2 - 1);
      }, { passive: true });
    }
  }

  private alloc(n: number): void {
    this.px = new Float32Array(n); this.py = new Float32Array(n);
    this.vx = new Float32Array(n); this.vy = new Float32Array(n);
    this.size = new Float32Array(n); this.alpha = new Float32Array(n);
    this.col = new Float32Array(n * 3);
    this.posArr = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      this.px[i] = Math.random() * 2 - 1;
      this.py[i] = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2, s = 0.02 + Math.random() * 0.12;
      this.vx[i] = Math.cos(a) * s; this.vy[i] = Math.sin(a) * s;
      this.size[i] = 1 + Math.random() * 3;
      this.alpha[i] = 0.25 + Math.random() * 0.75;
      // палитра: циан -> фиолет -> белый
      const t = Math.random();
      this.col[i * 3] = 0.3 + t * 0.7;
      this.col[i * 3 + 1] = 0.6 + Math.random() * 0.4;
      this.col[i * 3 + 2] = 1.0;
    }
  }

  setQuality(n: number): void {
    this.activeCount = Math.min(n, this.count);
  }

  resize(w: number, h: number, pixelRatio: number): void {
    this.opts.canvas.width = Math.floor(w * pixelRatio);
    this.opts.canvas.height = Math.floor(h * pixelRatio);
    this.gl?.viewport(0, 0, this.opts.canvas.width, this.opts.canvas.height);
  }

  private prog!: WebGLProgram;
  private initGL(): void {
    const gl = this.gl!;
    const vs = gl.createShader(gl.VERTEX_SHADER)!; gl.shaderSource(vs, VS); gl.compileShader(vs);
    const fs = gl.createShader(gl.FRAGMENT_SHADER)!; gl.shaderSource(fs, FS); gl.compileShader(fs);
    this.prog = gl.createProgram()!; gl.attachShader(this.prog, vs); gl.attachShader(this.prog, fs); gl.linkProgram(this.prog);
    gl.useProgram(this.prog);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.posBuf = gl.createBuffer()!; this.sizeBuf = gl.createBuffer()!;
    this.colBuf = gl.createBuffer()!; this.alphaBuf = gl.createBuffer()!;
  }

  update(dt: number): void {
    const n = this.activeCount;
    const { px, py, vx, vy, mx, my } = this;
    const damp = 1 - Math.min(dt * 0.6, 0.05);
    for (let i = 0; i < n; i++) {
      // отталкивание от курсора (дешево: один sqrt-free approx)
      const dx = px[i] - mx, dy = py[i] - my;
      const d2 = dx * dx + dy * dy;
      if (d2 < 0.02 && d2 > 0.00001) {
        const f = (0.02 - d2) * 8 * dt;
        vx[i] += (dx * f) / Math.sqrt(d2);
        vy[i] += (dy * f) / Math.sqrt(d2);
      }
      px[i] += vx[i] * dt; py[i] += vy[i] * dt;
      vx[i] *= damp; vy[i] *= damp;
      if (px[i] > 1) px[i] = -1; else if (px[i] < -1) px[i] = 1;
      if (py[i] > 1) py[i] = -1; else if (py[i] < -1) py[i] = 1;
      this.posArr[i * 2] = px[i]; this.posArr[i * 2 + 1] = py[i];
    }
  }

  render(): void {
    const gl = this.gl!; if (!gl) return;
    const n = this.activeCount;
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.prog);
    const bind = (buf: WebGLBuffer, loc: string, size: number, data: BufferSource) => {
      const l = gl.getAttribLocation(this.prog, loc);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(l);
      gl.vertexAttribPointer(l, size, gl.FLOAT, false, 0, 0);
    };
    bind(this.posBuf, 'a_pos', 2, this.posArr.subarray(0, n * 2) as unknown as BufferSource);
    bind(this.sizeBuf, 'a_size', 1, this.size.subarray(0, n) as unknown as BufferSource);
    bind(this.colBuf, 'a_col', 3, this.col.subarray(0, n * 3) as unknown as BufferSource);
    bind(this.alphaBuf, 'a_alpha', 1, this.alpha.subarray(0, n) as unknown as BufferSource);
    gl.drawArrays(gl.POINTS, 0, n);
  }
}
