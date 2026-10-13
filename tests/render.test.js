import { describe, it, expect } from 'vitest';
import { escapeHtml, highlightHtml, formatDate, renderNoteCard } from '../src/render.js';
import { CATEGORIES } from '../src/categories.js';

const ISO = '2026-01-01T00:00:00.000Z';
const note = (over = {}) => ({
  id: 'n1', text: 'hello', category: 'tasks', pinned: false, createdAt: ISO, updatedAt: ISO, ...over
});
const mount = (html) => {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
};
const hasInlineHandler = (root) =>
  [...root.querySelectorAll('*')].some((el) => [...el.attributes].some((a) => a.name.startsWith('on')));

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<b>&"'`)).toBe('&lt;b&gt;&amp;&quot;&#39;');
  });
});

describe('highlightHtml', () => {
  it('returns escaped text when there is no query', () => {
    expect(highlightHtml('a < b', '')).toBe('a &lt; b');
  });

  it('marks matches case-insensitively and keeps original casing', () => {
    expect(highlightHtml('Hello hello', 'HELLO')).toBe('<mark>Hello</mark> <mark>hello</mark>');
  });

  it('does not corrupt entities when the query looks like an entity name', () => {
    expect(highlightHtml('a & b', 'amp')).toBe('a &amp; b');
    expect(highlightHtml('1 < 2', 'lt')).toBe('1 &lt; 2');
  });

  it('highlights characters that need escaping', () => {
    expect(highlightHtml('1 < 2', '<')).toBe('1 <mark>&lt;</mark> 2');
    expect(highlightHtml('a & b', '&')).toBe('a <mark>&amp;</mark> b');
  });

  it('treats regex metacharacters literally', () => {
    expect(highlightHtml('a.b', '.')).toBe('a<mark>.</mark>b');
    expect(highlightHtml('axb', '.')).toBe('axb');
    expect(highlightHtml('(x)', '(')).toBe('<mark>(</mark>x)');
  });
});

describe('formatDate', () => {
  const now = new Date('2026-06-15T12:00:00Z');
  it('formats relative times', () => {
    expect(formatDate('2026-06-15T11:59:50Z', now)).toBe('agora');
    expect(formatDate('2026-06-15T11:55:00Z', now)).toBe('5min');
    expect(formatDate('2026-06-15T09:00:00Z', now)).toBe('3h');
    expect(formatDate('2026-06-13T12:00:00Z', now)).toBe('2d');
  });
  it('shows dd/mm for older dates', () => {
    expect(formatDate('2026-01-02T12:00:00Z', now)).toBe('02/01');
  });
  it('switches unit exactly at each threshold', () => {
    const at = (ms) => formatDate(new Date(now.getTime() - ms).toISOString(), now);
    expect(at(59999)).toBe('agora');
    expect(at(60000)).toBe('1min');
    expect(at(3599999)).toBe('59min');
    expect(at(3600000)).toBe('1h');
    expect(at(86399999)).toBe('23h');
    expect(at(86400000)).toBe('1d');
    expect(at(604799999)).toBe('6d');
    expect(at(604800000)).toMatch(/^\d{2}\/\d{2}$/);
  });
});

describe('renderNoteCard', () => {
  it('has no inline event handlers', () => {
    expect(hasInlineHandler(mount(renderNoteCard(note(), CATEGORIES)))).toBe(false);
  });

  it('keeps a hostile id inside the data attribute', () => {
    const hostile = `x" onmouseover="alert(1)`;
    const root = mount(renderNoteCard(note({ id: hostile }), CATEGORIES));
    expect(root.querySelector('.note-card').dataset.noteId).toBe(hostile);
    expect(hasInlineHandler(root)).toBe(false);
  });

  it('escapes note text and the updatedAt tooltip', () => {
    const root = mount(
      renderNoteCard(note({ text: '<img src=x onerror=alert(1)>', updatedAt: '"><img src=x>' }), CATEGORIES)
    );
    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelector('.note-text').textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('highlights the search query inside the card', () => {
    const root = mount(renderNoteCard(note({ text: 'apple pie' }), CATEGORIES, 'APP'));
    expect(root.querySelector('mark').textContent).toBe('app');
  });

  it('offers every other category in the move menu', () => {
    const root = mount(renderNoteCard(note(), CATEGORIES));
    const targets = [...root.querySelectorAll('[data-action="move"]')].map((el) => el.dataset.category);
    expect(targets).toEqual(CATEGORIES.map((c) => c.id).filter((id) => id !== 'tasks'));
  });

  it('exposes pin/edit/delete actions and reflects the pinned state', () => {
    const root = mount(renderNoteCard(note({ pinned: true }), CATEGORIES));
    expect(root.querySelector('[data-action="pin"]').getAttribute('aria-label')).toBe('Desafixar nota');
    expect(root.querySelector('[data-action="edit"]')).not.toBeNull();
    expect(root.querySelector('[data-action="delete"]')).not.toBeNull();
    expect(root.querySelector('.note-card').classList.contains('pinned')).toBe(true);
  });

  it('keeps quotes in the text from breaking out of the aria-label', () => {
    const root = mount(renderNoteCard(note({ text: '" onfocus="alert(1)' }), CATEGORIES));
    expect(hasInlineHandler(root)).toBe(false);
    expect(root.querySelector('.note-card').getAttribute('aria-label')).toBe('Nota: " onfocus="alert(1)');
  });

  it('shows the unpinned state', () => {
    const root = mount(renderNoteCard(note({ pinned: false }), CATEGORIES));
    const pin = root.querySelector('[data-action="pin"]');
    expect(pin.getAttribute('aria-label')).toBe('Fixar nota');
    expect(pin.textContent.trim()).toBe('☆');
    expect(root.querySelector('.note-card').classList.contains('pinned')).toBe(false);
  });
});
