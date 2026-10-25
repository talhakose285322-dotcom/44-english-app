import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
const relativeAsset = value => value.split('?')[0].startsWith('./') ? value.split('?')[0].slice(2) : value.split('?')[0];

test('Cloudflare production build includes app runtime and excludes repo-only files', () => {
  const run = spawnSync(process.execPath, ['scripts/build-static.mjs'], {cwd: root, encoding: 'utf8'});
  assert.equal(run.status, 0, run.stderr || run.stdout);
  for (const item of ['index.html', 'manifest.json', 'sw.js', 'icon.svg', 'icons/icon-192.png', 'vendor/pdfjs/pdf.min.mjs', 'vendor/pdfjs/pdf.worker.min.mjs', 'content/articles/catalog.json']) {
    assert.ok(fs.existsSync(path.join(out, item)), 'missing production asset: ' + item);
  }
  for (const item of ['tests', 'index.backup.html', 'index (1).html', 'CLOUDFLARE-DEPLOY.md']) {
    assert.equal(fs.existsSync(path.join(out, item)), false, 'repository-only file leaked into production: ' + item);
  }
});

test('production manifest icons and service-worker precache files all exist in dist', () => {
  const manifestText = fs.readFileSync(path.join(out, 'manifest.json'), 'utf8').replace(String.fromCharCode(65279), '');
  const manifest = JSON.parse(manifestText);
  for (const icon of manifest.icons || []) {
    assert.ok(fs.existsSync(path.join(out, relativeAsset(icon.src))), 'manifest icon is missing from production build: ' + icon.src);
  }

  const sw = fs.readFileSync(path.join(out, 'sw.js'), 'utf8');
  const start = sw.indexOf('const FILES = [');
  const end = sw.indexOf('];', start);
  assert.ok(start >= 0 && end > start, 'service-worker FILES precache list must be discoverable');
  const assets = [...sw.slice(start, end).matchAll(/["']([^"']+)["']/g)].map(m => m[1]);
  for (const item of assets) {
    assert.ok(fs.existsSync(path.join(out, relativeAsset(item))), 'service-worker precache asset is missing from production build: ' + item);
  }
});

test('production release marker matches the version shown inside the app', () => {
  const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  const match = html.match(/Words 44 · Sürüm (\d+\.\d+\.\d+)/);
  assert.ok(match, 'app must expose a semantic release version');
  const marker = JSON.parse(fs.readFileSync(path.join(out, 'version.json'), 'utf8'));
  assert.equal(marker.version, match[1], 'version.json must match the actual app version');
  const tracked = JSON.parse(fs.readFileSync(path.join(root, 'version.json'), 'utf8'));
  assert.equal(tracked.version, match[1], 'tracked version.json must match the actual app version');
});

test('installed-app update check uses the same version as the release marker (no repeated reloads)', () => {
  // A lagging runningVersion makes every resumed page see a "newer" version.json and reload again after each long
  // absence; it is bumped by hand together with version.json and the profile label, so keep the three in step.
  for (const dir of [root, out]) {
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    const shown = html.match(/Words 44 · Sürüm (\d+\.\d+\.\d+)/);
    const running = html.match(/var runningVersion = '(\d+\.\d+\.\d+)'/);
    const marker = JSON.parse(fs.readFileSync(path.join(dir, 'version.json'), 'utf8').replace(String.fromCharCode(65279), ''));
    assert.ok(shown && running, 'profile version and update-check runningVersion must both exist in ' + dir);
    assert.equal(running[1], shown[1], 'runningVersion must match the version shown in the app (' + dir + ')');
    assert.equal(running[1], marker.version, 'runningVersion must match version.json (' + dir + ')');
  }
});

test('Cloudflare Worker config publishes exactly the production build output', () => {
  // *.pages.dev is blocked on Turkish networks; the Worker (workers.dev) serves dist/ built from main.
  // pages_build_output_dir must stay absent so the existing Pages project keeps ignoring this file.
  const config = JSON.parse(fs.readFileSync(path.join(root, 'wrangler.jsonc'), 'utf8'));
  assert.equal(config.assets && config.assets.directory, './dist');
  assert.equal(config.main, undefined, 'static assets only, no Worker script');
  assert.equal(config.pages_build_output_dir, undefined);
  // pull requests run `wrangler preview`, which refuses to start without a previews block (an empty one is enough)
  assert.deepEqual(config.previews, {}, 'previews block for pull-request preview builds');
  assert.ok(fs.existsSync(path.join(out, '_headers')), 'cache headers must ship with the assets');
});

