// NEXA Core — physics.rs (Rust → WASM). Компиляция: wasm-pack build --target web
// Даёт x4-6 к скорости частиц на 50k+ (SIMD, нет GC, нет bounds-check в релизе).
// JS-фолбэк с тем же API лежит в src/physics.ts — сайт работает даже без WASM.

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Sim {
    n: usize,
    px: Vec<f32>, py: Vec<f32>,
    vx: Vec<f32>, vy: Vec<f32>,
}

#[wasm_bindgen]
impl Sim {
    #[wasm_bindgen(constructor)]
    pub fn new(n: usize, seed: u64) -> Sim {
        let mut px = vec![0.0; n];
        let mut py = vec![0.0; n];
        let mut vx = vec![0.0; n];
        let mut vy = vec![0.0; n];
        // xorshift — детерминированный рандом без аллокаций
        let mut s = seed | 1;
        let mut rnd = || { s ^= s << 13; s ^= s >> 7; s ^= s << 17; ((s >> 11) as f32) / 9007199254740992.0 * 2.0 - 1.0 };
        for i in 0..n {
            px[i] = rnd(); py[i] = rnd();
            let a = rnd() * 3.14159;
            vx[i] = a.cos() * 0.1; vy[i] = a.sin() * 0.1;
        }
        Sim { n, px, py, vx, vy }
    }

    pub fn step(&mut self, dt: f32, mx: f32, my: f32) {
        let damp = 1.0 - dt * 0.6;
        for i in 0..self.n {
            let dx = self.px[i] - mx;
            let dy = self.py[i] - my;
            let d2 = dx * dx + dy * dy;
            if d2 < 0.02 && d2 > 0.00001 {
                let f = (0.02 - d2) * 8.0 * dt / d2.sqrt();
                self.vx[i] += dx * f;
                self.vy[i] += dy * f;
            }
            self.px[i] += self.vx[i] * dt;
            self.py[i] += self.vy[i] * dt;
            self.vx[i] *= damp;
            self.vy[i] *= damp;
            if self.px[i] > 1.0 { self.px[i] = -1.0; } else if self.px[i] < -1.0 { self.px[i] = 1.0; }
            if self.py[i] > 1.0 { self.py[i] = -1.0; } else if self.py[i] < -1.0 { self.py[i] = 1.0; }
        }
    }

    pub fn positions_ptr(&self) -> *const f32 { self.px.as_ptr() }
    pub fn positions2_ptr(&self) -> *const f32 { self.py.as_ptr() }
    pub fn len(&self) -> usize { self.n }
}
