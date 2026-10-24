// Makale tab: three tabs (ready-made articles, a page from my word lists, upload / my articles), the chosen tab is
// remembered, and a file being reviewed always shows the upload tab. The user's own articles are untouched.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {startServer, openBrowser} from './lib/browser.mjs';
import {K, KA, KS} from './lib/app.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {makePdf} from './fixtures/pdf.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'words44-tabs-'));

const OWN = [{id: 'own1', title: 'My notes', text: 'A text that belongs to the user and must stay as it is.', pos: 0}];
let srv, b;
before(async () => {
  srv = await startServer();
  b = await openBrowser({origin: srv.url.slice(0, -1), fakes: ['supabase', 'tts']});
  await b.goto(srv.url);
  await b.seed({[K]: [{id: 'k1', w: 'sleep', m: 'uyku', box: 0, c: 'Okul'}], [KA]: OWN});
  await b.ev("document.getElementById('n-read').click()");
  await b.waitFor("!!document.getElementById('rtabs')&&document.querySelectorAll('#rl-list [data-rl]').length>0", 10000);
});
after(async () => { await b?.close(); srv?.stop(); fs.rmSync(dir, {recursive: true, force: true}); });

const shown = () => b.ev("['lib','kw','own'].filter(function(k){return !document.getElementById('rt-'+k).classList.contains('hide')})");
const tab = t => b.ev(`document.querySelector('#rtabs [data-rt="${t}"]').click()`);

test('üç sekme var; hazır makaleler açık başlıyor; sekme değişince yalnızca o bölüm görünüyor', async () => {
  assert.deepEqual(await b.ev("[].map.call(document.querySelectorAll('#rtabs [data-rt]'),function(x){return x.textContent})"), ['Hazır makaleler', 'Kelimelerimle oluştur', 'Makale yükle']);
  assert.deepEqual(await shown(), ['lib']);
  assert.match(await b.ev("document.querySelector('#rl .rchip.on').textContent"), /Tümü/);
  await tab('kw');
  assert.deepEqual(await shown(), ['kw']);
  assert.ok(await b.ev("!!document.getElementById('kw-go')"));
  await tab('own');
  assert.deepEqual(await shown(), ['own']);
  assert.match(await b.ev("document.getElementById('rt-own').innerText"), /Yeni makale ya da kitap[\s\S]*Makalelerim[\s\S]*My notes/, 'yükleme ve kendi makaleler aynı sekmede');
  assert.equal(JSON.parse((await b.storage())[KS]).rtab, 'own');
  assert.deepEqual(JSON.parse((await b.storage())[KA]), OWN, 'kendi makaleler değişmedi');
  assert.deepEqual(b.errors, []);
});

test('seçilen sekme makaleden dönünce ve yeniden açılınca hatırlanıyor; dosya önizlemesi yükleme sekmesini açıyor', async () => {
  await tab('kw');
  await b.ev("document.getElementById('n-dict').click();document.getElementById('n-read').click()");
  assert.deepEqual(await shown(), ['kw'], 'başka sekmeden dönünce');
  await b.goto(srv.url);
  await b.ev("document.getElementById('n-read').click()");
  await b.waitFor("!!document.getElementById('rtabs')", 10000);
  assert.deepEqual(await shown(), ['kw'], 'uygulama yeniden açılınca');
  await tab('lib');
  // a PDF under review (its preview) is shown in the upload tab, whichever tab was open
  const p = path.join(dir, 'nehir.pdf'); fs.writeFileSync(p, makePdf());
  await b.setFiles('#a-f', [p]);
  await b.waitFor("/river flows quietly/.test(document.getElementById('a-x').value)", 20000);
  assert.deepEqual(await shown(), ['own'], 'önizleme yükleme sekmesinde');
  assert.deepEqual(JSON.parse((await b.storage())[KA]), OWN, 'onaylanmadan hiçbir şey kaydedilmedi');
  // saving opens the new article; coming back, the upload tab (where it was added) is still the one shown
  await b.ev("document.getElementById('a-s').click()");
  await b.waitFor("document.body.classList.contains('reading')");
  await b.ev("document.getElementById('back').click()");
  await b.waitFor("!!document.getElementById('rtabs')");
  assert.deepEqual(await shown(), ['own'], 'kaydettikten sonra aynı sekme');
  assert.equal(JSON.parse((await b.storage())[KA]).length, 2);
  assert.deepEqual(b.errors, []);
});
