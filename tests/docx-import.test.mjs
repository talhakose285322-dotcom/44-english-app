// Word (.docx) article import through the real file input, plus a PDF regression check (the same input).
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {startServer, openBrowser} from './lib/browser.mjs';
import {K, KA} from './lib/app.mjs';
import {makeDocx} from './fixtures/docx.mjs';
import {makePdf} from './fixtures/pdf.mjs';

const BODY =
  '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Rivers</w:t></w:r></w:p>' +
  '<w:p><w:r><w:t xml:space="preserve">The river </w:t></w:r><w:r><w:t>&lt;img src=x onerror=window.__x=1&gt; flows quietly.</w:t></w:r></w:p>' +
  '<w:p><w:r><w:t>Line one</w:t><w:br/><w:t>Line two</w:t><w:tab/><w:t>tab</w:t></w:r><w:r><w:delText>deleted</w:delText></w:r></w:p>' +
  '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Cell text</w:t></w:r></w:p></w:tc></w:tr></w:tbl>' +
  '<w:p><w:r><w:t>Before box.</w:t></w:r><w:r><w:txbxContent><w:p><w:r><w:t>Box text</w:t></w:r></w:p></w:txbxContent></w:r></w:p>' +
  '<w:p/>';
const EXPECTED = '## Rivers\n\nThe river <img src=x onerror=window.__x=1> flows quietly.\n\nLine one\nLine two tab\n\nCell text\n\nBefore box.\n\nBox text';

let srv, b, dir;
before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'words44-files-'));
  srv = await startServer();
  b = await openBrowser({origin: srv.url.slice(0, -1), fakes: ['supabase', 'tts']});
  await b.goto(srv.url);
});
after(async () => { await b?.close(); srv?.stop(); fs.rmSync(dir, {recursive: true, force: true}); });

const file = (name, data) => { const p = path.join(dir, name); fs.writeFileSync(p, data); return p; };
const arts = async () => JSON.parse((await b.storage())[KA] || '[]');
async function pick(p) {
  await b.ev("document.getElementById('n-read').click()");
  await b.waitFor("!!document.getElementById('a-f')");
  await b.setFiles('#a-f', [p]);
}

test('Word (.docx): metin, başlıklar, satır sonları ve tablo okunuyor; makale olarak kaydediliyor; içerik HTML olarak çalışmıyor', async () => {
  await b.seed({[K]: [], [KA]: []});
  await pick(file('nehir-notlari.docx', makeDocx(BODY)));
  await b.waitFor(`document.getElementById('a-x').value===${JSON.stringify(EXPECTED)}`, 10000);
  assert.equal(await b.ev("document.getElementById('a-t').value"), 'nehir-notlari', 'başlık dosya adından');
  await b.ev("document.getElementById('a-s').click()");
  await b.waitFor("document.body.classList.contains('reading')");
  const a = await arts();
  assert.deepEqual(a.map(x => [x.title, x.text]), [['nehir-notlari', EXPECTED]]);
  assert.notEqual(await b.ev('window.__x'), 1, 'dosyadaki metin HTML olarak çalıştırılmadı');
  assert.deepEqual(b.errors, []);
});

test('Word (.docx): sıkıştırmasız kaydedilmiş dosya da okunuyor', async () => {
  await b.ev("document.getElementById('back')&&document.getElementById('back').click()");
  await b.seed({[K]: [], [KA]: []});
  await pick(file('duz.docx', makeDocx('<w:p><w:r><w:t>Stored entry text.</w:t></w:r></w:p>', {store: true})));
  await b.waitFor("document.getElementById('a-x').value==='Stored entry text.'", 10000);
});

test('eski .doc ve bozuk .docx açık bir hata veriyor, hiçbir şey değişmiyor', async () => {
  await b.seed({[K]: [], [KA]: []});
  await pick(file('eski.doc', Buffer.from('D0CF11E0 not a zip')));
  await b.waitFor("/Eski Word \\(\\.doc\\) biçimi desteklenmez/.test(document.getElementById('a-p').innerText)");
  assert.equal(await b.ev("document.getElementById('a-x').value"), '');
  await pick(file('bozuk.docx', makeDocx('', {document: false})));
  await b.waitFor("/geçerli bir Word \\(\\.docx\\) belgesi değil/.test(document.getElementById('a-p').innerText)");
  await pick(file('metin-degil.docx', Buffer.from('just text')));
  await b.waitFor("/geçerli bir Word \\(\\.docx\\) belgesi değil/.test(document.getElementById('a-p').innerText)");
  assert.equal(await b.ev("document.getElementById('a-x').value"), '');
  assert.deepEqual(await arts(), []);
  assert.deepEqual(b.errors, []);
});

test('PDF hâlâ aynı alandan okunuyor (regresyon)', async () => {
  await b.seed({[K]: [], [KA]: []});
  await pick(file('nehir.pdf', makePdf()));
  await b.waitFor("!!document.getElementById('a-x')&&/river flows quietly/.test(document.getElementById('a-x').value)", 20000);
  await b.ev("document.getElementById('a-s').click()");
  await b.waitFor("document.body.classList.contains('reading')");
  const a = await arts();
  assert.equal(a.length, 1);
  assert.deepEqual([a[0].src.type, a[0].src.name], ['pdf', 'nehir.pdf']);
  assert.deepEqual(b.errors, []);
});
