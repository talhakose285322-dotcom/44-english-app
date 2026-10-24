// Builds content/articles/catalog.json from the article files, after validating them.
// Publishing a new ready-made article never needs an app change:
//   1. add content/articles/<id>/meta.json and one <LEVEL>.json per available CEFR level (see an existing article);
//   2. run `node scripts/build-article-catalog.mjs` and commit the files with the updated catalog.
// `--check` only verifies that catalog.json is up to date (used by tests/CI) and writes nothing.
// The same files can later be served from a CDN or R2 bucket; the app only reads them over HTTP.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
export const CATEGORIES = {news: 'Haberler', academic: 'Akademik', science: 'Bilim', technology: 'Teknoloji', law: 'Hukuk', economics: 'Ekonomi',
  psychology: 'Psikoloji', history: 'Tarih', health: 'Sağlık', environment: 'Çevre', culture: 'Kültür', other: 'Diğer'};
const IMAGE_MAX = 400 * 1024;
// Reading speed of a learner at each level (words per minute), for the reading-time estimate.
const WPM = {A1: 90, A2: 100, B1: 120, B2: 140, C1: 160, C2: 180};

const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
const words = t => (t.match(/\S+/g) || []).length;
const plain = t => typeof t === 'string' && t.trim() && !/<\s*[a-z!/]/i.test(t);
const https = u => typeof u === 'string' && /^https:\/\/[^\s<>"']+$/.test(u);
const sentenceLength = ps => { const s = ps.join(' ').split(/[.!?]+\s/).filter(x => x.trim()); return s.reduce((n, x) => n + words(x), 0) / Math.max(1, s.length); };

// Optional extras (news and illustrated articles): a photo with its credit and licence, source links, key words and,
// per level, comprehension questions. News must name its sources and have an openly licensed photo.
function extras(meta, base, id, fail) {
  const out = {};
  if (meta.image !== undefined) {
    const im = meta.image;
    if (!im || !/^[a-z0-9-]+\.(jpg|jpeg|png|webp)$/.test(im.file || '')) fail('image.file must be a lowercase .jpg/.png/.webp name in the article folder');
    const f = path.join(base, id, im.file);
    if (!fs.existsSync(f)) fail(`image file ${im.file} is missing`);
    if (fs.statSync(f).size > IMAGE_MAX) fail(`image ${im.file} is larger than ${IMAGE_MAX / 1024} KB; use a smaller copy`);
    for (const k of ['alt', 'credit', 'license']) if (!plain(im[k])) fail(`image needs "${k}" as plain text`);
    if (!https(im.source)) fail('image.source must be the https address of the photo’s page (its licence)');
    out.image = {src: `${id}/${im.file}`, alt: im.alt, credit: im.credit, license: im.license, source: im.source};
  }
  if (meta.sources !== undefined) {
    if (!Array.isArray(meta.sources) || !meta.sources.length || meta.sources.some(s => !s || !plain(s.title) || !https(s.url))) fail('sources must be a list of {title, url} with https addresses');
    out.sources = meta.sources.map(s => ({title: s.title, url: s.url}));
  }
  if (meta.vocab !== undefined) {
    if (!Array.isArray(meta.vocab) || meta.vocab.length > 12 || meta.vocab.some(v => !v || !plain(v.w) || !plain(v.tr))) fail('vocab must be up to 12 {w, tr} entries');
    out.vocab = meta.vocab.map(v => ({w: v.w, tr: v.tr}));
  }
  if (meta.category === 'news') {
    if (!out.sources) fail('news needs "sources"');
    if (!out.image) fail('news needs an openly licensed "image"');
  }
  return out;
}

export function buildCatalog(root) {
  const base = path.join(root, 'content', 'articles'), list = [];
  // every article has its own photo: the same Commons page or the same image file may not be used twice
  const photoBySource = {}, photoByHash = {};
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
      if (a.questions !== undefined && (!Array.isArray(a.questions) || a.questions.length > 5 || a.questions.some(q => !q || !plain(q.q) || !plain(q.a)))) fail(`${lv}.json questions must be up to 5 {q, a} entries`);
      const w = a.paragraphs.reduce((n, p) => n + words(p), 0);
      levels[lv] = {words: w, minutes: Math.max(1, Math.round(w / WPM[lv]))};
      if (meta.category === 'news') levels[lv].sl = sentenceLength(a.paragraphs);
    }
    if (!Object.keys(levels).length) fail('no level files (A1.json … C2.json)');
    const ex = extras(meta, base, id, fail);
    if (ex.image) {
      const src = decodeURIComponent(ex.image.source).replace(/_/g, ' ').toLowerCase();
      const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(base, id, meta.image.file))).digest('hex');
      if (photoBySource[src]) fail(`photo ${ex.image.source} is already used by ${photoBySource[src]}; choose a different photo`);
      if (photoByHash[hash]) fail(`photo file is identical to the one used by ${photoByHash[hash]}; choose a different photo`);
      photoBySource[src] = id; photoByHash[hash] = id;
    }
    if (meta.category === 'news') {
      // the levels must really differ: A1 short and simple, each level up to B2 at least as long as the one before
      if (!LEVELS.every(l => levels[l])) fail('news needs all six levels');
      if (levels.A1.sl > 12) fail(`A1 sentences are too long (${levels.A1.sl.toFixed(1)} words on average, at most 12)`);
      for (let i = 1; i < 4; i++) if (levels[LEVELS[i]].words < levels[LEVELS[i - 1]].words) fail(`${LEVELS[i]} is shorter than ${LEVELS[i - 1]}`);
      for (const l of LEVELS) delete levels[l].sl;
    }
    list.push({id, category: meta.category, title: meta.title, summary: meta.summary, license: meta.license,
      published: meta.published, paragraphs: paras, levels, ...ex});
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
