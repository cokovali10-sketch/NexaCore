// NEXA Core — adapters/react.ts
// import { useNexa } from '@nexa/core/adapters/react';
// function Bg(){ const ref = useNexa({particles:true}); return <canvas ref={ref}/> }

import { useEffect, useRef } from 'react';
import { Nexa } from '../src/index.js';

export function useNexa(opts: { particles?: boolean; hud?: boolean } = {}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) void Nexa.boot({ canvas: ref.current, particles: opts.particles, hud: opts.hud });
  }, []);
  return ref;
}
