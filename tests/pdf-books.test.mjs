// PDF article import with real PDFs made by Chrome's "Save as PDF" (as Word or Google Docs would make them): article
// books are split into articles whatever their headings look like (contents page, "Article N", "1. Title", plain or
// bold-only headings, two text columns, sub-headings inside articles), running headers and page numbers stay out of
// the text, a single article stays one article, scanned pages go to OCR, and vocabulary tables are not touched.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {startServer, openBrowser, sleep} from './lib/browser.mjs';
import {K, KA} from './lib/app.mjs';

// deterministic filler text, so every run makes the same PDFs
const W = 'river city people morning market history science water energy future student teacher language music garden ocean mountain journey memory research system culture health climate design animal planet light'.split(' ');
let seed = 7;
const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
const sentence = () => { const ws = Array.from({length: 8 + Math.floor(rnd() * 12)}, () => W[Math.floor(rnd() * W.length)]); ws[0] = ws[0][0].toUpperCase() + ws[0].slice(1); return ws.join(' ') + '.'; };
const para = k => Array.from({length: k}, sentence).join(' ');
const TITLES = Array.from({length: 40}, (_, i) => ['The Secret Life of', 'Why We Study', 'A Short History of', 'How Scientists Measure', 'The Future of'][i % 5] + ' ' +
  ['Rivers', 'Cities', 'Language', 'Music', 'Gardens', 'Oceans', 'Mountains', 'Memory'][i % 8] + (i >= 8 ? ' ' + (Math.floor(i / 8) + 1) : ''));
const CSS = 'body{font-family:Georgia,serif;font-size:11pt;line-height:1.45;margin:0}h1{font-size:22pt}h2{font-size:16pt;margin:0 0 8pt}p{margin:0 0 8pt;text-align:justify}.pb{break-before:page}';

let srv, b, dir;
before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'words44-pdfbooks-'));
  srv = await startServer();
  b = await openBrowser({origin: srv.url.slice(0, -1), fakes: ['supabase', 'tts', 'ocr'], mobile: false});
});
after(async () => { await b?.close(); srv?.stop(); fs.rmSync(dir, {recursive: true, force: true}); });

async function pdf(name, html, header = false) {
  seed = 7;
  const body = typeof html === 'function' ? html() : html;
  await b.send('Page.navigate', {url: 'about:blank'}); await sleep(200);
  await b.ev(`document.open();document.write(${JSON.stringify(`<!doctype html><html lang=en><head><meta charset=utf-8><style>${CSS}</style></head><body>${body}</body></html>`)});document.close()`);
  await sleep(200);
  const opt = {paperWidth: 8.27, paperHeight: 11.69, marginTop: 0.8, marginBottom: 0.8, marginLeft: 0.8, marginRight: 0.8};
  if (header) Object.assign(opt, {displayHeaderFooter: true, headerTemplate: '<div style="font-size:8pt;width:100%;text-align:center">English Reading Book — Level B1</div>',
    footerTemplate: '<div style="font-size:8pt;width:100%;text-align:center">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>'});
  const p = path.join(dir, name + '.pdf');
  fs.writeFileSync(p, Buffer.from((await b.send('Page.printToPDF', opt)).data, 'base64'));
  return p;
}
// upload into Makaleler → Makale yükle; resolves with the proposed articles, or null when it stays one article
async function upload(p) {
  await b.goto(srv.url);
  await b.seed({[K]: [], [KA]: []});
  await b.ev("document.getElementById('n-read').click();document.querySelector('#rtabs [data-rt=\"own\"]').click()");
  await b.setFiles('#a-f', [p]);
  await b.waitFor("!!document.getElementById('wb-list')||document.getElementById('a-x').value!==''||/seçilebilir metin bulunamadı/.test(document.getElementById('a-p').textContent)", 30000);
  if (!await b.ev("!!document.getElementById('wb-list')")) return null;
  return b.ev("[].map.call(document.querySelectorAll('#wb-list .segc'),function(el){return {t:el.querySelector('.wt').value,on:el.querySelector('.wi').checked,w:+(el.querySelector('.sm').textContent.match(/(\\d+) kelime/)||[0,0])[1],p:el.querySelector('.spv').textContent}})");
}
const articles = segs => segs.filter(s => s.on);
const wholeText = async () => { await b.ev("document.getElementById('wb-one').click()"); await b.waitFor("document.getElementById('a-x').value!==''", 5000); return b.ev("document.getElementById('a-x').value"); };

