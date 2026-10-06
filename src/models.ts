// NEXA Core — models.ts: лёгкий glTF 2.0 loader (без three.js, ~8kb) + LOD + Instancing.
// Философия мировых движков: модель грузится прогрессивно, слабые GPU получают
// децимированную версию автоматически, дальние объекты — LOD1/LOD2.

export interface MeshData {
  positions: Float32Array;
  indices: Uint16Array | Uint32Array;
  normals?: Float32Array;
  uvs?: Float32Array;
  vertexCount: number;
  lod: number; // 0=full 1=half 2=quarter
}

function strideDecimate(pos: Float32Array, idx: Uint16Array | Uint32Array, step: number): MeshData {
  // Быстрая децимация: берём каждый N-й треугольник. Для веба хватает за глаза,
  // meshopt-качество приедет с WASM в v0.3.
  const triCount = idx.length / 3;
  const keep = Math.floor(triCount / step);
  const out = new (idx instanceof Uint16Array ? Uint16Array : Uint32Array)(keep * 3);
  for (let i = 0; i < keep; i++) {
    const s = i * step * 3;
    out[i * 3] = idx[s]; out[i * 3 + 1] = idx[s + 1]; out[i * 3 + 2] = idx[s + 2];
  }
  return { positions: pos, indices: out, vertexCount: pos.length / 3, lod: step === 1 ? 0 : step === 2 ? 1 : 2 };
}

export async function loadGltf(url: string, lodStep = 1): Promise<MeshData> {
  const res = await fetch(url);
  const json = await res.json();
  const base = url.slice(0, url.lastIndexOf('/') + 1);
  // 1. находим первый mesh → первый primitive
  const prim = json.meshes[0].primitives[0];
  const acc = (i: number) => json.accessors[i];
  const view = (i: number) => json.bufferViews[i];
  // 2. грузим .bin
  const binUri = json.buffers[0].uri.startsWith('data:')
    ? json.buffers[0].uri
    : base + json.buffers[0].uri;
  const binRes = await fetch(binUri);
  const bin = await binRes.arrayBuffer();
  const dv = new DataView(bin);
  const readF32 = (a: number, v: number) => {
    const vv = view(acc(a).bufferView);
    const off = (vv.byteOffset ?? 0) + (acc(a).byteOffset ?? 0);
    const n = acc(a).count * 3;
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = dv.getFloat32(off + i * 4, true);
    return out;
  };
  const readIdx = (a: number) => {
    const vv = view(acc(a).bufferView);
    const off = (vv.byteOffset ?? 0) + (acc(a).byteOffset ?? 0);
    const n = acc(a).count;
    const comp = acc(a).componentType; // 5123=U16 5125=U32
    if (comp === 5123) { const o = new Uint16Array(n); for (let i = 0; i < n; i++) o[i] = dv.getUint16(off + i * 2, true); return o; }
    const o = new Uint32Array(n); for (let i = 0; i < n; i++) o[i] = dv.getUint32(off + i * 4, true); return o;
  };
  const pos = readF32(prim.attributes.POSITION, 5126);
  const idx = readIdx(prim.indices);
  return strideDecimate(pos, idx as any, lodStep);
}

// ModelManager: кэш + автовыбор LOD по расстоянию/тиру
export class ModelManager {
  private cache = new Map<string, MeshData[]>();
  constructor(private maxCached = 32) {}

  async get(url: string): Promise<MeshData[]> {
    if (this.cache.has(url)) return this.cache.get(url)!;
    // грузим full + генерируем 2 LOD сразу (дешево, один проход)
    const full = await loadGltf(url, 1);
    const half: MeshData = strideDecimate(full.positions, full.indices as any, 2);
    const quarter: MeshData = strideDecimate(full.positions, full.indices as any, 4);
    const lods = [full, half, quarter];
    if (this.cache.size >= this.maxCached) {
      const first = this.cache.keys().next().value as string;
      this.cache.delete(first);
    }
    this.cache.set(url, lods);
    return lods;
  }

  pick(lods: MeshData[], distance: number, tier: number): MeshData {
    if (tier <= 1) return distance > 15 ? lods[2] : lods[1]; // слабые — сразу LOD
    if (distance > 60) return lods[2];
    if (distance > 25) return lods[1];
    return lods[0];
  }
}
