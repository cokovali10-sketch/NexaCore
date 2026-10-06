// NEXA Core — Scheduler: единый rAF-цикл на весь сайт.
// Проблема обычных сайтов: 20 разных rAF + scroll-лисенеры = лаги.
// Решение: все подписываются сюда, чип сам батчит, режет работу по бюджету 8мс,
// невидимое — ставит на паузу через IntersectionObserver.

type FrameTask = (dt: number, time: number) => void;

export class Scheduler {
  private tasks = new Map<string, { fn: FrameTask; visible: boolean }>();
  private last = performance.now();
  private running = false;
  private observer: IntersectionObserver | null = null;

  constructor(private frameBudgetMs = 8) {
    if (typeof IntersectionObserver !== 'undefined') {
      this.observer = new IntersectionObserver((entries) => {
        for (const e of entries) {
          const t = this.tasks.get((e.target as HTMLElement).dataset.nexaId!);
          if (t) t.visible = e.isIntersecting;
        }
      });
    }
  }

  add(id: string, fn: FrameTask, el?: HTMLElement): void {
    this.tasks.set(id, { fn, visible: true });
    if (el && this.observer) {
      el.dataset.nexaId = id;
      this.observer.observe(el);
    }
    if (!this.running) this.start();
  }

  remove(id: string): void {
    this.tasks.delete(id);
    if (this.tasks.size === 0) this.running = false;
  }

  private start(): void {
    this.running = true;
    this.last = performance.now();
    const loop = (time: number) => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      const frameStart = performance.now();
      const dt = Math.min((time - this.last) / 1000, 0.05);
      this.last = time;
      for (const [, t] of this.tasks) {
        if (!t.visible) continue; // спим пока offscreen — экономим батарею
        t.fn(dt, time);
        if (performance.now() - frameStart > this.frameBudgetMs) break; // переносим хвост на след. кадр
      }
    };
    requestAnimationFrame(loop);
  }

  // Тяжелое — в idle, не в кадре
  static idle(fn: () => void): void {
    const ric = (window as any).requestIdleCallback;
    if (ric) ric(fn, { timeout: 2000 });
    else setTimeout(fn, 32);
  }
}
