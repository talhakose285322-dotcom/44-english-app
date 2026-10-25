// Read aloud in the reader: the article is read sentence by sentence with the chosen speed, the sentence being read is
// highlighted, pause/next/previous work, and reading stops when the reader is left. Nothing about words is changed.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {startServer, openBrowser} from './lib/browser.mjs';
import {K, KA, KS} from './lib/app.mjs';

const TEXT = 'The river was quiet. Birds sang in the trees.\n\nA boat came slowly. Everyone waved at it.';
let srv, b;
before(async () => {
  srv = await startServer();
  b = await openBrowser({origin: srv.url.slice(0, -1), fakes: ['supabase', 'tts']});
  await b.goto(srv.url);
  await b.seed({[KA]: [{id: 'r1', title: 'River', text: TEXT, pos: 0}]});
  await b.goto(srv.url);
});
after(async () => { await b?.close(); srv?.stop(); });

const spoken = () => b.ev('window.__tts.spoken.map(function(x){return x.text})');
const cur = () => b.ev("((document.querySelector('#art .s.ra')||{}).textContent||'').trim()");
const click = sel => b.ev(`document.querySelector(${JSON.stringify(sel)}).click()`);

test('sesli okuma cümle cümle ilerliyor, vurguluyor; duraklat, ileri/geri, hız ve çıkış çalışıyor', async () => {
  const words = (await b.storage())[K];
  await b.ev("document.getElementById('n-read').click();document.querySelector('#rtabs [data-rt=\"mine\"]').click()");
  await click('#lib-list [data-o="r1"]');
  await b.waitFor("document.body.classList.contains('reading')");
  await click('#r-ra');
  await b.waitFor("!!document.getElementById('rabar')");
  assert.deepEqual(await spoken(), ['The river was quiet.']);
  assert.equal(await cur(), 'The river was quiet.');
  assert.match(await b.ev("document.querySelector('#rabar .ra-pos').textContent"), /1 \/ 4/);
  // a sentence finishing moves on to the next, across paragraphs
  await b.ev('window.__tts.end()');
  await b.ev('window.__tts.end()');
  assert.equal(await cur(), 'A boat came slowly.');
  assert.deepEqual(await spoken(), ['The river was quiet.', 'Birds sang in the trees.', 'A boat came slowly.']);
  // pause: nothing more is spoken, and play resumes from the same sentence
  await click('#rabar [data-ra="play"]');
  assert.equal(await b.ev("document.querySelector('#rabar [data-ra=\"play\"]').getAttribute('aria-label')"), 'Oynat');
  await b.ev('window.__tts.end()');
  assert.equal((await spoken()).length, 3);
  await click('#rabar [data-ra="prev"]');
  assert.equal(await cur(), 'Birds sang in the trees.');
  assert.equal((await spoken()).length, 3, 'duraklatılmışken geri gitmek okumuyor');
  // speed is remembered and used
  await click('#rabar [data-rr="0.6"]');
  assert.equal(JSON.parse((await b.storage())[KS]).rarate, 0.6);
  await click('#rabar [data-ra="play"]');
  const last = await b.ev('window.__tts.spoken[window.__tts.spoken.length-1]');
  assert.deepEqual([last.text, last.rate], ['Birds sang in the trees.', 0.6]);
  await click('#rabar [data-ra="next"]');
  assert.equal(await cur(), 'A boat came slowly.');
  await b.ev('window.__tts.end()');
  await b.ev('window.__tts.end()');
  // the end of the article: it stops on the last sentence
  assert.equal(await cur(), 'Everyone waved at it.');
  assert.equal(await b.ev("document.querySelector('#rabar [data-ra=\"play\"]').getAttribute('aria-label')"), 'Oynat');
  assert.equal(await b.ev("document.querySelector('#rabar [data-ra=\"next\"]').disabled"), true);
  // leaving the reader stops reading and removes the player
  await click('#rabar [data-ra="play"]');
  const n = (await spoken()).length;
  await click('#back');
  assert.equal(await b.ev("!!document.getElementById('rabar')"), false);
  await b.ev('window.__tts.end()');
  assert.equal((await spoken()).length, n, 'çıktıktan sonra okuma sürmüyor');
  assert.equal((await b.storage())[K], words, 'kelimeler değişmedi');
  assert.deepEqual(b.errors, []);
});
