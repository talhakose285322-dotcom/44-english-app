// Profile tabs: settings, backup and storage notes moved out of "Ekle" into Profil → Ayarlar; "Ekle" keeps only adding
// words. Settings keep working from their new place and the app link names the address the app runs from.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {startServer, openBrowser} from './lib/browser.mjs';
import {K, KS} from './lib/app.mjs';

let srv, b;
before(async () => {
  srv = await startServer();
  b = await openBrowser({origin: srv.url.slice(0, -1), fakes: ['supabase', 'tts']});
  await b.goto(srv.url);
  await b.seed({[K]: [{id: 'k1', w: 'book', m: 'kitap', box: 1}]});
});
after(async () => { await b?.close(); srv?.stop(); });

// heading text without an (i) info button that may follow it
const heads = id => b.ev(`[].map.call(document.querySelectorAll('#${id} h2'),function(h){return h.firstChild.textContent.trim()})`);
const visible = id => b.ev(`!document.getElementById('${id}').classList.contains('hide')`);

test('Ekle yalnızca kelime eklemeyi, Profil → Ayarlar ayarları ve yedeği gösteriyor', async () => {
  assert.deepEqual(await heads('v-add'), ['Tek kelime', 'PDF’den içe aktar', 'Toplu ekle']);
  await b.ev("document.getElementById('n-prof').click()");
  assert.ok(await visible('p-main'), 'Profil sekmesi açık başlıyor');
  assert.equal(await visible('p-set'), false);
  await b.ev("document.querySelector('#ptabs [data-pt=\"set\"]').click()");
  assert.equal(await visible('p-main'), false);
  assert.deepEqual(await heads('p-set'), ['Ayarlar', 'Uygulama linki', 'Yenilikler', 'Yedek', 'Yedekten geri yükle', 'Otomatik güvenlik kopyaları', 'Verilerin nerede saklanıyor?']);
  assert.match(await b.ev("document.getElementById('bk-info').innerText"), /1 kelime/, 'yedek bilgisi Ayarlar açılınca doluyor');
  assert.equal(await b.ev("document.getElementById('lk').value"), srv.url, 'uygulama linki çalıştığı adres');
  assert.deepEqual(b.errors, []);
});

test('ayarlar yeni yerinden kaydediliyor; Profil’e dönüp gelince seçili sekme korunuyor', async () => {
  await b.ev("(function(s){s.value='dark';s.dispatchEvent(new Event('change'))})(document.getElementById('s-theme'))");
  assert.equal(JSON.parse((await b.storage())[KS]).theme, 'dark');
  await b.ev("document.getElementById('n-dict').click();document.getElementById('n-prof').click()");
  assert.ok(await visible('p-set'), 'Ayarlar sekmesi açık kalıyor');
  await b.ev("document.querySelector('#ptabs [data-pt=\"me\"]').click()");
  assert.ok(await visible('p-main'));
  assert.match(await b.ev("document.getElementById('p-main').innerText"), /Sürüm \d+\.\d+\.\d+/);
  assert.deepEqual(b.errors, []);
});
