// The update/reload logic of the service-worker registration script, run in Node with a fake browser environment and
// a controllable clock. Checks when an open (resumed) page reloads to a new version and, above all, when it must not.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {swRegScript} from './lib/browser.mjs';

const CODE = swRegScript();
const M = 60000;
// a release that keeps the version number: the published marker says the same version as the running page
const RUNNING = CODE.match(/var runningVersion = '([\d.]+)'/)[1];
const tick = () => new Promise(r => setImmediate(r));

// Runs the script once. Returns {reloads, heads} after the steps.
async function run(steps, {controller = true, busy = false, active = null, dirty = false, headFail = false, etag = true} = {}) {
  let now = 1e9, reloads = 0, heads = 0, tag = '"aaaaaaaaaaaaaaaaaaaa-ssl-df"', built = '2026-10-24T10:00:00.000Z';
  const on = m => (t, f) => (m[t] = m[t] || []).push(f), fire = (m, t) => (m[t] || []).forEach(f => f());
  const docL = {}, swL = {}, winL = {};
  const document = {visibilityState: 'visible', activeElement: active, addEventListener: on(docL),
    querySelectorAll: () => dirty ? [{value: 'x', defaultValue: ''}] : []};
  const reg = {update: () => Promise.resolve()};
  const navigator = {serviceWorker: {controller: controller ? {} : null, addEventListener: on(swL),
    register: () => ({then: f => { f(reg); return {catch() {}}; }})}};
  const window = {addEventListener: on(winL), __44busy: () => busy};
  const location = {protocol: 'https:', pathname: '/', reload: () => reloads++};
  // the release marker (version.json, same version number, a new builtAt per deploy) and the page's HEAD (ETag)
  const fetch = url => {
    if (String(url).includes('version.json')) return headFail ? Promise.reject(new Error('net')) : Promise.resolve({ok: true, json: () => Promise.resolve({version: RUNNING, builtAt: built})});
    heads++; return headFail ? Promise.reject(new Error('net')) : Promise.resolve({ok: true, headers: {get: () => etag ? tag : null}});
  };
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
      deployBuild() { built = '2026-10-24T18:00:00.000Z'; },
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
test('ETag göndermeyen sunucuda (Cloudflare Worker) yeni yayın, version.json builtAt ile algılanır ve bir kez yenilenir', async () => {
  const deploy = async a => { a.hide(); a.wait(6 * M); a.deployBuild(); await a.show(); };
  assert.equal((await run(deploy, {etag: false})).reloads, 1);
  assert.equal((await run(async a => away(a), {etag: false})).reloads, 0, 'yayın yoksa yenileme yok');
  assert.equal((await run(async a => { a.hide(); a.wait(M); a.deployBuild(); await a.show(); }, {etag: false})).reloads, 0, 'kısa dönüşte yenilenmez');
  assert.equal((await run(async a => { a.hide(); a.wait(M); a.deployBuild(); await a.show(); await away(a); }, {etag: false})).reloads, 1, 'sonraki uzun dönüşte yenilenir');
  assert.equal((await run(async a => { a.deployBuild(); for (let i = 0; i < 5; i++) await away(a); }, {etag: false})).reloads, 1, 'sonsuz yenileme yok');
  assert.equal((await run(async a => { a.hide(); a.wait(6 * M); a.deployBuild(); await a.show(); }, {etag: false, busy: true})).reloads, 0, 'iş sürüyorsa yenilenmez');
});
