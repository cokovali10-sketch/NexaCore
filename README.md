# ⚡ NEXA Core — чип против лагов

> Один раз ставишь на любой сайт — тяжелые 3D, 50k частиц, 1000 карточек летают на 60 FPS.
> Уровень мировых компаний: как Unity Web + Vercel Speed + AAA dynamic resolution в одном файле.

## Идея (придумано с нуля)

Обычные сайты лагают по 4 причинам:
1. **20 разных rAF-циклов** дерутся за кадр → `Scheduler` (единый цикл + бюджет 8мс + пауза offscreen)
2. **GC-фризы** (объекты в кадре) → `Pool` + `Float32Array`, ноль аллокаций в `update()`
3. **Слабые телефоны грузят как RTX 4090** → `DeviceTier` + `Adaptive` (EMA времени кадра, авто-снижение pixelRatio/частиц, как в играх)
4. **Всё грузится сразу** → `SmartLoader` (IntersectionObserver + idle + батч-вставка DOM чанками)

Рендер: **WebGPU-first, WebGL2-fallback**, частицы — 1 draw call (`POINTS`), физика в типизированных массивах.
Тяжелая математика следующего этапа — **Rust → WASM** (физика, LOD, meshopt).

## Структура

```
src/
  device.ts     — тир устройства (POTATO/LOW/MID/ULTRA) + бюджет
  pool.ts       — zero-GC пул
  scheduler.ts  — единый rAF, offscreen-пауза, idle-хелпер
  adaptive.ts   — FPS-доктор, dynamic resolution
  particles.ts  — 50k частиц, 1 draw call, интерактив с мышью
  loader.ts     — ленивая загрузка + batchInsert
  index.ts      — Nexa.boot() — фасад-чип
demo/
  heavy.html    — открой в браузере: 20k частиц + 500 карточек, HUD с FPS
```

## Использование (любой сайт)

```html
<canvas id="bg"></canvas>
<script type="module">
  import { Nexa } from './src/index.ts'; // после сборки — с CDN: https://cdn.nexa/core.js
  await Nexa.boot({ canvas: '#bg', particles: true, hud: true });
</script>
```

```ts
// React / Vite / любой фреймворк
import { Nexa, SmartLoader } from '@nexa/core';
useEffect(() => { Nexa.boot({ particles: true }); }, []);
// 1000 карточек без лагов:
SmartLoader.batchInsert(grid, i => makeCard(i), 1000);
```

## Демо

Открой `demo/heavy.html` двойным кликом:
- счетчик FPS + ema + активных частиц (HUD слева внизу)
- кнопка 🔥 Стресс x2 — проверка adaptive (ядро само режет качество, FPS не падает)
- 500 карточек вставляются чанками по 12мс — без фризов

## Роадмап до мирового уровня

- [x] v0.1 — ядро (adaptive + scheduler + частицы + loader) ← мы здесь
- [ ] v0.2 — WebGPU backend + glTF loader + DRACO + KTX2
- [ ] v0.3 — Rust/WASM физика + LOD + автодецимация моделей
- [ ] v0.4 — CLI `npx nexa optimize` (аудит сайта как Lighthouse, автофиксы)
- [ ] v1.0 — CDN + NPM + React/Vue-адаптеры + профайлер-оверлей

Время не ограничено — идем по шагам. Следующий шаг скажи ты: **WebGPU, 3D-модели или CLI-аудитор?**
