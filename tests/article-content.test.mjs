// Ready-made article content: the published catalog is up to date and the validator rejects unsafe or inconsistent
// articles before they can be published.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildCatalog, LEVELS} from '../scripts/build-article-catalog.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('makale kataloğu güncel ve her makale tutarlı (aynı paragraf sayısı, lisans, kategori, seviye süreleri)', () => {
  const run = spawnSync(process.execPath, ['scripts/build-article-catalog.mjs', '--check'], {cwd: root, encoding: 'utf8'});
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const cat = buildCatalog(root);
  assert.ok(cat.articles.length >= 3, 'ilk sürümde en az 3 makale');
  for (const a of cat.articles) {
    assert.ok(a.license.trim() && a.summary.trim(), a.id + ': lisans ve özet');
    // every ready-made article is illustrated: an openly licensed photo with its credit (checked by the build script)
    assert.ok(a.image && a.image.credit && a.image.license, a.id + ': fotoğraf, sahibi ve lisansı');
    assert.deepEqual(Object.keys(a.levels), LEVELS, a.id + ': ilk makalelerin A1–C2 sürümleri var');
    const counts = LEVELS.map(lv => JSON.parse(fs.readFileSync(path.join(root, 'content/articles', a.id, lv + '.json'), 'utf8')).paragraphs.length);
    assert.equal(new Set(counts).size, 1, a.id + ': her seviyede aynı paragraf sayısı');
    assert.ok(a.levels.A1.words < a.levels.C1.words, a.id + ': üst seviye daha kapsamlı');
  }
});

function draft(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'words44-content-'));
  const art = path.join(dir, 'content/articles/test-article');
  fs.mkdirSync(art, {recursive: true});
  const meta = {id: 'test-article', category: 'science', title: 'Test', summary: 'Özet', license: 'Özgün', published: '2026-10-23'};
  const lv = {A1: {id: 'test-article', level: 'A1', title: 'Test', paragraphs: ['One.', 'Two.']},
    B1: {id: 'test-article', level: 'B1', title: 'Test', paragraphs: ['One longer.', 'Two longer.']}};
  mutate(meta, lv);
  fs.writeFileSync(path.join(art, 'meta.json'), JSON.stringify(meta));
  for (const [k, v] of Object.entries(lv)) fs.writeFileSync(path.join(art, k + '.json'), JSON.stringify(v));
  return dir;
}

test('yayın doğrulaması güvenli olmayan ya da tutarsız makaleleri reddediyor', () => {
  const ok = draft(() => {});
  assert.deepEqual(Object.keys(buildCatalog(ok).articles[0].levels), ['A1', 'B1'], 'geçerli taslak kabul edilir');
  const bad = [
    ['HTML etiketi', (m, l) => { l.A1.paragraphs[0] = 'Click <img src=x onerror=alert(1)>'; }, /plain text/],
    ['paragraf sayısı', (m, l) => { l.B1.paragraphs.push('Three.'); }, /paragraphs/],
    ['kategori', m => { m.category = 'unknown'; }, /unknown category/],
    ['lisans', m => { m.license = ''; }, /license/],
    ['seviye adı', (m, l) => { l.A1.level = 'B1'; }, /level/]
  ];
  for (const [name, mutate, re] of bad) {
    const dir = draft(mutate);
    assert.throws(() => buildCatalog(dir), re, name);
    fs.rmSync(dir, {recursive: true, force: true});
  }
  fs.rmSync(ok, {recursive: true, force: true});
});

// a valid news draft: all six levels growing in length, short A1 sentences, sources and an openly licensed photo
function newsDraft(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'words44-news-'));
  const art = path.join(dir, 'content/articles/test-news');
  fs.mkdirSync(art, {recursive: true});
  fs.writeFileSync(path.join(art, 'photo.jpg'), Buffer.alloc(1000));
  const meta = {id: 'test-news', category: 'news', title: 'Test', summary: 'Özet', license: 'Özgün', published: '2026-10-24',
    image: {file: 'photo.jpg', alt: 'Bir fotoğraf', credit: 'NASA', license: 'Kamu malı', source: 'https://commons.wikimedia.org/wiki/File:X.jpg'},
    sources: [{title: 'Kaynak', url: 'https://example.org/news'}], vocab: [{w: 'rover', tr: 'keşif aracı'}]};
  const lv = {};
  LEVELS.forEach((l, i) => { lv[l] = {id: 'test-news', level: l, title: 'Test', paragraphs: ['A short line. ' + 'more words here. '.repeat(i + 1)], questions: [{q: 'Why?', a: 'Because.'}]}; });
  mutate(meta, lv, art);
  fs.writeFileSync(path.join(art, 'meta.json'), JSON.stringify(meta));
  for (const [k, v] of Object.entries(lv)) fs.writeFileSync(path.join(art, k + '.json'), JSON.stringify(v));
  return dir;
}

