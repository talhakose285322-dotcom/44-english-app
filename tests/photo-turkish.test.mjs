// Photos of Turkish text: recognised (eng+tur), shown in the preview as Turkish, translated into English only on request
// with the free machine translation (fixed MyMemory answers here), the Turkish original kept and restorable; the free
// limit is shown and a too long text is not sent; a failed translation changes nothing; English photos are unchanged.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {startServer, openBrowser} from './lib/browser.mjs';
import {K, KA} from './lib/app.mjs';
import {makePng} from './fixtures/png.mjs';

const TR = 'Sağlıklı Alışkanlıklar\n\nÇoğu insan uykunun ve egzersizin önemli olduğunu bilir.\nAma alışkanlıkların nasıl oluştuğunu pek düşünmeyiz.\n\n' +
  'Bilim insanlarına göre her alışkanlığın üç parçası vardır.';
const EN = {'Sağlıklı Alışkanlıklar': 'Healthy Habits',
  'Çoğu insan uykunun ve egzersizin önemli olduğunu bilir. Ama alışkanlıkların nasıl oluştuğunu pek düşünmeyiz.': 'Most people know that sleep and exercise are important. But we rarely think about how habits form.',
  'Bilim insanlarına göre her alışkanlığın üç parçası vardır.': 'According to scientists, every habit has three parts.'};
const mm = [];
let fail = false;
const routes = [{match: u => u.startsWith('https://api.mymemory.translated.net/'), respond: u => {
  const p = new URL(u).searchParams, q = p.get('q'); mm.push([p.get('langpair'), q]);
  if (fail) return {body: {responseData: {translatedText: 'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY'}, responseStatus: 429, quotaFinished: true}};
  return {body: {responseData: {translatedText: EN[q] || 'EN: ' + q, match: 1}, responseStatus: 200, matches: []}};
}}];
let srv, b, dir;
before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'words44-trph-'));
  srv = await startServer();
  b = await openBrowser({origin: srv.url.slice(0, -1), fakes: ['supabase', 'tts', 'ocr', 'no-translator'], routes});
  await b.goto(srv.url);
});
after(async () => { await b?.close(); srv?.stop(); fs.rmSync(dir, {recursive: true, force: true}); });

const png = name => { const p = path.join(dir, name); fs.writeFileSync(p, makePng(600, 800)); return p; };
const box = () => b.ev("document.getElementById('a-x').value");
const pv = () => b.ev("document.getElementById('a-pv').textContent");
async function photo(texts) {
  await b.seed({[K]: [], [KA]: []});
  await b.ev("document.getElementById('n-read').click();document.querySelector('#rtabs [data-rt=\"own\"]').click()");
  await b.waitFor("!!document.getElementById('a-ig')");
  await b.ev(`window.__ocr.texts=${JSON.stringify(texts)}`);
  await b.setFiles('#a-ig', [png('p.png')]);
  await b.waitFor("/fotoğraf okundu|okunamadı|bulunamadı/.test(document.getElementById('a-p').textContent)", 15000);
}

