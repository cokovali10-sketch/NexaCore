// NEXA Core — scene.ts: универсальный конструктор сцены.
// Вставил чип → строишь 3D и дизайн прямо в нём, без three.js:
//   const s = new Scene(canvas, { glCanvas }); s.add({type:'cube3d', count:120});
// Сущности: cubes | spheres | particles | model | text | cube3d. Всё — 1 rAF через Scheduler,
// LOD и качество — через Adaptive. 2D — инстансинг на canvas, cube3d — GPU (GLCubeField,
// 1 draw call, угол в шейдере). Без glCanvas cube3d рисуется как 2D-плейсхолдер.

import { Scheduler } from './scheduler.js';
import { Adaptive } from './adaptive.js';
import { getDevice } from './device.js';
import { GLCubeField } from './gl3d.js';
import { GLModelLayer } from './glmodel.js';
import { Profiler } from './profiler.js';
import { PostFx, PostFxOpts } from './postfx.js';
import { StreamQueue } from './stream.js';

export type EntityType = 'cubes' | 'spheres' | 'particles' | 'model' | 'text' | 'cube3d';
export interface Entity {
  id: string;
  type: EntityType;
  x?: number; y?: number; // относительные 0..1 (для 2D-слоёв)
  count?: number;
  size?: number;
  color?: string;
  url?: string;   // для model
  content?: string; // для text
  speed?: number;
  distance?: number; // для LOD
  seed?: number;
  rot?: number; vr?: number;
}

interface Live extends Entity { items: { x: number; y: number; r: number; s: number; v: number }[]; }

let seq = 0;

export class Scene {
  private ctx: CanvasRenderingContext2D;
  private lives: Live[] = [];
  readonly scheduler = new Scheduler();
  readonly adaptive = new Adaptive(getDevice().tier);
  private mx = 0.5; private my = 0.5;
  private time = 0;
  private gl: GLCubeField | null = null;
  private glBuilt = 0;
  private models: GLModelLayer | null = null;
  private glCtx: WebGLRenderingContext | null = null;
  private fx: PostFx | null = null;
  private queue: StreamQueue | null = null;
  private tierLabel = 'MID';
  private hud: HTMLElement | null = null;
  private frameNo = 0;

