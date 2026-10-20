// Flashcards: "Biliyorum" / "Bilmiyorum" update the word's progress and the daily counters.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {startServer, openBrowser, sleep} from './lib/browser.mjs';
import {K, KS} from './lib/app.mjs';

let srv, b;
before(async () => {
  srv = await startServer();
  b = await openBrowser({origin: srv.url.slice(0, -1), fakes: ['supabase', 'tts']});
  await b.goto(srv.url);
});
after(async () => { await b?.close(); srv?.stop(); });

const state = async () => { const s = await b.storage(); return {w: JSON.parse(s[K])[0], s: JSON.parse(s[KS] || '{}')}; };
const today = () => b.ev('new Date().toISOString().slice(0,10)');

test('Biliyorum: kutu artıyor, aralık 1 gün, sonraki tekrar ileri tarihli, sayaçlar artıyor', async () => {
  await b.seed({[K]: [{id: 'a1', w: 'apple', m: 'elma', box: 0}]});
  await b.ev("document.getElementById('n-study').click()");
  await b.waitFor("!!document.getElementById('yes')");
  await b.ev("document.getElementById('yes').click()"); await sleep(100);
  const {w, s} = await state(), t = await today();
  assert.equal(w.box, 1);
  assert.equal(w.iv, 1);
  assert.ok(w.due > t, 'sonraki tekrar bugünden sonra: ' + w.due);
  assert.deepEqual([w.n, w.ok, w.bad || 0], [1, 1, 0]);
  assert.deepEqual([s.n, s.tot, s.day], [1, 1, t]);
  assert.ok(s.days.includes(t), 'bugün gün geçmişinde');
});

test('Bilmiyorum: kutu sıfırlanıyor, tekrar bugün, hata sayacı artıyor', async () => {
  await b.seed({[K]: [{id: 'a1', w: 'apple', m: 'elma', box: 2, iv: 3, n: 4, ok: 4}], [KS]: {tot: 10}});
  await b.ev("document.getElementById('n-study').click()");
  await b.waitFor("!!document.getElementById('no')");
  await b.ev("document.getElementById('no').click()"); await sleep(100);
  const {w, s} = await state(), t = await today();
  assert.deepEqual([w.box, w.iv, w.due], [0, 0, t]);
  assert.deepEqual([w.n, w.ok, w.bad], [5, 4, 1]);
  assert.equal(s.tot, 11, 'toplam tekrar');
  assert.deepEqual(b.errors, []);
});

test('üst üste 3 Biliyorum: kutu en fazla 3 olur (öğrenildi)', async () => {
  await b.seed({[K]: [{id: 'a1', w: 'apple', m: 'elma', box: 2, iv: 1}]});
  await b.ev("document.getElementById('n-study').click()");
  await b.waitFor("!!document.getElementById('yes')");
  await b.ev("document.getElementById('yes').click()"); await sleep(100);
  const {w} = await state();
  assert.equal(w.box, 3);
  assert.ok(w.iv > 1, 'aralık uzadı: ' + w.iv);
});
