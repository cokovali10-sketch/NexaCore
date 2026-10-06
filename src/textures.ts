// NEXA Core — textures.ts: атлас + ленивый decode + KTX2-заглушка.
// Мировые движки пакуют сотни PNG в 1-2 атласа → -90% draw calls и памяти.

export class Atlas {
  canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private x = 0; private y = 0; private rowH = 0;
  uv = new Map<string, [number, number, number, number]>(); // name -> u0,v0,u1,v1

  constructor(public size = 2048) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = size; this.canvas.height = size;
    this.ctx = this.canvas.getContext('2d')!;
  }

  add(name: string, img: TexImageSource): boolean {
    const w = (img as any).width, h = (img as any).height;
    if (this.x + w > this.size) { this.x = 0; this.y += this.rowH; this.rowH = 0; }
    if (this.y + h > this.size) return false; // атлас полон
    this.ctx.drawImage(img, this.x, this.y);
    this.uv.set(name, [this.x / this.size, this.y / this.size, (this.x + w) / this.size, (this.y + h) / this.size]);
    this.x += w; this.rowH = Math.max(this.rowH, h);
    return true;
  }

  // Декодируем картинки НЕ в кадре, а в idle — без фризов скролла
  static decodeLazy(url: string): Promise<ImageBitmap> {
    return new Promise((resolve, reject) => {
      const run = async () => {
        try {
          const r = await fetch(url);
          const b = await r.blob();
          const bmp = await createImageBitmap(b, { premultiplyAlpha: 'premultiply' });
          resolve(bmp);
        } catch (e) { reject(e); }
      };
      const ric = (window as any).requestIdleCallback;
      if (ric) ric(() => run(), { timeout: 3000 }); else setTimeout(run, 16);
    });
  }
}
