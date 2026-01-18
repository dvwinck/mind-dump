/**
 * Mind Dump - Storage Module
 * Handles localStorage persistence for notes
 */

const STORAGE_KEY = 'mind-dump-notes';

/**
 * Generate unique ID
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Get current ISO timestamp
 */
export function now() {
  return new Date().toISOString();
}

/**
 * Load all notes from localStorage
 * @returns {Array} Array of note objects
 */
export function loadAll() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading notes:', error);
    return [];
  }
}

/**
 * Save all notes to localStorage
 * @param {Array} notes - Array of note objects
 */
export function saveAll(notes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch (error) {
    console.error('Error saving notes:', error);
  }
}

/**
 * Create a new note
 * @param {string} text - Note text
 * @param {string} category - Category ID
 * @param {boolean} pinned - Whether note is pinned
 * @returns {Object} The created note
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
  saveAll(notes);
  
  return note;
}

/**
 * Update an existing note
 * @param {string} id - Note ID
 * @param {Object} updates - Fields to update
 * @returns {Object|null} Updated note or null if not found
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
  
  saveAll(notes);
  return notes[index];
}

/**
 * Delete a note
 * @param {string} id - Note ID
 * @returns {boolean} True if deleted, false if not found
 */
export function deleteNote(id) {
  const notes = loadAll();
  const index = notes.findIndex(n => n.id === id);
  
  if (index === -1) {
    return false;
  }
  
  notes.splice(index, 1);
  saveAll(notes);
  return true;
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
  const validCategories = ['unclear', 'feelings', 'projects', 'desires', 'tasks', 'not-do'];
  
  for (const note of notes) {
    if (!note.id || typeof note.id !== 'string') {
      return { valid: false, error: 'Nota sem ID válido' };
    }
    if (!note.text || typeof note.text !== 'string') {
      return { valid: false, error: `Nota ${note.id} sem texto válido` };
    }
    if (!note.category || !validCategories.includes(note.category)) {
      return { valid: false, error: `Nota ${note.id} com categoria inválida: ${note.category}` };
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
  
  saveAll(existingNotes);
  
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
