// NEXA Core — Adaptive: живой FPS-доктор. Меряет EMA времени кадра
// и автоматически понижает/повышает качество. Сайт НЕ лагает никогда —
// он деградирует красиво, как игры AAA (dynamic resolution).

import { budgetFor, DeviceTier } from './device.js';

export type QualityLevel = 0 | 1 | 2 | 3;
export interface QualityState {
  particles: number;
  pixelRatio: number;
  shadows: boolean;
  blur: boolean;
  postFX: boolean;
}

export class Adaptive {
  level: QualityLevel;
  state: QualityState;
  private ema = 16.6;
  private goodTime = 0;
  onChange?: (s: QualityState, level: QualityLevel) => void;

  constructor(tier: DeviceTier) {
    this.level = Math.min(tier, 3) as QualityLevel;
    this.state = { ...budgetFor(tier) };
  }

  // вызывать каждый кадр с dt в мс
  tick(dtMs: number): void {
    this.ema = this.ema * 0.95 + dtMs * 0.05;
    if (this.ema > 20 && this.level > 0) {
      // лаг! роняем качество сразу
      this.setLevel((this.level - 1) as QualityLevel);
      this.ema = 16.6;
      this.goodTime = 0;
    } else if (this.ema < 12.5) {
      // стабильно хорошо 4+ сек — пробуем поднять
      this.goodTime += dtMs;
      if (this.goodTime > 4000 && this.level < 3) {
        this.setLevel((this.level + 1) as QualityLevel);
        this.goodTime = 0;
        this.ema = 16.6;
      }
    } else {
      this.goodTime = 0;
    }
  }

  get fps(): number { return 1000 / Math.max(this.ema, 0.01); }

  private setLevel(l: QualityLevel): void {
    this.level = l;
    // маппим уровень на бюджет тира напрямую
    this.state = { ...budgetFor(l) };
    this.onChange?.(this.state, l);
  }
}
