/**
 * Mind Dump - Storage Module
 * Handles localStorage persistence for notes
 */

import { CATEGORY_IDS } from './categories.js';

export const STORAGE_KEY = 'mind-dump-notes';
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

const BACKUP_PREFIX = `${STORAGE_KEY}.corrupt-`;
const BLOCKED = Symbol('storage blocked');

let errorHandler = null;
// What loadAll last reported (the unreadable text, or BLOCKED), so a problem is reported once.
let reportedUnreadable = null;
// Unreadable text we could NOT copy aside: saves must not overwrite it while it is the only copy.
let unbackedUnreadable = null;

/**
 * Register a callback for storage problems:
 *   fn({ type: 'load', error, blocked, backedUp })  - stored notes could not be read
 *   fn({ type: 'save', error, blockedByBackup? })   - a save did not happen
 */
export function setErrorHandler(fn) {
  errorHandler = fn;
}

function reportError(type, error, details = {}) {
  console.error(`Storage ${type} error:`, error);
  if (errorHandler) errorHandler({ type, error, ...details });
}

function hasBackup(raw) {
  try {
    if (typeof localStorage.length !== 'number') return false;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(BACKUP_PREFIX) && localStorage.getItem(key) === raw) return true;
    }
  } catch (error) {
    console.error('Could not look for existing backups:', error);
  }
  return false;
}

/**
 * Copy unreadable text aside (unless an identical copy already exists).
 * @returns {boolean} true if a copy exists afterwards
 */
function backupUnreadable(raw) {
  if (hasBackup(raw)) return true;
  try {
    localStorage.setItem(`${BACKUP_PREFIX}${Date.now()}`, raw);
    return true;
  } catch (error) {
    console.error('Could not back up unreadable notes:', error);
    return false;
  }
}

/**
 * True while the stored text is unreadable and still has no backup: writing now would destroy it.
 * Retries the backup first, since space may have been freed.
 */
function mustKeepUnreadable() {
  if (unbackedUnreadable === null) return false;
  if (localStorage.getItem(STORAGE_KEY) !== unbackedUnreadable) {
    unbackedUnreadable = null;
    return false;
  }
  if (backupUnreadable(unbackedUnreadable)) {
    unbackedUnreadable = null;
    return false;
  }
  return true;
}

function isValidDate(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

/**
 * Generate unique ID
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 11);
}

/**
 * Get current ISO timestamp
 */
export function now() {
  return new Date().toISOString();
}

/**
 * Load all notes from localStorage.
 * Unreadable content is copied aside (once) and an empty list is returned.
 * @returns {Array} Array of note objects
 */
export function loadAll() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) throw new Error('Stored notes are not an array');
    return data;
  } catch (error) {
    const signature = raw === null ? BLOCKED : raw;
    if (signature !== reportedUnreadable) {
      reportedUnreadable = signature;
      const backedUp = raw ? backupUnreadable(raw) : false;
      unbackedUnreadable = raw && !backedUp ? raw : null;
      reportError('load', error, { blocked: raw === null, backedUp });
    }
    return [];
  }
}

/**
 * Save all notes to localStorage
 * @param {Array} notes - Array of note objects
 * @returns {boolean} true if saved, false if the browser refused
 */
