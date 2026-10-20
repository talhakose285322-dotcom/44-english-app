// sw.js itself, run in Node with fake service-worker globals: install must not be blocked by an optional file,
// activate must remove only the app's old caches, and fetch must be network-first with an offline fallback.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './lib/browser.mjs';

const CODE = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').replace(/^﻿/, '');
const CACHE = CODE.match(/const CACHE = "([^"]+)"/)[1];

function load({fail = [], offline = false, existing = []} = {}) {
  const store = {}, L = {}, log = {skip: 0, claim: 0, deleted: []};
  for (const n of existing) store[n] = new Map();
  const cacheFor = n => (store[n] = store[n] || new Map(), {
    put: async (k, v) => { store[n].set(typeof k === 'string' ? k : k.url, v); },
    match: async k => store[n].get(typeof k === 'string' ? k : k.url)
  });
  const caches = {
    open: async n => cacheFor(n),
    keys: async () => Object.keys(store),
    delete: async n => { log.deleted.push(n); return delete store[n]; },
    match: async k => { for (const n of Object.keys(store)) { const v = store[n].get(typeof k === 'string' ? k : k.url); if (v) return v; } }
  };
  const res = (body, ok = true) => ({ok, status: ok ? 200 : 404, redirected: false, body, clone() { return res(body, ok); }});
  const fetch = async (r) => {
    const u = typeof r === 'string' ? r : r.url;
    if (offline) throw new TypeError('offline');
    return res('net:' + u, !fail.some(f => u.includes(f)));
  };
  const self = {addEventListener: (t, f) => (L[t] = f), skipWaiting: () => log.skip++, clients: {claim: () => log.claim++}, location: {origin: 'https://app.test'}};
  new Function('self', 'caches', 'fetch', CODE)(self, caches, fetch);
  const run = async (type, extra = {}) => {
    let p = null, responded = null;
    L[type]({...extra, waitUntil: x => (p = x), respondWith: x => (responded = x)});
    if (p) await p;
    return responded && await responded;
  };
  return {run, store, log};
}

test('sw.js: kurulum isteğe bağlı dosya hatasında durmuyor, zorunlu dosya hatasında duruyor; eski önbellekler temizleniyor; önce ağ, çevrimdışı önbellek', async () => {
  // an optional file (an icon) missing: install still completes and activates at once
  let s = load({fail: ['favicon-32.png']});
  await s.run('install');
  assert.equal(s.log.skip, 1, 'skipWaiting çağrıldı');
  assert.ok(s.store[CACHE].has('./index.html'), 'uygulama sayfası önbellekte');

  // a core file missing: install fails (the old worker keeps running)
  s = load({fail: ['index.html']});
  await assert.rejects(s.run('install'));
  assert.equal(s.log.skip, 0);

  // activate: only this app's old caches go; other caches stay
  s = load({existing: ['english-app-v1', CACHE, 'other-site-cache']});
  await s.run('activate');
  assert.deepEqual(s.log.deleted, ['english-app-v1']);
  assert.equal(s.log.claim, 1);

  // fetch: network first (and the copy is cached), offline falls back to the cache, navigations to the app page
  s = load();
  const req = (u, extra = {}) => ({request: {method: 'GET', url: u, mode: 'cors', ...extra}});
  assert.equal((await s.run('fetch', req('https://app.test/icon.svg'))).body, 'net:https://app.test/icon.svg');
  await new Promise(r => setTimeout(r, 0));
  assert.ok(s.store[CACHE].has('https://app.test/icon.svg'), 'ağdan gelen kopya önbelleğe yazıldı');
  const off = load({offline: true});
  await off.store[CACHE] || off.run;
  off.store[CACHE] = new Map([['./', {body: 'cached app'}], ['https://app.test/icon.svg', {body: 'cached icon'}]]);
  assert.equal((await off.run('fetch', req('https://app.test/icon.svg'))).body, 'cached icon');
  assert.equal((await off.run('fetch', req('https://app.test/some/page', {mode: 'navigate'}))).body, 'cached app');

  // other sites and non-GET requests are not touched
  assert.equal(await s.run('fetch', req('https://en.wiktionary.org/w/api.php')), null);
  assert.equal(await s.run('fetch', {request: {method: 'POST', url: 'https://app.test/x'}}), null);
});
