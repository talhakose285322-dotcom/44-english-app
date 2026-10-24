// "Kelimelerimle oku": a reading page built from the user's word list with sentences from the ready-made articles,
// the user's own articles and saved example sentences. Nothing is stored until the user saves it.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {startServer, openBrowser, sleep} from './lib/browser.mjs';
import {K, KA, KS} from './lib/app.mjs';

const WORDS = [
  {id: 'w1', w: 'sleep', m: 'uyku', box: 0, c: 'Okul'},
  {id: 'w2', w: 'habit', m: 'alışkanlık', box: 1, c: 'Okul'},
  {id: 'w3', w: 'zzyzx', m: 'yok', box: 0, c: 'Okul'},
  {id: 'w4', w: 'garden', m: 'bahçe', box: 0, c: 'Okul', e: 'We planted roses in the garden last spring.'},
  {id: 'w5', w: 'inflation', m: 'enflasyon', box: 3, c: 'Ekonomi'}
];
const OWN = [{id: 'own1', title: 'My notes', text: 'Every morning I drink tea before my habit of reading the news begins. Our garden was 2.5 metres wide, Dr. Lee said.', pos: 0}];
let srv, b;
before(async () => {
  srv = await startServer();
  b = await openBrowser({origin: srv.url.slice(0, -1), fakes: ['supabase', 'tts']});
  await b.goto(srv.url);
  await b.seed({[K]: WORDS, [KA]: OWN});
  await b.ev("document.getElementById('n-read').click()");
  await b.waitFor("!!document.getElementById('kw-go')", 10000);
});
after(async () => { await b?.close(); srv?.stop(); });

const setSel = (id, v) => b.ev(`(function(s){s.value=${JSON.stringify(v)};s.dispatchEvent(new Event('change'))})(document.getElementById('${id}'))`);
// tick exactly the given word lists (and the 'not learned yet' box)
const pick = (lists, learn = false) => b.ev(`(function(){[].forEach.call(document.querySelectorAll('#kw .kw-col input'),function(i){i.checked=${JSON.stringify(lists)}.indexOf(i.value)>=0});document.getElementById('kw-l').checked=${learn}})()`);

test('seçilen listeden okuma sayfası oluşuyor; kelimeler vurgulu, bulunamayanlar belirtiliyor, hiçbir şey kaydedilmiyor', async () => {
  const before = await b.storage();
  assert.deepEqual(await b.ev("[].map.call(document.querySelectorAll('#kw .kw-col input'),function(i){return i.value})"), ['Ekonomi', 'Okul'], 'kelime listeleri işaretlenebiliyor (alfabetik)');
  assert.equal(await b.ev("document.getElementById('kw-go').textContent"), 'Makale oluştur');
  await pick(['Okul']);
  await setSel('kw-lv', 'B1');
  await b.ev("document.getElementById('kw-go').click()");
  await b.waitFor("!!document.getElementById('kw-sv')", 15000);
  assert.equal(await b.ev("document.querySelector('.atitle').textContent"), 'Kelimelerimle makale: Okul');
  const text = await b.ev("document.getElementById('art').innerText");
  assert.match(text, /\bsleep\b/i, 'hazır makaleden cümle');
  assert.match(text, /habit/i, 'hazır ya da kendi makalesinden cümle');
  assert.match(text, /We planted roses in the garden last spring\./, 'kaydedilmiş örnek cümle');
  assert.match(text, /Our garden was 2\.5 metres wide, Dr\. Lee said\./, 'ondalık sayı ve kısaltma cümleyi bölmüyor');
  assert.doesNotMatch(text, /inflation/i, 'başka listedeki kelime alınmıyor');
  const marked = await b.ev("[].map.call(document.querySelectorAll('#art .w.kwm'),function(e){return e.textContent.toLowerCase()})");
  assert.ok(marked.includes('garden') && marked.some(w => w.startsWith('sleep')), 'liste kelimeleri vurgulu: ' + marked.join(','));
  assert.match(await b.ev("document.querySelector('.libbar').innerText"), /Cümlesi bulunamayan: zzyzx/);
  const after = await b.storage();
  assert.equal(after[KA], before[KA], 'kaydetmeden makaleler değişmiyor');
  assert.equal(after[K], before[K], 'kelimeler değişmiyor');
  await b.ev("document.querySelector('#art .w.kwm').click()");
  await b.waitFor("!document.getElementById('sheet').classList.contains('hide')");
  await b.ev("document.getElementById('sheet').classList.add('hide')");
  assert.deepEqual(b.errors, []);
});

test('“Makalelerime kaydet” sayfayı kendi makalesi olarak ekliyor; mevcut makale aynı kalıyor', async () => {
  await b.ev("document.getElementById('kw-sv').click()");
  await b.waitFor(`JSON.parse(localStorage.getItem('${KA}')).length===2`);
  const arts = JSON.parse((await b.storage())[KA]);
  assert.equal(arts[0].title, 'Kelimelerimle makale: Okul');
  assert.equal(arts[0].c, 'Okul');
  assert.equal(arts[0].lv, 'B1');
  assert.ok(arts[0].text.length > 40);
  assert.deepEqual(arts[1], OWN[0], 'kendi makalesi değişmedi');
  assert.equal(await b.ev("document.querySelector('.atitle').textContent"), 'Kelimelerimle makale: Okul', 'kaydedilen makale açık');
  assert.deepEqual(b.errors, []);
});

test('hiçbir cümle bulunamazsa açık bir mesaj çıkıyor ve okuyucu açılmıyor', async () => {
  await b.seed({[K]: [{id: 'x1', w: 'qwertyuiop', m: 'yok', box: 0, c: 'Boş'}], [KA]: OWN});
  await b.ev("document.getElementById('n-read').click()");
  await b.waitFor("!!document.getElementById('kw-go')", 10000);
  await pick(['Boş']);
  await b.ev("document.getElementById('kw-go').click()");
  await b.waitFor("/cümle bulunamadı/.test(document.getElementById('kw-t').innerText)", 15000);
  assert.equal(await b.ev("!!document.querySelector('.atitle')"), false);
  assert.deepEqual(b.errors, []);
});

test('birkaç liste birlikte seçilebiliyor; “yalnızca henüz öğrenmediklerim” öğrenilenleri dışarıda bırakıyor', async () => {
  await b.seed({[K]: WORDS, [KA]: OWN});
  await b.ev("document.getElementById('n-read').click()");
  // the panel is redrawn once the seeded words are read: wait for it before ticking boxes
  await b.waitFor("!!document.querySelector('#kw .kw-col input[value=\"Ekonomi\"]')", 10000);
  await sleep(300);
  await pick(['Ekonomi'], true);
  await b.ev("document.getElementById('kw-go').click()");
  assert.match(await b.ev("document.getElementById('kw-t').innerText"), /öğrenilmemiş kelime yok/, 'inflation öğrenilmiş (kutu 3)');
  await pick(['Okul', 'Ekonomi']);
  await b.ev("document.getElementById('kw-go').click()");
  await b.waitFor("!!document.getElementById('kw-sv')", 15000);
  assert.equal(await b.ev("document.querySelector('.atitle').textContent"), 'Kelimelerimle makale: Ekonomi, Okul');
  const text = await b.ev("document.getElementById('art').innerText");
  assert.match(text, /inflation/i, 'ikinci listenin kelimesi de var');
  assert.match(text, /garden/i, 'ilk listenin kelimesi de var');
  assert.deepEqual(JSON.parse((await b.storage())[KS]).kwcs, ['Ekonomi', 'Okul'], 'seçim hatırlanıyor');
  assert.deepEqual(b.errors, []);
});
