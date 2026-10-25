// "Bu makaledeki yeni kelimeler": the words of an article that are not in the user's list (basic words, names,
// numbers and contractions left out) are listed at the end of the reader; the chosen ones get a machine-translated
// meaning (fixed MyMemory answers here) that the user can correct, and are added with the article sentence.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {startServer, openBrowser} from './lib/browser.mjs';
import {K, KA} from './lib/app.mjs';

const TEXT = 'The harbour was quiet in the morning. Maria watched the fishermen repair their nets.\n\n' +
  'Repairing nets is tiring work, but the fishermen don\'t complain. In 2024 the harbour got 12 new boats. Fishermen love the harbour.';
const mm = [];
const routes = [{match: u => u.startsWith('https://api.mymemory.translated.net/'), respond: u => {
  const q = new URL(u).searchParams.get('q'); mm.push(q);
  if (q === 'complain') return {status: 500, body: {}};
  return {body: {responseData: {translatedText: {harbour: 'liman', fishermen: 'balıkçılar', repair: 'onarmak', nets: 'ağlar', tiring: 'yorucu'}[q] || q, match: 1}, responseStatus: 200, matches: []}};
}}];
let srv, b;
before(async () => {
  srv = await startServer();
  b = await openBrowser({origin: srv.url.slice(0, -1), fakes: ['supabase', 'tts', 'no-translator'], routes});
  await b.goto(srv.url);
  await b.seed({[K]: [{id: 'w1', w: 'quiet', m: 'sessiz', box: 2}], [KA]: [{id: 'h1', title: 'Harbour', text: TEXT, pos: 0, c: 'Deniz'}]});
});
after(async () => { await b?.close(); srv?.stop(); });

const listed = () => b.ev("[].map.call(document.querySelectorAll('#nw-l .kw-w'),function(l){return l.textContent.trim()})");
const open = async () => {
  await b.ev("document.getElementById('n-read').click();document.querySelector('#rtabs [data-rt=\"mine\"]').click()");
  await b.ev("document.querySelector('#lib-list [data-o=\"h1\"]').click()");
  await b.waitFor("!!document.getElementById('nw-l')");
};

test('yeni kelimeler listeleniyor: listedekiler, temel kelimeler, özel adlar, sayılar ve kısaltmalar yok; sık geçen önce', async () => {
  await open();
  const L = await listed();
  assert.deepEqual(L.slice(0, 2), ['harbour ×3', 'fishermen ×3'], 'eşit sayıda geçenler makaledeki sırayla');
  for (const w of ['nets ×2', 'repair', 'tiring', 'complain']) assert.ok(L.includes(w), w + ' listede');
  // basic words also in their inflected forms (boats, watched), names, numbers, contractions, words already in the list;
  // a word never written in lower case counts as a name (so "Repairing", only at the start of a sentence, is left out too)
  for (const w of ['quiet', 'maria', 'repairing', 'the', 'morning', 'don', "don't", '2024', '12', 'work', 'love', 'new', 'boats', 'watched']) assert.ok(!L.some(x => x.split(' ')[0] === w), w + ' listede olmamalı');
  assert.match(await b.ev("document.getElementById('nw-sum').textContent"), /yeni kelime · listendeki 1 kelime bu makalede geçiyor/);
  assert.equal(await b.ev("document.getElementById('nw-go').disabled"), true, 'seçmeden düğme kapalı');
});

test('seçilen kelimelerin anlamı getiriliyor, düzeltilebiliyor; boş anlam eklenmiyor; örnek cümle makaleden', async () => {
  const pick = ws => b.ev(`[].forEach.call(document.querySelectorAll('#nw-l .kw-w'),function(l){var i=l.querySelector('input');i.checked=${JSON.stringify(ws)}.indexOf(l.textContent.trim().split(' ')[0])>=0});document.getElementById('nw-l').dispatchEvent(new Event('change'))`);
  await pick(['harbour', 'repair', 'complain']);
  assert.equal(await b.ev("document.getElementById('nw-go').textContent"), 'Anlamlarını getir (3)');
  const before = await b.storage();
  await b.ev("document.getElementById('nw-go').click()");
  await b.waitFor("!!document.getElementById('nw-add')", 10000);
  assert.deepEqual(mm, ['harbour', 'repair', 'complain']);
  assert.equal((await b.storage())[K], before[K], 'onaylamadan hiçbir şey eklenmedi');
  assert.deepEqual(await b.ev("[].map.call(document.querySelectorAll('#nw-p [data-nm]'),function(i){return i.value})"), ['liman', 'onarmak', '']);
  assert.match(await b.ev("document.getElementById('nw-p').textContent"), /1 kelimenin anlamı bulunamadı/);
  assert.equal(await b.ev("document.getElementById('nw-c').value"), 'Deniz', 'koleksiyon makaleninki');
  await b.ev("document.querySelector('#nw-p [data-nm=\"1\"]').value='tamir etmek'");
  await b.ev("document.getElementById('nw-add').click()");
  await b.waitFor("/2 kelime listene eklendi/.test(document.getElementById('nw-sum').textContent)");
  const ws = JSON.parse((await b.storage())[K]);
  assert.equal(ws.length, 3);
  const h = ws.find(x => x.w === 'harbour'), rp = ws.find(x => x.w === 'repair');
  assert.deepEqual([h.m, h.e, h.c, h.box], ['liman', 'The harbour was quiet in the morning.', 'Deniz', 0]);
  assert.deepEqual([rp.m, rp.e], ['tamir etmek', 'Maria watched the fishermen repair their nets.']);
  assert.ok(!ws.some(x => x.w === 'complain'), 'anlamı boş kelime eklenmedi');
  // the list is redrawn: added words are gone from it and are underlined in the text
  const L = await listed();
  assert.ok(!L.some(x => /^(harbour|repair)\b/.test(x)) && L.some(x => x.startsWith('complain')));
  assert.equal(await b.ev("[].some.call(document.querySelectorAll('#art .w.k'),function(e){return e.textContent==='harbour'})"), true);
  assert.deepEqual(b.errors, []);
});
