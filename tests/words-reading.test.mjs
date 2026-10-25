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

// a longer list: 15 words that all have their own example sentence, so every word gets a sentence
const LONG = Array.from({length: 15}, (_, i) => {
  const w = ['apple', 'river', 'window', 'garden', 'pencil', 'bridge', 'candle', 'forest', 'ladder', 'mirror', 'pillow', 'rocket', 'saddle', 'tunnel', 'violin'][i];
  return {id: 'l' + i, w, m: '-', box: 0, c: 'Uzun', e: `The ${w} in this sentence number ${i + 1} is quite plain.`};
});
const reopen = async seed => {
  await b.seed(seed);
  await b.ev("document.getElementById('n-read').click()");
  await b.waitFor("!!document.querySelector('#kw [data-km]')", 10000);
  await sleep(300);
};

test('Liste seç: listedeki bütün kelimeler seçilen sayıda makaleye bölünüyor; önceki/sonraki ve hepsini kaydet çalışıyor', async () => {
  await reopen({[K]: LONG, [KA]: OWN});
  await pick(['Uzun']);
  await b.ev("document.querySelector('#kw .kw-col input[value=\"Uzun\"]').dispatchEvent(new Event('change'))");
  assert.match(await b.ev("document.getElementById('kw-info').textContent"), /15 kelime/);
  await setSel('kw-n', '3');
  assert.match(await b.ev("document.getElementById('kw-info').textContent"), /her makalede yaklaşık 5 kelime/);
  assert.equal(await b.ev("document.getElementById('kw-go').textContent"), '3 makale oluştur');
  await b.ev("document.getElementById('kw-go').click()");
  await b.waitFor("!!document.querySelector('.kw-nav')", 15000);
  assert.equal(await b.ev("document.querySelector('.atitle').textContent"), 'Kelimelerimle makale: Uzun (1/3)');
  const seen = [];
  for (let i = 0; i < 3; i++) {
    assert.match(await b.ev("document.querySelector('.kw-nav b').textContent"), new RegExp(`Makale ${i + 1} / 3`));
    // the page names the list words it covers ("N kelimen bu sayfada vurgulu: a, b, c.")
    const note = await b.ev("document.querySelector('.libbar .note').textContent");
    seen.push(...note.split('vurgulu: ')[1].split('.')[0].split(', '));
    if (i < 2) { await b.ev("document.querySelector('.kw-nav [data-kn=\"1\"]').click()"); await b.waitFor(`document.querySelector('.atitle').textContent.indexOf('(${i + 2}/3)')>=0`); }
  }
  assert.deepEqual([...new Set(seen)].sort(), LONG.map(x => x.w).sort(), 'listedeki 15 kelimenin hepsi makalelerde, her biri bir kez');
  assert.equal(seen.length, 15, 'bir kelime iki makalede yok');
  assert.equal(await b.ev("document.querySelector('.kw-nav [data-kn=\"1\"]').disabled"), true, 'son makalede ileri yok');
  await b.ev("document.querySelector('.kw-nav [data-kn=\"-1\"]').click()");
  await b.waitFor("document.querySelector('.atitle').textContent.indexOf('(2/3)')>=0");
  await b.ev("document.getElementById('kw-sa').click()");
  assert.match(await b.ev("document.getElementById('kw-st').textContent"), /3 makale/);
  const arts = JSON.parse((await b.storage())[KA]);
  assert.equal(arts.length, 4, '3 makale + kendi makalesi');
  assert.deepEqual(arts.slice(0, 3).map(a => a.title).sort(), ['(1/3)', '(2/3)', '(3/3)'].map(x => 'Kelimelerimle makale: Uzun ' + x));
  await b.ev("document.getElementById('kw-sa').click()");
  assert.equal(JSON.parse((await b.storage())[KA]).length, 4, 'ikinci kez basınca tekrar kaydetmiyor');
  assert.deepEqual(b.errors, []);
});

test('Kelime seç: aranarak işaretlenen kelimelerle tek makale oluşuyor; seçim modu hatırlanıyor', async () => {
  await reopen({[K]: LONG, [KA]: OWN});
  await b.ev("document.querySelector('#kw [data-km=\"words\"]').click()");
  assert.equal(await b.ev("document.querySelectorAll('#kw-wl input').length"), 15);
  await b.ev("(function(q){q.value='riv';q.dispatchEvent(new Event('input'))})(document.getElementById('kw-ws'))");
  assert.equal(await b.ev("document.querySelectorAll('#kw-wl input').length"), 1, 'arama süzüyor');
  await b.ev("(function(i){i.checked=true;i.dispatchEvent(new Event('change'))})(document.querySelector('#kw-wl input'))");
  await b.ev("(function(q){q.value='';q.dispatchEvent(new Event('input'))})(document.getElementById('kw-ws'))");
  await b.ev("(function(i){i.checked=true;i.dispatchEvent(new Event('change'))})(document.querySelector('#kw-wl input[value=\"l13\"]'))");
  assert.match(await b.ev("document.getElementById('kw-info').textContent"), /2 kelime seçildi/);
  assert.equal(await b.ev("document.querySelector('#kw-wl input[value=\"l1\"]').checked"), true, 'arama değişince seçim kalıyor');
  await b.ev("document.getElementById('kw-go').click()");
  await b.waitFor("!!document.getElementById('kw-sv')", 15000);
  assert.equal(await b.ev("document.querySelector('.atitle').textContent"), 'Kelimelerimle makale: Seçtiğim kelimeler');
  assert.equal(await b.ev("!!document.querySelector('.kw-nav')"), false, 'tek makalede gezinme yok');
  const marked = await b.ev("[].map.call(document.querySelectorAll('#art .w.kwm'),function(e){return e.textContent.toLowerCase()})");
  assert.deepEqual([...new Set(marked)].sort(), ['river', 'tunnel']);
  assert.equal(JSON.parse((await b.storage())[KS]).kwm, 'words');
  assert.deepEqual(b.errors, []);
});
