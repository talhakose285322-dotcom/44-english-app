// Manual Supabase cloud backup: user scoping, validated merge-only restore, and failure safety.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {startServer, openBrowser} from './lib/browser.mjs';
import {K, KS, KA} from './lib/app.mjs';

let srv, b;
before(async () => {
  srv = await startServer();
  b = await openBrowser({origin: srv.url.slice(0, -1), fakes: ['supabase', 'tts']});
  await b.goto(srv.url);
});
after(async () => { await b?.close(); srv?.stop(); });

async function signIn() {
  await b.ev("document.getElementById('n-prof').click()");
  await b.waitFor("!!document.getElementById('p-acct')");
  await b.ev("document.getElementById('p-in').click()");
  await b.waitFor("window.__sb.created>0");
  await b.ev("window.__sb.signIn({id:'user-1',email:'cloud@example.com'})");
  await b.waitFor("!!document.getElementById('p-cloud-save')");
}
const words = async () => JSON.parse((await b.storage())[K] || '[]');
const cloudPayload = () => JSON.stringify({
  format: '44-backup', version: 1, app: '44', created: new Date().toISOString(),
  counts: {words: 1, articles: 0},
  keys: {[K]: [{id: 'cloud-pear', w: 'pear', m: 'armut', box: 0}], [KS]: {}, [KA]: []},
  extra: {}, unreadable: {}
});

test('hesap açmadan uygulama kullanılabilir ve bulut düğmeleri gösterilmez', async () => {
  await b.seed({[K]: [{id: 'local-apple', w: 'apple', m: 'elma', box: 0}]});
  await b.ev("document.getElementById('n-prof').click()");
  assert.equal(await b.ev("!!document.getElementById('p-cloud-save')"), false);
  assert.equal((await words()).length, 1);
  assert.deepEqual(b.errors, []);
});

test('bulut yedeği yalnızca oturum açmış kullanıcının satırına kaydedilir', async () => {
  await b.seed({[K]: [{id: 'local-apple', w: 'apple', m: 'elma', box: 0}], [KS]: {tot: 3}, [KA]: []});
  await signIn();
  await b.ev("document.getElementById('p-cloud-save').click()");
  await b.waitFor("document.getElementById('p-acct').innerText.includes('Bulut yedeği kaydedildi')");
  const row = await b.ev("window.__sb.row");
  assert.equal(row.user_id, 'user-1');
  const data = JSON.parse(row.data);
  assert.equal(data.format, '44-backup');
  assert.equal(data.keys[K][0].w, 'apple');
  assert.equal(data.keys[KS].tot, 3);
  assert.equal(JSON.stringify(data).includes('auth-token'), false);
  assert.deepEqual(b.errors, []);
});

test('buluttan geri yükleme doğrulanır ve yalnızca birleştirme sunar', async () => {
  await b.seed({[K]: [{id: 'local-apple', w: 'apple', m: 'elma', box: 0}], [KS]: {}, [KA]: []});
  await signIn();
  await b.ev("window.__sb.row={user_id:'user-1',data:"+JSON.stringify(cloudPayload())+",updated_at:new Date().toISOString()}");
  await b.ev("document.getElementById('p-cloud-load').click()");
  await b.waitFor("!!document.getElementById('rp-m')");
  assert.equal(await b.ev("!!document.getElementById('rp-r')"), false, 'bulut yedeği mevcut verileri değiştirememeli');
  await b.ev("document.getElementById('rp-m').click()");
  await b.waitFor("document.getElementById('rprev').innerText.includes('Geri yükleme tamamlandı')");
  const saved = await words();
  assert.ok(saved.some(w => w.w === 'apple'), 'mevcut kelime korunmalı');
  assert.ok(saved.some(w => w.w === 'pear'), 'bulut kelimesi eklenmeli');
  assert.deepEqual(b.errors, []);
});

test('bulut okuma hatasında yerel veriler değişmeden kalır', async () => {
  await b.seed({[K]: [{id: 'local-apple', w: 'apple', m: 'elma', box: 0}], [KS]: {}, [KA]: []});
  await signIn();
  await b.ev("window.__sb.fail='select'");
  await b.ev("document.getElementById('p-cloud-load').click()");
  await b.waitFor("document.getElementById('p-acct').innerText.includes('network down')");
  assert.deepEqual((await words()).map(w => w.w), ['apple']);
  assert.deepEqual(b.errors, []);
});

test('bozuk bulut yedeği reddedilir ve yerel veriler korunur', async () => {
  await b.seed({[K]: [{id: 'local-apple', w: 'apple', m: 'elma', box: 0}], [KS]: {}, [KA]: []});
  await signIn();
  await b.ev("window.__sb.row={user_id:'user-1',data:'not-json',updated_at:new Date().toISOString()}");
  await b.ev("document.getElementById('p-cloud-load').click()");
  await b.waitFor("document.getElementById('p-acct').innerText.includes('doğrulanamadı')");
  assert.deepEqual((await words()).map(w => w.w), ['apple']);
  assert.equal(await b.ev("!!document.getElementById('rp-r')"), false);
  assert.deepEqual(b.errors, []);
});
