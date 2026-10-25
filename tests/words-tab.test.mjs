// Kelimeler tab: "Listelerim" (collections as chips, compact rows that open for details) and "Kelime ekle" (the old
// Ekle tab's panels): no word is added twice, plain word lists get meanings to check first (fixed MyMemory answers),
// a backup file is pointed to Profil → Ayarlar instead of opening the restore, and the Ekle nav tab is gone.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {startServer, openBrowser} from './lib/browser.mjs';
import {K} from './lib/app.mjs';

const WORDS = [
  {id: 'w1', w: 'habit', m: 'alışkanlık', box: 0, c: 'Okul', e: 'Reading is a good habit.', t: 'Okumak iyi bir alışkanlıktır.'},
  {id: 'w2', w: 'budget', m: 'bütçe', box: 3, c: 'Ekonomi'},
  {id: 'w3', w: 'garden', m: 'bahçe', box: 1, c: 'Okul'}
];
const mm = [];
const routes = [{match: u => u.startsWith('https://api.mymemory.translated.net/'), respond: u => {
  const q = new URL(u).searchParams.get('q'); mm.push(q);
  return {body: {responseData: {translatedText: {apple: 'elma', river: 'nehir', zzq: 'zzq'}[q] || q, match: 1}, responseStatus: 200, matches: []}};
}}];
let srv, b, dir;
before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'words44-wt-'));
  srv = await startServer();
  b = await openBrowser({origin: srv.url.slice(0, -1), fakes: ['supabase', 'tts', 'no-translator'], routes});
  await b.goto(srv.url);
  await b.seed({[K]: WORDS});
});
after(async () => { await b?.close(); srv?.stop(); fs.rmSync(dir, {recursive: true, force: true}); });

const stored = async () => JSON.parse((await b.storage())[K]);
const rows = () => b.ev("[].map.call(document.querySelectorAll('#list .wrow'),function(r){return r.textContent})");
const addTab = () => b.ev("document.getElementById('n-list').click();document.querySelector('#ltabs [data-lt=\"add\"]').click()");

test('alt menüde Ekle yok; Kelimeler iki bölmeli; liste tek satırlık ve durum etiketli; koleksiyon çipleri süzüyor', async () => {
  assert.equal(await b.ev("!!document.getElementById('n-add')||!!document.getElementById('v-add')"), false);
  assert.deepEqual(await b.ev("[].map.call(document.querySelectorAll('nav button'),function(x){return x.textContent.trim()})"), ['Çalış', 'Makaleler', 'Kelimeler', 'Sözlük', 'Profil']);
  await b.ev("document.getElementById('n-list').click()");
  assert.deepEqual(await b.ev("[].map.call(document.querySelectorAll('#ltabs button'),function(x){return x.textContent})"), ['Listelerim', 'Kelime ekle']);
  assert.deepEqual(await rows(), ['habitalışkanlıkYeni', 'budgetbütçeÖğrenildi', 'gardenbahçeÖğreniliyor 1/3']);
  assert.match(await b.ev("document.getElementById('lsub').textContent"), /^3 kelime · 1 öğrenildi/);
  // details open on tap
  assert.equal(await b.ev("getComputedStyle(document.querySelector('#list .wdet')).display"), 'none');
  await b.ev("document.querySelector('#list .wrow').click()");
  assert.equal(await b.ev("document.querySelector('#list .wrow').getAttribute('aria-expanded')"), 'true');
  assert.match(await b.ev("document.querySelector('#list .witem.open .wdet').textContent"), /Reading is a good habit\.Okumak iyi bir alışkanlıktır\.Koleksiyon: Okul/);
  await b.ev("document.querySelector('#list .witem.open [data-sp]').click()");
  assert.equal(await b.ev('window.__tts.spoken[window.__tts.spoken.length-1].text'), 'habit');
  // collection chips
  assert.deepEqual(await b.ev("[].map.call(document.querySelectorAll('#lcards .rchip'),function(x){return x.textContent})"), ['Tümü 3', 'Ekonomi 1', 'Okul 2', '+ Yeni koleksiyon']);
  await b.ev("document.querySelector('#lcards [data-n=\"okul\"]').click()");
  assert.deepEqual(await b.ev("[].map.call(document.querySelectorAll('#list .wrow b'),function(x){return x.textContent})"), ['habit', 'garden']);
  assert.match(await b.ev("document.getElementById('lsub').textContent"), /^2 kelime \(toplam 3\)/);
  await b.ev("document.querySelector('#lcards [data-i=\"0\"]').click()");
  // search: the dictionary button appears only with a search
  assert.equal(await b.ev("document.getElementById('lfind').classList.contains('hide')"), true);
  await b.ev("var q=document.getElementById('lq');q.value='bud';q.dispatchEvent(new Event('input'))");
  assert.equal((await rows()).length, 1);
  assert.equal(await b.ev("document.getElementById('lfind').textContent"), 'Sözlükte ara: “bud”');
  await b.ev("var q=document.getElementById('lq');q.value='';q.dispatchEvent(new Event('input'))");
  // delete from the details
  await b.ev("window.confirm=function(){return true};document.querySelector('#list .wrow').click();document.querySelector('#list .witem.open [data-del]').click()");
  assert.deepEqual((await stored()).map(x => x.w), ['budget', 'garden']);
  assert.deepEqual(b.errors, []);
});

