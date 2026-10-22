import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');

test('Cloudflare production build includes app runtime and excludes repo-only files', () => {
  const run = spawnSync(process.execPath, ['scripts/build-static.mjs'], {cwd: root, encoding: 'utf8'});
  assert.equal(run.status, 0, run.stderr || run.stdout);
  for (const item of ['index.html', 'manifest.json', 'sw.js', 'icon.svg', 'icons/icon-192.png', 'vendor/pdfjs/pdf.min.mjs', 'vendor/pdfjs/pdf.worker.min.mjs']) {
    assert.ok(fs.existsSync(path.join(out, item)), `missing production asset: ${item}`);
  }
  for (const item of ['tests', 'index.backup.html', 'index (1).html', 'CLOUDFLARE-DEPLOY.md']) {
    assert.equal(fs.existsSync(path.join(out, item)), false, `repository-only file leaked into production: ${item}`);
  }
});
