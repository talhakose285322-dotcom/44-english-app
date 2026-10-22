import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';

const required = ['dist/index.html', 'dist/icon.svg', 'dist/icons', 'dist/manifest.json', 'dist/vendor/pdfjs'];
for (const path of required) assert.ok(existsSync(path), `Missing staged runtime asset: ${path}`);

const html = readFileSync('dist/index.html', 'utf8');
assert.ok(html.includes('!window.Capacitor?.isNativePlatform?.()'), 'Native build must guard PWA service-worker registration');
assert.ok(html.includes('signInWithOAuth'), 'Existing account flow should remain in the staged app');

const manifest = JSON.parse(readFileSync('dist/manifest.json', 'utf8'));
assert.equal(manifest.short_name, 'Words 44', 'Manifest short name must remain Words 44');
assert.equal(manifest.display, 'standalone', 'PWA manifest should preserve standalone display');

assert.ok(statSync('dist/vendor/pdfjs').isDirectory(), 'PDF.js runtime directory must be copied');
console.log('Native staging smoke tests passed. These checks do not validate Android compilation or OAuth on a device.');
