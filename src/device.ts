// NEXA Core — DeviceTier: определяем мощность устройства один раз
// Это "мозг чипа": от тира зависит всё остальное (частицы, тени, pixelRatio)

export type DeviceTier = 0 | 1 | 2 | 3; // 0=POTATO 1=LOW 2=MID 3=ULTRA

export interface DeviceInfo {
  tier: DeviceTier;
  cores: number;
  memoryGB: number;
  isMobile: boolean;
  hasWebGPU: boolean;
  label: string;
}

let cached: DeviceInfo | null = null;

export function getDevice(): DeviceInfo {
  if (cached) return cached;
  const nav = navigator as any;
  const cores = nav.hardwareConcurrency ?? 4;
  const memoryGB = nav.deviceMemory ?? 4;
  const isMobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 820);
  const hasWebGPU = !!(nav.gpu);

  let score = 0;
  score += Math.min(cores, 12);                    // до 12
  score += Math.min(memoryGB, 8) * 1.5;            // до 12
  if (!isMobile) score += 4;
  if (hasWebGPU) score += 4;

  let tier: DeviceTier = 1;
  let label = 'LOW';
  if (score >= 24) { tier = 3; label = 'ULTRA'; }
  else if (score >= 16) { tier = 2; label = 'MID'; }
  else if (score <= 8) { tier = 0; label = 'POTATO'; }

  cached = { tier, cores, memoryGB, isMobile, hasWebGPU, label };
  return cached;
}

// Сколько можем себе позволить по умолчанию для этого тира
export function budgetFor(tier: DeviceTier) {
  switch (tier) {
    case 3: return { particles: 50000, pixelRatio: Math.min(devicePixelRatio, 2), shadows: true, blur: true, postFX: true };
    case 2: return { particles: 20000, pixelRatio: Math.min(devicePixelRatio, 1.5), shadows: true, blur: false, postFX: true };
    case 1: return { particles: 8000, pixelRatio: 1, shadows: false, blur: false, postFX: false };
    case 0: return { particles: 2500, pixelRatio: 1, shadows: false, blur: false, postFX: false };
  }
}
