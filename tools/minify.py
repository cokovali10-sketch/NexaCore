"""NEXA minify — консервативный минификатор для dist-чипа (без node!).
Убирает только то, что не меняет семантику: блочные комментарии, full-line
// комментарии, пустые строки, висячие отступы. Строки/регексы не трогает.
Запуск: python tools/minify.py  →  dist/nexa.min.js
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "dist" / "nexa.js"
DST = ROOT / "dist" / "nexa.min.js"


def minify(t: str) -> str:
    t = re.sub(r"/\*.*?\*/", "", t, flags=re.S)  # блочные комментарии
    out = []
    for line in t.splitlines():
        s = line.strip()
        if not s or s.startswith("//"):  # пустые + full-line комментарии
            continue
        out.append(s)
    return "\n".join(out) + "\n"


def main() -> None:
    src = SRC.read_text(encoding="utf-8")
    mini = minify(src)
    # страховка: ключевые маркеры обязаны выжить
    for marker in ("window.Nexa", "data-auto", "requestAnimationFrame"):
        assert marker in mini, f"minify сломал файл: нет {marker}"
    DST.write_text(mini, encoding="utf-8")
    print(f"{SRC.name}: {len(src)} -> {DST.name}: {len(mini)} "
          f"(-{(1 - len(mini) / len(src)) * 100:.0f}%)")


if __name__ == "__main__":
    main()
