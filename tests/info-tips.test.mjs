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

test('açıklamalar gereken her yerde var ve açılan balon ekranın içinde kalıyor', async () => {
  const check = async (where, sel, re) => {
    await b.ev(`document.querySelector(${JSON.stringify(sel)}).click()`);
    const r = await b.ev(`(function(t){var u=t.querySelector('.itip-b').getBoundingClientRect();return {open:t.classList.contains('open'),l:u.left,r:u.right,w:innerWidth,text:t.textContent}})(document.querySelector(${JSON.stringify(sel)}))`);
    assert.ok(r.open, where + ': açıldı');
    assert.ok(r.l >= 0 && r.r <= r.w, `${where}: balon ekranda (${Math.round(r.l)}–${Math.round(r.r)} / ${r.w})`);
    assert.match(r.text, re, where);
    await b.ev("document.querySelector('h1').click()");
  };
  await check('Çalış kutuları', '#cardsUI .stats .itip', /0–3 arası bir kutudadır[\s\S]*1, 3, 8, 20 gün/);
  await b.ev("document.getElementById('n-read').click()");
  await b.waitFor("!!document.querySelector('#rl .note .itip')", 10000);
  await check('Hazır makaleler seviye', '#rl .note .itip', /Seviye: önerilen[\s\S]*B1/);
  await b.ev("document.querySelector('#rtabs [data-rt=\"kw\"]').click()");
  await check('Kelimelerimle oluştur', '#kw h2 .itip', /Liste seç[\s\S]*Kelime seç/);
  await b.ev("document.getElementById('n-prof').click();document.querySelector('#ptabs [data-pt=\"set\"]').click()");
  const set = await b.ev("[].map.call(document.querySelectorAll('#p-set h2 .itip'),function(t){return t.parentNode.firstChild.textContent.trim()})");
  assert.deepEqual(set, ['Otomatik güvenlik kopyaları', 'Verilerin nerede saklanıyor?']);
  await check('Güvenlik kopyaları', '#p-set h2 .itip', /son 15 kopya/);
  assert.ok(await b.ev("document.documentElement.scrollWidth<=innerWidth"), 'sayfa yana taşmıyor');
  assert.deepEqual(b.errors, []);
});
