"""NEXA smoke-test. Запуск: python tests/smoke.py (из папки NexaCore).
Проверяет структуру, двуязычность, CLI-команды, CDN-чип и новые модули v0.3.
Выход: PASS/FAIL по каждому пункту + итоговый код возврата."""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
ok = True

def check(name, cond, hint=""):
    global ok
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"  <-- {hint}"))
    if not cond: ok = False

# 1. структура
expected = ["src/index.ts","src/gpu.ts","src/postfx.ts","src/models.ts","src/textures.ts",
  "src/physics.ts","src/physics-worker.ts","src/ktx2.ts","src/basis.ts","src/decimate.ts",
  "src/scene.ts","src/design.ts","src/migrate.ts","src/profiler.ts","src/stream.ts",
  "wasm/physics.rs","wasm/meshopt.rs","cli/nexa.js","adapters/react.ts","adapters/vue.ts","dist/nexa.js",
  "demo/heavy.html","demo/world.html","demo/builder.html","README.md","README_RU.md","README_EN.md",
  "tests/smoke.py","bench/physics.bench.mjs"]
for f in expected:
    check(f"file {f}", (ROOT / f).exists(), "файл отсутствует")

# 2. двуязычность
hub = (ROOT/"README.md").read_text(encoding="utf-8")
check("hub links RU+EN", "README_RU.md" in hub and "README_EN.md" in hub)
ru = (ROOT/"README_RU.md").read_text(encoding="utf-8")
en = (ROOT/"README_EN.md").read_text(encoding="utf-8")
check("RU links EN", "README_EN.md" in ru)
check("EN links RU", "README_RU.md" in en)

# 3. CLI команды
cli = (ROOT/"cli/nexa.js").read_text(encoding="utf-8")
for c in ["optimize","init","scan-three","migrate","--fix","--apply","loading=\"lazy\""]:
    check(f"cli has {c}", c in cli)

# 4. CDN-чип
dist = (ROOT/"dist/nexa.js").read_text(encoding="utf-8")
check("dist exposes Nexa", "window.Nexa" in dist or "window['Nexa']" in dist)
check("dist data-auto", "data-auto" in dist)

# 5. v0.3 модули
postfx = (ROOT/"src/postfx.ts").read_text(encoding="utf-8")
check("postfx real FBO", "createFramebuffer" in postfx and "framebufferTexture2D" in postfx)
pw = (ROOT/"src/physics-worker.ts").read_text(encoding="utf-8")
check("worker zero-copy", "postMessage" in pw and ".buffer" in pw)
ktx = (ROOT/"src/ktx2.ts").read_text(encoding="utf-8")
check("ktx2 detect", "astc" in ktx and "etc2" in ktx and "s3tc" in ktx)
idx = (ROOT/"src/index.ts").read_text(encoding="utf-8")
for m in ["Profiler","StreamQueue","ModelManager","createPhysics","Scene","Design","planMigration","decimate","createWorkerPhysics"]:
    check(f"index exports {m}", m in idx)

print("\nSMOKE: " + ("ALL PASS" if ok else "FAILURES PRESENT"))
sys.exit(0 if ok else 1)
