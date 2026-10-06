<div align="center">

# ⚡ NEXA Core

### Чип против лагов для любых сайтов · Lag-killer chip for any website

[![version](https://img.shields.io/badge/version-v0.2.0-22d3ee?style=for-the-badge)](./package.json)
[![stack](https://img.shields.io/badge/WebGPU-first%20%7C%20WebGL2-fallback-8b5cf6?style=for-the-badge)](#)
[![particles](https://img.shields.io/badge/50k_particles-1_draw_call-4ade80?style=for-the-badge)](#)
[![fps](https://img.shields.io/badge/60_FPS-adaptive-22d3ee?style=for-the-badge)](#)

| | |
|---|---|
| 🇷🇺 | **[Читать на русском →](./README_RU.md)** |
| 🇬🇧 | **[Read in English →](./README_EN.md)** |

*Выбери язык · Choose your language*

</div>

---

<div align="center">

**Одна строка — и тяжёлый сайт летает · One line — and heavy sites fly**

```html
<script src="https://cdn.nexa/core.js" data-auto></script>
```

```ts
import { Nexa } from '@nexa/core';
await Nexa.boot({ particles: true, profiler: true });
```

[🚀 Демо: world.html](./demo/world.html) · [🔥 Демо: heavy.html](./demo/heavy.html) · [⚡ CLI-аудит](./cli/nexa.js)

</div>

---

## Что это · What is this

| 🇷🇺 Русский | 🇬🇧 English |
|---|---|
| Универсальное ядро-«чип»: ставишь на **любой** сайт, оно само держит **60 FPS** — 3D, 50k частиц, 1000 карточек. Как в AAA-играх: слабое устройство = красивая деградация, а не лаги. | Universal kernel-«chip»: drop it into **any** website and it holds **60 FPS** — 3D, 50k particles, 1000 cards. Like AAA games: weak devices get graceful degradation, not lag. |

## Фишки · Features

| | RU | EN |
|---|---|---|
| 🧠 | `Adaptive` — FPS-доктор, dynamic resolution | `Adaptive` — FPS doctor, dynamic resolution |
| 🔁 | `Scheduler` — один rAF на весь сайт, бюджет 8мс | `Scheduler` — single rAF for the whole site, 8ms budget |
| ✨ | `ParticleField` — 50k частиц за 1 draw call | `ParticleField` — 50k particles in 1 draw call |
| 🧊 | `glTF + LOD` — модели с автодецимацией | `glTF + LOD` — auto-decimated models |
| 🦀 | `Rust → WASM` — физика x4–6 быстрее | `Rust → WASM` — 4–6x faster physics |
| 📊 | `Profiler` — оверлей как в Unreal (stat fps) | `Profiler` — Unreal-style overlay (stat fps) |
| 🛠 | `CLI` — `nexa optimize` как Lighthouse | `CLI` — `nexa optimize` like Lighthouse |

## Структура · Structure

```
NexaCore/
├── README.md        ← ты здесь / you are here (переключатель языков)
├── README_RU.md     ← полная документация на русском
├── README_EN.md     ← full docs in English
├── src/             ← ядро (device, scheduler, adaptive, gpu, particles, models, physics, profiler, stream…)
├── wasm/            ← Rust-физика (physics.rs → WASM)
├── cli/             ← nexa optimize — аудит сайта
├── adapters/        ← React / Vue
├── dist/nexa.js     ← CDN-чип, zero-deps (вставил script — работает)
└── demo/            ← heavy.html (20k частиц) · world.html (30k + 3D + 1000 DOM)
```

<div align="center">

**🇷🇺 [Полная дока на русском →](./README_RU.md) · 🇬🇧 [Full docs in English →](./README_EN.md)**

</div>