test('içindekiler + “Article N” başlıklı 40 makalelik kitap: 40 makale, ön bölüm işaretsiz; kaydedince 40 makale', async () => {
  const p = await pdf('book40', () => `<h1>English Reading Book</h1><p>Forty short articles for learners.</p><div class=pb><h2>Contents</h2>${TITLES.map((t, i) => `<p>Article ${i + 1}: ${t} ........ ${i + 3}</p>`).join('')}</div>` +
    TITLES.map((t, i) => `<div class=pb><h2>Article ${i + 1}: ${t}</h2><p>${para(5)}</p><p>${para(4)}</p><p>${para(5)}</p></div>`).join(''));
  const s = await upload(p);
  assert.equal(s.length, 41);
  assert.equal(s[0].on, false, 'ön bölüm işaretsiz');
  assert.deepEqual(articles(s).map(x => x.t), TITLES.map((t, i) => `Article ${i + 1}: ${t}`));
  assert.ok(articles(s).every(x => x.w >= 120 && x.w <= 260), 'her makalenin metni tam');
  await b.ev("document.getElementById('wb-go').click()");
  await b.waitFor(`JSON.parse(localStorage.getItem('${KA}')||'[]').length===40`, 10000);
  const saved = JSON.parse((await b.storage())[KA]);
  assert.deepEqual(saved.map(a => a.ord), TITLES.map((_, i) => i + 1));
  assert.ok(saved.every(a => !/Contents|\.{4}/.test(a.text)), 'içindekiler metne girmedi');
  assert.deepEqual(b.errors, []);
});

test('numarasız, içindekiler yok, art arda yazılmış 40 makale: yine 40 makale', async () => {
  const s = await upload(await pdf('plain40', () => `<h1>Reading Collection</h1>` + TITLES.map(t => `<h2>${t}</h2><p>${para(5)}</p><p>${para(4)}</p><p>${para(5)}</p>`).join('')));
  assert.deepEqual(articles(s).map(x => x.t), TITLES);
  assert.deepEqual(b.errors, []);
});

test('başlıkları yalnızca kalın (metinle aynı boyutta) 20 makale: 20 makale; sayfa sonundaki başlık paragrafa yapışmıyor', async () => {
  const s = await upload(await pdf('bold20', () => TITLES.slice(0, 20).map(t => `<p><b>${t}</b></p><p>${para(5)}</p><p>${para(4)}</p>`).join('')));
  assert.deepEqual(articles(s).map(x => x.t), TITLES.slice(0, 20));
  assert.ok(articles(s).every(x => x.w >= 80 && x.w <= 160));
  assert.deepEqual(b.errors, []);
});

test('“1. Başlık” numaralı başlıklar ve makalelerin içinde alt başlıklar: yalnızca makaleler ayrılıyor', async () => {
  let s = await upload(await pdf('numbered', () => TITLES.slice(0, 15).map((t, i) => `<h2>${i + 1}. ${t}</h2><p>${para(5)}</p><p>${para(4)}</p>`).join('')));
  assert.deepEqual(articles(s).map(x => x.t), TITLES.slice(0, 15).map((t, i) => `${i + 1}. ${t}`));
  s = await upload(await pdf('nested', () => `<h1>Science Reader</h1>` + TITLES.slice(0, 8).map(t => `<h2>${t}</h2><p>${para(4)}</p><h3 style="font-size:13pt">Background</h3><p>${para(4)}</p><h3 style="font-size:13pt">What we know now</h3><p>${para(4)}</p>`).join('')));
  assert.deepEqual(articles(s).map(x => x.t), TITLES.slice(0, 8), 'alt başlıklar ayrı makale olmadı');
  assert.deepEqual(b.errors, []);
});

test('iki sütunlu sayfa: sütunlar karışmadan sırayla okunuyor ve makalelere ayrılıyor', async () => {
  const p = await pdf('columns', () => `<div style="columns:2;column-gap:24pt">` + TITLES.slice(0, 10).map(t => `<h2>${t}</h2><p>${para(6)}</p><p>${para(5)}</p>`).join('') + `</div>`);
  seed = 7; const first = [sentence(), sentence(), sentence()].join(' ');
  const s = await upload(p);
  assert.deepEqual(articles(s).map(x => x.t), TITLES.slice(0, 10));
  assert.ok(s[0].p.startsWith(first.slice(0, 200)), 'ilk makale kendi cümleleriyle, sırayla başlıyor:\n' + s[0].p.slice(0, 200) + '\n' + first.slice(0, 200));
  assert.deepEqual(b.errors, []);
});

