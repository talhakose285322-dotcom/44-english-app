// Big article texts: when localStorage gets full they move to IndexedDB ('44-metin') and localStorage keeps a stub;
// at launch the texts come back, backups (safety copies) always carry the full text, a full-storage save still works,
// and a text that cannot be found again is reported without deleting anything.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {startServer, openBrowser} from './lib/browser.mjs';
import {KA} from './lib/app.mjs';

const big = n => Array.from({length: n}, (_, i) => `Sentence number ${i} talks about rivers and long journeys.`).join(' ');
const BIG = big(700);          // ~38 000 characters
const SMALL = 'A short note that stays where it always was in local storage.';
const ARTS = [{id: 'big1', title: 'Long book', text: BIG, pos: 0.3, note: 'my note'}, {id: 'sm1', title: 'Small one', text: SMALL}];
const idbText = id => `new Promise(function(r){var q=indexedDB.open('44-metin',1);q.onupgradeneeded=function(){q.result.createObjectStore('m',{keyPath:'id'})};q.onsuccess=function(){var g=q.result.transaction('m').objectStore('m').get(${JSON.stringify(id)});g.onsuccess=function(){r(g.result?g.result.text.length:-1)}};q.onerror=function(){r(-2)}})`;

let srv;
before(async () => { srv = await startServer(); });
after(() => srv?.stop());

async function browser(init) {
  const b = await openBrowser({origin: srv.url.slice(0, -1), fakes: ['supabase', 'tts']});
  if (init) await b.send('Page.addScriptToEvaluateOnNewDocument', {source: init});
  return b;
}
const stored = async b => JSON.parse((await b.storage())[KA]);
const openArt = async (b, id) => {
  await b.ev("document.getElementById('n-read').click();document.querySelector('#rtabs [data-rt=\"mine\"]').click()");
  await b.ev(`document.querySelector('#lib-list [data-o=${JSON.stringify(id)}]').click()`);
  await b.waitFor("document.body.classList.contains('reading')");
};

test('büyük metin sınırı aşınca IndexedDB’ye taşınıyor; kayıt, ilerleme ve not yerinde; yeniden açılınca metin geri geliyor; güvenlik kopyası tam metinli', async () => {
  const b = await browser('window.__44spillAt=20000');
  try {
    await b.goto(srv.url);
    await b.seed({[KA]: ARTS});
    await b.goto(srv.url);
    await openArt(b, 'sm1'); // any article save (readAt) runs saveA, which moves big texts out
    await b.waitFor(`(function(){var a=JSON.parse(localStorage.getItem('${KA}'));return a[0].xt>0})()`, 10000);
    const a = await stored(b);
    assert.deepEqual([a[0].text, a[0].xt, a[0].title, a[0].pos, a[0].note], ['', BIG.length, 'Long book', 0.3, 'my note'], 'yerel kayıtta yalnızca metin boşaldı');
    assert.equal(a[1].text, SMALL, 'küçük makale yerinde');
    assert.equal(await b.ev(idbText('big1')), BIG.length, 'metin IndexedDB’de');
    // relaunch: the text is read back and the article opens normally
    await b.goto(srv.url);
    await openArt(b, 'big1');
    await b.waitFor("/Sentence number 699/.test(document.getElementById('art').textContent)", 10000);
    assert.notEqual(await b.ev("document.getElementById('edt').style.display"), 'none', 'düzenlenebilir');
    // the daily safety copy taken at launch carries the full text, not the stub
    const snaps = await b.snapshots();
    assert.ok(snaps.length >= 1);
    const last = JSON.parse(snaps.sort((x, y) => y.t - x.t)[0].data);
    const inCopy = last.keys[KA].find(x => x.id === 'big1');
    assert.equal(inCopy.text.length, BIG.length);
    assert.equal(inCopy.xt, undefined, 'yedekte yer tutucu yok');
    assert.deepEqual(b.errors, []);
  } finally { await b.close(); }
});

test('depolama doluyken (kota hatası) yeni büyük makale yine kaydediliyor', async () => {
  // localStorage refuses article data over 60 000 characters, as a full browser would
  const b = await browser(`(function(){var o=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='${KA}'&&String(v).length>60000){var e=new Error('full');e.name='QuotaExceededError';throw e}return o.apply(this,arguments)}})()`);
  try {
    await b.goto(srv.url);
    await b.seed({[KA]: [ARTS[1]]});
    await b.goto(srv.url);
    await b.ev("document.getElementById('n-read').click();document.querySelector('#rtabs [data-rt=\"own\"]').click()");
    const huge = big(1800); // ~98 000 characters
    await b.ev(`document.getElementById('a-t').value='Huge paste';document.getElementById('a-x').value=${JSON.stringify(huge)};document.getElementById('a-s').click()`);
    await b.waitFor("document.body.classList.contains('reading')", 10000);
    const a = await stored(b);
    const h = a.find(x => x.title === 'Huge paste');
    assert.ok(h && h.text === '' && h.xt === huge.length, 'yer tutucu kaydedildi');
    assert.equal(await b.ev(idbText(h.id)), huge.length, 'metin IndexedDB’de');
    assert.match(await b.ev("document.getElementById('art').textContent"), /Sentence number 1799/);
    assert.ok(a.some(x => x.id === 'sm1'), 'eski makale yerinde');
    assert.deepEqual(b.errors, []);
  } finally { await b.close(); }
});

test('metni bulunamayan makale silinmiyor: açık bir uyarı çıkıyor, düzenleme kapalı, yer tutucu korunuyor', async () => {
  const b = await browser();
  try {
    await b.goto(srv.url);
    await b.seed({[KA]: [{id: 'gone', title: 'Lost text', text: '', xt: 50000, note: 'keep me'}, ARTS[1]]});
    await b.goto(srv.url);
    await openArt(b, 'gone');
    await b.waitFor("/bulunamadı/.test(document.getElementById('art').textContent)", 10000);
    assert.equal(await b.ev("document.getElementById('edt').style.display"), 'none');
    await b.ev("document.getElementById('back').click()");
    assert.match(await b.ev("document.querySelector('#lib-list [data-o=\"gone\"]').textContent"), /metin bulunamadı/);
    assert.equal(await b.ev("!!document.querySelector('#lib-list [data-e=\"gone\"],#lib-list [data-p=\"gone\"]')"), false, 'listede düzenle/paylaş yok');
    assert.equal(await b.ev("!!document.querySelector('#lib-list [data-d=\"gone\"]')"), true, 'silmek mümkün');
    await b.ev("document.querySelector('#lib-list [data-o=\"gone\"]').click()");
    // a later save of the articles keeps the stub as it was
    await b.ev("document.getElementById('back').click()");
    await openArt(b, 'sm1');
    await b.waitFor(`JSON.parse(localStorage.getItem('${KA}'))[1].readAt>0`, 5000);
    const g = (await stored(b)).find(x => x.id === 'gone');
    assert.deepEqual([g.text, g.xt, g.note, g.lost], ['', 50000, 'keep me', undefined]);
    assert.deepEqual(b.errors, []);
  } finally { await b.close(); }
});