test('Türkçe fotoğraf: Türkçe olarak okunuyor, önizlemede “Türkçe metin algılandı”; çeviri yalnızca istenince', async () => {
  mm.length = 0;
  await photo([TR]);
  assert.equal(await b.ev('window.__ocr.langs'), 'eng+tur');
  assert.match(await b.ev("document.getElementById('a-p').textContent"), /Türkçe metin algılandı/);
  assert.equal(await box(), '## Sağlıklı Alışkanlıklar\n\nÇoğu insan uykunun ve egzersizin önemli olduğunu bilir. Ama alışkanlıkların nasıl oluştuğunu pek düşünmeyiz.\n\nBilim insanlarına göre her alışkanlığın üç parçası vardır.',
    'Türkçe harfler korunuyor, İngilizceye özel düzeltme uygulanmıyor');
  assert.match(await pv(), /Türkçe metin algılandı[\s\S]*İngilizceye çevir[\s\S]*Ücretsiz makine çevirisi · tek seferde en fazla 4\.000 karakter, günde toplam yaklaşık 5\.000/);
  assert.deepEqual(mm, [], 'kendiliğinden çeviri isteği gönderilmedi');
  // the Turkish text can be corrected before translating
  await b.ev("document.getElementById('apv-ed').click();var x=document.getElementById('a-x');x.value=x.value.replace('pek düşünmeyiz','pek düşünmeyiz');x.dispatchEvent(new Event('input'))");
  await b.ev("document.getElementById('apv-ed').click()");
  await b.ev("document.getElementById('apv-tren').click()");
  await b.waitFor("/İngilizceye çevrildi/.test(document.getElementById('a-pv').textContent)", 10000);
  assert.deepEqual(mm.map(x => x[0]), ['tr|en', 'tr|en', 'tr|en'], 'paragraf paragraf, Türkçeden İngilizceye');
  assert.equal(await box(), '## Healthy Habits\n\nMost people know that sleep and exercise are important. But we rarely think about how habits form.\n\nAccording to scientists, every habit has three parts.',
    'başlık işareti korunuyor');
  assert.equal(await b.ev("document.querySelector('#a-pv .apv-b .ah').textContent"), 'Healthy Habits');
  assert.match(await b.ev("document.querySelector('#a-pv .apv-or').textContent"), /Türkçe asıl metin[\s\S]*Bilim insanlarına göre/);
  // after translating: editable, and the Turkish original can be restored
  await b.ev("document.getElementById('apv-ed').click()");
  assert.equal(await b.ev("document.getElementById('a-x').classList.contains('hide')"), false);
  await b.ev("document.getElementById('apv-ed').click()");
  await b.ev("window.confirm=function(){return true};document.getElementById('apv-trback').click()");
  assert.match(await box(), /^## Sağlıklı Alışkanlıklar/);
  assert.match(await pv(), /Türkçe metin algılandı/);
  // translate again and save: the article is the English text
  await b.ev("document.getElementById('apv-tren').click()");
  await b.waitFor("/İngilizceye çevrildi/.test(document.getElementById('a-pv').textContent)", 10000);
  await b.ev("document.getElementById('a-s').click()");
  await b.waitFor("document.body.classList.contains('reading')");
  const a = JSON.parse((await b.storage())[KA]);
  assert.equal(a.length, 1);
  assert.match(a[0].text, /^## Healthy Habits/);
  assert.deepEqual(b.errors, []);
});

test('ücretsiz sınır: çok uzun Türkçe metin gönderilmiyor; günlük sınır dolunca açık mesaj, Türkçe metin değişmiyor', async () => {
  const long = Array.from({length: 60}, (_, i) => `Bu kitapta ${i + 1}. paragraf alışkanlıkların günlük hayattaki önemini ve nasıl oluştuğunu anlatıyor.`).join('\n\n');
  mm.length = 0;
  await photo([long]);
  await b.ev("document.getElementById('apv-tren').click()");
  await b.waitFor("/karakter\\. Ücretsiz çeviri tek seferde en fazla 4000 karakter/.test(document.getElementById('a-pv').textContent)", 5000);
  assert.deepEqual(mm, [], 'çok uzun metin gönderilmedi');
  assert.equal(await box(), long.split('\n\n').join('\n\n'));
  // daily limit reached at the service
  fail = true;
  await photo([TR]);
  await b.ev("document.getElementById('apv-tren').click()");
  await b.waitFor("/Günlük ücretsiz çeviri sınırı doldu[\\s\\S]*Türkçe metin değiştirilmedi/.test(document.getElementById('a-pv').textContent)", 10000);
  fail = false;
  assert.match(await box(), /^## Sağlıklı Alışkanlıklar/);
  assert.deepEqual(b.errors, []);
});

test('İngilizce fotoğraf eskisi gibi: İngilizce kalıyor, çeviri seçeneği yok; boş fotoğrafta anlaşılır mesaj', async () => {
  mm.length = 0;
  await photo(['The market opens early in the morning and the people buy fresh bread and fruit there every day.']);
  assert.equal(await box(), 'The market opens early in the morning and the people buy fresh bread and fruit there every day.');
  assert.doesNotMatch(await pv(), /Türkçe|İngilizceye çevir/);
  assert.deepEqual(mm, []);
  await photo(['   ']);
  assert.match(await b.ev("document.getElementById('a-p').textContent"), /Fotoğrafta okunabilir metin bulunamadı[\s\S]*iyi ışıkta/);
  assert.equal(await box(), '');
  assert.deepEqual(b.errors, []);
});
