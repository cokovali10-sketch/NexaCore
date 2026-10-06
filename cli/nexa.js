#!/usr/bin/env node
// NEXA CLI — `npx nexa optimize ./mysite`
// Аудит как Lighthouse, но заточен под лаги: картинки, шрифты, JS, three.js, canvas.
// Без внешних зависимостей — чистый Node.

const fs = require('fs');
const path = require('path');

const root = process.argv[3] || process.argv[2] || '.';
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Usage: nexa optimize <dir> [--fix]\n  Проверяет сайт и даёт план убийства лагов.');
  process.exit(0);
}
const doFix = process.argv.includes('--fix');

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

const files = walk(root);
let score = 100;
const issues = [];
const fixes = [];

const imgs = files.filter(f => /\.(png|jpe?g|webp|avif|gif)$/i.test(f.p));
let bigImgs = 0;
for (const f of imgs) {
  if (f.size > 500 * 1024) { bigImgs++; score -= 5; issues.push(`IMG ${(f.size / 1024).toFixed(0)}kb без сжатия: ${f.p}`); }
}
if (bigImgs) fixes.push('→ сожми в WebP/AVIF + добавь loading="lazy" (Nexa SmartLoader сделает авто)');

const js = files.filter(f => /\.js$/i.test(f.p));
const jsTotal = js.reduce((a, f) => a + f.size, 0);
if (jsTotal > 800 * 1024) { score -= 15; issues.push(`JS-бандл ${(jsTotal / 1024).toFixed(0)}kb > 800kb — долгая загрузка`); fixes.push('→ code-split + Nexa StreamQueue (приоритет по вьюпорту)'); }

const htmls = files.filter(f => /\.html?$/i.test(f.p));
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
else { console.log('Проблемы:'); issues.slice(0, 20).forEach(i => console.log('  ✕ ' + i)); console.log(''); }
if (fixes.length) { console.log('Как фиксить:'); [...new Set(fixes)].forEach(f => console.log('  ' + f)); console.log(''); }
console.log(`Файлов: ${files.length} · IMG: ${imgs.length} · JS: ${(jsTotal / 1024).toFixed(0)}kb · HTML: ${htmls.length}\n`);

if (doFix) {
  console.log('🛠 --fix: добавляю loading="lazy" в <img> без него...');
  let n = 0;
  for (const f of htmls) {
    let t = fs.readFileSync(f.p, 'utf8');
    const nt = t.replace(/<img(?![^>]*loading=)/gi, '<img loading="lazy"');
    if (nt !== t) { fs.writeFileSync(f.p, nt); n++; }
  }
  console.log(`  Готово: ${n} файлов пропатчено.\n`);
}
