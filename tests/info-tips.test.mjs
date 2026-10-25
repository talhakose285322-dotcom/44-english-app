// (i) info buttons: a tap opens a short explanation, a tap elsewhere or Esc closes it; the backup reminder has one.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {startServer, openBrowser} from './lib/browser.mjs';
import {K} from './lib/app.mjs';

let srv, b;
before(async () => {
  srv = await startServer();
  b = await openBrowser({origin: srv.url.slice(0, -1), fakes: ['supabase', 'tts']});
  await b.goto(srv.url);
  await b.seed({[K]: [{id: 'k1', w: 'book', m: 'kitap', box: 0}]});
  await b.goto(srv.url);
  await b.waitFor("!!document.querySelector('#remind .itip')", 10000);
});
after(async () => { await b?.close(); srv?.stop(); });

const open = () => b.ev("(function(t){return t.classList.contains('open')&&getComputedStyle(t.querySelector('.itip-b')).display!=='none'})(document.querySelector('#remind .itip'))");

test('yedek hatırlatmasında (i) var; dokununca açıklama açılıyor, dışarıya dokununca ya da Esc ile kapanıyor', async () => {
  assert.match(await b.ev("document.getElementById('remind').innerText"), /Şimdi yedekle/);
  assert.equal(await open(), false, 'başta kapalı');
  await b.ev("document.querySelector('#remind .itip').click()");
  assert.equal(await open(), true);
  assert.match(await b.ev("document.querySelector('#remind .itip-b').textContent"), /yalnızca bu cihazda[\s\S]*7 gün[\s\S]*Profil → Ayarlar/);
  assert.equal(await b.ev("document.querySelector('#remind .itip').getAttribute('aria-expanded')"), 'true');
  await b.ev("document.querySelector('h1').click()");
  assert.equal(await open(), false, 'dışarıya dokununca kapanıyor');
  await b.ev("document.querySelector('#remind .itip').click()");
  await b.ev("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))");
  assert.equal(await open(), false, 'Esc ile kapanıyor');
  // the button next to it still works and nothing else was triggered
  assert.equal(await b.ev("document.getElementById('sheet').classList.contains('hide')"), true);
  assert.ok(await b.ev("document.documentElement.scrollWidth<=innerWidth"), 'balon ekrandan taşmıyor');
  assert.deepEqual(b.errors, []);
});
