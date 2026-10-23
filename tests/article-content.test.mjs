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
