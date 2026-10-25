// EPUB e-books and subtitle files (.srt, .vtt) through the article file input: the text comes into the article box in
// reading order (EPUB spine) and is saved only with "Makaleyi kaydet"; nothing from the file is used as HTML.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {startServer, openBrowser} from './lib/browser.mjs';
import {K, KA} from './lib/app.mjs';
import {makeZip} from './fixtures/docx.mjs';

const X = body => `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>x</title></head><body>${body}</body></html>`;
function epub({encrypted = false} = {}) {
  const files = [
    ['mimetype', 'application/epub+zip'],
    ['META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'],
    ['OEBPS/content.opf', '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>The Lighthouse Keeper</dc:title></metadata>' +
      '<manifest><item id="c2" href="text/ch%202.xhtml" media-type="application/xhtml+xml"/><item id="c1" href="text/ch1.xhtml" media-type="application/xhtml+xml"/><item id="css" href="s.css" media-type="text/css"/></manifest>' +
      '<spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>'],
    ['OEBPS/text/ch1.xhtml', X('<h1>Chapter One</h1><p>The keeper climbed\n   the stairs.</p><p>He lit the lamp &lt;img src=x onerror=window.__x=1&gt; at dusk.</p><ul><li><p>Oil</p></li><li>Matches</li></ul>')],
    ['OEBPS/text/ch 2.xhtml', X('<h2>Chapter Two</h2><div><p>A ship passed in the night.</p></div>')],
    ['OEBPS/s.css', 'p{color:red}']
  ];
  if (encrypted) files.push(['META-INF/encryption.xml', '<encryption><EncryptedData/></encryption>']);
  return makeZip(files);
}
const SRT = '﻿1\r\n00:00:01,000 --> 00:00:02,500\r\n<i>Where are you going?</i>\r\n\r\n2\r\n00:00:02,600 --> 00:00:04,000\r\n- To the market.\r\n- Wait for me!\r\n\r\n3\r\n00:00:09,000 --> 00:00:11,000\r\n[MUSIC PLAYING]\r\n\r\n4\r\n00:00:12,000 --> 00:00:14,000\r\nThe next day, it rained.\r\n';
const VTT = 'WEBVTT\n\nNOTE made by hand\n\n00:01.000 --> 00:02.000\nHello there.\n\nintro\n00:02.100 --> 00:03.000 align:start\n<v Anna>How are you?</v> ♪\n';

let srv, b, dir;
before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'words44-epub-'));
  srv = await startServer();
  b = await openBrowser({origin: srv.url.slice(0, -1), fakes: ['supabase', 'tts']});
  await b.goto(srv.url);
});
after(async () => { await b?.close(); srv?.stop(); fs.rmSync(dir, {recursive: true, force: true}); });

const file = (name, data) => { const p = path.join(dir, name); fs.writeFileSync(p, data); return p; };
const arts = async () => JSON.parse((await b.storage())[KA] || '[]');
async function pick(p) {
  await b.ev("document.getElementById('n-read').click();document.querySelector('#rtabs [data-rt=\"own\"]').click()");
  await b.waitFor("!!document.getElementById('a-f')");
  await b.setFiles('#a-f', [p]);
}
const box = () => b.ev("document.getElementById('a-x').value");

test('EPUB: bölümler okuma sırasıyla, başlıklar işaretli, kitap adı başlık; HTML çalışmıyor; kaydedince makale', async () => {
  await b.seed({[K]: [], [KA]: []});
  await pick(file('kitap.epub', epub()));
  assert.match(await b.ev("document.getElementById('a-f').getAttribute('accept')"), /\.epub.*\.srt.*\.vtt/);
  await b.waitFor("/E-kitap okundu/.test(document.getElementById('a-p').textContent)", 10000);
  assert.equal(await box(), '## Chapter One\n\nThe keeper climbed the stairs.\n\nHe lit the lamp <img src=x onerror=window.__x=1> at dusk.\n\nOil\n\nMatches\n\n## Chapter Two\n\nA ship passed in the night.');
  assert.equal(await b.ev("document.getElementById('a-t').value"), 'The Lighthouse Keeper');
  assert.deepEqual(await arts(), [], 'onaylamadan kaydedilmedi');
  await b.ev("document.getElementById('a-s').click()");
  await b.waitFor("document.body.classList.contains('reading')");
  const a = await arts();
  assert.equal(a.length, 1);
  assert.equal(a[0].title, 'The Lighthouse Keeper');
  assert.equal(await b.ev('window.__x'), undefined, 'kitaptaki HTML çalışmadı');
  assert.deepEqual(b.errors, []);
});

test('EPUB: kopya korumalı ya da bozuk dosya açık uyarı veriyor, hiçbir şey değişmiyor', async () => {
  await b.seed({[K]: [], [KA]: []});
  await pick(file('drm.epub', epub({encrypted: true})));
  await b.waitFor("/kopya korumalı/.test(document.getElementById('a-p').textContent)", 10000);
  await pick(file('bozuk.epub', 'not a zip'));
  await b.waitFor("/geçerli bir EPUB e-kitabı değil/.test(document.getElementById('a-p').textContent)", 10000);
  assert.equal(await box(), '');
  assert.deepEqual(await arts(), []);
  assert.deepEqual(b.errors, []);
});

test('altyazı: numaralar, süreler, etiketler ve ses notları siliniyor; uzun duraklamada yeni paragraf', async () => {
  await b.seed({[K]: [], [KA]: []});
  await pick(file('dizi-bolum-1.srt', SRT));
  await b.waitFor("/Altyazı okundu/.test(document.getElementById('a-p').textContent)", 10000);
  assert.equal(await box(), 'Where are you going? To the market. Wait for me!\n\nThe next day, it rained.');
  assert.equal(await b.ev("document.getElementById('a-t').value"), 'dizi-bolum-1');
  await b.ev("document.getElementById('a-t').value='';document.getElementById('a-x').value=''");
  await pick(file('clip.vtt', VTT));
  await b.waitFor("document.getElementById('a-x').value!==''", 10000);
  assert.equal(await box(), 'Hello there. How are you?');
  assert.deepEqual(await arts(), []);
  assert.deepEqual(b.errors, []);
});
