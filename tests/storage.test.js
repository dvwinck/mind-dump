/**
 * Mind Dump - Storage Module Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as storage from '../src/storage.js';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = value; }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; })
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe('Storage Module', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = storage.generateId();
      const id2 = storage.generateId();
      
      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
    });

    it('should generate string IDs', () => {
      const id = storage.generateId();
      expect(typeof id).toBe('string');
    });
  });

  describe('now', () => {
    it('should return ISO timestamp', () => {
      const timestamp = storage.now();
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('loadAll', () => {
    it('should return empty array when no data', () => {
      const notes = storage.loadAll();
      expect(notes).toEqual([]);
    });

    it('should return stored notes', () => {
      const testNotes = [
        { id: '1', text: 'Test', category: 'tasks' }
      ];
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(testNotes));
      
      const notes = storage.loadAll();
      expect(notes).toEqual(testNotes);
    });

    it('should handle invalid JSON gracefully', () => {
      localStorageMock.getItem.mockReturnValueOnce('invalid json');
      
      const notes = storage.loadAll();
      expect(notes).toEqual([]);
    });
  });

  describe('saveAll', () => {
    it('should save notes to localStorage', () => {
      const testNotes = [
        { id: '1', text: 'Test', category: 'tasks' }
      ];
      
      storage.saveAll(testNotes);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'mind-dump-notes',
        JSON.stringify(testNotes)
      );
    });
  });

  describe('createNote', () => {
    it('should create a note with required fields', () => {
      const note = storage.createNote('Test note', 'tasks');
      
      expect(note).toHaveProperty('id');
      expect(note.text).toBe('Test note');
      expect(note.category).toBe('tasks');
      expect(note.pinned).toBe(false);
      expect(note).toHaveProperty('createdAt');
      expect(note).toHaveProperty('updatedAt');
    });

    it('should trim whitespace from text', () => {
      const note = storage.createNote('  Test note  ', 'tasks');
      expect(note.text).toBe('Test note');
    });

    it('should create pinned note when specified', () => {
      const note = storage.createNote('Test', 'tasks', true);
      expect(note.pinned).toBe(true);
    });

    it('should save to localStorage', () => {
      storage.createNote('Test', 'tasks');
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });
  });

  describe('updateNote', () => {
    beforeEach(() => {
      const testNotes = [
        { id: '1', text: 'Original', category: 'tasks', updatedAt: '2024-01-01' }
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(testNotes));
    });

    it('should update note text', () => {
      const updated = storage.updateNote('1', { text: 'Updated' });
      
      expect(updated.text).toBe('Updated');
      expect(updated.updatedAt).not.toBe('2024-01-01');
    });

    it('should return null for non-existent note', () => {
      const result = storage.updateNote('non-existent', { text: 'Updated' });
      expect(result).toBeNull();
    });

    it('should preserve other fields when updating', () => {
      const updated = storage.updateNote('1', { text: 'Updated' });
      
      expect(updated.category).toBe('tasks');
      expect(updated.id).toBe('1');
    });
  });

  describe('deleteNote', () => {
    beforeEach(() => {
      const testNotes = [
        { id: '1', text: 'Note 1', category: 'tasks' },
        { id: '2', text: 'Note 2', category: 'tasks' }
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(testNotes));
    });

    it('should delete existing note and return true', () => {
      const result = storage.deleteNote('1');
      expect(result).toBe(true);
    });

    it('should return false for non-existent note', () => {
      const result = storage.deleteNote('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('getNotesByCategory', () => {
    beforeEach(() => {
      const testNotes = [
        { id: '1', text: 'A', category: 'tasks', pinned: false, updatedAt: '2024-01-01' },
        { id: '2', text: 'B', category: 'tasks', pinned: true, updatedAt: '2024-01-02' },
        { id: '3', text: 'C', category: 'feelings', pinned: false, updatedAt: '2024-01-03' }
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(testNotes));
    });

    it('should filter by category', () => {
      const tasks = storage.getNotesByCategory('tasks');
      expect(tasks).toHaveLength(2);
      expect(tasks.every(n => n.category === 'tasks')).toBe(true);
    });

    it('should sort pinned notes first', () => {
      const tasks = storage.getNotesByCategory('tasks');
      expect(tasks[0].pinned).toBe(true);
    });

    it('should return empty array for empty category', () => {
      const notes = storage.getNotesByCategory('projects');
      expect(notes).toEqual([]);
    });
  });

  describe('moveNote', () => {
    beforeEach(() => {
      const testNotes = [
        { id: '1', text: 'Test', category: 'tasks', updatedAt: '2024-01-01' }
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(testNotes));
    });

    it('should move note to new category', () => {
      const updated = storage.moveNote('1', 'feelings');
      expect(updated.category).toBe('feelings');
    });

    it('should update the updatedAt timestamp', () => {
      const updated = storage.moveNote('1', 'feelings');
      expect(updated.updatedAt).not.toBe('2024-01-01');
    });
  });

  describe('togglePinned', () => {
    beforeEach(() => {
      const testNotes = [
        { id: '1', text: 'Test', category: 'tasks', pinned: false }
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(testNotes));
    });

    it('should toggle pinned from false to true', () => {
      const updated = storage.togglePinned('1');
      expect(updated.pinned).toBe(true);
    });
  });

  describe('searchNotes', () => {
    beforeEach(() => {
      const testNotes = [
        { id: '1', text: 'Hello World', category: 'tasks' },
        { id: '2', text: 'Goodbye World', category: 'feelings' },
        { id: '3', text: 'Something else', category: 'projects' }
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(testNotes));
    });

    it('should find notes containing query', () => {
      const results = storage.searchNotes('World');
      expect(results).toHaveLength(2);
    });

    it('should be case-insensitive', () => {
      const results = storage.searchNotes('world');
      expect(results).toHaveLength(2);
    });

    it('should return all notes for empty query', () => {
      const results = storage.searchNotes('');
      expect(results).toHaveLength(3);
    });

    it('should return empty array when no matches', () => {
      const results = storage.searchNotes('xyz');
      expect(results).toEqual([]);
    });
  });

  describe('validateImport', () => {
    it('should accept valid notes array', () => {
      const data = {
        notes: [
          { id: '1', text: 'Test', category: 'tasks' }
        ]
      };
      
      const result = storage.validateImport(data);
      expect(result.valid).toBe(true);
      expect(result.notes).toHaveLength(1);
    });

    it('should accept direct array format', () => {
      const data = [
        { id: '1', text: 'Test', category: 'tasks' }
      ];
      
      const result = storage.validateImport(data);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid category', () => {
      const data = {
        notes: [
          { id: '1', text: 'Test', category: 'invalid-category' }
        ]
      };
      
      const result = storage.validateImport(data);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('categoria inválida');
    });

    it('should reject missing id', () => {
      const data = {
        notes: [
          { text: 'Test', category: 'tasks' }
        ]
      };
      
      const result = storage.validateImport(data);
      expect(result.valid).toBe(false);
    });

    it('should reject missing text', () => {
      const data = {
        notes: [
          { id: '1', category: 'tasks' }
        ]
      };
      
      const result = storage.validateImport(data);
      expect(result.valid).toBe(false);
    });

    it('should reject null data', () => {
      const result = storage.validateImport(null);
      expect(result.valid).toBe(false);
    });
  });

  describe('mergeImport', () => {
    beforeEach(() => {
      const existingNotes = [
        { id: '1', text: 'Existing', category: 'tasks', updatedAt: '2024-01-01T00:00:00.000Z' }
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(existingNotes));
    });

    it('should add new notes', () => {
      const importData = {
        notes: [
          { id: '2', text: 'New note', category: 'tasks' }
        ]
      };
      
      const result = storage.mergeImport(importData);
      
      expect(result.success).toBe(true);
      expect(result.imported).toBe(1);
      expect(result.updated).toBe(0);
    });

    it('should update existing note if imported is newer', () => {
      const importData = {
        notes: [
          { id: '1', text: 'Updated', category: 'tasks', updatedAt: '2024-12-31T00:00:00.000Z' }
        ]
      };
      
      const result = storage.mergeImport(importData);
      
      expect(result.success).toBe(true);
      expect(result.updated).toBe(1);
    });

    it('should not update if existing is newer', () => {
      const importData = {
        notes: [
          { id: '1', text: 'Old', category: 'tasks', updatedAt: '2020-01-01T00:00:00.000Z' }
        ]
      };
      
      const result = storage.mergeImport(importData);
      
      expect(result.success).toBe(true);
      expect(result.updated).toBe(0);
    });

    it('should return error for invalid data', () => {
      const result = storage.mergeImport({ notes: 'invalid' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe('getCountsByCategory', () => {
    beforeEach(() => {
      const testNotes = [
        { id: '1', text: 'A', category: 'tasks' },
        { id: '2', text: 'B', category: 'tasks' },
        { id: '3', text: 'C', category: 'feelings' }
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(testNotes));
    });

    it('should count notes by category', () => {
      const counts = storage.getCountsByCategory();
      
      expect(counts.tasks).toBe(2);
      expect(counts.feelings).toBe(1);
    });

    it('should not include empty categories', () => {
      const counts = storage.getCountsByCategory();
      expect(counts.projects).toBeUndefined();
    });
  });

  describe('exportNotes', () => {
    it('should export notes as JSON string', () => {
      const testNotes = [
        { id: '1', text: 'Test', category: 'tasks' }
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(testNotes));
      
      const exported = storage.exportNotes();
      const parsed = JSON.parse(exported);
      
      expect(parsed).toHaveProperty('version', 1);
      expect(parsed).toHaveProperty('exportedAt');
      expect(parsed.notes).toHaveLength(1);
    });
  });
});

describe('validateImport categories', () => {
  it.each(['unclear', 'feelings', 'projects', 'desires', 'tasks', 'not-do'])('accepts %s', (category) => {
    expect(storage.validateImport([{ id: 'a1', text: 'x', category }]).valid).toBe(true);
  });

  it('rejects an unknown category', () => {
    expect(storage.validateImport([{ id: 'a1', text: 'x', category: 'nope' }]).valid).toBe(false);
  });
});

// The 'Storage Module' tests above leave getItem stuck on mockReturnValue(...) and
// vi.clearAllMocks() does not undo that, so rebuild a working in-memory mock here.
function resetMockStorage() {
  const store = {};
  vi.clearAllMocks();
  localStorageMock.getItem.mockImplementation((key) => (key in store ? store[key] : null));
  localStorageMock.setItem.mockImplementation((key, value) => { store[key] = String(value); });
  localStorageMock.removeItem.mockImplementation((key) => { delete store[key]; });
  localStorageMock.clear.mockImplementation(() => { Object.keys(store).forEach((key) => delete store[key]); });
}

describe('validateImport hardening', () => {
  beforeEach(resetMockStorage);

  const base = { id: 'a1', text: 'hello', category: 'tasks' };
  const check = (over) => storage.validateImport([{ ...base, ...over }]);

  it('rejects ids that are not attribute/URL safe', () => {
    for (const id of ["x');alert(1);//", 'a b', '<img>', 'a"b', '', 'a'.repeat(65)]) {
      expect(check({ id }).valid, id).toBe(false);
    }
  });

  it('accepts ids from generateId and typical ids', () => {
    expect(check({ id: storage.generateId() }).valid).toBe(true);
    expect(check({ id: 'note-1_B' }).valid).toBe(true);
  });

  it('rejects whitespace-only text', () => {
    expect(check({ text: '   \n ' }).valid).toBe(false);
  });

  it('rejects non-boolean pinned', () => {
    expect(check({ pinned: 'yes' }).valid).toBe(false);
  });

  it('rejects unparseable dates', () => {
    expect(check({ updatedAt: 'not-a-date' }).valid).toBe(false);
    expect(check({ createdAt: 123 }).valid).toBe(false);
  });

  it('rejects entries that are not objects', () => {
    expect(storage.validateImport([null]).valid).toBe(false);
    expect(storage.validateImport(['text']).valid).toBe(false);
  });

  it('accepts a note with only the required fields', () => {
    expect(check({}).valid).toBe(true);
  });

  it('does not store anything when mergeImport gets a hostile id', () => {
    const result = storage.mergeImport([{ ...base, id: "x');alert(1);//" }]);
    expect(result.success).toBe(false);
    expect(storage.loadAll()).toEqual([]);
  });
});

describe('storage durability', () => {
  // Each test uses a different unreadable string: loadAll reports/backs up once per distinct value.
  beforeEach(() => {
    resetMockStorage();
    storage.setErrorHandler(null);
  });

  const backups = () =>
    localStorageMock.setItem.mock.calls.filter(([key]) => key.startsWith('mind-dump-notes.corrupt-'));

  it('keeps a copy of unreadable data before returning an empty list', () => {
    localStorageMock.setItem('mind-dump-notes', '{not json');
    expect(storage.loadAll()).toEqual([]);
    expect(backups()).toHaveLength(1);
    expect(backups()[0][1]).toBe('{not json');
  });

  it('treats valid JSON that is not an array as unreadable', () => {
    localStorageMock.setItem('mind-dump-notes', '{"a":1}');
    expect(storage.loadAll()).toEqual([]);
    expect(backups()[0][1]).toBe('{"a":1}');
  });

  it('reports unreadable data once while it stays in storage', () => {
    const handler = vi.fn();
    storage.setErrorHandler(handler);
    localStorageMock.setItem('mind-dump-notes', '{broken-once');
    storage.loadAll();
    storage.loadAll();
    storage.loadAll();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ type: 'load' }));
    expect(backups()).toHaveLength(1);
  });

  it('returns true when saving works', () => {
    expect(storage.saveAll([])).toBe(true);
  });

  it('returns false and notifies the handler when saving fails', () => {
    const handler = vi.fn();
    storage.setErrorHandler(handler);
    localStorageMock.setItem.mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });
    expect(storage.saveAll([])).toBe(false);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ type: 'save' }));
  });

  it('exports the storage key', () => {
    expect(storage.STORAGE_KEY).toBe('mind-dump-notes');
  });
});
