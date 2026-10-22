// Local backup import safety: malformed/future backups cannot change local data, and merge preserves existing data.
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

async function openRestore() {
  await b.ev("document.getElementById('n-add').click()");
  await b.waitFor("!!document.getElementById('impb')");
}
async function pasteBackup(value) {
  await b.ev(`document.getElementById('imp').value=${JSON.stringify(JSON.stringify(value))};document.getElementById('impb').click()`);
}
const words = async () => JSON.parse((await b.storage())[K] || '[]');
const fullBackup = (keys, version = 1) => ({
  format: '44-backup', version, app: '44', created: new Date().toISOString(),
  counts: {words: (keys[K] || []).length, articles: (keys[KA] || []).length},
  keys, extra: {}, unreadable: {}
});

test('geçersiz JSON yedeği reddedilir ve yerel veriler aynen korunur', async () => {
  await b.seed({[K]: [{id: 'local-apple', w: 'apple', m: 'elma', box: 2}], [KS]: {goal: 17}, [KA]: []});
  await openRestore();
  await b.ev("document.getElementById('imp').value='not-json';document.getElementById('impb').click()");
  await b.waitFor("document.getElementById('rprev').innerText.includes('Mevcut verilerine dokunulmadı')");
  assert.deepEqual((await words()).map(w => [w.w, w.box]), [['apple', 2]]);
  assert.equal(JSON.parse((await b.storage())[KS]).goal, 17);
  assert.deepEqual(b.errors, []);
});

test('gelecek sürüm yedeği reddedilir ve yerel veriler aynen korunur', async () => {
  await b.seed({[K]: [{id: 'local-apple', w: 'apple', m: 'elma', box: 1}], [KS]: {goal: 19}, [KA]: []});
  await openRestore();
  await pasteBackup(fullBackup({[K]: [{id: 'future-pear', w: 'pear', m: 'armut', box: 0}], [KS]: {}, [KA]: []}, 2));
  await b.waitFor("document.getElementById('rprev').innerText.includes('daha yeni bir sürümüyle yapılmış')");
  assert.deepEqual((await words()).map(w => [w.w, w.box]), [['apple', 1]]);
  assert.equal(JSON.parse((await b.storage())[KS]).goal, 19);
  assert.deepEqual(b.errors, []);
});

test('yedek birleştirmesi mevcut kelimeyi/ilerlemeyi korur, yeni kelimeyi ekler ve öncesinde güvenlik kopyası alır', async () => {
  await b.seed({[K]: [{id: 'local-apple', w: 'apple', m: 'elma', box: 3}], [KS]: {goal: 23}, [KA]: []});
  await openRestore();
  await pasteBackup(fullBackup({[K]: [
    {id: 'backup-apple', w: 'Apple', m: 'meyve', box: 0},
    {id: 'backup-pear', w: 'pear', m: 'armut', box: 0}
  ], [KS]: {goal: 99, theme: 'dark'}, [KA]: []}));
  await b.waitFor("!!document.getElementById('rp-m')");
  assert.equal(await b.ev("!!document.getElementById('rp-r')"), true, 'tam değiştirme seçeneği görünmeli');
  await b.ev("document.getElementById('rp-r').click()");
  await b.waitFor("document.getElementById('rp-r')!==null");
  assert.ok(b.dialogs.some(x => x.includes('değiştirilecek') && x.includes('güvenlik kopyası')), 'tam değiştirme açık onay istemeli');
  assert.deepEqual((await words()).map(w => [w.w, w.box]), [['apple', 3]], 'onay verilmediğinde yerel veri değişmemeli');
  await b.ev("document.getElementById('rp-m').click()");
  await b.waitFor("document.getElementById('rprev').innerText.includes('Geri yükleme tamamlandı')");
  const saved = await words();
  assert.equal(saved.filter(w => w.w.toLowerCase() === 'apple').length, 1, 'yinelenen kelime eklenmemeli');
  assert.equal(saved.find(w => w.w.toLowerCase() === 'apple').box, 3, 'mevcut öğrenme ilerlemesi korunmalı');
  assert.ok(saved.some(w => w.w === 'pear'), 'yeni kelime eklenmeli');
  const settings = JSON.parse((await b.storage())[KS]);
  assert.equal(settings.goal, 23, 'mevcut ayar ezilmemeli');
  assert.equal(settings.theme, 'dark', 'yedekteki eksik ayar eklenmeli');
  assert.ok((await b.snapshots()).some(x => x.why === 'geri yüklemeden önce'), 'geri yükleme öncesi otomatik kopya alınmalı');
  assert.deepEqual(b.errors, []);
});