test('tek kelime: listede olan kelime eklenmiyor; yazarken uyarı ve anlam önerisi', async () => {
  await b.seed({[K]: WORDS});
  await addTab();
  await b.ev("var i=document.getElementById('f-w');i.value='Habit';i.dispatchEvent(new Event('input'))");
  assert.match(await b.ev("document.getElementById('f-sg').textContent"), /zaten listende: “alışkanlık”/);
  await b.ev("document.getElementById('f-m').value='huy';document.getElementById('add1').click()");
  assert.match(await b.ev("document.getElementById('t1').textContent"), /“Habit” zaten listende\. Eklenmedi/);
  assert.equal((await stored()).length, 3);
  await b.ev("document.getElementById('t1-ed').click()");
  assert.equal(await b.ev("document.getElementById('ed-w').value"), 'habit', 'düzenleyici açıldı');
  await b.ev("document.getElementById('ed-x').click()");
  // a new word: a machine-translated meaning is offered and used only on tap
  await b.ev("document.getElementById('f-m').value='';var i=document.getElementById('f-w');i.value='apple';i.dispatchEvent(new Event('input'))");
  await b.waitFor("!!document.getElementById('f-use')", 5000);
  assert.match(await b.ev("document.getElementById('f-sg').textContent"), /Öneri: elma \(makine çevirisi\)/);
  assert.equal(await b.ev("document.getElementById('f-m').value"), '');
  await b.ev("document.getElementById('f-use').click();document.getElementById('add1').click()");
  const a = (await stored()).find(x => x.w === 'apple');
  assert.deepEqual([a.m, a.box], ['elma', 0]);
  assert.equal(await b.ev("document.getElementById('f-sg').textContent"), '');
  assert.deepEqual(b.errors, []);
});

test('toplu ekle: yalnızca kelimeler → anlamlar kontrol için gelir; anlamlı satırlar hemen eklenir; tekrarlar atlanır', async () => {
  await b.seed({[K]: WORDS});
  await addTab();
  mm.length = 0;
  await b.ev("document.getElementById('b-c').value='Yeni liste';document.getElementById('bulk').value='apple\\nhabit\\nmoon | ay\\nriver\\nApple\\nzzq';document.getElementById('addN').click()");
  await b.waitFor("!!document.getElementById('bp-add')", 10000);
  assert.deepEqual(mm, ['apple', 'river', 'zzq']);
  assert.match(await b.ev("document.getElementById('t2').textContent"), /^1 kelime eklendi\. 2 kelime zaten listende olduğu için eklenmedi \(habit, Apple\)/);
  let ws = await stored();
  assert.deepEqual(ws.map(x => x.w), ['habit', 'budget', 'garden', 'moon'], 'anlamı yazılmış satır hemen eklendi');
  assert.deepEqual(await b.ev("[].map.call(document.querySelectorAll('#b-pv [data-nm]'),function(i){return i.value})"), ['elma', 'nehir', '']);
  assert.equal(await b.ev("document.getElementById('bp-c').value"), 'Yeni liste');
  await b.ev("document.getElementById('bp-add').click()");
  assert.match(await b.ev("document.getElementById('t2').textContent"), /2 kelime listene eklendi\./);
  ws = await stored();
  assert.deepEqual(ws.map(x => [x.w, x.m, x.c]), [['habit', 'alışkanlık', 'Okul'], ['budget', 'bütçe', 'Ekonomi'], ['garden', 'bahçe', 'Okul'], ['moon', 'ay', 'Yeni liste'], ['apple', 'elma', 'Yeni liste'], ['river', 'nehir', 'Yeni liste']]);
  assert.equal(await b.ev("document.getElementById('b-pv').innerHTML"), '');
  assert.deepEqual(b.errors, []);
});

test('dosyadan: .txt kelime listesi eklenir; yedek dosyası geri yüklemeyi açmıyor, Ayarlar’a yönlendiriyor', async () => {
  await b.seed({[K]: WORDS});
  await addTab();
  const backup = path.join(dir, 'yedek.json');
  fs.writeFileSync(backup, JSON.stringify({app: 'x', keys: {[K]: []}}));
  await b.setFiles('#fl', [backup]);
  await b.waitFor("!!document.getElementById('t2-bk')", 5000);
  assert.match(await b.ev("document.getElementById('t2').textContent"), /yedek dosyası gibi görünüyor/);
  assert.equal(await b.ev("document.getElementById('v-list').classList.contains('hide')"), false, 'Kelimeler’de kalındı');
  assert.equal((await stored()).length, 3, 'hiçbir şey değişmedi');
  const txt = path.join(dir, 'liste.txt');
  fs.writeFileSync(txt, 'sun | güneş\nbudget | bütçe');
  await b.setFiles('#fl', [txt]);
  await b.waitFor("/1 kelime eklendi/.test(document.getElementById('t2').textContent)", 5000);
  assert.deepEqual((await stored()).map(x => x.w), ['habit', 'budget', 'garden', 'sun']);
  assert.deepEqual(b.errors, []);
});

test('ana sayfadaki “PDF ekle” Kelime ekle bölmesini açıyor; makale PDF’i için Makaleler sekmesine bağlantı var', async () => {
  await b.ev("document.getElementById('n-study').click()");
  await b.ev("document.getElementById('q-pdf').click()");
  assert.equal(await b.ev("!document.getElementById('v-list').classList.contains('hide')&&!document.getElementById('lt-add').classList.contains('hide')"), true);
  assert.equal(await b.ev("!!document.getElementById('pmode')"), false, 'makale seçeneği kalktı');
  await b.ev("document.getElementById('pf-art').click()");
  assert.equal(await b.ev("!document.getElementById('v-read').classList.contains('hide')&&!document.getElementById('rt-own').classList.contains('hide')"), true);
  assert.deepEqual(b.errors, []);
});
