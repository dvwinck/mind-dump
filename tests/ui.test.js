import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Under jsdom, `new URL(...)` is jsdom's class and node:fs rejects it, so resolve paths from a string.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');
const bodyHtml = indexHtml
  .match(/<body[^>]*>([\s\S]*)<\/body>/)[1]
  .replace(/<script[\s\S]*?<\/script>/g, '');

class FakeModal {
  constructor(el) { this.el = el; }
  show() { this.shown = true; }
  hide() { this.shown = false; }
}

let ui;
let storage;

async function boot() {
  document.body.innerHTML = bodyHtml;
  globalThis.bootstrap = { Modal: FakeModal };
  vi.resetModules();
  storage = await import('../src/storage.js');
  ui = await import('../src/ui.js');
  ui.init();
}

const press = (el, key, init = {}) =>
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
const columns = (id) => document.querySelectorAll(`.category-column[data-category="${id}"]`);
const cardIn = (column, noteId) =>
  [...column.querySelectorAll('.note-card')].find((c) => c.dataset.noteId === noteId);

beforeEach(async () => {
  localStorage.clear();
  await boot();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('creating notes', () => {
  it('creates a note on Enter and renders it in both layouts', () => {
    const input = columns('tasks')[0].querySelector('.note-input');
    input.value = 'buy milk';
    press(input, 'Enter');

    expect(storage.loadAll()).toHaveLength(1);
    expect(document.querySelectorAll('.category-column[data-category="tasks"] .note-card')).toHaveLength(2);
    expect(columns('tasks')[0].querySelector('.note-count').textContent).toBe('1');
    expect(input.value).toBe('');
  });

  it('does not create a note on Shift+Enter', () => {
    const input = columns('tasks')[0].querySelector('.note-input');
    input.value = 'line one';
    press(input, 'Enter', { shiftKey: true });
    expect(storage.loadAll()).toHaveLength(0);
  });
});

describe('note actions (delegated clicks)', () => {
  it('pins and unpins', () => {
    const n = storage.createNote('a', 'tasks');
    ui.renderAllCategories();

    cardIn(columns('tasks')[1], n.id).querySelector('[data-action="pin"]').click();
    expect(storage.loadAll()[0].pinned).toBe(true);
    expect(document.querySelector('.note-card.pinned')).not.toBeNull();
  });

  it('moves a note through the move menu', () => {
    const n = storage.createNote('a', 'tasks');
    ui.renderAllCategories();

    cardIn(columns('tasks')[1], n.id).querySelector('[data-action="move"][data-category="projects"]').click();
    expect(storage.loadAll()[0].category).toBe('projects');
    expect(cardIn(columns('projects')[1], n.id)).toBeTruthy();
  });

  it('edits a note through the modal', () => {
    const n = storage.createNote('old', 'tasks');
    ui.renderAllCategories();

    cardIn(columns('tasks')[1], n.id).querySelector('[data-action="edit"]').click();
    const textarea = document.getElementById('edit-note-text');
    expect(textarea.value).toBe('old');

    textarea.value = 'new';
    document.getElementById('btn-save-edit').click();
    expect(storage.loadAll()[0].text).toBe('new');
  });

  it('deletes a note after confirmation', () => {
    const n = storage.createNote('bye', 'tasks');
    ui.renderAllCategories();

    cardIn(columns('tasks')[1], n.id).querySelector('[data-action="delete"]').click();
    expect(storage.loadAll()).toHaveLength(1);
    document.getElementById('btn-confirm-delete').click();
    expect(storage.loadAll()).toHaveLength(0);
  });

  it('exposes no global handler object', () => {
    expect(window.mindDump).toBeUndefined();
  });
});

describe('search', () => {
  it('filters (debounced) and highlights without touching the total count', () => {
    vi.useFakeTimers();
    storage.createNote('apple pie', 'tasks');
    storage.createNote('banana', 'tasks');
    ui.renderAllCategories();

    const search = document.getElementById('search-input');
    search.value = 'APP';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(200);

    const cards = document.querySelectorAll('.category-column[data-category="tasks"] .note-card');
    expect(cards).toHaveLength(2); // one match, rendered in both layouts
    expect(cards[0].querySelector('mark').textContent).toBe('app');
    expect(columns('tasks')[0].querySelector('.note-count').textContent).toBe('2');
  });

  it('keeps notes with HTML-ish text intact when searching for entity names', () => {
    vi.useFakeTimers();
    storage.createNote('R&D <plan> sample', 'tasks');
    ui.renderAllCategories();

    const search = document.getElementById('search-input');
    search.value = 'amp';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(200);

    const text = document.querySelector('.category-column[data-category="tasks"] .note-text');
    expect(text.textContent).toBe('R&D <plan> sample');
    // The match is inside "sample"; the escaped "&amp;" and "&lt;" must stay whole.
    expect(text.innerHTML).toBe('R&amp;D &lt;plan&gt; s<mark>amp</mark>le');
  });
});

describe('keyboard behavior', () => {
  it('ignores Enter while an IME composition is active', () => {
    const input = columns('tasks')[0].querySelector('.note-input');
    input.value = 'caf';
    press(input, 'Enter', { isComposing: true });
    expect(storage.loadAll()).toHaveLength(0);
    expect(input.value).toBe('caf');
  });

  it('keeps focus on the same action after pinning', () => {
    const n = storage.createNote('a', 'tasks');
    ui.renderAllCategories();
    const column = columns('tasks')[1];
    const pin = cardIn(column, n.id).querySelector('[data-action="pin"]');

    pin.focus();
    expect(document.activeElement).toBe(pin);
    pin.click();

    const active = document.activeElement;
    expect(active).not.toBe(pin); // the old node was replaced by the re-render
    expect(active.dataset.action).toBe('pin');
    expect(column.contains(active)).toBe(true);
    expect(active.closest('.note-card').dataset.noteId).toBe(n.id);
  });

  it('moves focus to the column input when the focused note leaves the column', () => {
    const n = storage.createNote('a', 'tasks');
    ui.renderAllCategories();
    const column = columns('tasks')[1];
    const item = cardIn(column, n.id).querySelector('[data-action="move"][data-category="projects"]');

    item.focus();
    item.click();

    expect(document.activeElement).toBe(column.querySelector('.note-input'));
  });
});

describe('storage problems are shown to the user', () => {
  it('shows a danger toast when saving fails', () => {
    const n = storage.createNote('a', 'tasks');
    ui.renderAllCategories();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    cardIn(columns('tasks')[1], n.id).querySelector('[data-action="pin"]').click();

    const toast = document.querySelector('#toast-container .toast');
    expect(toast).not.toBeNull();
    expect(toast.getAttribute('role')).toBe('alert');
    expect(toast.textContent).toMatch(/salvar/i);
  });

  it('shows a toast and keeps a copy when the saved data is unreadable', async () => {
    localStorage.setItem('mind-dump-notes', '{corrupt');
    await boot();

    expect(document.querySelector('#toast-container .toast').textContent).toMatch(/cópia/i);
    const backupKey = Object.keys(localStorage).find((k) => k.startsWith('mind-dump-notes.corrupt-'));
    expect(localStorage.getItem(backupKey)).toBe('{corrupt');
  });
});

describe('cross-tab sync', () => {
  const external = {
    id: 'x1', text: 'from another tab', category: 'tasks', pinned: false,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'
  };

  it('re-renders when another tab changes the notes', () => {
    localStorage.setItem('mind-dump-notes', JSON.stringify([external]));
    window.dispatchEvent(new StorageEvent('storage', { key: 'mind-dump-notes' }));
    expect(document.querySelectorAll('.category-column[data-category="tasks"] .note-card')).toHaveLength(2);
  });

  it('ignores changes to unrelated keys', () => {
    localStorage.setItem('mind-dump-notes', JSON.stringify([external]));
    window.dispatchEvent(new StorageEvent('storage', { key: 'something-else' }));
    expect(document.querySelectorAll('.note-card')).toHaveLength(0);
  });
});
