import { gzipSync } from 'node:zlib';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const dist = new URL('../dist/', import.meta.url);
const assetsDir = new URL('./assets/', dist);
const html = await readFile(new URL('./index.html', dist), 'utf8');

if (!html.includes('/cheatordie-game/assets/')) {
  throw new Error('Production index is missing the GitHub Pages /cheatordie-game/ asset base.');
}
if (html.includes('/src/main.ts')) {
  throw new Error('Production index still references source TypeScript.');
}

const files = await readdir(assetsDir);
const js = [];
for (const name of files.filter((file) => file.endsWith('.js'))) {
  const path = join(assetsDir.pathname, name);
  const info = await stat(path);
  const bytes = await readFile(path);
  js.push({ name, raw: info.size, gzip: gzipSync(bytes, { level: 9 }).byteLength });
}

js.sort((a, b) => b.raw - a.raw);
const largest = js[0];
if (!largest) throw new Error('No JavaScript chunks were emitted.');

const MAX_SINGLE_CHUNK = 1_250_000;
if (largest.raw > MAX_SINGLE_CHUNK) {
  throw new Error(
    'Largest JavaScript chunk ' + largest.name + ' is ' + (largest.raw / 1024).toFixed(1) + ' KiB, ' +
    'over the ' + (MAX_SINGLE_CHUNK / 1024).toFixed(1) + ' KiB mobile budget. ' +
    'Check for broad Babylon barrel imports or newly bundled heavy subsystems.'
  );
}

const totalRaw = js.reduce((sum, file) => sum + file.raw, 0);
const totalGzip = js.reduce((sum, file) => sum + file.gzip, 0);
console.log(
  'Build verified: ' + js.length + ' JS chunks, largest ' + largest.name + ' ' +
  (largest.raw / 1024).toFixed(1) + ' KiB raw / ' + (largest.gzip / 1024).toFixed(1) + ' KiB gzip; ' +
  'all JS ' + (totalRaw / 1024).toFixed(1) + ' KiB raw / ' + (totalGzip / 1024).toFixed(1) + ' KiB gzip.'
);
