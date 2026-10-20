// Test helpers for Words 44: the local server, a throwaway headless Chrome driven over the DevTools protocol, and
// small utilities. No npm packages: Node's own fetch/WebSocket/child_process only.
// Every browser gets a fresh temporary profile that is deleted afterwards, so the user's Chrome profile and data are
// never touched. Requests to anything but the local server are blocked, so tests run offline and repeatably.
import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {fileURLToPath} from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FAKES = path.join(ROOT, 'tests', 'fakes');
export const sleep = ms => new Promise(r => setTimeout(r, ms));

// Every server/browser process a test file starts. If a test file ends without closing them (for example after a
// failure), they are stopped when that file's process exits, so no child keeps the test run waiting.
const children = new Set();
function track(proc) { children.add(proc); proc.once('exit', () => children.delete(proc)); return proc; }
function killTree(proc) {
  if (proc.exitCode !== null || proc.signalCode !== null) return;
  try {
    // Chrome runs several child processes; end the whole tree of this one process only
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], {stdio: 'ignore'});
    else process.kill(-proc.pid, 'SIGKILL');
  } catch { try { proc.kill('SIGKILL'); } catch {} }
}
process.once('exit', () => { for (const p of children) killTree(p); });

export function readApp() { return fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'); }
// The app's main script (one IIFE) and the service-worker registration script, as plain source text.
export function mainScript(html = readApp()) {
  const m = html.match(/<script>\r?\n\(function\(\)\{[\s\S]*?\n\}\)\(\);\r?\n<\/script>/);
  if (!m) throw new Error('main script not found in index.html');
  return m[0].replace(/^<script>|<\/script>$/g, '');
}
export function swRegScript(html = readApp()) {
  const m = html.match(/<script>if \('serviceWorker'[\s\S]*?<\/script>/);
  if (!m) throw new Error('service worker registration script not found in index.html');
  return m[0].slice(8, -9);
}

function freePort() {
  return new Promise((res, rej) => {
    const s = net.createServer();
    s.once('error', rej);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
  });
}

// yerel-sunucu.cjs on a free port; resolves once it answers.
export async function startServer() {
  const port = await freePort();
  const proc = track(spawn(process.execPath, [path.join(ROOT, 'yerel-sunucu.cjs')], {cwd: ROOT, env: {...process.env, PORT: String(port)}, stdio: 'ignore'}));
  const url = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(url); if (r.ok) return {url, port, stop: () => killTree(proc)}; } catch {}
    await sleep(100);
  }
  killTree(proc);
  throw new Error('local server did not start');
}

