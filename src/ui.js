/**
 * Mind Dump - UI Module
 * Handles all DOM interactions, rendering, and events
 */

import * as storage from './storage.js';
import { CATEGORIES } from './main.js';

// State
let currentSearchQuery = '';
let editingNoteId = null;
let deleteNoteId = null;
let draggedNoteId = null;

// DOM Elements
let editModal, deleteModal, editTextarea;

/**
 * Initialize the UI
 */
export function init() {
  // Cache modal elements
  editModal = new bootstrap.Modal(document.getElementById('edit-modal'));
  deleteModal = new bootstrap.Modal(document.getElementById('delete-modal'));
  editTextarea = document.getElementById('edit-note-text');
  
  // Setup event listeners
  setupNoteInputs();
  setupSearch();
  setupModals();
  setupExportImport();
  setupDragAndDrop();
  
  // Initial render
  renderAllCategories();
  
  console.log('📝 UI initialized');
}

/**
 * Setup note input fields (Enter to create)
 */
function setupNoteInputs() {
  document.querySelectorAll('.note-input').forEach(input => {
    input.addEventListener('keydown', (e) => {
      // Enter (without Shift) or Ctrl+Enter to create
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const category = input.closest('.category-column').dataset.category;
        const text = input.value.trim();
        
        if (text) {
          storage.createNote(text, category);
          input.value = '';
          renderCategory(category);
        }
      }
    });
  });
}

/**
 * Setup search functionality
 */
function setupSearch() {
  const searchInput = document.getElementById('search-input');
  let debounceTimer;
  
  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      currentSearchQuery = e.target.value;
      renderAllCategories();
    }, 200);
  });
}

/**
 * Setup modal event handlers
 */
function setupModals() {
  // Edit modal - save button
  document.getElementById('btn-save-edit').addEventListener('click', () => {
    if (editingNoteId && editTextarea.value.trim()) {
      storage.updateNote(editingNoteId, { text: editTextarea.value.trim() });
      editModal.hide();
      renderAllCategories();
    }
  });
  
  // Edit modal - Enter to save (Ctrl+Enter)
  editTextarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      document.getElementById('btn-save-edit').click();
    }
  });
  
  // Delete modal - confirm button
  document.getElementById('btn-confirm-delete').addEventListener('click', () => {
    if (deleteNoteId) {
      storage.deleteNote(deleteNoteId);
      deleteModal.hide();
      renderAllCategories();
    }
  });
}

/**
 * Setup export/import functionality
 */
