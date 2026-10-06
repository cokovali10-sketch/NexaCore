// NEXA Core — profiler.ts: оверлей как в Unreal (stat fps). График кадров,
// draw calls, память, тир. Включается одной строкой, в проде — 0 cost (tree-shaken).

export class Profiler {
  private el: HTMLElement; private cv: HTMLCanvasElement; private g: CanvasRenderingContext2D;
  private hist = new Float32Array(120); private hi = 0;
  private frames = 0; private lastT = performance.now();
  drawCalls = 0; triangles = 0;

  constructor() {
    this.el = document.createElement('div');
    this.el.style.cssText = 'position:fixed;right:12px;top:12px;z-index:99999;width:230px;background:rgba(5,8,18,.85);border:1px solid #22d3ee55;border-radius:12px;padding:10px 12px;font:11px/1.5 monospace;color:#a5f3fc;backdrop-filter:blur(8px)';
    this.cv = document.createElement('canvas');
    this.cv.width = 206; this.cv.height = 48;
    this.cv.style.cssText = 'width:100%;height:48px;background:#020617;border-radius:6px;margin:6px 0';
    this.g = this.cv.getContext('2d')!;
    this.el.appendChild(this.cv);
    const t = document.createElement('div'); t.id = 'nexa-prof-text';
    this.el.appendChild(t);
    document.body.appendChild(this.el);
  }

  frame(dtMs: number, info: { api: string; tier: string; level: number; active: number }): void {
    this.hist[this.hi++ % 120] = Math.min(dtMs, 50);
    if (++this.frames % 10 === 0) this.draw(info, dtMs);
  }

  private draw(info: { api: string; tier: string; level: number; active: number }, dtMs: number): void {
    const g = this.g;
    g.clearRect(0, 0, 206, 48);
    g.fillStyle = '#083344'; g.fillRect(0, 0, 206, 48);
    for (let i = 0; i < 120; i++) {
      const v = this.hist[(this.hi + i) % 120];
      const h = (v / 50) * 48;
      g.fillStyle = v > 20 ? '#ef4444' : v > 17 ? '#f59e0b' : '#22d3ee';
      g.fillRect(i * 1.7, 48 - h, 1.4, h);
    }
    // линия 16.6ms
    g.fillStyle = '#4ade80'; g.fillRect(0, 48 - (16.6 / 50) * 48, 206, 1);
    const fps = 1000 / Math.max(dtMs, 0.01);
    const mem = (performance as any).memory ? Math.round((performance as any).memory.usedJSHeapSize / 1048576) + 'MB' : 'n/a';
    (this.el.querySelector('#nexa-prof-text') as HTMLElement).innerHTML =
      `⚡ NEXA <b>${fps.toFixed(0)} FPS</b> · ${dtMs.toFixed(1)}ms<br>` +
      `GPU:${info.api} · ${info.tier} · L${info.level}<br>` +
      `✦ ${(info.active / 1000).toFixed(1)}k · draw:${this.drawCalls} · tri:${(this.triangles / 1000).toFixed(0)}k<br>` +
      `heap:${mem}`;
  }

  destroy(): void { this.el.remove(); }
}
