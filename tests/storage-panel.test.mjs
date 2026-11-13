import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {startServer, openBrowser} from './lib/browser.mjs';
import {K} from './lib/app.mjs';

let srv, b;
before(async () => {
  srv = await startServer();
  b = await openBrowser({origin: srv.url.slice(0, -1), fakes: ['supabase', 'tts']});
  await b.goto(srv.url);
});
after(async () => { await b?.close(); srv?.stop(); });

test('profil depolama ölçümü isteğe bağlıdır, yerel veriyi değiştirmez ve kişisel veriyi göndermez', async () => {
  const seeded = [{id:'storage-test',w:'resilient',m:'dayanıklı',box:0}];
  await b.seed({[K]:seeded});
  await b.ev("document.getElementById('n-prof').click()");
  await b.waitFor("!!document.getElementById('p-storage-check')");
  assert.equal(await b.ev("document.getElementById('p-storage-result').textContent"), '');
  await b.ev("document.getElementById('p-storage-check').click()");
  await b.waitFor("document.getElementById('p-storage-result').textContent.includes('localStorage tahmini')");
  assert.match(await b.ev("document.getElementById('p-storage-result').textContent"), /localStorage tahmini:/);
  assert.deepEqual(JSON.parse((await b.storage())[K]), seeded);
  assert.deepEqual(b.errors, []);
});
