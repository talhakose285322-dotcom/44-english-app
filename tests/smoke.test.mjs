// Smoke test: the scripts parse, the app opens without errors, every tab shows its screen, and the PWA basics
// (manifest, service worker) are in place.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT, readApp, mainScript, swRegScript, startServer, openBrowser} from './lib/browser.mjs';

test('betikler sözdizimi hatası içermiyor', () => {
  const html = readApp();
  assert.doesNotThrow(() => new Function(mainScript(html)), 'ana betik');
  assert.doesNotThrow(() => new Function(swRegScript(html)), 'service worker kayıt betiği');
  assert.doesNotThrow(() => new Function(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8')), 'sw.js');
});

let srv, b;
before(async () => {
  srv = await startServer();
  b = await openBrowser({origin: srv.url.slice(0, -1), fakes: ['supabase', 'tts']});
  await b.goto(srv.url);
});
after(async () => { await b?.close(); srv?.stop(); });

test('manifest kurulabilir bir PWA tanımlıyor', async () => {
  const m = await (await fetch(srv.url + 'manifest.json')).json();
  assert.equal(m.display, 'standalone');
  assert.ok(m.id && m.start_url && m.scope, 'id, start_url, scope');
  assert.ok(m.icons.some(i => i.sizes === '512x512' && i.purpose === 'maskable'), 'maskable 512 ikon');
  for (const i of m.icons) assert.equal((await fetch(new URL(i.src, srv.url))).status, 200, i.src);
});

test('uygulama hatasız açılıyor', async () => {
  await b.waitFor("!!document.getElementById('v-study')");
  assert.deepEqual(b.errors, []);
});

test('her sekme kendi ekranını gösteriyor', async () => {
  for (const v of ['read', 'list', 'dict', 'add', 'prof', 'study']) {
    await b.ev(`document.getElementById('n-${v}').click()`);
    const shown = await b.ev(`['study','read','list','dict','tr','add','prof'].filter(function(k){return !document.getElementById('v-'+k).classList.contains('hide')})`);
    assert.deepEqual(shown, [v], `sekme ${v}`);
  }
  assert.deepEqual(b.errors, []);
});

test('service worker kaydoluyor ve sayfayı kontrol ediyor', async () => {
  await b.waitFor('navigator.serviceWorker.getRegistration().then(function(r){return !!(r&&r.active)})', 10000);
  await b.reload();
  assert.equal(await b.ev('!!navigator.serviceWorker.controller'), true);
  assert.deepEqual(b.errors, []);
});
