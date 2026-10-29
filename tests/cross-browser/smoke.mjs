// The app's main paths in Safari's engine (WebKit, as an iPhone) and in Firefox, with Playwright. The Chrome tests in
// tests/*.test.mjs cover the details; these check that the same app works in the other browser engines.
// Run: node --test tests/cross-browser/smoke.mjs   (Playwright and its browsers must be installed; see the
// "Tarayıcılar" workflow. PW_MODULE may point to a playwright module outside the repository.)
import {describe, test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {startServer, ROOT} from '../lib/browser.mjs';
import {K, KS, KA} from '../lib/app.mjs';
import {makeDocx} from '../fixtures/docx.mjs';
import {makePdf, PDF_LINES} from '../fixtures/pdf.mjs';
import {makePng} from '../fixtures/png.mjs';

const pw = await import(process.env.PW_MODULE ? pathToFileURL(process.env.PW_MODULE).href : 'playwright');
const FAKES = ['supabase', 'tts', 'ocr'].map(f => fs.readFileSync(path.join(ROOT, 'tests', 'fakes', f + '.js'), 'utf8'));
const ENGINES = (process.env.ENGINES || 'webkit,firefox').split(',');
const DEVICE = {webkit: pw.devices['iPhone 13'], firefox: {viewport: {width: 390, height: 844}}};

for (const engine of ENGINES) describe(engine, () => {
  let srv, browser, ctx, page, dir, errors;
  before(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'w44-xb-'));
    srv = await startServer();
    browser = await pw[engine].launch();
    ctx = await browser.newContext({...DEVICE[engine], acceptDownloads: true});
    for (const f of FAKES) await ctx.addInitScript(f);
    // nothing leaves the test machine: outside services answer "unavailable" (an aborted request would be reported by
    // WebKit as a page error even when the app handles it)
    await ctx.route('**/*', r => r.request().url().startsWith(srv.url) || /^(data|blob):/.test(r.request().url()) ? r.continue()
      : r.fulfill({status: 503, headers: {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}, body: '{}'}));
    page = await ctx.newPage();
    errors = [];
    page.on('pageerror', e => errors.push(String(e.message || e).split('\n')[0]));
    await page.goto(srv.url);
  });
  after(async () => { await browser?.close(); srv?.stop(); if (dir) fs.rmSync(dir, {recursive: true, force: true}); });

  const ev = expr => page.evaluate(expr);
  const waitFor = (expr, timeout = 10000) => page.waitForFunction(expr, null, {timeout});
  const seed = async keys => {
    await ev(`(function(){localStorage.clear();var k=${JSON.stringify(keys)};Object.keys(k).forEach(function(n){localStorage.setItem(n,JSON.stringify(k[n]))})})()`);
    await page.reload(); await waitFor("document.readyState==='complete'");
  };
  const stored = async key => JSON.parse(await ev(`localStorage.getItem(${JSON.stringify(key)})||'null'`));
  const file = (name, data) => { const p = path.join(dir, name); fs.writeFileSync(p, data); return p; };
  const visible = id => ev(`!document.getElementById(${JSON.stringify(id)}).classList.contains('hide')`);

  test('açılıyor; her sekme kendi ekranını gösteriyor; hata yok', async () => {
    await waitFor("!!document.getElementById('v-study')");
    for (const v of ['read', 'list', 'dict', 'prof', 'study']) {
      await page.click('#n-' + v);
      assert.ok(await visible('v-' + v), 'sekme ' + v);
    }
    assert.deepEqual(errors, []);
  });

  test('kelime ekleniyor, listede görünüyor, yeniden açınca kalıcı; aynı kelime ikinci kez eklenmiyor', async () => {
    await seed({[K]: []});
    await page.click('#n-list');
    await page.click('#ltabs [data-lt="add"]');
    await page.fill('#f-w', 'harbour');
    await page.fill('#f-m', 'liman');
    await page.click('#add1');
    await page.reload(); await waitFor("document.readyState==='complete'");
    await page.click('#n-list');
    assert.equal(await page.textContent('#list .wrow b'), 'harbour');
    await page.click('#ltabs [data-lt="add"]');
    await page.fill('#f-w', 'Harbour'); await page.fill('#f-m', 'liman'); await page.click('#add1');
    assert.match(await page.textContent('#t1'), /zaten listende/);
    assert.equal((await stored(K)).length, 1);
    assert.deepEqual(errors, []);
  });

  test('kart çalışma: “Biliyorum” kutuyu artırıyor ve sonraki tekrarı ileri atıyor', async () => {
    await seed({[K]: [{id: 'a1', w: 'apple', m: 'elma', box: 0}]});
    await page.click('#n-study');
    await page.click('#reveal'); // the answer first, as a learner does
    await page.click('#yes');
    await waitFor(`JSON.parse(localStorage.getItem('${K}'))[0].box===1`);
    const w = (await stored(K))[0];
    assert.ok(w.due > new Date().toISOString().slice(0, 10));
    assert.deepEqual(errors, []);
  });

  test('makale: yapıştır, kaydet, oku; kelimeye dokununca kelime kartı açılıyor; sesli okuma oynatıcısı', async () => {
    await seed({[K]: [], [KA]: []});
    await page.click('#n-read');
    await page.click('#rtabs [data-rt="own"]');
    await page.fill('#a-t', 'River');
    await page.fill('#a-x', 'The river was quiet in the morning. Birds sang in the trees near the water.');
    await page.click('#a-s');
    await waitFor("document.body.classList.contains('reading')");
    assert.equal((await stored(KA)).length, 1);
    await page.click('#art .w >> text=river');
    await waitFor("!document.getElementById('sheet').classList.contains('hide')");
    await ev("document.getElementById('sheet').classList.add('hide')");
    await page.click('#r-ra');
    await page.waitForSelector('#rabar');
    assert.equal(await ev("window.__tts.spoken[0].text"), 'The river was quiet in the morning.');
    await page.click('#back');
    assert.equal(await ev("!!document.getElementById('rabar')"), false);
    assert.deepEqual(errors, []);
  });

  test('dosyadan makale: Word (.docx) ve PDF metni geliyor', async () => {
    await seed({[K]: [], [KA]: []});
    await page.click('#n-read');
    await page.click('#rtabs [data-rt="own"]');
    await page.setInputFiles('#a-f', file('notes.docx', makeDocx('<w:p><w:r><w:t>The harbour was busy at dawn.</w:t></w:r></w:p>')));
    await waitFor("document.getElementById('a-x').value.indexOf('harbour was busy')>=0");
    await ev("document.getElementById('a-x').value='';document.getElementById('a-t').value=''");
    await page.setInputFiles('#a-f', file('river.pdf', makePdf()));
    await waitFor("document.getElementById('a-x').value.indexOf('old bridge')>=0", 30000);
    assert.match(await page.inputValue('#a-x'), new RegExp(PDF_LINES[0].slice(0, 20)));
    assert.deepEqual(errors, []);
  });

  test('fotoğraftan makale (sahte metin tanıma): metin ve önizleme geliyor', async () => {
    await seed({[K]: [], [KA]: []});
    await page.click('#n-read');
    await page.click('#rtabs [data-rt="own"]');
    await ev(`window.__ocr.texts=${JSON.stringify(['The market opens early in the morning and the people buy fresh bread and fruit there.'])}`);
    await page.setInputFiles('#a-ig', file('page.png', makePng(900, 1200)));
    await waitFor("/fotoğraf okundu/.test(document.getElementById('a-p').textContent)", 20000);
    assert.match(await page.inputValue('#a-x'), /market opens early/);
    assert.equal(await ev("document.querySelectorAll('#a-phv img').length"), 1);
    assert.deepEqual(errors, []);
  });

  test('yedek: tam yedek indiriliyor; geri yüklemede önce önizleme, onaysız hiçbir şey değişmiyor; birleştirince ekleniyor', async () => {
    await seed({[K]: [{id: 'w1', w: 'apple', m: 'elma', box: 2}], [KS]: {goal: 15}, [KA]: []});
    await page.click('#n-prof');
    await page.click('#ptabs [data-pt="set"]');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#expf')]);
    const backup = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
    assert.equal(backup.format, '44-backup');
    assert.equal(backup.keys[K][0].w, 'apple');
    backup.keys[K].push({id: 'w2', w: 'pear', m: 'armut', box: 0});
    await page.fill('#imp', JSON.stringify(backup));
    await page.click('#impb');
    await page.waitForSelector('#rp-m');
    assert.equal((await stored(K)).length, 1, 'önizlemede kaldı, onaysız eklenmedi');
    await page.click('#rp-m');
    await waitFor("document.getElementById('rprev').innerText.includes('Geri yükleme tamamlandı')");
    assert.deepEqual((await stored(K)).map(w => w.w), ['apple', 'pear']);
    assert.deepEqual(errors, []);
  });

  test('güvenlik kopyası tarayıcının veritabanına (IndexedDB) yazılıyor', async () => {
    await seed({[K]: [{id: 'w1', w: 'apple', m: 'elma', box: 1}]});
    const n = await page.waitForFunction(() => new Promise(r => {
      const q = indexedDB.open('44-guvenlik', 1);
      q.onsuccess = () => { try { const t = q.result.transaction('snaps', 'readonly').objectStore('snaps').getAll(); t.onsuccess = () => r(t.result.length); } catch (e) { r(0); } };
      q.onerror = () => r(0);
    }), null, {timeout: 10000});
    assert.ok(await n.jsonValue() >= 1);
    assert.deepEqual(errors, []);
  });
});
