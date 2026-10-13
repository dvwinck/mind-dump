/**
 * Mind Dump - Render helpers
 * Pure functions that turn notes into HTML strings. Every dynamic value is
 * escaped here, so callers may assign the result to innerHTML.
 */

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Escape `text` and wrap case-insensitive matches of `query` in <mark>.
 * Splits the RAW text first, so matches can never land inside an HTML entity.
 */
export function highlightHtml(text, query) {
  if (!query) return escapeHtml(text);
  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, 'i'));
  return parts
    .map((part, i) => (i % 2 === 1 ? `<mark>${escapeHtml(part)}</mark>` : escapeHtml(part)))
    .join('');
}

export function formatDate(isoString, now = new Date()) {
  const date = new Date(isoString);
  const diff = now - date;

  if (diff < 60000) return 'agora';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}min`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`;

  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function renderNoteCard(note, categories, query = '', now = new Date()) {
  const pinned = Boolean(note.pinned);
  const pinLabel = pinned ? 'Desafixar' : 'Fixar';

  const moveItems = categories
    .filter((c) => c.id !== note.category)
    .map(
      (c) => `
              <li>
                <a class="dropdown-item" href="#" data-action="move" data-category="${escapeHtml(c.id)}">${escapeHtml(c.name)}</a>
              </li>`
    )
    .join('');

  return `
    <div class="note-card ${pinned ? 'pinned' : ''}"
         data-note-id="${escapeHtml(note.id)}"
         draggable="true"
         role="listitem"
         tabindex="0"
         aria-label="Nota: ${escapeHtml(note.text.substring(0, 50))}">
      <div class="note-text">${highlightHtml(note.text, query)}</div>
      <div class="note-meta">
        <span title="Atualizado em ${escapeHtml(note.updatedAt)}">${formatDate(note.updatedAt, now)}</span>
        <div class="note-actions">
          <button class="btn btn-sm btn-outline-warning btn-pin ${pinned ? 'active' : ''}"
                  data-action="pin"
                  aria-label="${pinLabel} nota"
                  title="${pinLabel}">${pinned ? '⭐' : '☆'}</button>
          <button class="btn btn-sm btn-outline-primary"
                  data-action="edit"
                  aria-label="Editar nota"
                  title="Editar">✏️</button>
          <div class="dropdown d-inline">
            <button class="btn btn-sm btn-outline-secondary dropdown-toggle"
                    data-bs-toggle="dropdown"
                    aria-label="Mover nota para outra categoria"
                    title="Mover para...">📁</button>
            <ul class="dropdown-menu move-menu">${moveItems}
            </ul>
          </div>
          <button class="btn btn-sm btn-outline-danger"
                  data-action="delete"
                  aria-label="Excluir nota"
                  title="Excluir">🗑️</button>
        </div>
      </div>
    </div>
  `;
}
