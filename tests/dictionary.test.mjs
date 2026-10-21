// Dictionary with fixed answers (tests/fixtures/dictionary.mjs): Turkish meanings grouped by word type, automatic
// example translations, "Listeye ekle" without duplicates, and the reading speed.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {startServer, openBrowser, sleep} from './lib/browser.mjs';
import {K} from './lib/app.mjs';
import {dictionaryRoutes, mymemory} from './fixtures/dictionary.mjs';

let srv, b;
before(async () => {
  srv = await startServer();
  b = await openBrowser({origin: srv.url.slice(0, -1), fakes: ['supabase', 'tts', 'no-translator'], routes: dictionaryRoutes});
  await b.goto(srv.url);
  await b.seed({[K]: [{id: 'k1', w: 'kitap', m: 'book', box: 1, c: 'Okul'}, {id: 'h1', w: 'house', m: 'ev', box: 0, c: 'İş'}]});
});
after(async () => { await b?.close(); srv?.stop(); });

async function search(q) {
  await b.ev("document.getElementById('n-dict').click()");
  await b.ev(`document.getElementById('dq').value=${JSON.stringify(q)};document.getElementById('dq-go').click()`);
  await b.waitFor("!!document.querySelector('.dtrs')&&!/aranıyor/.test(document.getElementById('dres').innerText)", 8000);
}
const words = async () => JSON.parse((await b.storage())[K]);

test('Türkçe karşılıklar kelime türüne göre ve iki kaynaktan tekrarsız gösteriliyor', async () => {
  await search('approach');
  await b.waitFor("/yaklaşım/.test(document.querySelector('.dtrs').innerText)", 8000);
  // the word-type label is its own element (spaced by CSS), so read label and meanings separately
  const rows = await b.ev("[].map.call(document.querySelectorAll('.dtrs>div'),function(r){var l=r.querySelector('i');return (l?l.textContent:'')+': '+r.textContent.slice(l?l.textContent.length:0).trim()})");
  assert.deepEqual(rows, ['fiil: yaklaşmak', 'isim: yaklaşım']);
  assert.match(await b.ev("document.querySelector('.dtrs>span').innerText"), /Vikisözlük \+ Türkçe Vikisözlük/);
});

test('ilk örnek cümleler otomatik çevriliyor ve cümlenin altında gösteriliyor', async () => {
  await b.waitFor("document.querySelectorAll('.dex .dmt').length>=3&&!/Çevriliyor/.test(document.getElementById('dres').innerText)", 8000);
  const ex = await b.ev("[].slice.call(document.querySelectorAll('.dex'),0,3).map(function(d){return d.querySelector('.dmt').innerText})");
  assert.match(ex[0], /makine çevirisi.*TR: She approached the door cautiously\./s);
  assert.match(ex[1], /TR: We were approached by a stranger\./);
  assert.match(ex[2], /TR: The approach of winter was felt\./);
  assert.equal(mymemory.length, 3, 'yalnızca 3 cümle çevrildi');
  assert.ok(b.served.every(u => /wiktionary|dictionaryapi|datamuse|mymemory/.test(u)), 'yalnızca sabit yanıtlar kullanıldı');
});

test('Listeye ekle: kelime listeye ekleniyor, aynı listeye tekrar eklenemiyor, ikinci liste aynı kayda ekleniyor', async () => {
  await b.ev("document.getElementById('d-add').click()");
  await b.waitFor("!!document.querySelector('#sheet [data-col]')");
  await b.ev("[].filter.call(document.querySelectorAll('#sheet [data-col]'),function(x){return x.getAttribute('data-col')==='Okul'})[0].click()");
  await b.waitFor("/listesine eklendi/.test(document.getElementById('ls-t').innerText)");
  let a = (await words()).filter(x => x.w === 'approach');
  assert.equal(a.length, 1);
  assert.equal(a[0].c, 'Okul');
  assert.match(a[0].m, /yaklaşmak/);
  await sleep(1500);
  await b.ev("document.getElementById('d-add').click()");
  await b.waitFor("!!document.querySelector('#sheet [data-col]')");
  assert.equal(await b.ev("[].filter.call(document.querySelectorAll('#sheet [data-col]'),function(x){return x.getAttribute('data-col')==='Okul'})[0].disabled"), true, 'aynı liste seçilemiyor');
  await b.ev("[].filter.call(document.querySelectorAll('#sheet [data-col]'),function(x){return x.getAttribute('data-col')==='İş'})[0].click()");
  await b.waitFor("/listesine eklendi/.test(document.getElementById('ls-t').innerText)");
  a = (await words()).filter(x => x.w === 'approach');
  assert.equal(a.length, 1, 'yinelenen kayıt yok');
  assert.deepEqual(a[0].cs, ['Okul', 'İş']);
  assert.equal((await words()).length, 3);
});

test('Oku düğmesi varsayılan 0.6 hızla İngilizce sesle okuyor; seçilen hız saklanıyor', async () => {
  await sleep(1500);
  await b.ev("window.__tts.spoken=[];document.getElementById('d-tts').click()");
  assert.deepEqual(await b.ev('window.__tts.spoken.map(function(s){return [s.text,s.rate,s.lang]})'), [['approach', 0.6, 'en-US']]);
  await b.ev("document.querySelector('[data-rate=\"0.85\"]').click()");
  assert.equal(JSON.parse((await b.storage())[K + '-s']).drate, 0.85);
  assert.deepEqual(b.errors, []);
});

test('çekimli biçimler Wikisözlük kalıplarından güvenilir kök kelimeye bağlanıyor', async () => {
  for (const [form, lemma] of [['went', 'go'], ['committed', 'commit']]) {
    await b.ev(`document.getElementById('dq').value=${JSON.stringify(form)};document.getElementById('dq-go').click()`);
    await b.waitFor(`document.querySelector('.dform')&&document.querySelector('.dform').innerText.includes(${JSON.stringify(lemma)})&&!/aranıyor/.test(document.getElementById('dres').innerText)`, 8000);
    const relation = await b.ev("document.querySelector('.dform').innerText");
    assert.match(relation, new RegExp(lemma));
  }
});
