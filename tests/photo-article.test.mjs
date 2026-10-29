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
  await b.setFiles('#a-ig', [file('p1.png', makePng(4000, 2000)), file('p2.png', makePng(800, 600))]);
  await b.waitFor("/2 fotoğraf okundu/.test(document.getElementById('a-p').textContent)", 15000);
  assert.equal(await b.ev("document.getElementById('a-x').value"),
    '## Unit 3\n\nThe city never sleeps at night. People walk and talk.\n\nMany shops stay open until late, and the streets are full of light.');
  assert.equal(await b.ev("document.getElementById('a-t').value"), 'Fotoğraftan makale');
  assert.deepEqual(await b.ev('window.__ocr.sizes'), [[3200, 1600], [800, 600]], 'en fazla 3200 px (iPhone tuval sınırının altında)');
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

test('metin tanıma çıktısı: boş satırsız paragraflar ayrılıyor, tipik karışmalar (js, fee], 8ood) yalnızca bilinen kelimeye düzeltiliyor', async () => {
  await b.seed({[K]: [], [KA]: []});
  await open();
  // what Tesseract gives for a blurred photo: one line per printed line, no blank lines (the last line of a paragraph
  // is short), some typical confusions; "natura]" stays, since "natural" is not in the basic word list
  const raw = 'Unit 4 Healthy Habits\n' +
    'Most people know that sleep and food are important, but few of us\n' +
    'think about how a habit js formed.\n' +
    'Scientists say there is a reward, like the 8ood feeling after a run,\n' +
    'and you fee] it. The rule is clear], not natura].\n' +
    'In 2024, 12 students tried it for 5 weeks with the X1 app.';
  await b.ev(`window.__ocr.texts=${JSON.stringify([raw])}`);
  await b.setFiles('#a-ig', [file('blur.png', makePng(600, 800))]);
  await b.waitFor("/1 fotoğraf okundu/.test(document.getElementById('a-p').textContent)", 15000);
  assert.equal(await b.ev("document.getElementById('a-x').value"),
    '## Unit 4 Healthy Habits\n\n' +
    'Most people know that sleep and food are important, but few of us think about how a habit is formed.\n\n' +
    'Scientists say there is a reward, like the good feeling after a run, and you feel it. The rule is clear, not natura].\n\n' +
    'In 2024, 12 students tried it for 5 weeks with the X1 app.');
  assert.deepEqual(b.errors, []);
});

test('okunamayan ya da Türkçe sayfa: anlamsız metin kutuya konmuyor, açık uyarı ve ipucu; istenirse yine de ekleniyor', async () => {
  await b.seed({[K]: [], [KA]: []});
  await open();
  assert.match(await b.ev("document.getElementById('a-new').textContent"), /iyi ışık, sayfa düz[\s\S]*Türkçe metin okunmaz/);
  // what a real photo of a Turkish page gave (shared by the user)
  await b.ev(`window.__ocr.texts=${JSON.stringify(["F r11) al’ Cl¢ il Sank Hz 1Sa das) | 14ari | | : 2 I - ig res ga i l 11 i d ._; yapmaktan menetmistl. dors Te as E- BY k gUZt Iklerinl ziKretme Konusuiida uyall, : 4 cak gusciits ; fy i and Ax i ] lay 111 DAS K ASI IVD EeLuliil 211% i All D fluo vyg- 4 4 g 3 4 sr) q 4 : . AME Cul Fra ha lod mas uy al VOL Ul LAL LI 1 cittl Ona “Seni glyoct 1ldx pi db :\n1 1S1U Le RE Ler TE da bu konuy!\nE : <: 0 vivecedidll ledi. HZ. Umer \\Ia} Sa tt a i 1I.AMA0M 1 VAY A, : ! p KOPtEa**\" 7 : savalar Ciunl 11a . ~~ 1>votfmenl7z Oe ( 11. \\ UK :\n4 141i “Allah1 (CC) zikretmenlz gerel\nE- 115 am ; . as 1NvaAarivorulll LiL:\n3 ; Aanticiinda 1se S1Z1 uy al ly Ul vais BY  jpsanlan zikretm konusunda 1S¢ fe ft C FI EAN . 9 s tha Y | {O)) 1S] 4 hktir.” demistir Cenab-1 Hak'tan ibade iE LA (11 ern ~ \\ | 4X 1 0. hastalixi ph: cea lavet 1IstivOTUZ.\n4 da muvaffakiyet 15ULye & E i RE ha"])}`);
  await b.setFiles('#a-ig', [file('tr.png', makePng(600, 800))]);
  await b.waitFor("!!document.getElementById('ocr-any')", 15000);
  assert.match(await b.ev("document.getElementById('a-p').textContent"), /Türkçe görünüyor[\s\S]*İngilizce bir sayfanın fotoğrafını çek[\s\S]*Hiçbir şey eklenmedi/);
  assert.equal(await b.ev("document.getElementById('a-x').value"), '', 'kutu boş kaldı');
  await b.ev("document.getElementById('ocr-any').click()");
  assert.match(await b.ev("document.getElementById('a-x').value"), /konusunda/, 'istenince metin eklendi');
  // unreadable, not Turkish: the share of readable words and how to take a better photo
  await b.ev("document.getElementById('a-x').value='';window.__ocr.texts=['Tl1e qvick brovvn f0x jvmps ovr tl1e lazv d0g; Ixrt vvqp zzkt mmnr ptlk qrst vvbx.\\nXqz krr plmn ttrv qwz brrk vvn zxq lppt mrrq tkkl.']");
  await b.setFiles('#a-ig', [file('blur.png', makePng(600, 800))]);
  await b.waitFor("!!document.getElementById('ocr-any')", 15000);
  assert.match(await b.ev("document.getElementById('a-p').textContent"), /yazı okunamadı[\s\S]*%\d+[\s\S]*iyi ışıkta çek[\s\S]*El yazısı/);
  assert.equal(await b.ev("document.getElementById('a-x').value"), '');
  assert.deepEqual(await arts(), []);
  assert.deepEqual(b.errors, []);
});
