// Photo → article: pictures taken with the camera or picked from the gallery are read with OCR (a fake Tesseract
// here) on the device; the text goes into the article box for checking and is saved only when the user saves it.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {startServer, openBrowser} from './lib/browser.mjs';
import {K, KA} from './lib/app.mjs';
import {makePng} from './fixtures/png.mjs';

const PAGE1 = 'Unit 3\n\nThe city never\nsleeps at night.\nPeople walk and talk.\n\n';
const PAGE2 = 'Many shops stay open\nuntil late, and the streets are full of light.';
let srv, b, dir;
before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'words44-photos-'));
  srv = await startServer();
  b = await openBrowser({origin: srv.url.slice(0, -1), fakes: ['supabase', 'tts', 'ocr']});
  await b.goto(srv.url);
  await b.seed({[K]: [], [KA]: []});
});
after(async () => { await b?.close(); srv?.stop(); fs.rmSync(dir, {recursive: true, force: true}); });

const file = (name, data) => { const p = path.join(dir, name); fs.writeFileSync(p, data); return p; };
const arts = async () => JSON.parse((await b.storage())[KA] || '[]');
const open = async () => {
  await b.ev("document.getElementById('n-read').click();document.querySelector('#rtabs [data-rt=\"own\"]').click()");
  await b.waitFor("!!document.getElementById('a-ig')");
};

test('galeriden seçilen fotoğrafların metni sırayla kutuya geliyor; büyük fotoğraf küçültülüyor; kaydetmeden hiçbir şey saklanmıyor', async () => {
  await open();
  assert.match(await b.ev("document.getElementById('a-new').textContent"), /Fotoğraf çek.*Fotoğraf seç.*en fazla 10 fotoğraf/s);
  assert.equal(await b.ev("document.getElementById('a-ic').getAttribute('capture')"), 'environment', 'kamera düğmesi arka kamerayı açar');
  await b.ev(`window.__ocr.texts=${JSON.stringify([PAGE1, PAGE2])}`);
  await b.setFiles('#a-ig', [file('p1.png', makePng(3000, 1500)), file('p2.png', makePng(800, 600))]);
  await b.waitFor("/2 fotoğraf okundu/.test(document.getElementById('a-p').textContent)", 15000);
  assert.equal(await b.ev("document.getElementById('a-x').value"),
    '## Unit 3\n\nThe city never sleeps at night. People walk and talk.\n\nMany shops stay open until late, and the streets are full of light.');
  assert.equal(await b.ev("document.getElementById('a-t').value"), 'Fotoğraftan makale');
  assert.deepEqual(await b.ev('window.__ocr.sizes'), [[2400, 1200], [800, 600]]);
  assert.equal(await b.ev('window.__ocr.langs'), 'eng');
  assert.equal(await b.ev('window.__ocr.terminated'), 1, 'tanıma motoru kapatıldı');
  assert.deepEqual(await arts(), [], 'henüz kaydedilmedi');
  // another photo is added after the text that is already there
  await b.ev("window.__ocr.texts=['Page two: the river runs through the old town.']");
  await b.setFiles('#a-ic', [file('p3.png', makePng(400, 300))]);
  await b.waitFor("/1 fotoğraf okundu/.test(document.getElementById('a-p').textContent)", 15000);
  assert.match(await b.ev("document.getElementById('a-p').textContent"), /sonuna eklendi/);
  assert.match(await b.ev("document.getElementById('a-x').value"), /full of light\.\n\nPage two: the river runs through the old town\.$/);
  await b.ev("document.getElementById('a-s').click()");
  await b.waitFor("document.body.classList.contains('reading')");
  const a = await arts();
  assert.equal(a.length, 1);
  assert.equal(a[0].title, 'Fotoğraftan makale');
  assert.match(a[0].text, /^## Unit 3/);
  assert.deepEqual(b.errors, []);
});

test('metin çıkmayan ya da açılamayan fotoğraf: açık uyarı, hiçbir şey değişmiyor', async () => {
  await b.seed({[K]: [], [KA]: []});
  await open();
  await b.ev("window.__ocr.texts=['  ~ ']");
  await b.setFiles('#a-ig', [file('blank.png', makePng(200, 200))]);
  await b.waitFor("/okunabilir İngilizce metin bulunamadı/.test(document.getElementById('a-p').textContent)", 15000);
  assert.equal(await b.ev("document.getElementById('a-x').value"), '');
  await b.setFiles('#a-ig', [file('bozuk.jpg', 'not an image')]);
  await b.waitFor("document.getElementById('a-p').textContent.indexOf('fotoğraf açılamadı (bozuk.jpg)')>=0", 15000);
  assert.match(await b.ev("document.getElementById('a-p').textContent"), /Hiçbir veri değiştirilmedi/);
  assert.equal(await b.ev("document.getElementById('a-x').value"), '');
  assert.deepEqual(await arts(), []);
  assert.deepEqual(b.errors, []);
});
