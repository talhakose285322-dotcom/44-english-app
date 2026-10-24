// Ready-made article library in the app, with the real content files: catalog, filters, opening in the normal
// reader at a level, level switch keeping the paragraph, progress/saved list in their own key, failure handling.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {startServer, openBrowser, sleep} from './lib/browser.mjs';
import {K, KA} from './lib/app.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './lib/browser.mjs';

// the real catalog: the library grows without app releases, so counts come from it rather than being fixed here
const CATALOG = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'articles', 'catalog.json'), 'utf8'));
const LIBK = K + '-lib';
const OWN = [{id: 'own1', title: 'My notes', text: 'A text that belongs to the user and must stay as it is.', pos: 0.5}];
let srv, b;
before(async () => {
  srv = await startServer();
  b = await openBrowser({origin: srv.url.slice(0, -1), fakes: ['supabase', 'tts']});
  await b.goto(srv.url);
  await b.seed({[K]: [{id: 'k1', w: 'kitap', m: 'book', box: 1}], [KA]: OWN});
  await b.ev("document.getElementById('n-read').click()");
});
after(async () => { await b?.close(); srv?.stop(); });

const cards = () => b.ev("[].map.call(document.querySelectorAll('#rl-list [data-rl]'),function(t){return t.getAttribute('data-rl')+'@'+t.getAttribute('data-lv')})");
const lib = async () => JSON.parse((await b.storage())[LIBK] || '{}');
const setSel = (id, v) => b.ev(`(function(s){s.value=${JSON.stringify(v)};s.dispatchEvent(new Event('change'))})(document.getElementById('${id}'))`);
const artText = () => b.ev("document.getElementById('art').innerText");
const topPara = () => b.ev("(function(){var ch=document.getElementById('art').children,i=0;for(;i<ch.length;i++)if(ch[i].getBoundingClientRect().bottom>90)break;return i})()");

test('hazır makaleler kataloğu yükleniyor; kategori, seviye ve arama filtreleri çalışıyor', async () => {
  await b.waitFor("document.querySelectorAll('#rl-list [data-rl]').length>=3", 10000);
  assert.equal((await cards()).length, CATALOG.articles.length, 'katalogdaki her makale listede');
  await setSel('rl-c', 'technology');
  assert.deepEqual(await cards(), ['how-the-internet-moves-data@B1']);
  await setSel('rl-c', '');
  await setSel('rl-lv', 'C2');
  assert.ok((await cards()).every(c => c.endsWith('@C2')), 'seçilen seviye kartlara geçiyor');
  await b.ev("(function(q){q.value='inflation';q.dispatchEvent(new Event('input'))})(document.getElementById('rl-q'))");
  assert.deepEqual(await cards(), ['what-is-inflation@C2']);
  await b.ev("(function(q){q.value='';q.dispatchEvent(new Event('input'))})(document.getElementById('rl-q'))");
  await setSel('rl-lv', 'B1');
  assert.deepEqual(b.errors, []);
});

test('kartlar kategori, seviye ve okuma süresiyle gösteriliyor; “Günün makalesi” yalnızca filtresizken var', async () => {
  await setSel('rl-lv', '');
  const first = await b.ev("(function(c){return {cat:c.querySelector('.lc-cat').textContent,lv:c.getAttribute('data-lv'),on:[].map.call(c.querySelectorAll('.lc-lvs i.on'),function(i){return i.textContent}),n:c.querySelectorAll('.lc-lvs i').length,top:c.querySelector('.lc-top').innerText}})(document.querySelector('#rl-list .lcard'))");
  // the category filter is built from the catalog, so a real category label is one of its options
  const catLabels = await b.ev("[].filter.call(document.querySelectorAll('#rl-c option'),function(o){return o.value&&o.value!=='saved'}).map(function(o){return o.textContent})");
  assert.ok(catLabels.includes(first.cat), 'kategori etiketi: ' + first.cat);
  assert.equal(first.n, 6);
  assert.deepEqual(first.on, [first.lv], 'açılacak seviye vurgulu');
  assert.match(first.top, /\d+ dk okuma/);
  assert.match(await b.ev("document.querySelector('#rl-feat .lfeat').innerText"), /Günün makalesi/);
  assert.ok(await b.ev("!!document.querySelector('#rl-feat .lfeat[data-rl]')"), 'günün makalesi açılabilir');
  await setSel('rl-c', 'technology');
  assert.equal(await b.ev("document.getElementById('rl-feat').innerHTML"), '', 'filtre seçiliyken gösterilmiyor');
  await setSel('rl-c', '');
  assert.deepEqual(b.errors, []);
});

