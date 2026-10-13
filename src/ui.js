/**
 * Mind Dump - UI Module
 * Handles all DOM interactions, rendering, and events
 */

import * as storage from './storage.js';
import { CATEGORIES } from './categories.js';
import { renderNoteCard } from './render.js';
import { showToast } from './toast.js';

// State
let currentSearchQuery = '';
let editingNoteId = null;
let deleteNoteId = null;
let draggedNoteId = null;
let modalOpener = null;

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

  // Surface storage problems instead of failing silently
  storage.setErrorHandler((problem) => {
    showToast(storageProblemMessage(problem), { variant: 'danger', timeout: 10000 });
  });

  // Setup event listeners
  setupNoteInputs();
  setupSearch();
  setupModals();
  setupExportImport();
  setupNoteActions();
  setupDragAndDrop();

  // Another tab changed the notes (or cleared storage): refresh what we show
  window.addEventListener('storage', (e) => {
    if (e.key === null || e.key === storage.STORAGE_KEY) rerender();
  });

  // Initial render
  renderAllCategories();

  console.log('📝 UI initialized');
}

/** True only when storage is readable and really has no such note (e.g. deleted in another tab). */
function noteIsGone(noteId) {
  return storage.isReadable() && !storage.loadAll().some(n => n.id === noteId);
}

/** loadAll() only reports an unreadable store once, so a retried action explains itself here. */
function explainIfUnreadable() {
  if (!storage.isReadable()) {
    showToast('Não foi possível ler as notas guardadas, então a alteração não foi salva. O texto continua aberto.', {
      variant: 'danger'
    });
  }
}

function storageProblemMessage({ type, blocked, backedUp, blockedByBackup }) {
  if (type === 'save') {
    return blockedByBackup
      ? 'Não foi possível guardar uma cópia das notas ilegíveis. Para não apagá-las, novas notas não serão salvas até liberar espaço.'
      : 'Não foi possível salvar. O armazenamento do navegador pode estar cheio ou bloqueado: exporte um backup.';
  }
  if (blocked) {
    return 'Não foi possível acessar o armazenamento do navegador (ele pode estar bloqueado). Suas notas não serão salvas.';
  }
  return backedUp
    ? 'Não foi possível ler as notas salvas. Uma cópia do conteúdo foi mantida no armazenamento do navegador.'
    : 'Não foi possível ler as notas salvas nem guardar uma cópia. Para não apagá-las, novas notas não serão salvas até liberar espaço.';
}

/**
 * Setup note input fields (Enter to create)
 */
function setupNoteInputs() {
  document.querySelectorAll('.note-input').forEach(input => {
    input.addEventListener('keydown', (e) => {
      // Enter (without Shift) creates the note. keyCode 229 is how Safari reports the Enter
      // that commits an IME composition (isComposing is already false by then).
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
        e.preventDefault();
        const category = input.closest('.category-column').dataset.category;
        const text = input.value.trim();

        if (text) {
          // Only clear the field once the note is really stored
          if (storage.createNote(text, category)) {
            input.value = '';
            renderCategory(category);
          }
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
      currentSearchQuery = e.target.value.trim();
      rerender();
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
      if (storage.updateNote(editingNoteId, { text: editTextarea.value.trim() })) {
        editModal.hide();
        rerender();
      } else if (noteIsGone(editingNoteId)) {
        // Deleted in another tab. A failed save keeps the modal open instead, so the text is not lost.
        showToast('Esta nota não existe mais: ela foi removida em outra aba.', { variant: 'warning' });
        editModal.hide();
        rerender();
      } else {
        explainIfUnreadable();
      }
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
      if (storage.deleteNote(deleteNoteId) || noteIsGone(deleteNoteId)) {
        deleteModal.hide();
        rerender();
      } else {
        // The save failed: keep the modal so the user can retry or cancel (the storage toast says why)
        explainIfUnreadable();
      }
    }
  });

  // Focus the textarea only once the modal is visible, and give focus back when it closes
  const editEl = document.getElementById('edit-modal');
  editEl.addEventListener('shown.bs.modal', () => editTextarea.focus());
  editEl.addEventListener('hidden.bs.modal', () => restoreFocus(modalOpener));
  document.getElementById('delete-modal').addEventListener('hidden.bs.modal', () => restoreFocus(modalOpener));
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
        showToast(`Importação concluída: ${result.imported} adicionadas, ${result.updated} atualizadas.`, { variant: 'success' });
        rerender();
      } else {
        showToast(`Erro na importação: ${result.error}`, { variant: 'danger' });
      }
    } catch (error) {
      showToast('Erro ao ler arquivo: ' + error.message, { variant: 'danger' });
    }

    // Reset file input
    e.target.value = '';
  });
}

