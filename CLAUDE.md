# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run dev                 # npx serve -> http://localhost:3000 (static server; no build step)
npm test                    # vitest run (jsdom, globals enabled)
npm run test:watch
npm run test:coverage       # v8; only src/main.js is excluded from coverage
npx vitest run tests/storage.test.js -t "mergeImport"   # single file / test name filter
```

There is no linter and no bundler. The app is plain ES modules served as-is. Bootstrap 5.3.2 is vendored in `vendor/bootstrap/` (no CDN, so the app works offline from the first load) and used as the global `bootstrap`.

## Architecture

Offline-first, localStorage-only notes PWA (UI text is in Portuguese). Modules under `src/`:

- `categories.js` — single source of truth for the six categories (`CATEGORIES`, `CATEGORY_IDS`).
- `storage.js` — the only code touching localStorage (key `mind-dump-notes`). Every operation does `loadAll()` → mutate → `saveAll()`; there is no in-memory state. Failures are reported through the handler set with `setErrorHandler` (the UI shows a toast). Unreadable stored JSON is copied to `mind-dump-notes.corrupt-<timestamp>` before the app starts empty.
- `render.js` — pure functions that build escaped HTML (`renderNoteCard`, `highlightHtml`, `escapeHtml`, `formatDate`). All escaping lives here; cards carry `data-action` / `data-note-id` attributes and **no inline handlers**.
- `ui.js` — DOM wiring. Clicks and drag & drop are delegated from `<main>`; categories are re-rendered by rewriting `innerHTML`, so use `rerender()` (it restores keyboard focus) rather than `renderAllCategories()` for user-triggered updates.
- `toast.js` — `showToast`; no dependency on Bootstrap's JS.
- `main.js` — entry point: calls `ui.init()`, registers the service worker and drives the update toast.

### Things that span multiple files

- **Duplicate layouts**: `index.html` renders every category twice — mobile tabs (`d-md-none`) and desktop Kanban (`d-none d-md-block`) — both as `.category-column[data-category="<id>"]`. `renderCategory` writes the same HTML into all matching containers.
- **Adding a category** touches `src/categories.js`, both columns in `index.html` (`tests/categories.test.js` fails if one is missing) and the color in `styles/app.css`.
- **Service worker cache**: `ASSETS_TO_CACHE` in `service-worker.js` is a hand-kept list; `tests/service-worker.test.js` fails if a file loaded by `index.html` or imported from `src/` is missing, or if anything references a third-party host. Still bump `CACHE_NAME` on every release that changes a cached file. Paths are relative so a sub-path deploy works. Updates are user-driven: the new SW waits until `main.js` posts `SKIP_WAITING`. The precache strips redirects (`cleanResponse`) because `serve` redirects `/index.html`, and a redirected response cannot answer a navigation.
- **Import**: `validateImport` is the trust boundary for backups (id must match `^[A-Za-z0-9_-]{1,64}$`, dates must parse, `pinned` must be boolean). `mergeImport` dedupes by `id` and keeps the newer `updatedAt`; the accepted formats are a bare array or `{version, exportedAt, notes}`.
- `updateNote` always bumps `updatedAt` (including pin toggles and category moves); notes sort pinned-first, then by `updatedAt` descending.
- **Tests under jsdom**: `new URL(..., import.meta.url)` is jsdom's class and `node:fs` rejects it, so build file paths with `fileURLToPath(import.meta.url)`. `tests/ui.test.js` loads the real `index.html` body with a fake `bootstrap.Modal`. In `tests/storage.test.js`, earlier tests leave the mocked `getItem` stuck on `mockReturnValue`, so new `describe` blocks use `resetMockStorage()`.