test('üst bilgi ve sayfa numaraları metne karışmıyor; “Tek makale olarak al” bütün metni veriyor', async () => {
  const s = await upload(await pdf('header', () => TITLES.slice(0, 12).map((t, i) => `<div class=${i ? 'pb' : ''}><h2>Unit ${i + 1} ${t}</h2><p>${para(6)}</p><p>${para(6)}</p><p>${para(6)}</p></div>`).join(''), true));
  assert.equal(articles(s).length, 12);
  const t = await wholeText();
  assert.equal((t.match(/^## Unit \d+/gm) || []).length, 12);
  assert.doesNotMatch(t, /Page \d+ of|Level B1/);
  assert.ok(t.split(/\s+/).length > 2600);
  assert.deepEqual(b.errors, []);
});

test('alt başlıklı tek makale tek makale kalıyor; başlıklar işaretli', async () => {
  const s = await upload(await pdf('single', () => `<h1>How Cities Grow</h1><p>${para(6)}</p><h2>Early settlements</h2><p>${para(6)}</p><h2>Industry</h2><p>${para(6)}</p>`));
  assert.equal(s, null);
  const t = await b.ev("document.getElementById('a-x').value");
  assert.match(t, /^## How Cities Grow\n\n[A-Z][\s\S]*\n\n## Early settlements\n\n[\s\S]*\n\n## Industry\n\n/);
  assert.equal(await b.ev("document.getElementById('a-t').value"), 'How Cities Grow');
  assert.deepEqual(JSON.parse((await b.storage())[KA]), [], 'kaydetmeden saklanmadı');
  assert.deepEqual(b.errors, []);
});

test('taranmış (yalnızca görüntü) PDF: OCR önerisi; onaylanınca metin tanınıyor ve ünitelere ayrılıyor', async () => {
  // pages that are pictures of text: no selectable text in the PDF
  const img = n => `<div class=${n ? 'pb' : ''}><svg width="500" height="200"><rect width="500" height="200" fill="#eee"/><text x="20" y="40" font-size="20">Page ${n + 1} as a picture</text></svg></div>`;
  const s = await upload(await pdf('scanned', [0, 1, 2].map(img).join('')));
  assert.equal(s, null);
  assert.match(await b.ev("document.getElementById('a-p').textContent"), /seçilebilir metin bulunamadı[\s\S]*OCR/);
  await b.ev(`window.__ocr.texts=${JSON.stringify([0, 1, 2].map(i => `Unit ${i + 1}\n\n${TITLES[i]}\n\n${para(5)}\n\n${para(4)}`))}`);
  await b.ev("document.getElementById('ocr-go').click()");
  await b.waitFor("!!document.getElementById('wb-list')", 30000);
  assert.deepEqual(await b.ev("[].map.call(document.querySelectorAll('#wb-list .segc .wt'),function(x){return x.value})"), [0, 1, 2].map(i => `Unit ${i + 1} — ${TITLES[i]}`));
  assert.equal(await b.ev('window.__ocr.sizes.length'), 3, 'her sayfa tanındı');
  assert.deepEqual(b.errors, []);
});

test('kelime listesi PDF’i (iki sütunlu tablo) eskisi gibi kelime–anlam satırlarına ayrılıyor', async () => {
  const rows = [['approach', 'yaklaşmak'], ['measure', 'ölçmek'], ['achieve', 'başarmak'], ['journey', 'yolculuk'], ['resilient', 'dayanıklı'], ['habit', 'alışkanlık'],
    ['budget', 'bütçe'], ['harbour', 'liman'], ['repair', 'onarmak'], ['garden', 'bahçe'], ['inflation', 'enflasyon'], ['research', 'araştırma']];
  const p = await pdf('vocab', `<table style="width:100%;font-size:12pt">${rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</table>`);
  await b.goto(srv.url);
  await b.seed({[K]: []});
  await b.ev("document.getElementById('n-list').click();document.querySelector('#ltabs [data-lt=\"add\"]').click()");
  await b.setFiles('#pf', [p]);
  await b.waitFor("document.querySelectorAll('#pv-rows .vr').length>0", 30000);
  const got = await b.ev("[].map.call(document.querySelectorAll('#pv-rows .vr'),function(el){return [el.querySelector('.vw').value,el.querySelector('.vm').value]})");
  assert.deepEqual(got, rows);
  assert.deepEqual(b.errors, []);
});
