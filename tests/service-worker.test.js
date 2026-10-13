import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Under jsdom, `new URL(...)` is jsdom's class and node:fs rejects it, so resolve paths from a string.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const sw = read('service-worker.js');
const html = read('index.html');
const assetsBlock = sw.match(/const ASSETS_TO_CACHE = \[([\s\S]*?)\];/)[1];
const cached = [...assetsBlock.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter(Boolean);

describe('service worker asset list', () => {
  it('only lists files that exist', () => {
    for (const file of cached) expect(existsSync(join(root, file)), file).toBe(true);
  });

  it('caches every local file index.html loads', () => {
    const refs = [...html.matchAll(/(?:href|src)="([^"#][^"]*)"/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) expect(cached, ref).toContain(ref);
  });

  it('caches every module in src/ (so new modules cannot be forgotten)', () => {
    for (const file of readdirSync(join(root, 'src'))) expect(cached, file).toContain(`src/${file}`);
  });

  it('caches every module that a src/ file imports', () => {
    for (const file of readdirSync(join(root, 'src'))) {
      const imports = [...read(`src/${file}`).matchAll(/from\s+'\.\/([^']+)'/g)].map((m) => `src/${m[1]}`);
      for (const imported of imports) expect(cached, `${file} -> ${imported}`).toContain(imported);
    }
  });

  it('needs no third-party host to run offline', () => {
    expect(html).not.toMatch(/(?:href|src)="https?:/);
    // The SVG namespace in the offline image fallback is an XML identifier, not a network request.
    expect(sw.replaceAll('http://www.w3.org/2000/svg', '')).not.toMatch(/https?:\/\//);
  });
});