function findChrome() {
  const c = [process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  const f = c.find(p => p && fs.existsSync(p));
  if (!f) throw new Error('Chrome/Edge not found; set CHROME_PATH');
  return f;
}

// opts: {origin, fakes: ['supabase', 'tts'], mobile: true, routes}
// routes: [{match: url => bool, respond: url => ({status, body, type})}] answer matching outside requests with fixed
// data (served with CORS allowed); every other outside request is still blocked.
export async function openBrowser(opts = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'words44-test-'));
  // CI runners (Ubuntu) often cannot start Chrome's sandbox; only there, and only for these throwaway test browsers
  const ci = process.env.CI ? ['--no-sandbox'] : [];
  // own process group on Linux/macOS, so the whole browser can be ended at once (Windows uses taskkill /T)
  const proc = track(spawn(findChrome(), ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + dir, ...ci,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--disable-extensions', '--disable-crash-reporter', 'about:blank'],
    {stdio: 'ignore', detached: process.platform !== 'win32'}));
  const exited = new Promise(r => proc.once('exit', r));
  let port = 0;
  for (let i = 0; i < 100 && !port; i++) {
    try { port = +fs.readFileSync(path.join(dir, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch {}
    if (!port) await sleep(100);
  }
  if (!port) { killTree(proc); throw new Error('Chrome did not start'); }
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'); } catch {}
    if (!target) await sleep(100);
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0;
  const pending = {}, listeners = [];
  const b = {errors: [], blocked: [], dialogs: [], served: []};
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; return; }
    listeners.forEach(f => f(m));
  };
  b.send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id; pending[i] = m => m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result);
    ws.send(JSON.stringify({id: i, method, params}));
  });
  b.on = f => listeners.push(f);
  // Evaluate an expression in the page; promises are awaited; a page exception rejects.
  b.ev = async expr => {
    const r = await b.send('Runtime.evaluate', {expression: expr, awaitPromise: true, returnByValue: true});
    if (r.exceptionDetails) throw new Error('page: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  };
  b.waitFor = async (expr, ms = 5000) => {
    const t = Date.now() + ms;
    while (Date.now() < t) { try { if (await b.ev(expr)) return true; } catch {} await sleep(50); }
    throw new Error('timed out waiting for: ' + expr);
  };
  b.on(m => {
    if (m.method === 'Runtime.exceptionThrown') b.errors.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).split('\n')[0]);
    if (m.method === 'Page.javascriptDialogOpening') { b.dialogs.push(m.params.message); b.send('Page.handleJavaScriptDialog', {accept: false}).catch(() => {}); }
    if (m.method === 'Fetch.requestPaused') {
      const u = m.params.request.url, route = (opts.routes || []).find(r => r.match(u));
      if (route) {
        const r = route.respond(u), body = typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
        b.served.push(u);
        b.send('Fetch.fulfillRequest', {requestId: m.params.requestId, responseCode: r.status || 200,
          responseHeaders: [{name: 'Content-Type', value: r.type || 'application/json; charset=utf-8'}, {name: 'Access-Control-Allow-Origin', value: '*'}],
          body: Buffer.from(body, 'utf8').toString('base64')}).catch(() => {});
      }
      else if (opts.origin && u.startsWith(opts.origin) || u.startsWith('data:') || u.startsWith('blob:')) b.send('Fetch.continueRequest', {requestId: m.params.requestId}).catch(() => {});
      else { b.blocked.push(u); b.send('Fetch.failRequest', {requestId: m.params.requestId, errorReason: 'BlockedByClient'}).catch(() => {}); }
    }
  });
  await b.send('Runtime.enable');
  await b.send('Page.enable');
  await b.send('Fetch.enable', {patterns: [{urlPattern: '*'}]});
  if (opts.mobile !== false) await b.send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 2, mobile: true});
  for (const f of opts.fakes || []) await b.send('Page.addScriptToEvaluateOnNewDocument', {source: fs.readFileSync(path.join(FAKES, f + '.js'), 'utf8')});

  b.goto = async url => { await b.send('Page.navigate', {url}); await b.waitFor("document.readyState==='complete'", 10000); await sleep(300); };
  b.reload = async () => { await b.send('Page.reload'); await sleep(200); await b.waitFor("document.readyState==='complete'", 10000); await sleep(300); };
  // Replace the app's storage for this origin with test data, then reload so the app reads it.
  b.seed = async (keys) => {
    await b.ev(`(function(){localStorage.clear();var k=${JSON.stringify(keys)};Object.keys(k).forEach(function(n){localStorage.setItem(n,typeof k[n]==='string'?k[n]:JSON.stringify(k[n]))})})()`);
    await b.reload();
  };
  // Put local files into an <input type=file> and fire its change event (as if the user picked them).
  b.setFiles = async (selector, files) => {
    const {root} = await b.send('DOM.getDocument', {depth: 0});
    const {nodeId} = await b.send('DOM.querySelector', {nodeId: root.nodeId, selector});
    if (!nodeId) throw new Error('no element: ' + selector);
    await b.send('DOM.setFileInputFiles', {nodeId, files: files.map(f => path.resolve(f))});
  };
  b.storage = () => b.ev("(function(){var o={};for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);o[k]=localStorage.getItem(k)}return o})()");
  b.snapshots = () => b.ev("new Promise(function(r){var q=indexedDB.open('44-guvenlik',1);q.onsuccess=function(){try{var t=q.result.transaction('snaps','readonly').objectStore('snaps').getAll();t.onsuccess=function(){r(t.result||[])}}catch(e){r([])}};q.onerror=function(){r([])}})");
  // Closing never throws: the test results stay what they are. Order: ask Chrome to quit (it then ends its child
  // processes and releases the profile), wait for it, end the process tree if it does not quit, then delete the
  // temporary profile. If that still fails, a clear warning is printed and b.cleanupError is set.
  let closed = false;
  b.close = async () => {
    if (closed) return; closed = true;
    try {
      const v = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
      const bws = new WebSocket(v.webSocketDebuggerUrl);
      await new Promise((res, rej) => { bws.onopen = res; bws.onerror = rej; setTimeout(rej, 2000); });
      bws.send(JSON.stringify({id: 1, method: 'Browser.close'}));
    } catch {}
    try { ws.close(); } catch {}
    const quit = await Promise.race([exited.then(() => true), sleep(5000).then(() => false)]);
    if (!quit) { killTree(proc); await Promise.race([exited, sleep(3000)]); }
    // only ever the temporary profile created above, never a user's Chrome profile
    if (!(dir.startsWith(os.tmpdir()) && path.basename(dir).startsWith('words44-test-'))) return;
    try { fs.rmSync(dir, {recursive: true, force: true, maxRetries: 25, retryDelay: 200}); }
    catch (e) {
      b.cleanupError = e;
      console.warn(`[words44-test] UYARI: geçici Chrome profili silinemedi (${e.code || e.message}): ${dir}`);
    }
  };
  return b;
}
