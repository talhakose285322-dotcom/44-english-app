// The article upload form explains what gives the best results, closed by default and without any requirement.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {startServer, openBrowser} from './lib/browser.mjs';

let srv, b;
before(async () => {
  srv = await startServer();
  b = await openBrowser({origin: srv.url.slice(0, -1), fakes: ['supabase', 'tts']});
  await b.goto(srv.url);
});
after(async () => { await b?.close(); srv?.stop(); });

test('makale yükleme ipuçları: kapalı geliyor, açılınca ayırma ve dosya türleri anlatılıyor', async () => {
  await b.ev("document.getElementById('n-read').click();document.querySelector('#rtabs [data-rt=\"own\"]').click()");
  await b.waitFor("!!document.getElementById('a-tips')");
  assert.equal(await b.ev("document.getElementById('a-tips').open"), false);
  assert.equal(await b.ev("document.querySelector('#a-tips summary').textContent"), 'Hangi dosyalar en iyi sonucu verir?');
  await b.ev("document.querySelector('#a-tips summary').click()");
  assert.equal(await b.ev("document.getElementById('a-tips').open"), true);
  const t = await b.ev("document.getElementById('a-tips').textContent");
  assert.match(t, /Özel bir hazırlık gerekmez/);
  assert.match(t, /kendiliğinden makalelere ayrılır/);
  assert.match(t, /Şart değil/);
  assert.deepEqual(b.errors, []);
});
