// Builds content/articles/catalog.json from the article files, after validating them.
// Publishing a new ready-made article never needs an app change:
//   1. add content/articles/<id>/meta.json and one <LEVEL>.json per available CEFR level (see an existing article);
//   2. run `node scripts/build-article-catalog.mjs` and commit the files with the updated catalog.
// `--check` only verifies that catalog.json is up to date (used by tests/CI) and writes nothing.
// The same files can later be served from a CDN or R2 bucket; the app only reads them over HTTP.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
export const CATEGORIES = {academic: 'Akademik', science: 'Bilim', technology: 'Teknoloji', law: 'Hukuk', economics: 'Ekonomi',
  psychology: 'Psikoloji', history: 'Tarih', health: 'Sağlık', environment: 'Çevre', culture: 'Kültür', other: 'Diğer'};
// Reading speed of a learner at each level (words per minute), for the reading-time estimate.
const WPM = {A1: 90, A2: 100, B1: 120, B2: 140, C1: 160, C2: 180};

const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
const words = t => (t.match(/\S+/g) || []).length;

export function buildCatalog(root) {
  const base = path.join(root, 'content', 'articles'), list = [];
  for (const id of fs.readdirSync(base).filter(n => fs.statSync(path.join(base, n)).isDirectory()).sort()) {
    const where = `content/articles/${id}`, fail = m => { throw new Error(`${where}: ${m}`); };
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id) || id.length > 80) fail('folder name must be lowercase words joined by "-"');
    const meta = read(path.join(base, id, 'meta.json'));
    if (meta.id !== id) fail('meta.json id must equal the folder name');
    for (const k of ['title', 'summary', 'license', 'published']) if (typeof meta[k] !== 'string' || !meta[k].trim()) fail(`meta.json needs "${k}"`);
    if (!CATEGORIES[meta.category]) fail(`unknown category "${meta.category}" (allowed: ${Object.keys(CATEGORIES).join(', ')})`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.published)) fail('published must be YYYY-MM-DD');
    const levels = {};
    let paras = null;
    for (const lv of LEVELS) {
      const file = path.join(base, id, lv + '.json');
      if (!fs.existsSync(file)) continue;
      const a = read(file);
      if (a.id !== id || a.level !== lv) fail(`${lv}.json must have id "${id}" and level "${lv}"`);
      if (typeof a.title !== 'string' || !a.title.trim()) fail(`${lv}.json needs a title`);
      if (!Array.isArray(a.paragraphs) || !a.paragraphs.length) fail(`${lv}.json needs paragraphs`);
      for (const p of a.paragraphs) {
        if (typeof p !== 'string' || !p.trim()) fail(`${lv}.json has an empty paragraph`);
        if (/<\s*[a-z!/]/i.test(p)) fail(`${lv}.json must be plain text (no HTML tags)`);
      }
      // the same paragraph count at every level keeps the reading position when the level is changed
      if (paras === null) paras = a.paragraphs.length;
      else if (a.paragraphs.length !== paras) fail(`${lv}.json has ${a.paragraphs.length} paragraphs, other levels have ${paras}`);
      const w = a.paragraphs.reduce((n, p) => n + words(p), 0);
      levels[lv] = {words: w, minutes: Math.max(1, Math.round(w / WPM[lv]))};
    }
    if (!Object.keys(levels).length) fail('no level files (A1.json … C2.json)');
    list.push({id, category: meta.category, title: meta.title, summary: meta.summary, license: meta.license,
      published: meta.published, paragraphs: paras, levels});
  }
  list.sort((a, b) => b.published.localeCompare(a.published) || a.title.localeCompare(b.title));
  return {format: 'words44-articles', version: 1, updated: list.reduce((m, a) => a.published > m ? a.published : m, ''),
    levels: LEVELS, categories: CATEGORIES, articles: list};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const file = path.join(root, 'content', 'articles', 'catalog.json');
  const text = JSON.stringify(buildCatalog(root), null, 2) + '\n';
  if (process.argv.includes('--check')) {
    const now = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : '';
    if (now !== text) { console.error('content/articles/catalog.json is out of date: run node scripts/build-article-catalog.mjs'); process.exit(1); }
    console.log('Article catalog is up to date.');
  } else {
    fs.writeFileSync(file, text);
    console.log('Wrote content/articles/catalog.json');
  }
}
