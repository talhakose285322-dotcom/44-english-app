// Error reports: unexpected errors are sent to the error_reports table without personal data (quoted text removed,
// file names only), at most 5 per session and not twice; the setting turns them off; "Sorun bildir" sends the user's
// own message. Supabase is answered by a fixed route here; nothing leaves the test machine.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {startServer, openBrowser, sleep} from './lib/browser.mjs';
import {K, KS} from './lib/app.mjs';

const sent = [];
let status = 201;
const routes = [{match: u => /supabase\.co\/rest\/v1\/error_reports/.test(u), respond: () => ({status, body: ''})}];
let srv, b;
before(async () => {
  srv = await startServer();
  b = await openBrowser({origin: srv.url.slice(0, -1), fakes: ['supabase', 'tts'], routes});
  // the request bodies, as the page sends them
  await b.send('Page.addScriptToEvaluateOnNewDocument', {source: `(function(){var f=window.fetch;window.__rep=[];window.fetch=function(u,o){if(/error_reports/.test(String(u)))window.__rep.push({u:String(u),h:o&&o.headers,b:JSON.parse(o.body)});return f.apply(this,arguments)}})()`});
  await b.goto(srv.url);
});
after(async () => { await b?.close(); srv?.stop(); });

const reports = () => b.ev('window.__rep');
const throwLater = msg => b.ev(`setTimeout(function(){throw new Error(${JSON.stringify(msg)})},0)`);

test('beklenmeyen hata: kişisel metin olmadan, dosya adlarıyla gönderiliyor; aynı hata iki kez gitmiyor; en fazla 5', async () => {
  await b.seed({[K]: [{id: 'w1', w: 'apple', m: 'elma', box: 0}]});
  await b.ev("document.getElementById('n-list').click()");
  await throwLater('Unexpected token "my secret note about rivers" in JSON');
  await b.waitFor('window.__rep.length===1');
  const [r] = await reports();
  assert.match(r.u, /^https:\/\/[a-z]+\.supabase\.co\/rest\/v1\/error_reports$/);
  assert.equal(r.h.Prefer, 'return=minimal');
  assert.match(r.h.apikey, /^sb_publishable_/, 'yalnızca herkese açık anahtar');
  assert.deepEqual([r.b.kind, r.b.screen, r.b.version], ['error', 'list', '1.3.0']);
  assert.doesNotMatch(JSON.stringify(r.b), /secret note|rivers|apple|elma/, 'kullanıcı içeriği yok');
  assert.match(r.b.message, /Unexpected token "…" in JSON/);
  assert.doesNotMatch(r.b.detail, /127\.0\.0\.1|https?:/, 'adres yok, yalnızca dosya ve satır');
  // the same error is not sent again; distinct errors up to 5 per session
  await throwLater('Unexpected token "my secret note about rivers" in JSON');
  for (let i = 1; i <= 6; i++) await throwLater('Failure number ' + i);
  await sleep(500);
  assert.equal((await reports()).length, 5);
});

test('yakalanmamış promise hatası da gidiyor; ayar kapalıyken hiçbir şey gönderilmiyor', async () => {
  await b.goto(srv.url);
  await b.ev("setTimeout(function(){Promise.reject(new Error('Load failed for the dictionary'))},0)");
  await b.waitFor("window.__rep.some(function(r){return /Load failed for the dictionary/.test(r.b.message)})");
  // turn the reports off in Ayarlar
  await b.ev("document.getElementById('n-prof').click();document.querySelector('#ptabs [data-pt=\"set\"]').click()");
  assert.equal(await b.ev("document.getElementById('s-err').checked"), true, 'varsayılan açık');
  await b.ev("var c=document.getElementById('s-err');c.checked=false;c.dispatchEvent(new Event('change'))");
  assert.equal(JSON.parse((await b.storage())[KS]).noerr, true);
  await b.goto(srv.url);
  await throwLater('Should not be sent at all');
  await sleep(500);
  assert.deepEqual(await reports(), []);
  await b.ev("document.getElementById('n-prof').click();document.querySelector('#ptabs [data-pt=\"set\"]').click()");
  await b.ev("var c=document.getElementById('s-err');c.checked=true;c.dispatchEvent(new Event('change'))");
  assert.equal(JSON.parse((await b.storage())[KS]).noerr, undefined);
});

test('“Sorun bildir”: kullanıcının mesajı gidiyor; başarı ve hata durumunda açık mesaj', async () => {
  await b.goto(srv.url);
  await b.ev("document.getElementById('n-prof').click()");
  await b.waitFor("!!document.getElementById('fb-s')");
  await b.ev("document.getElementById('fb-t').value='ok';document.getElementById('fb-s').click()");
  assert.match(await b.ev("document.getElementById('fb-m').textContent"), /Birkaç kelimeyle/);
  await b.ev("document.getElementById('fb-t').value='The PDF of my book did not open on the phone.';document.getElementById('fb-s').click()");
  await b.waitFor("/Teşekkürler, iletildi/.test(document.getElementById('fb-m').textContent)");
  const r = (await reports()).find(x => x.b.kind === 'report');
  assert.deepEqual([r.b.message, r.b.screen, r.b.version], ['The PDF of my book did not open on the phone.', 'prof', '1.3.0']);
  assert.equal(await b.ev("document.getElementById('fb-t').value"), '');
  status = 404; // e.g. the table is not set up yet
  await b.ev("document.getElementById('fb-t').value='Second message for the team.';document.getElementById('fb-s').click()");
  await b.waitFor("/Gönderilemedi/.test(document.getElementById('fb-m').textContent)");
  status = 201;
  assert.equal(await b.ev("document.getElementById('fb-t').value"), 'Second message for the team.', 'mesaj kaybolmadı');
});
