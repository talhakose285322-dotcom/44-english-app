// A library that has grown for months (a stand-in catalog): 12 cards at a time with "Daha fazla göster", news older
// than 30 days kept in "Haber arşivi" but still found by search and under "Haberler", no old news as article of the day.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {startServer, openBrowser} from './lib/browser.mjs';

const day = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const art = (id, category, published, title) => ({id, category, title, summary: 'Özet ' + id, license: 'Özgün', published, paragraphs: 3,
  levels: {B1: {words: 150, minutes: 1}}});
const RECENT = Array.from({length: 25}, (_, i) => art('recent-' + i, i % 2 ? 'news' : 'science', day(i % 20), 'Recent ' + i));
const OLD = [art('old-news-a', 'news', day(45), 'Old harvest report'), art('old-news-b', 'news', day(60), 'Old storm'), art('old-news-c', 'news', day(90), 'Old election')];
const CATALOG = {format: 'words44-articles', version: 1, updated: day(0), levels: ['B1'], categories: {news: 'Haberler', science: 'Bilim'},
  articles: [...RECENT, ...OLD].sort((a, b) => b.published.localeCompare(a.published))};

let srv, b;
before(async () => {
  srv = await startServer();
  b = await openBrowser({origin: srv.url.slice(0, -1), fakes: ['supabase', 'tts'],
    routes: [{match: u => u.includes('/content/articles/catalog.json'), respond: () => ({body: CATALOG})}]});
  await b.send('Network.enable');
  await b.send('Network.setBypassServiceWorker', {bypass: true});
  await b.goto(srv.url);
  await b.ev("document.getElementById('n-read').click()");
  await b.waitFor("document.querySelectorAll('#rl-list [data-rl]').length>0", 10000);
});
after(async () => { await b?.close(); srv?.stop(); });

const ids = () => b.ev("[].map.call(document.querySelectorAll('#rl-list [data-rl]'),function(t){return t.getAttribute('data-rl')})");
const setSel = (id, v) => b.ev(`(function(s){s.value=${JSON.stringify(v)};s.dispatchEvent(new Event('change'))})(document.getElementById('${id}'))`);

test('liste 12’şer gösteriliyor; “Daha fazla göster” kalanları açıyor; eski haberler ana listede yok', async () => {
  let shown = await ids();
  assert.equal(shown.length, 12);
  assert.match(await b.ev("document.getElementById('rl-mb').textContent"), /Daha fazla göster \(13\)/);
  await b.ev("document.getElementById('rl-mb').click()");
  assert.equal((await ids()).length, 24);
  await b.ev("document.getElementById('rl-mb').click()");
  shown = await ids();
  assert.equal(shown.length, 25, 'tüm güncel makaleler');
  assert.equal(await b.ev("!!document.getElementById('rl-mb')"), false, 'hepsi açılınca düğme yok');
  assert.ok(!shown.some(id => id.startsWith('old-')), 'eski haberler ana listede değil');
  assert.ok(!/^old-/.test(await b.ev("(document.querySelector('#rl-feat [data-rl]')||{getAttribute:function(){return ''}}).getAttribute('data-rl')")), 'günün makalesi eski haber değil');
  assert.deepEqual(b.errors, []);
});

test('“Haber arşivi” eski haberleri, “Haberler” bütün haberleri gösteriyor; arama arşivi de tarıyor; filtre değişince sayfa başa dönüyor', async () => {
  await setSel('rl-c', 'archive');
  assert.deepEqual(await ids(), ['old-news-a', 'old-news-b', 'old-news-c']);
  await setSel('rl-c', 'news');
  const news = await ids();
  assert.equal(news.length, 12, 'ilk sayfa');
  assert.match(await b.ev("document.getElementById('rl-mb').textContent"), /\(3\)/, '12 güncel + 3 eski haber = 15');
  await setSel('rl-c', '');
  assert.equal((await ids()).length, 12, 'filtre değişince yine 12 kart');
  await b.ev("(function(q){q.value='harvest';q.dispatchEvent(new Event('input'))})(document.getElementById('rl-q'))");
  assert.deepEqual(await ids(), ['old-news-a'], 'arama arşivi de buluyor');
  assert.deepEqual(b.errors, []);
});