test('makale seçilen seviyede normal okuyucuda açılıyor; kelimeye dokununca mevcut kelime paneli açılıyor', async () => {
  await b.ev("document.querySelector('#rl-list [data-rl=\"why-we-sleep\"]').click()");
  await b.waitFor("document.body.classList.contains('reading')&&!!document.querySelector('.libbar')", 10000);
  assert.equal(await b.ev("document.querySelector('.atitle').textContent"), 'Why Do We Sleep?');
  assert.match(await artText(), /We spend about a third of our lives asleep/);
  assert.deepEqual(await b.ev("[].map.call(document.querySelectorAll('[data-llv]'),function(x){return x.textContent+(x.classList.contains('on')?'*':'')})"), ['A1', 'A2', 'B1*', 'B2', 'C1', 'C2']);
  assert.equal(await b.ev("document.getElementById('edt').style.display"), 'none', 'hazır makale düzenlenemez');
  await b.ev("document.querySelector('#art .w').click()");
  await b.waitFor("!document.getElementById('sheet').classList.contains('hide')");
  await b.ev("document.getElementById('sheet').classList.add('hide')");
  assert.deepEqual(b.errors, []);
});

test('okuma ilerlemesi kendi anahtarına kaydediliyor; seviye değişince aynı paragrafta kalınıyor', async () => {
  await b.ev("document.getElementById('art').children[2].scrollIntoView({block:'start'});window.scrollBy(0,-60)");
  await b.waitFor(`(function(){var d=JSON.parse(localStorage.getItem('${LIBK}')||'{}');return d.p&&d.p['why-we-sleep']&&d.p['why-we-sleep'].pos>0})()`, 8000);
  const before = await topPara();
  assert.equal(before, 2);
  await b.ev("document.querySelector('[data-llv=\"A2\"]').click()");
  await b.waitFor("/Every night, people go to sleep, but why do we need it/.test(document.getElementById('art').innerText)", 10000);
  await sleep(400);
  assert.equal(await topPara(), before, 'aynı paragraf');
  assert.equal(await b.ev("document.querySelector('[data-llv].on').textContent"), 'A2');
  assert.equal((await lib()).p['why-we-sleep'].lv, 'A2');
  assert.deepEqual(JSON.parse((await b.storage())[KA]), OWN, 'kullanıcının kendi makaleleri değişmedi');
});

test('kaydetme listesi ve son seviye hatırlanıyor; kendi makaleler aynı kalıyor', async () => {
  await b.ev("document.getElementById('rl-sv').click()");
  assert.deepEqual((await lib()).saved, ['why-we-sleep']);
  assert.equal(await b.ev("document.getElementById('rl-sv').textContent"), '★ Kaydedildi');
  await b.ev("document.getElementById('back').click()");
  await b.waitFor("document.querySelectorAll('#rl-list [data-rl]').length>=1");
  await setSel('rl-lv', '');
  await setSel('rl-c', 'saved');
  assert.deepEqual(await cards(), ['why-we-sleep@A2'], 'kaydedilen makale son seviyesiyle listeleniyor');
  await setSel('rl-c', '');
  assert.deepEqual(JSON.parse((await b.storage())[KA]), OWN);
  assert.ok(await b.ev("document.getElementById('lib-list').innerText.indexOf('My notes')>=0"), 'kendi kütüphanesi görünüyor');
  assert.deepEqual(b.errors, []);
});

