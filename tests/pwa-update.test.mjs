// The update/reload logic of the service-worker registration script, run in Node with a fake browser environment and
// a controllable clock. Checks when an open (resumed) page reloads to a new version and, above all, when it must not.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {swRegScript} from './lib/browser.mjs';

const CODE = swRegScript();
const M = 60000;
const tick = () => new Promise(r => setImmediate(r));

// Runs the script once. Returns {reloads, heads} after the steps.
async function run(steps, {controller = true, busy = false, active = null, dirty = false, headFail = false} = {}) {
  let now = 1e9, reloads = 0, heads = 0, tag = '"aaaaaaaaaaaaaaaaaaaa-ssl-df"';
  const on = m => (t, f) => (m[t] = m[t] || []).push(f), fire = (m, t) => (m[t] || []).forEach(f => f());
  const docL = {}, swL = {}, winL = {};
  const document = {visibilityState: 'visible', activeElement: active, addEventListener: on(docL),
    querySelectorAll: () => dirty ? [{value: 'x', defaultValue: ''}] : []};
  const reg = {update: () => Promise.resolve()};
  const navigator = {serviceWorker: {controller: controller ? {} : null, addEventListener: on(swL),
    register: () => ({then: f => { f(reg); return {catch() {}}; }})}};
  const window = {addEventListener: on(winL), __44busy: () => busy};
  const location = {protocol: 'https:', pathname: '/', reload: () => reloads++};
  const fetch = () => { heads++; return headFail ? Promise.reject(new Error('net')) : Promise.resolve({ok: true, headers: {get: () => tag}}); };
  const RealDate = Date;
  globalThis.Date = {now: () => now};
  try {
    new Function('document', 'navigator', 'window', 'location', 'fetch', CODE)(document, navigator, window, location, fetch);
    fire(winL, 'load'); await tick();
    await steps({
      hide() { document.visibilityState = 'hidden'; fire(docL, 'visibilitychange'); },
      async show() { document.visibilityState = 'visible'; fire(docL, 'visibilitychange'); await tick(); await tick(); },
      wait(ms) { now += ms; },
      newWorker() { fire(swL, 'controllerchange'); },
      deployHtml() { tag = '"bbbbbbbbbbbbbbbbbbbb-ssl-df"'; },
      touch() { fire(docL, 'pointerdown'); }
    });
  } finally { globalThis.Date = RealDate; }
  return {reloads, heads};
}
const away = async (a, ms = 6 * M) => { a.hide(); a.wait(ms); await a.show(); };

test('ilk kurulumda yenileme yok', async () => {
  assert.equal((await run(async a => a.newWorker(), {controller: false})).reloads, 0);
});
test('hiç arka plana gitmemiş (yeni açılmış) sayfa yenilenmez', async () => {
  assert.equal((await run(async a => { a.wait(3000); a.newWorker(); })).reloads, 0);
});
test('5 dk+ arka plandan dönüşte yeni service worker: bir kez yenilenir', async () => {
  assert.equal((await run(async a => { await away(a); a.wait(2000); a.newWorker(); })).reloads, 1);
});
test('kısa arka plan (1 dk): yenilenmez, sonraki uzun dönüşte yenilenir', async () => {
  assert.equal((await run(async a => { await away(a, M); a.wait(2000); a.newWorker(); })).reloads, 0);
  assert.equal((await run(async a => { await away(a, M); a.wait(2000); a.newWorker(); await away(a); })).reloads, 1);
});
test('dönüşten sonra kullanıcı dokunduysa yenilenmez', async () => {
  assert.equal((await run(async a => { await away(a); a.touch(); a.wait(1000); a.newWorker(); })).reloads, 0);
});
test('iş sürüyorsa, alan odaktaysa ya da kaydedilmemiş metin varsa yenilenmez', async () => {
  const s = async a => { await away(a); a.wait(1000); a.newWorker(); };
  assert.equal((await run(s, {busy: true})).reloads, 0, 'busy');
  assert.equal((await run(s, {active: {tagName: 'TEXTAREA'}})).reloads, 0, 'odak');
  assert.equal((await run(s, {dirty: true})).reloads, 0, 'kaydedilmemiş metin');
});
test('yalnız index.html değişen yayın (ETag) algılanır ve bir kez yenilenir', async () => {
  assert.equal((await run(async a => { a.hide(); a.wait(6 * M); a.deployHtml(); await a.show(); })).reloads, 1);
  assert.equal((await run(async a => away(a))).reloads, 0, 'yayın yoksa yenileme yok');
});
test('ağ hatasında (HEAD başarısız) yenileme yok', async () => {
  assert.equal((await run(async a => { a.hide(); a.wait(6 * M); a.deployHtml(); await a.show(); }, {headFail: true})).reloads, 0);
});
test('ard arda dönüşlerde sonsuz yenileme yok', async () => {
  const r = await run(async a => { a.deployHtml(); for (let i = 0; i < 5; i++) await away(a); });
  assert.equal(r.reloads, 1);
});