function setupExportImport() {
  // Export button
  document.getElementById('btn-export').addEventListener('click', () => {
    const data = storage.exportNotes();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `mind-dump-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  });
  
  // Import button - trigger file input
  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  
  // File input change
  document.getElementById('import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const result = storage.mergeImport(data);
      
      if (result.success) {
        alert(`Importação concluída!\n${result.imported} notas adicionadas\n${result.updated} notas atualizadas`);
        renderAllCategories();
      } else {
        alert(`Erro na importação: ${result.error}`);
      }
    } catch (error) {
      alert('Erro ao ler arquivo: ' + error.message);
    }
    
    // Reset file input
    e.target.value = '';
  });
}

/**
 * Setup drag and drop
 */
function setupDragAndDrop() {
  // Use event delegation on the main container
  document.addEventListener('dragstart', (e) => {
    const noteCard = e.target.closest('.note-card');
    if (noteCard) {
      draggedNoteId = noteCard.dataset.noteId;
      noteCard.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggedNoteId);
    }
  });
  
  document.addEventListener('dragend', (e) => {
    const noteCard = e.target.closest('.note-card');
    if (noteCard) {
      noteCard.classList.remove('dragging');
      draggedNoteId = null;
    }
    
    // Remove all drop-target classes
    document.querySelectorAll('.drop-target').forEach(el => {
      el.classList.remove('drop-target');
    });
  });
  
  document.addEventListener('dragover', (e) => {
    const column = e.target.closest('.category-column');
    if (column && draggedNoteId) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      column.classList.add('drop-target');
    }
  });
  
  document.addEventListener('dragleave', (e) => {
    const column = e.target.closest('.category-column');
    if (column) {
      // Check if we're leaving to a child element
      const relatedTarget = e.relatedTarget;
      if (!column.contains(relatedTarget)) {
        column.classList.remove('drop-target');
      }
    }
  });
  
  document.addEventListener('drop', (e) => {
    const column = e.target.closest('.category-column');
    if (column && draggedNoteId) {
      e.preventDefault();
      
      const newCategory = column.dataset.category;
      const note = storage.loadAll().find(n => n.id === draggedNoteId);
      
      if (note && note.category !== newCategory) {
        storage.moveNote(draggedNoteId, newCategory);
        renderAllCategories();
      }
      
      column.classList.remove('drop-target');
      draggedNoteId = null;
    }
  });
}

/**
 * Render all categories
 */
export function renderAllCategories() {
  CATEGORIES.forEach(cat => renderCategory(cat.id));
}

/**
 * Render a single category's notes
 */
export function renderCategory(categoryId) {
  // Get notes for this category
  let notes = storage.getNotesByCategory(categoryId);
  
  // Apply search filter if active
  if (currentSearchQuery) {
    const query = currentSearchQuery.toLowerCase();
    notes = notes.filter(n => n.text.toLowerCase().includes(query));
  }
  
  // Find all containers for this category (desktop + mobile)
  const containers = document.querySelectorAll(`.category-column[data-category="${categoryId}"] .notes-list`);
  const countBadges = document.querySelectorAll(`.category-column[data-category="${categoryId}"] .note-count`);
  
  // Update count badges
  const totalCount = storage.getNotesByCategory(categoryId).length;
  countBadges.forEach(badge => {
    badge.textContent = totalCount;
  });
  
  // Render notes
  const html = notes.length > 0 
    ? notes.map(note => renderNoteCard(note)).join('')
    : '<div class="empty-state">Nenhuma nota</div>';
  
  containers.forEach(container => {
    container.innerHTML = html;
  });
}

/**
 * Render a single note card
 */
function renderNoteCard(note) {
  const pinnedClass = note.pinned ? 'pinned' : '';
  const pinnedIcon = note.pinned ? '⭐' : '☆';
  const highlightedText = highlightSearch(escapeHtml(note.text));
  const dateStr = formatDate(note.updatedAt);
  
  return `
    <div class="note-card ${pinnedClass}" 
         data-note-id="${note.id}" 
         draggable="true"
         role="listitem"
         tabindex="0"
         aria-label="Nota: ${escapeHtml(note.text.substring(0, 50))}">
      <div class="note-text">${highlightedText}</div>
      <div class="note-meta">
        <span title="Atualizado em ${note.updatedAt}">${dateStr}</span>
        <div class="note-actions">
          <button class="btn btn-sm btn-outline-warning btn-pin ${note.pinned ? 'active' : ''}" 
                  onclick="window.mindDump.togglePin('${note.id}')"
                  aria-label="${note.pinned ? 'Desafixar' : 'Fixar'} nota"
                  title="${note.pinned ? 'Desafixar' : 'Fixar'}">
            ${pinnedIcon}
          </button>
          <button class="btn btn-sm btn-outline-primary" 
                  onclick="window.mindDump.editNote('${note.id}')"
                  aria-label="Editar nota"
                  title="Editar">
            ✏️
          </button>
          <div class="dropdown d-inline">
            <button class="btn btn-sm btn-outline-secondary dropdown-toggle" 
                    data-bs-toggle="dropdown"
                    aria-label="Mover nota para outra categoria"
                    title="Mover para...">
              📁
            </button>
            <ul class="dropdown-menu move-menu">
              ${CATEGORIES
                .filter(c => c.id !== note.category)
                .map(c => `
                  <li>
                    <a class="dropdown-item" href="#" 
                       onclick="event.preventDefault(); window.mindDump.moveNote('${note.id}', '${c.id}')">
                      ${c.name}
                    </a>
                  </li>
                `).join('')}
            </ul>
          </div>
          <button class="btn btn-sm btn-outline-danger" 
                  onclick="window.mindDump.confirmDelete('${note.id}')"
                  aria-label="Excluir nota"
                  title="Excluir">
            🗑️
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Edit a note (open modal)
 */
export function editNote(noteId) {
  const notes = storage.loadAll();
  const note = notes.find(n => n.id === noteId);
  
  if (note) {
    editingNoteId = noteId;
    editTextarea.value = note.text;
    editModal.show();
    editTextarea.focus();
  }
}

/**
 * Confirm delete (open modal)
 */
export function confirmDelete(noteId) {
  deleteNoteId = noteId;
  deleteModal.show();
}

/**
 * Toggle pin status
 */
export function togglePin(noteId) {
  storage.togglePinned(noteId);
  renderAllCategories();
}

/**
 * Move note to category
 */
export function moveNote(noteId, newCategory) {
  storage.moveNote(noteId, newCategory);
  renderAllCategories();
}

// Helper functions

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function highlightSearch(text) {
  if (!currentSearchQuery) return text;
  
  const regex = new RegExp(`(${escapeRegex(currentSearchQuery)})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatDate(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diff = now - date;
  
  // Less than 1 minute
  if (diff < 60000) return 'agora';
  
  // Less than 1 hour
  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return `${mins}min`;
  }
  
  // Less than 24 hours
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h`;
  }
  
  // Less than 7 days
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days}d`;
  }
  
  // Older - show date
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// Expose functions globally for onclick handlers
window.mindDump = {
  editNote,
  confirmDelete,
  togglePin,
  moveNote
};
