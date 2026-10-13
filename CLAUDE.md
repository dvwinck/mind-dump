# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run dev                 # npx serve -> http://localhost:3000 (static server; no build step)
npm test                    # vitest run (jsdom, globals enabled)
npm run test:watch
npm run test:coverage       # v8; src/ui.js and src/main.js are excluded from coverage
npx vitest run tests/storage.test.js -t "mergeImport"   # single file / test name filter
```

There is no linter and no bundler. The app is plain ES modules served as-is; Bootstrap 5.3.2 comes from a CDN and is used as the global `bootstrap` (not imported).

## Architecture

Offline-first, localStorage-only notes PWA (UI text is in Portuguese). Three modules under `src/`:

- `storage.js` — the only code touching localStorage (key `mind-dump-notes`). Every operation does a full `loadAll()` → mutate → `saveAll()` round trip; there is no in-memory state. Pure of DOM, which is why it's the only unit-tested module (`tests/storage.test.js` mocks `localStorage`).
- `ui.js` — all DOM work: event wiring, rendering, drag & drop, modals, export/import. Re-renders by rewriting `innerHTML` of category lists. `renderNoteCard` builds HTML strings, so user text must go through `escapeHtml` (and `highlightSearch` for search).
- `main.js` — entry point: exports `CATEGORIES`, calls `ui.init()` on `DOMContentLoaded`, registers the service worker. Note the circular import: `ui.js` imports `CATEGORIES` from `main.js`.

### Things that span multiple files

- **Duplicate layouts**: `index.html` renders every category twice — a mobile tab layout (`d-md-none`) and a desktop Kanban (`d-none d-md-block`) — both as `.category-column[data-category="<id>"]`. `renderCategory` queries by that selector and writes the same HTML into all matching containers, so new markup/selectors must work in both copies.
- **Category list is defined in four places** and must be kept in sync: `CATEGORIES` in `src/main.js`, `validCategories` in `src/storage.js` (`validateImport`), the HTML columns in `index.html` (desktop and mobile), and per-category colors in `styles/app.css`.
- **Service worker cache**: `service-worker.js` has a hard-coded `ASSETS_TO_CACHE` list (and CDN list) and cache-first fetching. When adding/renaming/removing a file under `src/`, `styles/` or `icons/`, update that list and bump `CACHE_NAME` (currently `mind-dump-v2`), otherwise returning users keep stale assets. Paths are absolute (`/src/...`, `/service-worker.js`), so the app must be served from the origin root.
- **Import merge semantics**: `mergeImport` dedupes by `id` and keeps the note with the newer `updatedAt`; `validateImport` accepts either a bare array or `{version, exportedAt, notes}` (the export format).
- `updateNote` always bumps `updatedAt` (this includes pin toggles and category moves), and notes sort pinned-first then by `updatedAt` descending.
