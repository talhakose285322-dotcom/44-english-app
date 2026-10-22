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
  for (const item of ['index.html', 'manifest.json', 'sw.js', 'icon.svg', 'icons/icon-192.png', 'vendor/pdfjs/pdf.min.mjs', 'vendor/pdfjs/pdf.worker.min.mjs']) {
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
});

test('backup build uses its own canonical host without changing the primary source files', () => {
  const base = 'https://talhakose285322-dotcom.github.io/44-english-app';
  for (const item of ['welcome.html', 'terms.html', 'privacy.html', 'sitemap.xml', 'robots.txt']) {
    const file = path.join(out, item);
    if (!fs.existsSync(file)) continue;
    const body = fs.readFileSync(file, 'utf8');
    assert.ok(!body.includes('https://44-english-app.pages.dev'), item + ' must not advertise the primary host on GitHub Pages');
    if (item === 'sitemap.xml') assert.ok(body.includes(base), 'backup sitemap must point to the backup host');
  }
});
