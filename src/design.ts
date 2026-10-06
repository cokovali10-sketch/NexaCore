// NEXA Core — design.ts: дизайн-система поверх ядра.
// Темы + glass-карточки + кнопки + сетка. Всё уважает Adaptive:
// на POTATO/LOW блюр выключается сам (иначе backdrop-filter жрёт FPS).

import { SmartLoader } from './loader.js';

export type ThemeName = 'abyss' | 'neon' | 'paper';
export interface Theme { bg: string; ink: string; accent: string; card: string; radius: number; blur: boolean; }

export const THEMES: Record<ThemeName, Theme> = {
  abyss: { bg: '#04060e', ink: '#e2e8f0', accent: '#22d3ee', card: 'rgba(255,255,255,.06)', radius: 14, blur: true },
  neon: { bg: '#0a0414', ink: '#f5f3ff', accent: '#a78bfa', card: 'rgba(167,139,250,.10)', radius: 18, blur: true },
  paper: { bg: '#fafaf9', ink: '#1c1917', accent: '#0d9488', card: 'rgba(0,0,0,.04)', radius: 12, blur: false },
};

export class Design {
  private root: HTMLElement;
  theme: Theme = THEMES.abyss;

  constructor(root?: HTMLElement) {
    this.root = root ?? document.body;
  }

  apply(name: ThemeName, lowPower = false): void {
    this.theme = THEMES[name];
    const t = this.theme;
    const blur = t.blur && !lowPower;
    this.root.style.background = t.bg;
    this.root.style.color = t.ink;
    let st = document.getElementById('nexa-design');
    if (!st) { st = document.createElement('style'); st.id = 'nexa-design'; document.head.appendChild(st); }
    st.textContent = [
      `.nx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}`,
      `.nx-card{background:${t.card};border:1px solid rgba(128,128,128,.25);border-radius:${t.radius}px;padding:16px;${blur ? 'backdrop-filter:blur(8px);' : ''}}`,
      `.nx-btn{background:${t.accent};color:#000;border:0;padding:12px 20px;border-radius:12px;font-weight:800;cursor:pointer}`,
      `.nx-h{font-size:clamp(36px,7vw,84px);letter-spacing:-3px;line-height:.95}`,
      `.nx-accent{color:${t.accent}}`,
    ].join('\n');
  }

  // Карточки чанками (без фризов) в контейнер с классом nx-grid
  cards(el: HTMLElement, total: number, render: (i: number) => string): void {
    el.className = 'nx-grid';
    SmartLoader.batchInsert(el, (i) => {
      const d = document.createElement('div');
      d.className = 'nx-card';
      d.innerHTML = render(i);
      return d;
    }, total);
  }
}