/**
 * Delegated clicks for note actions. Cards are rebuilt on every render, so
 * listening on <main> (instead of inline handlers) keeps ids out of JS strings.
 */
function setupNoteActions() {
  document.querySelector('main').addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-action]');
    const card = trigger && trigger.closest('.note-card');
    if (!trigger || !card) return;

    const noteId = card.dataset.noteId;
    switch (trigger.dataset.action) {
      case 'pin':
        togglePin(noteId);
        break;
      case 'edit':
        editNote(noteId);
        break;
      case 'delete':
        confirmDelete(noteId);
        break;
      case 'move':
        e.preventDefault();
        moveNote(noteId, trigger.dataset.category);
        break;
    }
  });
}

/**
 * Setup drag and drop (delegated on <main>)
 */
function setupDragAndDrop() {
  const root = document.querySelector('main');

  root.addEventListener('dragstart', (e) => {
    const noteCard = e.target.closest('.note-card');
    if (noteCard) {
      draggedNoteId = noteCard.dataset.noteId;
      noteCard.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggedNoteId);
    }
  });

  root.addEventListener('dragend', (e) => {
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

  root.addEventListener('dragover', (e) => {
    const column = e.target.closest('.category-column');
    if (column && draggedNoteId) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      column.classList.add('drop-target');
    }
  });

  root.addEventListener('dragleave', (e) => {
    const column = e.target.closest('.category-column');
    if (column) {
      // Check if we're leaving to a child element
      const relatedTarget = e.relatedTarget;
      if (!column.contains(relatedTarget)) {
        column.classList.remove('drop-target');
      }
    }
  });

  root.addEventListener('drop', (e) => {
    const column = e.target.closest('.category-column');
    if (column && draggedNoteId) {
      e.preventDefault();

      const newCategory = column.dataset.category;
      const note = storage.loadAll().find(n => n.id === draggedNoteId);

      if (note && note.category !== newCategory) {
        storage.moveNote(draggedNoteId, newCategory);
        rerender();
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
 * Render a single category's notes (desktop + mobile copies)
 */
export function renderCategory(categoryId) {
  const allNotes = storage.getNotesByCategory(categoryId);
  const query = currentSearchQuery.toLowerCase();
  const notes = query
    ? allNotes.filter(n => n.text.toLowerCase().includes(query))
    : allNotes;

  const selector = `.category-column[data-category="${categoryId}"]`;

  // Badges always show the category total, not the filtered count
  document.querySelectorAll(`${selector} .note-count`).forEach(badge => {
    badge.textContent = allNotes.length;
  });

  const html = notes.length > 0
    ? notes.map(note => renderNoteCard(note, CATEGORIES, currentSearchQuery)).join('')
    : '<div class="empty-state">Nenhuma nota</div>';

  document.querySelectorAll(`${selector} .notes-list`).forEach(container => {
    container.innerHTML = html;
  });
}

/**
 * Edit a note (open modal)
 */
export function editNote(noteId) {
  const note = storage.loadAll().find(n => n.id === noteId);

  if (note) {
    editingNoteId = noteId;
    editTextarea.value = note.text;
    modalOpener = captureFocus();
    editModal.show();
  }
}

/**
 * Confirm delete (open modal)
 */
export function confirmDelete(noteId) {
  deleteNoteId = noteId;
  modalOpener = captureFocus();
  deleteModal.show();
}

/**
 * Toggle pin status
 */
export function togglePin(noteId) {
  storage.togglePinned(noteId);
  rerender();
}

/**
 * Move note to category
 */
export function moveNote(noteId, newCategory) {
  storage.moveNote(noteId, newCategory);
  rerender();
}

/**
 * Remember which note action had keyboard focus. Cards are rebuilt via
 * innerHTML, so without this the focus would drop to <body> after every action.
 */
function captureFocus() {
  const active = document.activeElement;
  const card = active && active.closest ? active.closest('.note-card') : null;
  if (!card) return null;
  return {
    column: card.closest('.category-column'),
    noteId: card.dataset.noteId,
    action: active.dataset.action || null
  };
}

function restoreFocus(saved) {
  if (!saved || !saved.column) return;
  const card = [...saved.column.querySelectorAll('.note-card')]
    .find(c => c.dataset.noteId === saved.noteId);
  const target = (card && saved.action && card.querySelector(`[data-action="${saved.action}"]`))
    || card
    || saved.column.querySelector('.note-input');
  if (target) target.focus();
}

function rerender() {
  const saved = captureFocus();
  renderAllCategories();
  restoreFocus(saved);
}
