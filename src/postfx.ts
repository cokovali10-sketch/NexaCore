// NEXA Core — postfx.ts v0.3: настоящий ping-pong PostFX (FBO + fullscreen pass).
// Сцена рендерится в текстуру, затем 1 fullscreen quad: vignette + fake bloom + grain.
// На LOW/POTATO — скип (0 cost). На MID/ULTRA — ровно +1 draw call.

export interface PostFxOpts { vignette?: boolean; bloom?: boolean; grain?: boolean; }

import { compileProg, attrBuf } from './gl.js';

const VS = `attribute vec2 p;varying vec2 uv;void main(){uv=p*0.5+0.5;gl_Position=vec4(p,0.,1.);}`;
const FS = `
precision mediump float;varying vec2 uv;uniform sampler2D t;uniform float onV,onB,onG,time;
void main(){
 vec3 c = texture2D(t,uv).rgb;
 float d = distance(uv,vec2(0.5));
 if(onV>0.5) c *= smoothstep(0.85,0.35,d)*0.35+0.65;
 if(onB>0.5){ vec3 b = texture2D(t,uv+(uv-0.5)*0.012).rgb; c += b*0.28; }
 if(onG>0.5) c += (fract(sin(dot(uv*(time+1.0),vec2(12.9898,78.233)))*43758.5453)-0.5)*0.045;
 gl_FragColor=vec4(c,1.);}`;

export class PostFx {
  enabled = true;
  private gl: WebGLRenderingContext | WebGL2RenderingContext;
  private prog: WebGLProgram;
  private fbo: WebGLFramebuffer | null = null;
  private tex: WebGLTexture | null = null;
  private quad: WebGLBuffer;
  private w = 0; private h = 0;

  constructor(private canvas: HTMLCanvasElement, gl: WebGLRenderingContext | WebGL2RenderingContext | null) {
    if (!gl) throw new Error('PostFx needs WebGL');
    this.gl = gl;
    this.prog = compileProg(gl, VS, FS);
    this.quad = attrBuf(gl, this.prog, 'p', 2, new Float32Array([-1, -1, 3, -1, -1, 3]));
  }

  setEnabled(postFX: boolean): void { this.enabled = postFX; }

  private ensureTarget(): void {
    const gl = this.gl;
    const w = this.canvas.width, h = this.canvas.height;
    if (this.fbo && this.w === w && this.h === h) return;
    this.w = w; this.h = h;
    if (!this.fbo) this.fbo = gl.createFramebuffer();
    if (this.tex) gl.deleteTexture(this.tex);
    this.tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private uniform(name: string): WebGLUniformLocation | null {
    return this.gl.getUniformLocation(this.prog, name);
  }

  // scene: () => void — отрисовка сцены обычным способом
  render(scene: () => void, o: PostFxOpts, time: number): void {
    const gl = this.gl;
    if (!this.enabled) { scene(); return; }
    this.ensureTarget();
    // pass 1: сцена → текстура
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    scene();
    // pass 2: текстура → экран с эффектами (+1 draw call)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(this.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    const t = this.uniform('t'); if (t) gl.uniform1i(t, 0);
    const set = (n: string, v: number) => { const u = this.uniform(n); if (u) gl.uniform1f(u, v); };
    set('onV', o.vignette === false ? 0 : 1);
    set('onB', o.bloom === false ? 0 : 1);
    set('onG', o.grain === false ? 0 : 1);
    set('time', (time / 1000) % 100);
    const loc = gl.getAttribLocation(this.prog, 'p');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
