// Article upload form: imported text is previewed as a readable article in its own area (not in the paste box, no
// "## " marks), can be edited on request, a file never replaces text in the box without asking, and unsaved text
// survives a re-draw of the form.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {startServer, openBrowser} from './lib/browser.mjs';
import {K, KA} from './lib/app.mjs';
import {makeDocx} from './fixtures/docx.mjs';

const BODY = '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Rivers</w:t></w:r></w:p>' +
  '<w:p><w:r><w:t>The river flows quietly past the old town.</w:t></w:r></w:p><w:p><w:r><w:t>People walk along it every evening.</w:t></w:r></w:p>';
let srv, b, dir;
before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'words44-upv-'));
  srv = await startServer();
  b = await openBrowser({origin: srv.url.slice(0, -1), fakes: ['supabase', 'tts']});
  await b.goto(srv.url);
});
after(async () => { await b?.close(); srv?.stop(); fs.rmSync(dir, {recursive: true, force: true}); });

const file = (name, data) => { const p = path.join(dir, name); fs.writeFileSync(p, data); return p; };
const hidden = id => b.ev(`document.getElementById('${id}').classList.contains('hide')`);
async function openForm() {
  await b.seed({[K]: [], [KA]: []});
  await b.ev("document.getElementById('n-read').click();document.querySelector('#rtabs [data-rt=\"own\"]').click()");
  await b.waitFor("!!document.getElementById('a-f')");
}

test('içe aktarılan metin ayrı önizlemede okunur biçimde; yapıştırma kutusu gizli; düzenlenebiliyor; kaydediliyor', async () => {
  await openForm();
  assert.equal(await b.ev("document.getElementById('a-pv').innerHTML"), '', 'başta önizleme yok');
  assert.equal(await hidden('a-x'), false, 'yapıştırma kutusu açık');
  await b.setFiles('#a-f', [file('rivers.docx', makeDocx(BODY))]);
  await b.waitFor("!!document.querySelector('#a-pv .apv-b')", 10000);
  assert.equal(await hidden('a-x'), true, 'metin yapıştırma kutusunda gösterilmiyor');
  assert.equal(await b.ev("document.querySelector('#a-pv .apv-b .ah').textContent"), 'Rivers', 'başlık başlık olarak');
  assert.equal(await b.ev("document.querySelectorAll('#a-pv .apv-b p').length"), 2);
  assert.doesNotMatch(await b.ev("document.getElementById('a-pv').textContent"), /##|\{|\}|<w:/, 'teknik işaret yok');
  assert.equal(await b.ev("document.querySelector('#a-pv .apv-t').textContent"), 'rivers', 'başlık önizlemede');
  // edit on request; the preview follows
  await b.ev("document.getElementById('apv-ed').click()");
  assert.equal(await hidden('a-x'), false);
  assert.match(await b.ev("document.getElementById('a-xl').textContent"), /^Metni düzenle/);
  await b.ev("var x=document.getElementById('a-x');x.value=x.value+'\\n\\nThe bridge is old.';x.dispatchEvent(new Event('input'))");
  await b.waitFor("document.querySelectorAll('#a-pv .apv-b p').length===3", 3000);
  await b.ev("document.getElementById('apv-ed').click()");
  assert.equal(await hidden('a-x'), true, 'önizlemeye dönüldü');
  await b.ev("document.getElementById('a-s').click()");
  await b.waitFor("document.body.classList.contains('reading')");
  const a = JSON.parse((await b.storage())[KA]);
  assert.equal(a.length, 1);
  assert.match(a[0].text, /^## Rivers\n\n[\s\S]*The bridge is old\.$/);
  // after saving the form is a plain paste box again
  await b.ev("document.getElementById('back').click();document.querySelector('#rtabs [data-rt=\"own\"]').click()");
  assert.equal(await b.ev("document.getElementById('a-pv').innerHTML"), '');
  assert.equal(await hidden('a-x'), false);
  assert.deepEqual(b.errors, []);
});

test('kutuda kaydedilmemiş metin varken dosya seçilince sorulur; reddedilirse metin korunur', async () => {
  await openForm();
  await b.ev("document.getElementById('a-x').value='My own notes that I typed and did not save yet.'");
  const n = b.dialogs.length;
  await b.setFiles('#a-f', [file('other.docx', makeDocx(BODY))]);
  await new Promise(r => setTimeout(r, 800)); // the file would have been read by now
  assert.equal(b.dialogs.length, n + 1);
  assert.match(b.dialogs[n], /kaydedilmemiş bir metin var/);
  assert.equal(await b.ev("document.getElementById('a-x').value"), 'My own notes that I typed and did not save yet.', 'metin korundu');
  assert.equal(await b.ev("document.getElementById('a-pv').innerHTML"), '');
  assert.deepEqual(b.errors, []);
});

test('form yeniden çizilince (ör. başka sekmede değişiklik) yapıştırılmış ama kaydedilmemiş metin kaybolmuyor', async () => {
  await openForm();
  await b.ev("document.getElementById('a-t').value='Draft';document.getElementById('a-x').value='Unsaved pasted text about rivers and towns.'");
  await b.ev(`localStorage.setItem('${KA}','[]');window.dispatchEvent(new StorageEvent('storage',{key:'${KA}',newValue:'[]',storageArea:localStorage}))`);
  await b.waitFor("!!document.getElementById('a-x')");
  assert.equal(await b.ev("document.getElementById('a-x').value"), 'Unsaved pasted text about rivers and towns.');
  assert.equal(await b.ev("document.getElementById('a-t').value"), 'Draft');
  assert.deepEqual(b.errors, []);
});

test('“Metni temizle” onaylanınca içe aktarılan metin ve önizleme kalkıyor; hiçbir şey kaydedilmiyor', async () => {
  await openForm();
  await b.setFiles('#a-f', [file('rivers2.docx', makeDocx(BODY))]);
  await b.waitFor("!!document.querySelector('#a-pv .apv-b')", 10000);
  await b.ev("window.confirm=function(){return true};document.getElementById('apv-x').click()");
  assert.equal(await b.ev("document.getElementById('a-pv').innerHTML"), '');
  assert.equal(await b.ev("document.getElementById('a-x').value"), '');
  assert.equal(await hidden('a-x'), false);
  assert.deepEqual(JSON.parse((await b.storage())[KA]), []);
  assert.deepEqual(b.errors, []);
});
