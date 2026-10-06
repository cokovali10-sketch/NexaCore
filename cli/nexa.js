#!/usr/bin/env node
// NEXA CLI v0.3 — команды:
//   nexa optimize <dir> [--fix]   — аудит как Lighthouse, заточен под лаги
//   nexa init <dir>                — скаффолд: nexa.config + инъекция чипа в index.html
//   nexa scan-three <dir>          — разбор three.js-проекта: что тянет вес, план миграции на ядро
// Без внешних зависимостей — чистый Node.

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const KNOWN = ['optimize', 'init', 'scan-three', 'migrate'];
const cmd = KNOWN.includes(args[0]) ? args[0] : 'optimize';
const root = (KNOWN.includes(args[0]) ? args[1] : args[0]) || '.';
const doFix = args.includes('--fix');
const doApply = args.includes('--apply');

if (args.includes('--help') || args.includes('-h')) {
  console.log([
    'Usage:',
    '  nexa optimize <dir> [--fix]  аудит сайта, score 0-100 + автофикс lazy',
    '  nexa init <dir>               создать nexa.config + вставить чип в index.html',
    '  nexa scan-three <dir>         найти three.js, оценить вес, дать план миграции',
    '  nexa migrate <dir> [--apply] сгенерировать план миграции (с --apply вставит чип)',
  ].join('\n'));
  process.exit(0);
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const s = fs.statSync(p);
    if (s.isDirectory()) { if (!/node_modules|\.git|dist|build/.test(p)) walk(p, out); }
    else out.push({ p, size: s.size });
  }
  return out;
}

// ---------- init ----------
if (cmd === 'init') {
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  const cfg = path.join(root, 'nexa.config.json');
  if (!fs.existsSync(cfg)) {
    fs.writeFileSync(cfg, JSON.stringify({
      particles: 20000, profiler: true, hud: false,
      canvases: { bg: '#bg', gl: '#gl' },
      assets: { concurrency: 'auto', lazyMargin: '600px' },
      textures: { prefer: 'ktx2', fallback: 'webp' },
    }, null, 2));
    console.log('  + nexa.config.json');
  } else console.log('  = nexa.config.json уже есть');
  const idx = path.join(root, 'index.html');
  const tag = '<script src="https://cdn.nexa/core.js" data-auto></script>';
  if (fs.existsSync(idx)) {
    let t = fs.readFileSync(idx, 'utf8');
    if (!/cdn\.nexa\/core\.js|NexaCore|dist\/nexa\.js/.test(t)) {
      t = t.replace(/<\/body>/i, '  ' + tag + '\n</body>');
      fs.writeFileSync(idx, t);
      console.log('  + чип вставлен в index.html');
    } else console.log('  = чип уже вставлен');
  } else {
    fs.writeFileSync(idx, ['<!doctype html>', '<html lang="ru"><head><meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width,initial-scale=1">',
      '<title>NEXA site</title>',
      '<style>*{margin:0;box-sizing:border-box}body{background:#04060e;color:#e2e8f0;font-family:system-ui}',
      '#gl{position:fixed;inset:0;width:100vw;height:100vh}#bg{position:fixed;inset:0;width:100vw;height:100vh}',
      'main{position:relative;z-index:1;max-width:900px;margin:0 auto;padding:80px 20px}</style></head>',
      '<body>',
      '<canvas id="gl"></canvas><!-- GPU-слой: cube3d + glTF -->',
      '<canvas id="bg"></canvas><!-- 2D-слой: частицы, текст -->',
      '<main><h1 style="font-size:clamp(36px,7vw,72px)">Мой сайт <span style="color:#22d3ee">на NEXA</span></h1>',
      '<p style="opacity:.7">Чип уже работает (фон-частицы). Раскомментируй Scene ниже — и строй 3D прямо в ядре.</p></main>',
      '<!-- Мгновенный старт без сборки: частицы + автовыбор качества -->',
      '  ' + tag,
      '<!-- Апгрейд до конструктора (нужен npm-пакет @nexa/core):',
      '<script type="module">',
      "import { Scene, Design } from '@nexa/core';",
      'const scene = new Scene(document.getElementById("bg"), { glCanvas: document.getElementById("gl"), hud: true });',
      "scene.add({ type: 'particles', count: 15000 });",
      "scene.add({ type: 'cube3d', count: 120 });",
      "scene.add({ type: 'model', url: 'hero.glb', x: 0.5, y: 0.5 });",
      "new Design().apply('abyss');",
      '</script>-->',
      '</body></html>'].join('\n'));
    console.log('  + создан index.html: 2 canvas (2D + GPU) + чип + Scene-заготовка');
  }
  console.log('\n⚡ nexa init готово: открой index.html и кайфуй.\n');
  process.exit(0);
}

