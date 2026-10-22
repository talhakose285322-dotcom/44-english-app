import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
const required = ['index.html', 'manifest.json', 'sw.js', 'icon.svg', 'icons', 'vendor'];
// Public landing page, metadata and legal pages must ship with the application.
const optionalPublic = ['welcome.html', 'privacy.html', 'terms.html', 'robots.txt', 'sitemap.xml', '_headers'];

for (const item of required) {
  if (!fs.existsSync(path.join(root, item))) {
    throw new Error(`Required production asset is missing: ${item}`);
  }
}

fs.rmSync(out, {recursive: true, force: true});
fs.mkdirSync(out, {recursive: true});
for (const item of [...required, ...optionalPublic]) {
  if (fs.existsSync(path.join(root, item))) {
    fs.cpSync(path.join(root, item), path.join(out, item), {recursive: true});
  }
}

// Give the GitHub Pages backup its own canonical URLs and sitemap entries.
// Source files keep Cloudflare as the primary production host; this rewrite is build-output-only.
const backupBase = 'https://talhakose285322-dotcom.github.io/44-english-app';
for (const item of ['welcome.html', 'privacy.html', 'terms.html', 'sitemap.xml', 'robots.txt']) {
  const file = path.join(out, item);
  if (fs.existsSync(file)) {
    const original = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, original.replaceAll('https://44-english-app.pages.dev', backupBase));
  }
}

// Also publish an extensionless-friendly /welcome/ route for hosts that don't map /welcome to welcome.html.
const landingPage = path.join(out, 'welcome.html');
if (fs.existsSync(landingPage)) {
  const welcomeDir = path.join(out, 'welcome');
  fs.mkdirSync(welcomeDir, {recursive: true});
  const welcomeHtml = fs.readFileSync(landingPage, 'utf8')
    .replace(/(["'])\.\/index\.html\1/g, '$1../index.html$1')
    .replace(/(["'])\.\/welcome\.html\1/g, '$1../welcome.html$1')
    .replace(/(["'])\.\/privacy\.html\1/g, '$1../privacy.html$1')
    .replace(/(["'])\.\/terms\.html\1/g, '$1../terms.html$1');
  fs.writeFileSync(path.join(welcomeDir, 'index.html'), welcomeHtml);
}

const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
for (const asset of ['manifest.json', 'sw.js', 'icons/apple-touch-icon.png', 'vendor/pdfjs/pdf.min.mjs', 'vendor/pdfjs/pdf.worker.min.mjs']) {
  if (!html.includes(asset) && asset !== 'sw.js') {
    // The service worker may reference assets that are not named directly in HTML.
    const sw = fs.readFileSync(path.join(out, 'sw.js'), 'utf8');
    if (!sw.includes(asset)) throw new Error(`Production asset is not referenced by app or service worker: ${asset}`);
  }
}
// Prevent a successful-looking deployment if the generated entry point is stale or empty.
if (Buffer.byteLength(html, 'utf8') < 50_000) {
  throw new Error('Production index.html is unexpectedly small; refusing deployment.');
}
for (const item of required) {
  if (!fs.existsSync(path.join(out, item))) {
    throw new Error(`Production output is missing: ${item}`);
  }
}
if (fs.existsSync(path.join(root, 'welcome.html')) && !fs.existsSync(path.join(out, 'welcome.html'))) {
  throw new Error('Public landing page is missing from production output.');
}
for (const privateName of ['index.backup.html', 'index (1).html', '.git']) {
  if (fs.existsSync(path.join(out, privateName))) {
    throw new Error(`Non-production file leaked into build: ${privateName}`);
  }
}
// Expose the exact packaged release to support lightweight update diagnostics.
const release = html.match(/Words 44 · Sürüm (\d+\.\d+\.\d+)/);
if (!release) throw new Error('Profile release version is missing');
fs.writeFileSync(path.join(out, 'version.json'), JSON.stringify({
  version: release[1],
  builtAt: new Date().toISOString()
}, null, 2) + '\n');
console.log('Words 44 static build ready: dist/');