test('katalog yüklenemezse açık bir mesaj çıkıyor ve kendi makaleler kullanılabiliyor', async () => {
  const s2 = await startServer();
  const b2 = await openBrowser({origin: s2.url.slice(0, -1), fakes: ['supabase', 'tts'],
    routes: [{match: u => u.includes('/content/articles/catalog.json'), respond: () => ({status: 500, body: 'error'})}]});
  try {
    // the service worker would fetch the catalog itself, outside the page's request routing; skip it in this browser
    await b2.send('Network.enable');
    await b2.send('Network.setBypassServiceWorker', {bypass: true});
    await b2.goto(s2.url);
    await b2.seed({[K]: [], [KA]: OWN});
    await b2.ev("document.getElementById('n-read').click()");
    await b2.waitFor("/Hazır makaleler şu an yüklenemedi/.test(document.getElementById('rl').innerText)", 10000);
    assert.ok(await b2.ev("document.getElementById('lib-list').innerText.indexOf('My notes')>=0"));
    assert.deepEqual(b2.errors, []);
  } finally { await b2.close(); s2.stop(); }
});

test('haberler fotoğraf, fotoğraf sahibi, önemli kelimeler, anlama soruları ve kaynaklarla açılıyor', async () => {
  await b.ev("document.getElementById('n-read').click()");
  await b.waitFor("document.querySelectorAll('#rl-list [data-rl]').length>=3", 10000);
  await setSel('rl-lv', '');
  await setSel('rl-c', 'news');
  assert.equal(await b.ev("document.querySelector('#rl-c option[value=\"news\"]').textContent"), 'Haberler');
  const news = CATALOG.articles.filter(a => a.category === 'news');
  assert.ok(news.length >= 1);
  assert.equal((await cards()).length, news.length);
  assert.ok(await b.ev("[].every.call(document.querySelectorAll('#rl-list .lcard'),function(c){return !!c.querySelector('img.lc-img')})"), 'her haber kartında fotoğraf var');
  const n = news[0];
  await b.ev(`document.querySelector('#rl-list [data-rl=${JSON.stringify(n.id)}]').click()`);
  await b.waitFor("!!document.querySelector('.libbar')&&!!document.querySelector('.libx')", 10000);
  const r = await b.ev("(function(){var f=document.querySelector('.libfig'),x=document.querySelector('.libx');return {img:f.querySelector('img').getAttribute('src'),cap:f.querySelector('figcaption').innerText,link:(f.querySelector('a')||{}).href||'',heads:[].map.call(x.querySelectorAll('h2'),function(h){return h.textContent}),qs:x.querySelectorAll('.lx-q').length,voc:x.querySelectorAll('[data-vw]').length,src:[].map.call(x.querySelectorAll('.lx-src a'),function(a){return a.href})}})()");
  assert.equal(r.img, './content/articles/' + n.image.src);
  assert.ok(r.cap.startsWith('Fotoğraf: ') && r.cap.includes(n.image.credit) && r.cap.includes(n.image.license), r.cap);
  assert.equal(r.link, n.image.source);
  assert.deepEqual(r.heads, ['Önemli kelimeler', 'Anlama soruları', 'Kaynaklar']);
  assert.equal(r.voc, n.vocab.length);
  assert.ok(r.qs >= 1);
  assert.deepEqual(r.src, n.sources.map(s => s.url));
  await b.ev("document.querySelector('.libx [data-vw]').click()");
  await b.waitFor("!document.getElementById('sheet').classList.contains('hide')");
  await b.ev("document.getElementById('sheet').classList.add('hide')");
  assert.deepEqual(b.errors, []);
});
