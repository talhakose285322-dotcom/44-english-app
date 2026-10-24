// "Install the app" option: Profile panel using the browser's install dialog (Chrome/Edge), manual steps on iPhone,
// and the landing page link (?yukle=1) that opens the panel without leaving the flag in the installed app's address.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startServer, openBrowser, ROOT} from './lib/browser.mjs';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
let srv;
before(async () => { srv = await startServer(); });
after(() => srv?.stop());

const panel = b => b.ev("(function(p){return p?{shown:!p.classList.contains('hide'),text:p.innerText,btn:!!document.getElementById('p-inst')}:null})(document.getElementById('p-app'))");

test('Chrome kurulum penceresi Profil’deki düğmeyle açılıyor; kabul edilince bölüm gizleniyor', async () => {
  const b = await openBrowser({origin: srv.url.slice(0, -1), fakes: ['supabase', 'tts']});
  try {
    await b.goto(srv.url);
    // stand-in for Chrome's event: records prompt() and accepts
    await b.ev("(function(){var e=new Event('beforeinstallprompt',{cancelable:true});e.prompt=function(){window.__prompted=(window.__prompted||0)+1};e.userChoice=Promise.resolve({outcome:'accepted'});dispatchEvent(e);return e.defaultPrevented})()");
    await b.ev("document.getElementById('n-prof').click()");
    const p = await panel(b);
    assert.ok(p.shown && p.btn, 'yükle düğmesi görünüyor');
    await b.ev("document.getElementById('p-inst').click()");
    await b.waitFor("window.__prompted===1&&document.getElementById('p-app').classList.contains('hide')");
    assert.deepEqual(b.errors, []);
  } finally { await b.close(); }
});

test('iPhone’da kurulum adımları gösteriliyor; ?yukle=1 Profil’i açıp adresten siliniyor', async () => {
  const b = await openBrowser({origin: srv.url.slice(0, -1), fakes: ['supabase', 'tts']});
  try {
    await b.send('Emulation.setUserAgentOverride', {userAgent: IPHONE, platform: 'iPhone'});
    // Safari has no beforeinstallprompt; keep this Chrome's own event away from the app
    await b.send('Page.addScriptToEvaluateOnNewDocument', {source: "addEventListener('beforeinstallprompt',function(e){e.stopImmediatePropagation()},true)"});
    await b.goto(srv.url + 'index.html?yukle=1');
    await b.waitFor("!document.getElementById('v-prof').classList.contains('hide')");
    assert.equal(await b.ev('location.search'), '', 'ana ekrana eklenen adres ?yukle=1 içermiyor');
    const p = await panel(b);
    assert.ok(p.shown, 'kurulum bölümü görünüyor');
    assert.equal(p.btn, false, 'iPhone’da tarayıcı kurulum penceresi yok');
    assert.match(p.text, /Ana Ekrana Ekle/);
    assert.deepEqual(b.errors, []);
  } finally { await b.close(); }
});

test('karşılama sayfasındaki “Uygulamayı yükle” bağlantısı /welcome/ kopyasında da uygulamaya gidiyor', () => {
  const html = fs.readFileSync(path.join(ROOT, 'welcome.html'), 'utf8');
  assert.ok(html.includes('href="./index.html?yukle=1"'));
  const copy = path.join(ROOT, 'dist', 'welcome', 'index.html');
  if (fs.existsSync(copy)) {
    const w = fs.readFileSync(copy, 'utf8');
    assert.ok(w.includes('href="../index.html?yukle=1"') && !w.includes('"./index.html?'), '/welcome/ kopyası üst klasöre bağlanıyor');
  }
});
