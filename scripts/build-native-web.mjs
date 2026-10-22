import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const dist = new URL('../dist/', import.meta.url);
const required = ['index.html', 'icon.svg', 'icons', 'manifest.json', 'vendor/pdfjs'];

for (const item of required) {
  if (!existsSync(new URL('../' + item, import.meta.url))) {
    throw new Error(`Required Words 44 runtime asset is missing: ${item}`);
  }
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const item of required) {
  await cp(new URL('../' + item, import.meta.url), new URL('../dist/' + item, import.meta.url), { recursive: true });
}

// A native WebView must not install the website's PWA service worker.
const stagedIndex = new URL('../dist/index.html', import.meta.url);
let html = await readFile(stagedIndex, 'utf8');
const registrationGuard = "if ('serviceWorker' in navigator && location.protocol !== 'file:')";
if (!html.includes(registrationGuard)) {
  throw new Error('Could not find the expected service-worker registration guard; refusing to stage an unverified native build.');
}
html = html.replace(registrationGuard, "if (!window.Capacitor?.isNativePlatform?.() && 'serviceWorker' in navigator && location.protocol !== 'file:')");
await writeFile(stagedIndex, html, 'utf8');

console.log('Words 44 native web assets staged in dist/. PWA service-worker registration is disabled in the native WebView. Production web files were not modified.');
