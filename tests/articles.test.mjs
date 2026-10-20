// Articles: saving a pasted text, the reading progress kept while scrolling, and duplicate protection.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {startServer, openBrowser, sleep} from './lib/browser.mjs';
import {K, KA} from './lib/app.mjs';

let srv, b;
before(async () => {
  srv = await startServer();
  b = await openBrowser({origin: srv.url.slice(0, -1), fakes: ['supabase', 'tts']});
  await b.goto(srv.url);
  await b.seed({[K]: [{id: 'a1', w: 'apple', m: 'elma', box: 0}], [KA]: []});
});
after(async () => { await b?.close(); srv?.stop(); });

const TEXT = Array.from({length: 60}, (_, i) => `Paragraph ${i + 1}. The river flows quietly past the old town, and people walk along it every evening.`).join('\n\n');
const arts = async () => JSON.parse((await b.storage())[KA] || '[]');
async function save(title, text) {
  await b.ev("document.getElementById('n-read').click()");
  await b.waitFor("!!document.getElementById('a-s')");
  await b.ev(`document.getElementById('a-t').value=${JSON.stringify(title)};document.getElementById('a-x').value=${JSON.stringify(text)};document.getElementById('a-s').click()`);
}

test('yapıştırılan metin makale olarak kaydediliyor ve okuyucu açılıyor', async () => {
  await save('River story', TEXT);
  await b.waitFor("document.body.classList.contains('reading')");
  const a = await arts();
  assert.equal(a.length, 1);
  assert.equal(a[0].title, 'River story');
  assert.equal(a[0].text, TEXT);
  assert.ok(a[0].id && a[0].h, 'kimlik ve özet');
});

test('kaydırınca okuma ilerlemesi saklanıyor', async () => {
  await b.ev('window.scrollTo(0,(document.documentElement.scrollHeight-innerHeight)/2)');
  await sleep(1700);
  const a = (await arts())[0];
  assert.ok(a.pos > 0.4 && a.pos < 0.6, 'ilerleme ~%50: ' + a.pos);
  assert.ok(a.readAt > 0, 'okuma zamanı');
});

test('aynı metin ikinci kez kaydedilmiyor; mevcut ilerleme değişmiyor', async () => {
  const pos = (await arts())[0].pos;
  await b.ev("document.getElementById('back').click()");
  await save('Kopya', TEXT);
  await b.waitFor("/zaten kayıtlı/.test(document.getElementById('a-m').innerText)");
  const a = await arts();
  assert.equal(a.length, 1);
  assert.equal(a[0].pos, pos);
  assert.deepEqual(b.errors, []);
});
