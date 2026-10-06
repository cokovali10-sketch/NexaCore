// NEXA Core — decimate.ts: децимация мешей на JS + Rust-исходник в wasm/meshopt.rs.
// JS-версия: stride + сварка дубликатов позиций (хеш по квантованной координате).
// Убирает до 75% треугольников и дубли — хватает для LOD1/LOD2 без WASM.

import type { MeshData } from './models.js';

export function weld(pos: Float32Array, idx: Uint16Array | Uint32Array): { pos: Float32Array; idx: Uint16Array | Uint32Array } {
  const map = new Map<string, number>();
  const remap = new Int32Array(pos.length / 3);
  const out: number[] = [];
  for (let i = 0; i < pos.length / 3; i++) {
    const k = `${Math.round(pos[i * 3] * 1e4)},${Math.round(pos[i * 3 + 1] * 1e4)},${Math.round(pos[i * 3 + 2] * 1e4)}`;
    let id = map.get(k);
    if (id === undefined) { id = out.length / 3; map.set(k, id); out.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); }
    remap[i] = id;
  }
  const U = out.length / 3 > 65535 ? Uint32Array : Uint16Array;
  const ni = new U(idx.length);
  for (let i = 0; i < idx.length; i++) ni[i] = remap[idx[i]];
  return { pos: new Float32Array(out), idx: ni };
}

export function decimate(pos: Float32Array, idx: Uint16Array | Uint32Array, ratio: number): MeshData {
  const step = Math.max(1, Math.round(1 / Math.max(ratio, 0.05)));
  const keep = Math.floor(idx.length / 3 / step);
  const U = idx instanceof Uint16Array && pos.length / 3 < 65535 ? Uint16Array : Uint32Array;
  const out = new U(keep * 3);
  for (let i = 0; i < keep; i++) {
    const s = i * step * 3;
    out[i * 3] = idx[s]; out[i * 3 + 1] = idx[s + 1]; out[i * 3 + 2] = idx[s + 2];
  }
  const w = weld(pos, out as any);
  return { positions: w.pos, indices: w.idx as any, vertexCount: w.pos.length / 3, lod: ratio >= 0.9 ? 0 : ratio >= 0.4 ? 1 : 2 };
}
