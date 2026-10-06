// NEXA bench — честный замер физики частиц (тот же цикл что в src/physics.ts).
// Запуск (где есть node): node bench/physics.bench.mjs
// Ожидаемо на MID-ноутбуке: 20k ~1-2мс/шаг, 50k ~3-5мс/шаг → запас до бюджета кадра 8мс.
const counts = [8000, 20000, 50000];
for (const n of counts) {
  const px = new Float32Array(n), py = new Float32Array(n), vx = new Float32Array(n), vy = new Float32Array(n);
  for (let i = 0; i < n; i++) { px[i] = Math.random()*2-1; py[i] = Math.random()*2-1; vx[i] = 0.05; vy[i] = -0.03; }
  const dt = 0.016, mx = 999, my = 999;
  const t0 = performance.now();
  const STEPS = 60;
  for (let s = 0; s < STEPS; s++) {
    const damp = 1 - Math.min(dt*0.6, 0.05);
    for (let i = 0; i < n; i++) {
      const dx = px[i]-mx, dy = py[i]-my, d2 = dx*dx+dy*dy;
      if (d2 < 0.02 && d2 > 0.00001) { const f = (0.02-d2)*8*dt/Math.sqrt(d2); vx[i] += dx*f; vy[i] += dy*f; }
      px[i] += vx[i]*dt; py[i] += vy[i]*dt; vx[i] *= damp; vy[i] *= damp;
      if (px[i] > 1) px[i] = -1; else if (px[i] < -1) px[i] = 1;
      if (py[i] > 1) py[i] = -1; else if (py[i] < -1) py[i] = 1;
    }
  }
  const ms = (performance.now()-t0)/STEPS;
  console.log(`${n} particles: ${ms.toFixed(2)}ms/step ${ms < 8 ? 'OK (влезает в бюджет 8мс)' : 'HEAVY (нужен WASM/Worker)'}`);
}
