import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const root = process.cwd();
const dist = new URL('../dist/', import.meta.url);
const required = ['index.html', 'icon.svg', 'icons', 'vendor/pdfjs'];

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
console.log('Words 44 native web assets staged in dist/. Production web files were not modified.');