test('primary build advertises the Worker host; backup build uses its own canonical host', () => {
  const primary = 'https://words44.words44.workers.dev', base = 'https://talhakose285322-dotcom.github.io/44-english-app';
  const pages = ['welcome.html', 'terms.html', 'privacy.html', 'sitemap.xml', 'robots.txt'];
  for (const item of pages) {
    const body = fs.readFileSync(path.join(out, item), 'utf8');
    assert.ok(!body.includes(base) && !body.includes('44-english-app.pages.dev'), item + ' must advertise only the primary host');
    if (item === 'sitemap.xml') assert.ok(body.includes(primary), 'primary sitemap must point to the Worker host');
  }
  const backupOut = 'dist-backup-test';
  try {
    const run = spawnSync(process.execPath, ['scripts/build-static.mjs'], {cwd: root, encoding: 'utf8', env: {...process.env, WORDS44_SITE: 'backup', WORDS44_OUT: backupOut}});
    assert.equal(run.status, 0, run.stderr || run.stdout);
    for (const item of pages) {
      const body = fs.readFileSync(path.join(root, backupOut, item), 'utf8');
      assert.ok(!body.includes(primary), item + ' must not advertise the primary host on GitHub Pages');
      if (item === 'sitemap.xml') assert.ok(body.includes(base), 'backup sitemap must point to the backup host');
    }
  } finally { fs.rmSync(path.join(root, backupOut), {recursive: true, force: true}); }
});

test('landing page offers web access and desktop installer links with truthful requirements', () => {
  const html = fs.readFileSync(path.join(out, 'welcome.html'), 'utf8');
  assert.ok(html.includes('id="bilgisayara-yukle"'), 'desktop installation section must exist');
  assert.ok(html.includes('Bilgisayara yükle'), 'landing page must link to desktop instructions');
  assert.ok(html.includes('Web’de kullan'), 'browser access must remain available');
  assert.ok(html.includes('https://github.com/talhakose285322-dotcom/44-english-app/releases/latest/download/Words44-Setup.exe'), 'Windows installer must link to the latest stable release asset');
  assert.ok(html.includes('https://github.com/talhakose285322-dotcom/44-english-app/releases/latest/download/Words44-macOS.dmg'), 'macOS installer must link to the latest stable release asset');
  assert.ok(html.includes('internet bağlantısı gerektirir'), 'desktop wrapper must disclose its internet requirement');
  assert.ok(html.includes('Apple tarafından imzalanıp noter onayından geçirilmediği'), 'macOS signing status must be disclosed');
});

test('Koruma iş akışı main’deki kopyadan çalışıyor ve PR kodunu indirmiyor', () => {
  // pull_request_target runs with the base branch's file; checking out the pull request there would let it run its code
  const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'guard.yml'), 'utf8');
  assert.match(wf, /^on:\s*\n\s+pull_request_target:/m);
  assert.doesNotMatch(wf, /actions\/checkout|head\.sha/, 'never checks out the pull request');
  const refs = wf.split('\n').filter(l => l.includes('pull_request.head.ref'));
  assert.deepEqual(refs.map(l => l.trim().split(':')[0]), ['HEAD_REF'], 'the branch name reaches the script only through env');
  assert.match(wf, /news\/\*[\s\S]*content\/articles\//, 'news branches limited to content/articles/');
  assert.match(wf, /workflow-onay/, '.github changes need the owner label');
  assert.match(wf, /permissions:\s*\n\s+contents: read\s*\n\s+pull-requests: read/, 'read-only token');
});

test('Haber bildirimi yalnızca birleşen news/ PR’ında çalışıyor, PR kodunu indirmiyor ve sahibini etiketliyor', () => {
  const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'news-notify.yml'), 'utf8');
  assert.match(wf, /^on:\s*\n\s+pull_request_target:\s*\n\s+types: \[closed\]/m);
  assert.match(wf, /if: github\.event\.pull_request\.merged == true && startsWith\(github\.event\.pull_request\.head\.ref, 'news\/'\)/);
  assert.doesNotMatch(wf, /actions\/checkout|head\.sha/, 'never checks out the pull request');
  assert.match(wf, /permissions:\s*\n\s+issues: write\s*\n\s*\n/, 'only issues may be written');
  // pull request text reaches the script only through env, never inside run:
  const run = wf.slice(wf.indexOf('run: |'));
  assert.doesNotMatch(run, /\$\{\{/, 'no expressions inside the script');
  assert.match(run, /'@%s [^']*' "\$OWNER"/, 'the owner is mentioned, so GitHub sends an e-mail');
});
