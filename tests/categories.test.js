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

  const doc = new DOMParser().parseFromString(html, 'text/html');

  it('index.html has exactly one column per category in each of the mobile and desktop layouts', () => {
    const mobile = doc.querySelector('.tab-content');
    const desktop = doc.querySelector('.d-none.d-md-block');
    expect(mobile).not.toBeNull();
    expect(desktop).not.toBeNull();
    for (const id of CATEGORY_IDS) {
      expect(mobile.querySelectorAll(`.category-column[data-category="${id}"]`), `mobile ${id}`).toHaveLength(1);
      expect(desktop.querySelectorAll(`.category-column[data-category="${id}"]`), `desktop ${id}`).toHaveLength(1);
    }
  });

  it('index.html has a mobile tab button and tab pane per category', () => {
    for (const id of CATEGORY_IDS) {
      expect(doc.getElementById(`tab-${id}`), `tab-${id}`).not.toBeNull();
      expect(doc.getElementById(`panel-${id}`), `panel-${id}`).not.toBeNull();
    }
  });

  it('index.html has no column for an unknown category', () => {
    const unknown = [...doc.querySelectorAll('.category-column')]
      .map((el) => el.dataset.category)
      .filter((id) => !CATEGORY_IDS.includes(id));
    expect(unknown).toEqual([]);
  });
});
