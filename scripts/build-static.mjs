import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
const required = ['index.html', 'manifest.json', 'sw.js', 'icon.svg', 'icons', 'vendor'];

for (const item of required) {
  if (!fs.existsSync(path.join(root, item))) {
    throw new Error(`Required production asset is missing: ${item}`);
  }
}

fs.rmSync(out, {recursive: true, force: true});
fs.mkdirSync(out, {recursive: true});
for (const item of required) {
  fs.cpSync(path.join(root, item), path.join(out, item), {recursive: true});
}

const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
for (const asset of ['manifest.json', 'sw.js', 'icons/apple-touch-icon.png', 'vendor/pdfjs/pdf.min.mjs', 'vendor/pdfjs/pdf.worker.min.mjs']) {
  if (!html.includes(asset) && asset !== 'sw.js') {
    // The service worker may reference assets that are not named directly in HTML.
    const sw = fs.readFileSync(path.join(out, 'sw.js'), 'utf8');
    if (!sw.includes(asset)) throw new Error(`Production asset is not referenced by app or service worker: ${asset}`);
  }
}
console.log('Words 44 static build ready: dist/');