test('haber doğrulaması: kaynak, lisanslı fotoğraf ve gerçekten farklı seviyeler zorunlu', () => {
  const ok = newsDraft(() => {});
  const a = buildCatalog(ok).articles[0];
  assert.equal(a.image.src, 'test-news/photo.jpg');
  assert.deepEqual(a.sources, [{title: 'Kaynak', url: 'https://example.org/news'}]);
  assert.deepEqual(a.vocab, [{w: 'rover', tr: 'keşif aracı'}]);
  fs.rmSync(ok, {recursive: true, force: true});
  const bad = [
    ['kaynak yok', m => { delete m.sources; }, /news needs "sources"/],
    ['fotoğraf yok', m => { delete m.image; }, /news needs an openly licensed "image"/],
    ['fotoğraf sahibi yok', m => { m.image.credit = ''; }, /credit/],
    ['http kaynak', m => { m.sources[0].url = 'http://example.org'; }, /https/],
    ['eksik fotoğraf dosyası', m => { m.image.file = 'nope.jpg'; }, /missing/],
    ['çok büyük fotoğraf', (m, l, art) => { fs.writeFileSync(path.join(art, 'photo.jpg'), Buffer.alloc(500 * 1024)); }, /larger than/],
    ['eksik seviye', (m, l) => { delete l.C2; }, /all six levels/],
    ['uzun A1 cümleleri', (m, l) => { l.A1.paragraphs = ['This sentence in the easiest level goes on and on with far too many words for a beginner reader.']; }, /A1 sentences are too long/],
    ['kısalan seviye', (m, l) => { l.B2.paragraphs = ['Short.']; }, /B2 is shorter than B1/],
    ['HTML soru', (m, l) => { l.B1.questions = [{q: '<b>Why</b>', a: 'x'}]; }, /questions/]
  ];
  for (const [name, mutate, re] of bad) {
    const dir = newsDraft(mutate);
    assert.throws(() => buildCatalog(dir), re, name);
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

// two articles in one draft library, each with a photo (bytes and Commons page chosen by the caller)
function twoArticles(a, b) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'words44-photos-'));
  for (const [id, bytes, source] of [['first-one', ...a], ['second-one', ...b]]) {
    const art = path.join(dir, 'content/articles', id);
    fs.mkdirSync(art, {recursive: true});
    fs.writeFileSync(path.join(art, 'image.jpg'), bytes);
    fs.writeFileSync(path.join(art, 'meta.json'), JSON.stringify({id, category: 'science', title: 'T', summary: 'Ö', license: 'Özgün', published: '2026-10-25',
      image: {file: 'image.jpg', alt: 'Bir fotoğraf', credit: 'X', license: 'CC0', source}}));
    fs.writeFileSync(path.join(art, 'B1.json'), JSON.stringify({id, level: 'B1', title: 'T', paragraphs: ['One line here.']}));
  }
  return dir;
}

test('her makalenin fotoğrafı farklı: aynı Commons sayfası ya da aynı dosya ikinci kez kullanılamaz', () => {
  const C = 'https://commons.wikimedia.org/wiki/File:';
  const ok = twoArticles([Buffer.from('photo one'), C + 'A_bee.jpg'], [Buffer.from('photo two'), C + 'A_clock.jpg']);
  assert.equal(buildCatalog(ok).articles.length, 2, 'farklı fotoğraflar kabul edilir');
  const cases = [
    ['aynı sayfa', twoArticles([Buffer.from('photo one'), C + 'A_bee.jpg'], [Buffer.from('photo two'), C + 'A_bee.jpg']), /already used by first-one/],
    ['aynı sayfa, farklı yazım', twoArticles([Buffer.from('photo one'), C + 'A_bee.jpg'], [Buffer.from('photo two'), C + 'A%20bee.jpg']), /already used by first-one/],
    ['aynı dosya, farklı sayfa', twoArticles([Buffer.from('same bytes'), C + 'A_bee.jpg'], [Buffer.from('same bytes'), C + 'Copy_of_bee.jpg']), /identical to the one used by first-one/]
  ];
  for (const [name, dir, re] of cases) {
    assert.throws(() => buildCatalog(dir), re, name);
    fs.rmSync(dir, {recursive: true, force: true});
  }
  fs.rmSync(ok, {recursive: true, force: true});
});
