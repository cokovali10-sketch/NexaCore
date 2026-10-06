// NEXA Core — stream.ts: умная очередь ассетов. Приоритет по расстоянию до вьюпорта,
// лимит параллельных загрузок по тиру (POTATO=2, ULTRA=8), префетч следующего экрана.

export interface Job { url: string; priority: number; run: () => Promise<any>; }

export class StreamQueue {
  private q: Job[] = [];
  private active = 0;
  constructor(private concurrency: number) {}

  static forTier(tier: number): StreamQueue {
    return new StreamQueue([2, 3, 5, 8][Math.max(0, Math.min(3, tier))]);
  }

  push(j: Job): void {
    this.q.push(j);
    this.q.sort((a, b) => b.priority - a.priority);
    this.pump();
  }

  private pump(): void {
    while (this.active < this.concurrency && this.q.length) {
      const j = this.q.shift()!;
      this.active++;
      j.run().catch(() => {}).finally(() => { this.active--; this.pump(); });
    }
  }

  get pending(): number { return this.q.length + this.active; }
}
