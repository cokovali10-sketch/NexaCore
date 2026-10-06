// NEXA Core — wasm/meshopt.rs: Rust-децимация (заготовка под wasm-pack).
// Цель: edge-collapse с квадриками как в meshopt — x10 быстрее JS на 500k треугольников.
// JS-фолбэк с тем же смыслом: src/decimate.ts (stride + weld).

// Компиляция: wasm-pack build wasm --target web --out-dir ../wasm/pkg
// (требует crate meshopt — подключается при сборке, ядро без него работает).

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn decimate_stride(index_count: usize, step: usize) -> Vec<u32> {
    // Возвращает список KEEP-индексов треугольников (каждый step-й).
    // Полный weld/edge-collapse — в pkg-версии с meshopt; здесь детерминированный сэмплинг.
    let tris = index_count / 3;
    let keep = tris / step.max(1);
    let mut out = Vec::with_capacity(keep * 3);
    for t in 0..keep {
        let s = (t * step * 3) as u32;
        out.push(s);
        out.push(s + 1);
        out.push(s + 2);
    }
    out
}
