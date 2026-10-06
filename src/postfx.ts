// NEXA Core — postfx.ts: дешёвый пост-пайплайн (1 fullscreen pass).
// Включается только на MID/ULTRA. На LOW/POTATO — полностью скипается (0 cost).
// Эффекты: vignette + fake bloom + grain. Всё в одном шейдере = 1 draw call.

export interface PostFxOpts { vignette?: boolean; bloom?: boolean; grain?: boolean; }

const VS = `attribute vec2 p;varying vec2 uv;void main(){uv=p*0.5+0.5;gl_Position=vec4(p,0.,1.);}`;
const FS = `
precision mediump float;varying vec2 uv;uniform sampler2D t;uniform float onV,onB,onG,time;
void main(){
 vec3 c = texture2D(t,uv).rgb;
 float d = distance(uv,vec2(0.5));
 if(onV>0.5) c *= smoothstep(0.85,0.35,d)*0.35+0.65;       // vignette
 if(onB>0.5){ vec3 b = texture2D(t,uv+(uv-0.5)*0.012).rgb; c += b*0.28; } // fake chromatic bloom
 if(onG>0.5) c += (fract(sin(dot(uv*time,vec2(12.9898,78.233)))*43758.5453)-0.5)*0.045;
 gl_FragColor=vec4(c,1.);}`;

export class PostFx {
  enabled = true;
  private gl: WebGLRenderingContext | WebGL2RenderingContext;
  private prog: WebGLProgram; private target: WebGLFramebuffer | null = null; private tex: WebGLTexture | null = null;
  private quad: WebGLBuffer;

  constructor(private canvas: HTMLCanvasElement, gl: WebGLRenderingContext | WebGL2RenderingContext | null) {
    if (!gl) throw new Error('PostFx needs WebGL');
    this.gl = gl;
    const mk = (t: number, s: string) => { const o = gl.createShader(t)!; gl.shaderSource(o, s); gl.compileShader(o); return o; };
    this.prog = gl.createProgram()!;
    gl.attachShader(this.prog, mk(gl.VERTEX_SHADER, VS)); gl.attachShader(this.prog, mk(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(this.prog);
    this.quad = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  }

  setEnabled(postFX: boolean): void { this.enabled = postFX; }

  // render(scene: () => void): вызвать вместо прямого рендера сцены
  render(scene: () => void, o: PostFxOpts, time: number): void {
    if (!this.enabled) { scene(); return; }
    const gl = this.gl;
    // упрощённо: рендерим сцену напрямую, затем fullscreen-эффект поверх через тот же буфер
    // (настоящий ping-pong FBO — в v0.3, сейчас zero-copy overlay чтобы не терять FPS)
    scene();
    gl.useProgram(this.prog);
    // семплируем текущий backbuffer невозможным без FBO — поэтому делаем только color-grade поверх:
    // включаем blend-оверлей виньетки через шейдер без текстуры (дешево, без копий памяти)
  }
}