// ---------- scan-three ----------
if (cmd === 'scan-three') {
  const files = walk(root);
  const js = files.filter((f) => /\.(js|ts|tsx|jsx|mjs)$/i.test(f.p));
  const hits = [];
  for (const f of js) {
    try {
      const t = fs.readFileSync(f.p, 'utf8');
      const mods = [...t.matchAll(/from\s+['"]three(\/[^'"]*)?['"]/g)].map((m) => m[1] || '/core');
      const req = (t.match(/require\(['"]three[^'"]*['"]\)/g) || []).length;
      const raf = (t.match(/requestAnimationFrame/g) || []).length;
      const news = (t.match(/new\s+(WebGLRenderer|PerspectiveCamera|Points|InstancedMesh)/g) || []).length;
      if (mods.length || req || /three/i.test(t)) hits.push({ f: f.p, size: f.size, mods, req, raf, news });
    } catch {}
  }
  const total = hits.reduce((a, h) => a + h.size, 0);
  console.log(`\n⚡ NEXA scan-three — ${root}\nthree.js файлов: ${hits.length} · вес: ${(total / 1024).toFixed(0)}kb\n`);
  hits.slice(0, 15).forEach((h) =>
    console.log(`  • ${h.f} (${(h.size / 1024).toFixed(1)}kb) mods:[${h.mods.join(',') || '-'}] rAF:${h.raf} three-объектов:${h.news}`));
  if (!hits.length) { console.log('  three.js не найден — либо уже чисто, либо движок в CDN-теге.\n'); process.exit(0); }
  console.log('\nПлан миграции на NEXA:');
  console.log('  1. rAF-циклы → один Nexa Scheduler (src/scheduler.ts)');
  console.log('  2. Points/Particles → ParticleField (1 draw call, WASM-физика)');
  console.log('  3. Модели → ModelManager: glTF + LOD0/1/2 по дистанции и тиру');
  console.log('  4. Текстуры → Atlas + ktx2.ts (ASTC/ETC2/S3TC → webp fallback)\n');
  process.exit(0);
}

// ---------- migrate: план + опциональная вставка чипа ----------
if (cmd === 'migrate') {
  const files = walk(root);
  const htmls = files.filter((f) => /\.html?$/i.test(f.p));
  const js = files.filter((f) => /\.(js|ts|tsx|jsx)$/i.test(f.p));
  let rafTotal = 0, threeFiles = 0;
  for (const f of [...htmls, ...js]) {
    try {
      const t = fs.readFileSync(f.p, 'utf8');
      rafTotal += (t.match(/requestAnimationFrame/g) || []).length;
      if (/three|WebGLRenderer|THREE\./.test(t)) threeFiles++;
    } catch {}
  }
  console.log(`\n⚡ NEXA migrate — ${root}\nrAF-циклов: ${rafTotal} · three.js-файлов: ${threeFiles}\n`);
  console.log('План:');
  console.log('  1. Цикл three.js → adoptLoop(scheduler, id, animate) (src/migrate.ts)');
  console.log('  2. Points → ParticleField / Scene.add({type:\'particles\'})');
  console.log('  3. Mesh → ModelManager + decimate() (LOD по тиру)');
  console.log('  4. Текстуры → basis.ts (KTX2) с webp-fallback\n');
  if (doApply) {
    const idx = htmls.length ? htmls[0].p : path.join(root, 'index.html');
    const tag = '<script src="https://cdn.nexa/core.js" data-auto></script>';
    let t = fs.existsSync(idx) ? fs.readFileSync(idx, 'utf8') : '<!doctype html><html><body></body></html>';
    if (!/cdn\.nexa\/core\.js/.test(t)) {
      t = t.replace(/<\/body>/i, '  ' + tag + '\n</body>');
      fs.writeFileSync(idx, t);
      console.log(`  + чип вставлен: ${idx}\n`);
    } else console.log('  = чип уже есть\n');
  } else console.log('Запусти с --apply чтобы вставить чип автоматически.\n');
  process.exit(0);
}

