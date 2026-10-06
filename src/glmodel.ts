// NEXA Core — glmodel.ts: настоящий рендер glTF-мешей в WebGL.
// ModelManager грузит + режет LOD, этот слой — рисует: 1 программа на все модели,
// нормали считаются один раз при загрузке (глобальное сглаживание), вращение Y,
// дистанционный туман вместо света-студии. Тяжёлая загрузка идёт через fetch,
// поэтому add() мгновенный, меш появляется когда докачался.

import { ModelManager, MeshData } from './models.js';

const VS = `
attribute vec3 a_p; attribute vec3 a_n;
uniform float u_ang, u_aspect, u_sx, u_sy, u_sz, u_sc;
varying vec3 v_c; varying float v_f;
void main(){
  float ca = cos(u_ang), sa = sin(u_ang);
  vec3 v = vec3(a_p.x*ca + a_p.z*sa, a_p.y, -a_p.x*sa + a_p.z*ca) * u_sc;
  vec3 n = vec3(a_n.x*ca + a_n.z*sa, a_n.y, -a_n.x*sa + a_n.z*ca);
  vec3 wp = vec3(v.x + u_sx, v.y + u_sy, u_sz);
  float f = 2.4;
  float ndc = (wp.z - 2.0) / 6.0;
  gl_Position = vec4(wp.x*f*u_aspect, wp.y*f, (ndc*2.0-1.0)*wp.z, wp.z);
  vec3 L = normalize(vec3(0.5, 0.8, 0.6));
  float dif = 0.35 + 0.65*max(dot(n, L), 0.0);
  v_f = dif * (1.0 - ndc*0.45); // туман с глубиной
  v_c = vec3(0.55, 0.85, 1.0);
}`;

const FS = `
precision mediump float; varying vec3 v_c; varying float v_f;
void main(){ gl_FragColor = vec4(v_c * v_f, 1.0); }`;

interface GpuMesh { vbo: WebGLBuffer; ibo: WebGLBuffer; count: number; idxType: number; }

export interface PlacedModel {
  id: string; url: string;
  x: number; y: number; depth: number;
  scale: number; spin: number; base: number;
  lods: MeshData[] | null;
  gpu: (GpuMesh | null)[];
}

function smoothNormals(pos: Float32Array, idx: Uint16Array | Uint32Array): Float32Array {
  const n = new Float32Array(pos.length);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    for (const p of [a, b, c]) { n[p] += nx; n[p + 1] += ny; n[p + 2] += nz; }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= l; n[i + 1] /= l; n[i + 2] /= l;
  }
  return n;
}

export class GLModelLayer {
  private gl: WebGLRenderingContext;
  private prog: WebGLProgram;
  private mgr = new ModelManager();
  models: PlacedModel[] = [];

  constructor(private canvas: HTMLCanvasElement) {
    // тот же контекст, что у GLCubeField (один canvas — один контекст)
    const gl = canvas.getContext('webgl', { antialias: false, depth: true }) as WebGLRenderingContext | null;
    if (!gl) throw new Error('WebGL not supported');
    this.gl = gl;
    const mk = (t: number, s: string) => { const o = gl.createShader(t)!; gl.shaderSource(o, s); gl.compileShader(o); return o; };
    this.prog = gl.createProgram()!;
    gl.attachShader(this.prog, mk(gl.VERTEX_SHADER, VS));
    gl.attachShader(this.prog, mk(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(this.prog);
    gl.enable(gl.DEPTH_TEST);
  }

  // Мгновенно возвращает плейсхолдер; меш подтянется асинхронно
  add(id: string, url: string, x = 0.5, y = 0.5, scale = 0.8): PlacedModel {
    const m: PlacedModel = {
      id, url, x: x * 2 - 1, y: -(y * 2 - 1), depth: 4, scale,
      spin: 0.4, base: Math.random() * 6.28, lods: null, gpu: [null, null, null],
    };
    this.models.push(m);
    this.mgr.get(url).then((lods) => {
      m.lods = lods;
      lods.forEach((lod, i) => { m.gpu[i] = this.upload(lod); });
    }).catch(() => { /* битая ссылка — останется плейсхолдер */ });
    return m;
  }

  remove(id: string): void {
    this.models = this.models.filter((m) => {
      if (m.id !== id) return true;
      m.gpu.forEach((g) => { if (g) { this.gl.deleteBuffer(g.vbo); this.gl.deleteBuffer(g.ibo); } });
      return false;
    });
  }

  clear(): void { [...this.models].forEach((m) => this.remove(m.id)); }

  private upload(mesh: MeshData): GpuMesh {
    const gl = this.gl;
    const normals = mesh.normals ?? smoothNormals(mesh.positions, mesh.indices as any);
    const inter = new Float32Array(mesh.vertexCount * 6);
    for (let i = 0; i < mesh.vertexCount; i++) {
      inter.set(mesh.positions.subarray(i * 3, i * 3 + 3), i * 6);
      inter.set(normals.subarray(i * 3, i * 3 + 3), i * 6 + 3);
    }
    const vbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, inter, gl.STATIC_DRAW);
    const ibo = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices as BufferSource, gl.STATIC_DRAW);
    return {
      vbo, ibo, count: mesh.indices.length,
      idxType: mesh.indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT,
    };
  }

  get readyCount(): number { return this.models.filter((m) => m.gpu[0]).length; }

  render(time: number, tier: number, aspect: number): void {
    const gl = this.gl;
    gl.useProgram(this.prog);
    const U = (n: string) => gl.getUniformLocation(this.prog, n);
    const uAng = U('u_ang'), uAsp = U('u_aspect'), uSx = U('u_sx'), uSy = U('u_sy'), uSz = U('u_sz'), uSc = U('u_sc');
    if (uAsp) gl.uniform1f(uAsp, aspect);
    const lp = gl.getAttribLocation(this.prog, 'a_p');
    const ln = gl.getAttribLocation(this.prog, 'a_n');
    for (const m of this.models) {
      // LOD: слабые — сразу quarter, остальные по глубине
      const li = tier <= 1 ? 2 : m.depth > 5.5 ? 2 : m.depth > 4 ? 1 : 0;
      const g = m.gpu[li] ?? m.gpu[1] ?? m.gpu[0];
      if (!g || !uAng) continue; // ещё грузится — 2D-плейсхолдер в Scene прикроет
      if (uAng) gl.uniform1f(uAng, m.base + (time / 1000) * m.spin);
      if (uSx) gl.uniform1f(uSx, m.x);
      if (uSy) gl.uniform1f(uSy, m.y);
      if (uSz) gl.uniform1f(uSz, m.depth);
      if (uSc) gl.uniform1f(uSc, m.scale);
      gl.bindBuffer(gl.ARRAY_BUFFER, g.vbo);
      gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 3, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(ln); gl.vertexAttribPointer(ln, 3, gl.FLOAT, false, 24, 12);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.ibo);
      gl.drawElements(gl.TRIANGLES, g.count, g.idxType, 0);
    }
  }
}
