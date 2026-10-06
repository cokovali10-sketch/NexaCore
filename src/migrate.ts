// NEXA Core — migrate.ts: мост three.js → NEXA (duck-typed, three.js НЕ в зависимостях).
// Сцена three.js описывается как есть (renderer/scene/camera/points/meshes),
// мост переводит: rAF → Scheduler, Points → ParticleField-бюджет, Mesh → LOD-план.
// Ничего не ломает: возвращает план + патчит цикл только при apply:true.

export interface ThreeLike {
  renderer?: { render: (scene: any, camera: any) => void; setPixelRatio?: (n: number) => void };
  scene?: any;
  camera?: any;
  pointsCount?: number;
  meshCount?: number;
  rafIds?: number;
}

export interface MigratePlan {
  steps: string[];
  particleBudget: number;
  lodForMeshes: number;
  pixelRatio: number;
}

export function planMigration(t: ThreeLike, tier: number): MigratePlan {
  const steps: string[] = [];
  if ((t.rafIds ?? 1) > 1) steps.push(`rAF: ${(t.rafIds ?? 1)} цикла → 1 Nexa Scheduler (батч 8мс)`);
  const budget = [2500, 8000, 20000, 50000][Math.max(0, Math.min(3, tier))];
  if ((t.pointsCount ?? 0) > budget) steps.push(`Points: ${t.pointsCount} → бюджет ${budget} (Adaptive срежет сам)`);
  else if ((t.pointsCount ?? 0) > 0) steps.push(`Points: ${t.pointsCount} → ParticleField, 1 draw call`);
  const lod = tier <= 1 ? 2 : 1;
  if ((t.meshCount ?? 0) > 0) steps.push(`Mesh: ${t.meshCount} → ModelManager LOD${lod} + decimate()`);
  steps.push(`PixelRatio: ${tier >= 3 ? 2 : tier === 2 ? 1.5 : 1} (dynamic resolution)`);
  return { steps, particleBudget: budget, lodForMeshes: lod, pixelRatio: tier >= 3 ? 2 : tier === 2 ? 1.5 : 1 };
}

// Перехват цикла three.js: их animate() → внутрь Scheduler (кадр остаётся их, бюджет — наш)
export function adoptLoop(scheduler: { add: (id: string, fn: (dt: number) => void) => void }, id: string, animate: (dt: number) => void): void {
  scheduler.add(id, (dt) => animate(Math.min(dt, 0.05)));
}