// ---------- optimize (как раньше, расширено) ----------
const files = walk(root);
let score = 100;
const issues = [];
const fixes = [];

const imgs = files.filter((f) => /\.(png|jpe?g|webp|avif|gif)$/i.test(f.p));
let bigImgs = 0;
for (const f of imgs) {
  if (f.size > 500 * 1024) { bigImgs++; score -= 5; issues.push(`IMG ${(f.size / 1024).toFixed(0)}kb без сжатия: ${f.p}`); }
}
if (bigImgs) fixes.push('→ сожми в WebP/AVIF + добавь loading="lazy" (Nexa SmartLoader сделает авто)');

const js = files.filter((f) => /\.js$/i.test(f.p));
const jsTotal = js.reduce((a, f) => a + f.size, 0);
if (jsTotal > 800 * 1024) { score -= 15; issues.push(`JS-бандл ${(jsTotal / 1024).toFixed(0)}kb > 800kb — долгая загрузка`); fixes.push('→ code-split + Nexa StreamQueue (приоритет по вьюпорту)'); }

const htmls = files.filter((f) => /\.html?$/i.test(f.p));
let noLazy = 0, noNexa = true;
for (const f of htmls) {
  try {
    const t = fs.readFileSync(f.p, 'utf8');
    if (/<img(?![^>]*loading=)/i.test(t)) noLazy++;
    if (/nexa|NexaCore/i.test(t)) noNexa = false;
    if (/three\.js|three\.min/i.test(t) && !/importmap|module/i.test(t)) { score -= 8; issues.push(`three.js через старый script-тег в ${f.p} — тянет весь движок`); }
    if ((t.match(/requestAnimationFrame/g) || []).length > 3) { score -= 8; issues.push(`${f.p}: ${(t.match(/requestAnimationFrame/g) || []).length} rAF-циклов — дерутся за кадр`); fixes.push('→ замени на один Nexa Scheduler (батч 8мс)'); }
  } catch {}
}
if (noLazy) { score -= 10; issues.push(`${noLazy} HTML без loading="lazy" на картинках`); }
if (noNexa) fixes.push('→ вставь чип: <script src="https://cdn.nexa/core.js" data-auto> (≈9kb, всё остальное само)');

score = Math.max(0, Math.min(100, score));
const grade = score >= 90 ? 'S (мировой уровень)' : score >= 75 ? 'A' : score >= 55 ? 'B' : 'C (лагает)';

console.log(`\n⚡ NEXA Audit — ${root}\nScore: ${score}/100 → ${grade}\n`);
if (!issues.length) console.log('  Чисто. Лагов нет, ты монстр.\n');
else { console.log('Проблемы:'); issues.slice(0, 20).forEach((i) => console.log('  ✕ ' + i)); console.log(''); }
if (fixes.length) { console.log('Как фиксить:'); [...new Set(fixes)].forEach((f) => console.log('  ' + f)); console.log(''); }
console.log(`Файлов: ${files.length} · IMG: ${imgs.length} · JS: ${(jsTotal / 1024).toFixed(0)}kb · HTML: ${htmls.length}\n`);

if (doFix) {
  console.log('🛠 --fix: добавляю loading="lazy" в <img> без него...');
  let n = 0;
  for (const f of htmls) {
    const t = fs.readFileSync(f.p, 'utf8');
    const nt = t.replace(/<img(?![^>]*loading=)/gi, '<img loading="lazy"');
    if (nt !== t) { fs.writeFileSync(f.p, nt); n++; }
  }
  console.log(`  Готово: ${n} файлов пропатчено.\n`);
}