  constructor(private canvas: HTMLCanvasElement, public opts: { hud?: boolean; glCanvas?: HTMLCanvasElement; profiler?: Profiler; postfx?: PostFxOpts } = {}) {
    canvas.style.pointerEvents = 'none';
    const g = canvas.getContext('2d');
    if (!g) throw new Error('Scene needs 2d context');
    this.ctx = g;
    this.fit(); addEventListener('resize', () => this.fit(), { passive: true });
    this.tierLabel = getDevice().label;
    if (opts.hud) {
      this.hud = document.createElement('div');
      this.hud.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:99999;font:12px/1.4 monospace;background:rgba(0,0,0,.6);color:#22d3ee;padding:6px 10px;border-radius:8px;border:1px solid #22d3ee44';
      document.body.appendChild(this.hud);
    }
    let last = performance.now();
    this.scheduler.add('nexa-scene', (dt) => {
      const now = performance.now();
      const dtMs = Math.min(now - last, 100); last = now;
      this.adaptive.tick(dtMs);
      this.time += dt;
      this.frameNo++;
      this.frame(Math.min(dt, 0.05), dtMs);
    });
    addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mx = (e.clientX - r.left) / r.width; this.my = (e.clientY - r.top) / r.height;
    }, { passive: true });
  }

  private fit(): void {
    const pr = this.adaptive.state.pixelRatio;
    this.canvas.width = Math.floor(innerWidth * pr);
    this.canvas.height = Math.floor(innerHeight * pr);
  }

  // Главный API стройки: один вызов — один объект/система в сцене
  add(e: Omit<Entity, 'id'> & { id?: string }): Entity {
    const full = { id: e.id ?? `e${++seq}`, ...e } as Entity;
    const rnd = (a: number, b: number, i: number) => {
      const x = Math.sin((full.seed ?? 7) * 999 + i * 78.233) * 43758.5453;
      return a + (x - Math.floor(x)) * (b - a);
    };
    const n = full.count ?? (full.type === 'particles' ? 3000 : full.type === 'cube3d' ? 120 : 60);
    full.count = n;
    const items = [];
    for (let i = 0; i < n; i++) {
      items.push({ x: rnd(0, 1, i * 3), y: rnd(0, 1, i * 3 + 1), r: rnd(0, 6.28, i * 3 + 2), s: (full.size ?? 24) * rnd(0.4, 1.4, i), v: (full.speed ?? 0.2) * rnd(0.3, 1.5, i + n) });
    }
    this.lives.push({ ...full, items } as Live);
    if (full.type === 'cube3d') this.ensureLayers();
    if (full.type === 'model' && full.url) {
      this.ensureLayers();
      this.models?.add(full.id, full.url, full.x ?? 0.5, full.y ?? 0.5, (full.size ?? 120) / 150);
    }
    return full;
  }

  remove(id: string): void {
    const was3d = this.lives.some((l) => l.id === id && l.type === 'cube3d');
    const wasModel = this.lives.some((l) => l.id === id && l.type === 'model');
    this.lives = this.lives.filter((l) => l.id !== id);
    if (wasModel) this.models?.remove(id);
    if (was3d) this.ensureLayers();
  }
  clear(type?: EntityType): void {
    this.lives = type ? this.lives.filter((l) => l.type !== type) : [];
    if (!type || type === 'model') this.models?.clear();
    if (!type || type === 'cube3d') this.ensureLayers();
  }

  // GPU-слои. Буфер кубов строится с запасом; если сущностей стало больше — пересборка.
  private cube3dTotal(): number {
    return this.lives.reduce((a, l) => a + (l.type === 'cube3d' ? (l.count ?? 120) : 0), 0);
  }

  private ensureLayers(): void {
    if (!this.opts.glCanvas) return;
    if (!this.glCtx) this.glCtx = this.opts.glCanvas.getContext('webgl') as WebGLRenderingContext | null;
    const total = this.cube3dTotal();
    if (total > 0 && (!this.gl || total > this.glBuilt)) {
      this.glBuilt = Math.max(total, 360);
      this.gl = new GLCubeField({ canvas: this.opts.glCanvas, count: this.glBuilt });
    }
    const needModels = this.lives.some((l) => l.type === 'model' && l.url);
    if (needModels && !this.models) {
      if (!this.queue) this.queue = StreamQueue.forTier(getDevice().tier);
      this.models = new GLModelLayer(this.opts.glCanvas, this.queue);
    }
    if (this.opts.postfx && this.glCtx && !this.fx) this.fx = new PostFx(this.opts.glCanvas, this.glCtx);
  }

  private modelReady(id: string): boolean {
    const m = this.models?.models.find((x) => x.id === id);
    return !!(m && m.gpu[0]);
  }
  get entities(): Entity[] { return this.lives.map(({ items: _items, ...e }) => e); }

  toJSON(): string { return JSON.stringify(this.entities, null, 2); }
  fromJSON(json: string): void {
    this.clear();
    for (const e of JSON.parse(json)) this.add(e);
  }

  // Сводная статистика кадра для HUD и Profiler (stat fps)
  stats(): { fps: number; level: number; draws: number; tris: number; entities: number; modelsReady: number; modelsPending: number } {
    return {
      fps: this.adaptive.fps,
      level: this.adaptive.level,
      draws: (this.gl?.lastDraws ?? 0) + (this.models?.lastDraws ?? 0),
      tris: (this.gl?.lastTris ?? 0) + (this.models?.lastTris ?? 0),
      entities: this.lives.length,
      modelsReady: this.models?.readyCount ?? 0,
      modelsPending: this.models?.pendingCount ?? 0,
    };
  }

  private frame(dt: number, dtMs: number): void {
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height;
    const q = this.adaptive.level; // 0..3 — чем ниже, тем грубее рисуем
    ctx.clearRect(0, 0, W, H);
    const skip = q === 0 ? 3 : q === 1 ? 2 : 1; // LOD: рисуем каждый N-й
    for (const l of this.lives) {
      const col = l.color ?? '#22d3ee';
      if (l.type === 'cube3d' && this.gl) continue; // их рисует GPU-слой ниже
      if (l.type === 'cube3d' && !this.gl) {
        // fallback без glCanvas: 3D-кубы как вращающиеся 2D-квадраты
        ctx.fillStyle = col; ctx.font = '11px monospace';
        ctx.fillText(`cube3d×${l.count ?? 120} (дай glCanvas для GPU)`, 12, H - 12);
      }
      if (l.type === 'text' && l.content) {
        ctx.fillStyle = col; ctx.font = `${Math.floor(H * 0.06)}px system-ui`;
        ctx.fillText(l.content, (l.x ?? 0.08) * W, (l.y ?? 0.2) * H);
        continue;
      }
      if (l.type === 'model') {
        if (this.modelReady(l.id)) continue; // меш уже в GPU — плейсхолдер не нужен
        // ещё грузится (или нет glCanvas): плейсхолдер-бокс с подписью
        ctx.strokeStyle = col; ctx.lineWidth = 2;
        const bx = (l.x ?? 0.5) * W, by = (l.y ?? 0.5) * H, bs = (l.size ?? 120);
        ctx.strokeRect(bx - bs / 2, by - bs / 2, bs, bs);
        ctx.fillStyle = col; ctx.font = '12px monospace';
        ctx.fillText(`3D:${(l.url ?? '?').split('/').pop()} LOD${q}`, bx - bs / 2, by - bs / 2 - 6);
        continue;
      }
      for (let i = 0; i < l.items.length; i += skip) {
        const it = l.items[i];
        it.r += dt * it.v;
        if (l.type === 'particles') {
          it.y -= dt * it.v * 0.15; if (it.y < 0) it.y = 1;
          const dx = it.x - this.mx, dy = it.y - this.my;
          if (dx * dx + dy * dy < 0.004) { it.x += dx * dt * 4; it.y += dy * dt * 4; }
        }
        const X = it.x * W, Y = it.y * H;
        if (l.type === 'spheres') {
          ctx.beginPath(); ctx.arc(X, Y, it.s * 0.4, 0, 6.283);
          ctx.strokeStyle = col; ctx.globalAlpha = 0.7; ctx.stroke(); ctx.globalAlpha = 1;
        } else {
          ctx.save(); ctx.translate(X, Y); ctx.rotate(it.r);
          ctx.strokeStyle = col; ctx.globalAlpha = l.type === 'particles' ? 0.5 : 0.8;
          const s = l.type === 'particles' ? it.s * 0.25 : it.s;
          ctx.strokeRect(-s / 2, -s / 2, s, s);
          ctx.restore(); ctx.globalAlpha = 1;
        }
      }
    }
    // GPU-слой: кубы — одним GLCubeField за 1 draw call, модели — слоем GLModelLayer.
    // Чистим GL-canvas один раз на кадр, дальше слои компонуются по depth buffer.
    // С postfx — всё уходит в FBO и выходит одним fullscreen-pass (+1 draw call).
    const total3d = this.cube3dTotal();
    const hasModels = (this.models?.models.length ?? 0) > 0;
    const drawGL = () => {
      if (this.glCtx) {
        this.glCtx.clearColor(0, 0, 0, 0);
        this.glCtx.clear(this.glCtx.COLOR_BUFFER_BIT | this.glCtx.DEPTH_BUFFER_BIT);
      }
      if (this.gl && total3d > 0) {
        const frac = q === 3 ? 1 : q === 2 ? 0.65 : 0.35; // adaptive LOD для 3D
        this.gl.setQuality(Math.max(1, Math.floor(Math.min(total3d, this.glBuilt) * frac)));
        this.gl.render(performance.now());
      }
      if (this.models && hasModels) this.models.render(performance.now(), q, H / Math.max(W, 1));
    };
    if (total3d > 0 || hasModels) {
      if (this.fx && this.opts.postfx) {
        this.fx.setEnabled(this.adaptive.state.postFX); // слабые — без поста (0 cost)
        this.fx.render(drawGL, this.opts.postfx, performance.now());
      } else drawGL();
    }
    // без glCanvas всё уже нарисовано выше как 2D (fallback), GPU-слой не нужен
    if (this.frameNo % 10 === 0) {
      const s = this.stats();
      if (this.hud) {
        this.hud.textContent = `${s.fps.toFixed(0)} FPS · ${this.tierLabel} · L${s.level} · draw:${s.draws} · tri:${(s.tris / 1000).toFixed(0)}k · ent:${s.entities}` +
          (s.modelsPending > 0 ? ` · 3D грузятся:${s.modelsPending}` : '');
      }
      if (this.opts.profiler) {
        this.opts.profiler.drawCalls = s.draws;
        this.opts.profiler.triangles = s.tris;
        this.opts.profiler.frame(dtMs, { api: this.glCtx ? 'webgl' : '2d', tier: this.tierLabel, level: s.level, active: this.lives.reduce((a, l) => a + (l.count ?? 0), 0) });
      }
    }
  }
}
