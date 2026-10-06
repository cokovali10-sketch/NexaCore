// NEXA Core — physics-worker.ts: вынос физики в Web Worker.
// Main thread делает только render(), физика крутится в фоне.
// Сообщения: {type:'step', dt, mx, my} → {type:'pos', buffer} (transferable, zero-copy).

export interface WorkerHandle {
  step(dt: number, mx: number, my: number): void;
  onPositions(cb: (pos: Float32Array, n: number) => void): void;
  terminate(): void;
}

const WORKER_SRC = `
let px,py,vx,vy,n=0;
onmessage = (e) => {
  const m = e.data;
  if (m.type === 'init') {
    n = m.count;
    px = new Float32Array(n); py = new Float32Array(n);
    vx = new Float32Array(n); vy = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      px[i] = Math.random()*2-1; py[i] = Math.random()*2-1;
      const a = Math.random()*6.283, s = 0.02+Math.random()*0.1;
      vx[i] = Math.cos(a)*s; vy[i] = Math.sin(a)*s;
    }
    postMessage({type:'ready'});
  } else if (m.type === 'step') {
    const dt = m.dt, mx = m.mx, my = m.my;
    const damp = 1 - Math.min(dt*0.6, 0.05);
    const pos = new Float32Array(n*2);
    for (let i = 0; i < n; i++) {
      const dx = px[i]-mx, dy = py[i]-my, d2 = dx*dx+dy*dy;
      if (d2 < 0.02 && d2 > 0.00001) {
        const f = (0.02-d2)*8*dt/Math.sqrt(d2);
        vx[i] += dx*f; vy[i] += dy*f;
      }
      px[i] += vx[i]*dt; py[i] += vy[i]*dt;
      vx[i] *= damp; vy[i] *= damp;
      if (px[i] > 1) px[i] = -1; else if (px[i] < -1) px[i] = 1;
      if (py[i] > 1) py[i] = -1; else if (py[i] < -1) py[i] = 1;
      pos[i*2] = px[i]; pos[i*2+1] = py[i];
    }
    postMessage({type:'pos', pos}, [pos.buffer]);
  }
};`;

export function createWorkerPhysics(count: number): WorkerHandle | null {
  try {
    const blob = new Blob([WORKER_SRC], { type: 'text/javascript' });
    const w = new Worker(URL.createObjectURL(blob));
    let cb: ((pos: Float32Array, n: number) => void) | null = null;
    w.onmessage = (e) => {
      if (e.data.type === 'pos' && cb) cb(e.data.pos as Float32Array, count);
    };
    w.postMessage({ type: 'init', count });
    return {
      step(dt: number, mx: number, my: number) { w.postMessage({ type: 'step', dt, mx, my }); },
      onPositions(f) { cb = f; },
      terminate() { w.terminate(); },
    };
  } catch {
    return null; // нет Worker (SSR/старый браузер) — вызывающий код падает на JsPhysics
  }
}
