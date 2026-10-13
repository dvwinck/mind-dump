import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORIES, CATEGORY_IDS } from '../src/categories.js';

// Under jsdom, `new URL(...)` is jsdom's class and node:fs rejects it, so resolve paths from a string.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');

describe('categories', () => {
  it('exposes ids in display order', () => {
    expect(CATEGORY_IDS).toEqual(['unclear', 'feelings', 'projects', 'desires', 'tasks', 'not-do']);
    expect(CATEGORIES.map((c) => c.id)).toEqual(CATEGORY_IDS);
  });

  it('index.html has exactly one mobile and one desktop column per category', () => {
    for (const id of CATEGORY_IDS) {
      const count = html.split(`data-category="${id}"`).length - 1;
      expect(count, id).toBe(2);
    }
  });

  it('index.html has no column for an unknown category', () => {
    const ids = [...html.matchAll(/class="category-column[^"]*" data-category="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(CATEGORY_IDS.length * 2);
    expect(ids.every((id) => CATEGORY_IDS.includes(id))).toBe(true);
  });
});