export function saveAll(notes) {
  try {
    if (mustKeepUnreadable()) {
      throw new Error('Refusing to overwrite unreadable notes that have no backup');
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    reportedUnreadable = null;
    return true;
  } catch (error) {
    reportError('save', error, unbackedUnreadable !== null ? { blockedByBackup: true } : {});
    return false;
  }
}

/**
 * Create a new note
 * @param {string} text - Note text
 * @param {string} category - Category ID
 * @param {boolean} pinned - Whether note is pinned
 * @returns {Object|null} The created note, or null if it could not be saved
 */
export function createNote(text, category, pinned = false) {
  const notes = loadAll();
  const timestamp = now();
  
  const note = {
    id: generateId(),
    text: text.trim(),
    category,
    pinned,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  
  notes.push(note);
  return saveAll(notes) ? note : null;
}

/**
 * Update an existing note
 * @param {string} id - Note ID
 * @param {Object} updates - Fields to update
 * @returns {Object|null} Updated note, or null if not found or not saved
 */
export function updateNote(id, updates) {
  const notes = loadAll();
  const index = notes.findIndex(n => n.id === id);
  
  if (index === -1) {
    return null;
  }
  
  notes[index] = {
    ...notes[index],
    ...updates,
    updatedAt: now()
  };
  
  return saveAll(notes) ? notes[index] : null;
}

/**
 * Delete a note
 * @param {string} id - Note ID
 * @returns {boolean} True if deleted, false if not found or the change could not be saved
 */
export function deleteNote(id) {
  const notes = loadAll();
  const index = notes.findIndex(n => n.id === id);
  
  if (index === -1) {
    return false;
  }
  
  notes.splice(index, 1);
  return saveAll(notes);
}

/**
 * Get notes by category
 * @param {string} category - Category ID
 * @returns {Array} Notes in the category
 */
export function getNotesByCategory(category) {
  const notes = loadAll();
  return notes
    .filter(n => n.category === category)
    .sort((a, b) => {
      // Pinned notes first
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      // Then by updatedAt descending
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
}

/**
 * Move note to another category
 * @param {string} id - Note ID
 * @param {string} newCategory - New category ID
 * @returns {Object|null} Updated note or null
 */
export function moveNote(id, newCategory) {
  return updateNote(id, { category: newCategory });
}

/**
 * Toggle note pinned status
 * @param {string} id - Note ID
 * @returns {Object|null} Updated note or null
 */
export function togglePinned(id) {
  const notes = loadAll();
  const note = notes.find(n => n.id === id);
  
  if (!note) return null;
  
  return updateNote(id, { pinned: !note.pinned });
}

/**
 * Search notes by text
 * @param {string} query - Search query
 * @returns {Array} Matching notes
 */
export function searchNotes(query) {
  if (!query || !query.trim()) {
    return loadAll();
  }
  
  const lowerQuery = query.toLowerCase().trim();
  const notes = loadAll();
  
  return notes.filter(n => 
    n.text.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Export all notes as JSON string
 * @returns {string} JSON string
 */
export function exportNotes() {
  const notes = loadAll();
  return JSON.stringify({
    version: 1,
    exportedAt: now(),
    notes
  }, null, 2);
}

/**
 * Validate imported data
 * @param {Object} data - Imported data
 * @returns {Object} { valid: boolean, notes?: Array, error?: string }
 */
export function validateImport(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Dados inválidos' };
  }
  
  // Support both direct array and wrapped format
  let notes = Array.isArray(data) ? data : data.notes;
  
  if (!Array.isArray(notes)) {
    return { valid: false, error: 'Formato inválido: esperado array de notas' };
  }
  
  // Validate each note has required fields
  for (const note of notes) {
    if (!note || typeof note !== 'object') {
      return { valid: false, error: 'Nota inválida' };
    }
    if (typeof note.id !== 'string' || !ID_PATTERN.test(note.id)) {
      return { valid: false, error: 'Nota sem ID válido' };
    }
    if (typeof note.text !== 'string' || !note.text.trim()) {
      return { valid: false, error: `Nota ${note.id} sem texto válido` };
    }
    if (!CATEGORY_IDS.includes(note.category)) {
      return { valid: false, error: `Nota ${note.id} com categoria inválida: ${note.category}` };
    }
    if (note.pinned !== undefined && typeof note.pinned !== 'boolean') {
      return { valid: false, error: `Nota ${note.id} com pinned inválido` };
    }
    for (const field of ['createdAt', 'updatedAt']) {
      if (note[field] !== undefined && !isValidDate(note[field])) {
        return { valid: false, error: `Nota ${note.id} com ${field} inválido` };
      }
    }
  }
  
  return { valid: true, notes };
}

/**
 * Import notes with merge (no duplicates, keep most recent)
 * @param {Object} importData - Data to import
 * @returns {Object} { success: boolean, imported: number, updated: number, error?: string }
 */
export function mergeImport(importData) {
  const validation = validateImport(importData);
  
  if (!validation.valid) {
    return { success: false, imported: 0, updated: 0, error: validation.error };
  }
  
  const existingNotes = loadAll();
  const importedNotes = validation.notes;
  
  let imported = 0;
  let updated = 0;
  
  for (const importNote of importedNotes) {
    const existingIndex = existingNotes.findIndex(n => n.id === importNote.id);
    
    if (existingIndex === -1) {
      // New note - add it
      existingNotes.push({
        ...importNote,
        pinned: importNote.pinned || false,
        createdAt: importNote.createdAt || now(),
        updatedAt: importNote.updatedAt || now()
      });
      imported++;
    } else {
      // Existing note - keep most recent by updatedAt
      const existing = existingNotes[existingIndex];
      const existingDate = new Date(existing.updatedAt || 0);
      const importDate = new Date(importNote.updatedAt || 0);
      
      if (importDate > existingDate) {
        existingNotes[existingIndex] = {
          ...importNote,
          pinned: importNote.pinned || false
        };
        updated++;
      }
    }
  }
  
  if (!saveAll(existingNotes)) {
    return { success: false, imported: 0, updated: 0, error: 'Não foi possível salvar as notas importadas.' };
  }

  return { success: true, imported, updated };
}

/**
 * Get note count by category
 * @returns {Object} Map of category to count
 */
export function getCountsByCategory() {
  const notes = loadAll();
  const counts = {};
  
  for (const note of notes) {
    counts[note.category] = (counts[note.category] || 0) + 1;
  }
  
  return counts;
}
