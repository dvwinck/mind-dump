# Mind Dump Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir os bugs de segurança, perda de dados e offline encontrados na análise do projeto, e remover as fontes de divergência (lista de categorias, lista de cache da SW) que os causaram.

**Architecture:** Mantém o app como ES modules estáticos, sem build. Extrai `categories.js` (fonte única das categorias), `render.js` (funções puras que geram HTML já escapado) e `toast.js`. `ui.js` passa a usar delegação de eventos a partir de `<main>` em vez de `onclick` inline, o que elimina o XSS por `id` importado e deixa a UI testável com jsdom. A `storage.js` ganha validação de import mais rígida e detecção de falhas de leitura/gravação. O Bootstrap passa a ser servido localmente e a service worker ganha um teste-guarda para a lista de assets.

**Tech Stack:** HTML/CSS/JS (ES modules), Bootstrap 5.3.2 (vendorizado na Task 9), Vitest 1.x + jsdom.

**Spec:** não há documento de spec. A base é a análise do projeto feita nesta sessão (resumida em "Achados cobertos" e "Fora de escopo" abaixo).

## Global Constraints

- Sem build step nem bundler: o app é servido como arquivos estáticos (`npm run dev` = `npx serve`). Node só é usado para os testes.
- Não mudar a chave do localStorage (`mind-dump-notes`) nem o formato da nota `{ id, text, category, pinned, createdAt, updatedAt }`: dados de usuários existentes devem continuar carregando sem migração.
- O formato de exportação continua `{ "version": 1, "exportedAt": <ISO>, "notes": [...] }`.
- Todo texto de interface em pt-BR.
- Texto de nota nunca entra em `innerHTML` sem passar por `escapeHtml` (Task 4).
- Testes: `npm test` (tudo) ou `npx vitest run tests/<arquivo>.test.js` (um arquivo).
- Git: o repo só tem `main` (confirmar na Task 0 que não existe `base`). Branch `improve/hardening` a partir de `main`, merge local no fim, **sem push e sem PR**.
- Todo commit termina com estas duas linhas de trailer (use exatamente o comando dos steps de commit):
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` e `Claude-Session: https://claude.ai/code/session_01CMqzDWSDWW6DowMmVxfABw`.

## Review Focus

Entradas/condições que o projeto atual não cobre e que mais provavelmente quebram para quem usa (mais provável primeiro). Cada linha tem o teste que a fixa na task dona do código.

1. **Backup JSON com `id` hostil** (`x');alert(1);//`, aspas, `<`): deve ser rejeitado na importação com mensagem de erro, sem gravar nada, e nunca virar atributo executável. Testes: Task 2 (`validateImport`) e Task 4 (`renderNoteCard`).
2. **Busca por `&`, `<`, `amp`, `lt`, `.`** em notas com esses caracteres: o texto deve aparecer intacto, com o trecho destacado. Teste: Task 4 (`highlightHtml`) e Task 5 (busca na UI).
3. **localStorage com JSON corrompido na abertura**: o app abre vazio, **guarda uma cópia** do conteúdo ilegível e avisa o usuário; a próxima gravação não destrói a única cópia. Testes: Task 3 e Task 7.
4. **Gravação falha (cota cheia / storage bloqueado)**: o usuário vê um aviso em vez de achar que salvou. Testes: Task 3 e Task 7.
5. **Enter durante composição de IME** (acentos por dead keys, teclados CJK): não pode criar a nota pela metade. Teste: Task 6.

## Achados cobertos

| Achado da análise | Task |
|---|---|
| Lista de categorias em 4 lugares / import circular `main`↔`ui` | 1 |
| `validateImport` frouxo (ids, datas, `pinned`, texto em branco) | 2 |
| Perda silenciosa de dados em `loadAll`/`saveAll` | 3 |
| Highlight de busca corrompe entidades HTML; XSS via `id` em `onclick`/`title` | 4, 5 |
| `renderCategory` carrega e ordena as notas duas vezes; `ui.js` fora da cobertura | 5 |
| Foco perdido após re-render; `focus()` antes do modal abrir; Enter com IME | 6 |
| `alert()`/`confirm()` | 7 |
| Sem sync entre abas | 8 |
| Offline quebra se o CDN falhar; SW sem `.catch`; fluxo de update; caminhos absolutos | 9 |
| README/CLAUDE.md desatualizados | 10 |

## Fora de escopo (decisão consciente)

- Ícone `maskable` separado com margem de segurança: precisa de arte nova; fica como follow-up.
- Upgrade do Vitest, lint/formatação e CI: mudanças independentes, merecem plano próprio.
- Ordenação manual das notas, desfazer exclusão, atualização automática das datas relativas: features novas, não correções.
- Gerar as 12 colunas do `index.html` a partir de `CATEGORIES`: o teste da Task 1 já impede divergência, então o custo/benefício não compensa agora.
- Cache em memória do storage: com o ajuste da Task 5 o custo de render é baixo para o tamanho esperado de dados.

## File Structure

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/categories.js` | criar | `CATEGORIES` e `CATEGORY_IDS`, fonte única |
| `src/render.js` | criar | HTML puro e escapado: `escapeHtml`, `highlightHtml`, `formatDate`, `renderNoteCard` |
| `src/toast.js` | criar | `showToast(message, options)` sem depender do JS do Bootstrap |
| `src/storage.js` | modificar | validação de import, backup de dado ilegível, `setErrorHandler`, `STORAGE_KEY` exportado |
| `src/ui.js` | modificar | delegação de eventos, preservar foco, toasts, sync entre abas |
| `src/main.js` | modificar | importa categorias, `persist()`, fluxo de atualização da SW |
| `index.html` | modificar | container de toasts, Bootstrap local |
| `service-worker.js` | modificar | assets relativos + vendor, sem CDN, precache limpo, update por mensagem |
| `manifest.json` | modificar | `id`, `scope`, `start_url` relativos |
| `vendor/bootstrap/*` | criar | Bootstrap 5.3.2 local (css + bundle js) |
| `vitest.config.js` | modificar | `ui.js` passa a entrar na cobertura |
| `tests/categories.test.js`, `render.test.js`, `ui.test.js`, `toast.test.js`, `service-worker.test.js` | criar | ver tasks |
| `tests/storage.test.js` | modificar | novos `describe` ao final |
| `README.md`, `CLAUDE.md` | modificar | refletir a nova estrutura |

---

### Task 0: Preparar branch e baseline

**Files:** nenhum.

- [ ] **Step 1: Confirmar que não existe `base` e criar a branch**

```bash
cd /Users/diogo/projects/mind-dump
git branch --list base      # esperado: saída vazia (se aparecer `base`, use `base` no lugar de `main` neste plano)
git remote -v               # se listar `origin`, rode: git pull --ff-only
git switch -c improve/hardening main
```

- [ ] **Step 2: Instalar dependências e registrar o baseline**

```bash
npm install
npm test
```

Expected: todos os testes passam. Anote o número de testes (o README diz 39; ele será corrigido na Task 10).

---

### Task 1: `categories.js` como fonte única

**Files:**
- Create: `src/categories.js`
- Create: `tests/categories.test.js`
- Modify: `src/main.js` (remove a constante, importa de `categories.js`)
- Modify: `src/ui.js:7` (import)
- Modify: `src/storage.js` (`validCategories` passa a vir de `CATEGORY_IDS`)

**Interfaces:**
- Produces: `CATEGORIES: Array<{ id: string, name: string }>` e `CATEGORY_IDS: string[]` (mesma ordem), exportados por `src/categories.js`.

- [ ] **Step 1: Escrever o teste que falha**

`tests/categories.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CATEGORIES, CATEGORY_IDS } from '../src/categories.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('categories', () => {
  it('exposes ids in display order', () => {
    expect(CATEGORY_IDS).toEqual(['unclear', 'feelings', 'projects', 'desires', 'tasks', 'not-do']);
    expect(CATEGORIES.map((c) => c.id)).toEqual(CATEGORY_IDS);
  });

  it('index.html has exactly one mobile and one desktop column per category', () => {
    for (const id of CATEGORY_IDS) {
      const count = html.split(`data-category="${id}"`).length - 1;
      expect(count, id).toBe(2);
    }
  });

  it('index.html has no column for an unknown category', () => {
    const ids = [...html.matchAll(/class="category-column[^"]*" data-category="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(CATEGORY_IDS.length * 2);
    expect(ids.every((id) => CATEGORY_IDS.includes(id))).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/categories.test.js`
Expected: FAIL (`Failed to resolve import "../src/categories.js"`).

- [ ] **Step 3: Criar `src/categories.js`**

```js
/**
 * Mind Dump - Categories
 * Single source of truth for the note categories.
 * Adding one also needs: two columns in index.html (mobile + desktop)
 * and a color in styles/app.css (tests/categories.test.js guards the HTML part).
 */

export const CATEGORIES = [
  { id: 'unclear', name: 'Demandas com pouca clareza' },
  { id: 'feelings', name: 'Sentimentos' },
  { id: 'projects', name: 'Projetos' },
  { id: 'desires', name: 'Desejos' },
  { id: 'tasks', name: 'Tarefas' },
  { id: 'not-do', name: 'Não fazer' }
];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
```

- [ ] **Step 4: Ligar os consumidores**

Em `src/main.js`, remover o bloco de `// Categories configuration` até o `];` que fecha `CATEGORIES`, e trocar o início do arquivo por:

```js
import * as ui from './ui.js';
import { CATEGORIES } from './categories.js';
```

Em `src/ui.js`, linha 7: `import { CATEGORIES } from './categories.js';`

Em `src/storage.js`: adicionar no topo `import { CATEGORY_IDS } from './categories.js';`, apagar a linha `const validCategories = [...]` dentro de `validateImport` e trocar `validCategories.includes(note.category)` por `CATEGORY_IDS.includes(note.category)`.

- [ ] **Step 5: Teste de regressão em `tests/storage.test.js`** (ao final do arquivo)

```js
describe('validateImport categories', () => {
  it.each(['unclear', 'feelings', 'projects', 'desires', 'tasks', 'not-do'])('accepts %s', (category) => {
    expect(storage.validateImport([{ id: 'a1', text: 'x', category }]).valid).toBe(true);
  });

  it('rejects an unknown category', () => {
    expect(storage.validateImport([{ id: 'a1', text: 'x', category: 'nope' }]).valid).toBe(false);
  });
});
```

- [ ] **Step 6: Rodar tudo**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/categories.js src/main.js src/ui.js src/storage.js tests/categories.test.js tests/storage.test.js
git commit -m "refactor: single source of truth for categories" -m $'Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_01CMqzDWSDWW6DowMmVxfABw'
```

---

### Task 2: Endurecer `validateImport`

**Files:**
- Modify: `src/storage.js` (`generateId`, `validateImport`)
- Test: `tests/storage.test.js`

**Interfaces:**
- Consumes: `CATEGORY_IDS` (Task 1).
- Produces: `validateImport(data)` continua retornando `{ valid, notes?, error? }`, agora rejeitando: nota não-objeto; `id` fora de `/^[A-Za-z0-9_-]{1,64}$/`; `text` vazio ou só espaços; `pinned` presente e não booleano; `createdAt`/`updatedAt` presentes e que não são string de data parseável.

- [ ] **Step 1: Escrever os testes que falham** (ao final de `tests/storage.test.js`)

```js
describe('validateImport hardening', () => {
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/storage.test.js -t "validateImport hardening"`
Expected: FAIL nos testes de id, texto em branco, `pinned`, datas e não-objeto.

- [ ] **Step 3: Implementar**

Em `src/storage.js`, acima de `validateImport`:

```js
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function isValidDate(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}
```

Trocar o corpo do `for (const note of notes)` de `validateImport` por:

```js
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
```

Em `generateId`, trocar `substr(2, 9)` por `slice(2, 11)` (`substr` está depreciado; mesmo resultado).

- [ ] **Step 4: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS. Se algum teste antigo usar um `id`/data que a regra nova rejeita, corrija o fixture, não a regra (a menos que o fixture represente um formato legítimo de backup antigo; nesse caso pare e pergunte).

- [ ] **Step 5: Commit**

```bash
git add src/storage.js tests/storage.test.js
git commit -m "fix: reject unsafe or malformed notes on import" -m $'Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_01CMqzDWSDWW6DowMmVxfABw'
```

---

### Task 3: Storage que não perde dados em silêncio

**Files:**
- Modify: `src/storage.js` (`STORAGE_KEY`, `loadAll`, `saveAll`, novo `setErrorHandler`)
- Modify: `src/main.js` (pedido de storage persistente)
- Test: `tests/storage.test.js`

**Interfaces:**
- Produces:
  - `export const STORAGE_KEY = 'mind-dump-notes'`
  - `setErrorHandler(fn | null)`: `fn({ type: 'load' | 'save', error })` é chamada em falhas.
  - `saveAll(notes): boolean`: `true` se gravou, `false` se falhou (nunca lança).
  - `loadAll()`: se o conteúdo guardado não for JSON de array, copia o texto bruto para a chave `mind-dump-notes.corrupt-<Date.now()>` (uma vez por valor ilegível) e retorna `[]`.

- [ ] **Step 1: Escrever os testes que falham** (ao final de `tests/storage.test.js`)

```js
describe('storage durability', () => {
  // Each test uses a different unreadable string: loadAll reports/backs up once per distinct value.
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/storage.test.js -t "storage durability"`
Expected: FAIL (`setErrorHandler is not a function`, etc.).

- [ ] **Step 3: Implementar em `src/storage.js`**

Substituir `const STORAGE_KEY = 'mind-dump-notes';`, `loadAll` e `saveAll` por:

```js
export const STORAGE_KEY = 'mind-dump-notes';

let errorHandler = null;
let reportedUnreadable = null;

/**
 * Register a callback for storage problems: fn({ type: 'load' | 'save', error }).
 */
export function setErrorHandler(fn) {
  errorHandler = fn;
}

function reportError(type, error) {
  console.error(`Storage ${type} error:`, error);
  if (errorHandler) errorHandler({ type, error });
}

function backupUnreadable(raw) {
  try {
    localStorage.setItem(`${STORAGE_KEY}.corrupt-${Date.now()}`, raw);
  } catch (error) {
    console.error('Could not back up unreadable notes:', error);
  }
}
```

```js
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
    if (raw === null || raw !== reportedUnreadable) {
      reportedUnreadable = raw;
      if (raw) backupUnreadable(raw);
      reportError('load', error);
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    reportedUnreadable = null;
    return true;
  } catch (error) {
    reportError('save', error);
    return false;
  }
}
```

- [ ] **Step 4: Pedir storage persistente em `src/main.js`**

Dentro do callback de `DOMContentLoaded`, antes de `ui.init();`, adicionar:

```js
  // Ask the browser not to evict our data under storage pressure (best effort, may be a no-op)
  navigator.storage?.persist?.();
```

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS. Se um teste antigo esperava um comportamento diferente de `loadAll` com JSON inválido além de "retorna `[]`", ajuste o teste antigo mantendo a asserção do retorno.

- [ ] **Step 6: Commit**

```bash
git add src/storage.js src/main.js tests/storage.test.js
git commit -m "fix: back up unreadable notes and surface save failures" -m $'Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_01CMqzDWSDWW6DowMmVxfABw'
```

---

### Task 4: `render.js` com HTML sempre escapado

**Files:**
- Create: `src/render.js`
- Create: `tests/render.test.js`

**Interfaces:**
- Consumes: `CATEGORIES` (Task 1), passado como parâmetro.
- Produces (todas puras, exportadas de `src/render.js`):
  - `escapeHtml(value: any): string`
  - `highlightHtml(text: string, query: string): string` (texto já escapado; trechos que casam com `query`, sem diferenciar maiúsculas, vão em `<mark>`)
  - `formatDate(isoString: string, now?: Date): string`
  - `renderNoteCard(note, categories, query?: string, now?: Date): string`: HTML do card, **sem** atributos `on*`; ações via `data-action="pin|edit|delete|move"`; itens de mover têm `data-category`; o `id` da nota fica em `data-note-id` no `.note-card`.

- [ ] **Step 1: Escrever os testes que falham**

`tests/render.test.js`:

```js
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
    expect(formatDate('2026-01-02T12:00:00Z', now)).toMatch(/^\d{2}\/\d{2}$/);
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
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/render.test.js`
Expected: FAIL (`Failed to resolve import "../src/render.js"`).

- [ ] **Step 3: Criar `src/render.js`**

```js
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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/render.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/render.js tests/render.test.js
git commit -m "feat: add escaped, handler-free note rendering" -m $'Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_01CMqzDWSDWW6DowMmVxfABw'
```

---

### Task 5: `ui.js` com delegação de eventos e testes de UI

**Files:**
- Modify (reescrever): `src/ui.js`
- Create: `tests/ui.test.js`
- Modify: `vitest.config.js` (tirar `src/ui.js` do `exclude` da cobertura)

**Interfaces:**
- Consumes: `renderNoteCard(note, categories, query)` (Task 4), `CATEGORIES` (Task 1), `storage.*`.
- Produces: `ui.js` continua exportando `init`, `renderAllCategories`, `renderCategory`, `editNote`, `confirmDelete`, `togglePin`, `moveNote`. **Remove** `window.mindDump`. Os listeners de clique e de drag & drop ficam em `document.querySelector('main')` (não em `document`), o que mantém o teste isolado.

- [ ] **Step 1: Escrever os testes que falham**

`tests/ui.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
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
    storage.createNote('R&D <plan>', 'tasks');
    ui.renderAllCategories();

    const search = document.getElementById('search-input');
    search.value = 'amp';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(200);

    const text = document.querySelector('.category-column[data-category="tasks"] .note-text');
    expect(text.textContent).toBe('R&D <plan>');
    expect(text.querySelector('mark')).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/ui.test.js`
Expected: FAIL (os cliques em `[data-action=...]` não encontram elementos, pois o `ui.js` atual ainda gera `onclick`; o teste do `window.mindDump` também falha).

- [ ] **Step 3: Reescrever `src/ui.js`**

```js
/**
 * Mind Dump - UI Module
 * Handles all DOM interactions, rendering, and events
 */

import * as storage from './storage.js';
import { CATEGORIES } from './categories.js';
import { renderNoteCard } from './render.js';

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
  setupNoteActions();
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
      // Enter (without Shift) creates the note
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
      currentSearchQuery = e.target.value.trim();
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
 * Delegated clicks for note actions. Cards are rebuilt on every render, so
 * listening on <main> (instead of per-button onclick) keeps ids out of JS strings.
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
```

- [ ] **Step 4: Tirar `ui.js` da exclusão de cobertura**

Em `vitest.config.js`, trocar `exclude: ['src/ui.js', 'src/main.js']` por `exclude: ['src/main.js']`.

- [ ] **Step 5: Rodar tudo e confirmar que não sobrou referência ao global**

```bash
npm test
grep -rn "mindDump\|onclick" src index.html
```

Expected: testes PASS; o `grep` não imprime nada.

- [ ] **Step 6: Commit**

```bash
git add src/ui.js tests/ui.test.js vitest.config.js
git commit -m "refactor: delegate note actions and render through render.js" -m $'Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_01CMqzDWSDWW6DowMmVxfABw'
```

---

### Task 6: Foco do teclado e Enter com IME

**Files:**
- Modify: `src/ui.js`
- Test: `tests/ui.test.js`

**Interfaces:**
- Consumes: `ui.js` da Task 5.
- Produces (internas ao módulo): `captureFocus(): { column, noteId, action } | null`, `restoreFocus(saved)`, `rerender()`. `togglePin` e `moveNote` passam a chamar `rerender()`.

- [ ] **Step 1: Escrever os testes que falham** (ao final de `tests/ui.test.js`)

```js
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/ui.test.js -t "keyboard behavior"`
Expected: FAIL (a nota é criada durante composição; o foco cai no `body`).

- [ ] **Step 3: Implementar em `src/ui.js`**

3a. Em `setupNoteInputs`, trocar a condição:

```js
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
```

3b. Junto das variáveis de estado, adicionar `let modalOpener = null;` e, depois de `moveNote`, adicionar as funções:

```js
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
```

3c. `togglePin` e `moveNote` chamam `rerender()` em vez de `renderAllCategories()`.

3d. Modais: em `editNote`, remover `editTextarea.focus();` e guardar o foco antes de abrir:

```js
  if (note) {
    editingNoteId = noteId;
    editTextarea.value = note.text;
    modalOpener = captureFocus();
    editModal.show();
  }
```

Em `confirmDelete`, antes de `deleteModal.show();` adicionar `modalOpener = captureFocus();`.

Em `setupModals`, ao final da função, adicionar:

```js
  // Focus the textarea only once the modal is visible, and give focus back when it closes
  const editEl = document.getElementById('edit-modal');
  editEl.addEventListener('shown.bs.modal', () => editTextarea.focus());
  editEl.addEventListener('hidden.bs.modal', () => restoreFocus(modalOpener));
  document.getElementById('delete-modal').addEventListener('hidden.bs.modal', () => restoreFocus(modalOpener));
```

- [ ] **Step 4: Rodar tudo**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Verificação manual dos modais** (o `FakeModal` dos testes não dispara eventos do Bootstrap; isto só vale depois da Task 9, quando o Bootstrap local existir. Registre o resultado na Task 10)

Em `npm run dev`, via teclado: Tab até o ✏️ de uma nota, Enter, digite algo, Ctrl+Enter. Esperado: o foco volta ao ✏️ da mesma nota. Repetir com 🗑️ → Cancelar e → Excluir (neste caso o foco vai para o campo de nova nota da coluna).

- [ ] **Step 6: Commit**

```bash
git add src/ui.js tests/ui.test.js
git commit -m "fix: preserve keyboard focus across renders and ignore IME Enter" -m $'Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_01CMqzDWSDWW6DowMmVxfABw'
```

---

### Task 7: Toasts no lugar de `alert()` e avisos de falha de storage

**Files:**
- Create: `src/toast.js`
- Create: `tests/toast.test.js`
- Modify: `index.html` (container de toasts)
- Modify: `src/ui.js`
- Test: `tests/ui.test.js`

**Interfaces:**
- Consumes: `storage.setErrorHandler` (Task 3).
- Produces: `showToast(message: string, options?: { variant?: 'secondary'|'success'|'danger'|'warning', actionLabel?: string, onAction?: () => void, timeout?: number }): HTMLElement | null`. `timeout` em ms (padrão 5000; `0` = não some sozinho). Retorna `null` se não houver `#toast-container`. A mensagem entra via `textContent`.

- [ ] **Step 1: Escrever os testes que falham**

`tests/toast.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { showToast } from '../src/toast.js';

beforeEach(() => {
  document.body.innerHTML = '<div id="toast-container"></div>';
});
afterEach(() => vi.useRealTimers());

describe('showToast', () => {
  it('returns null when there is no container', () => {
    document.body.innerHTML = '';
    expect(showToast('x')).toBeNull();
  });

  it('shows the message as text, never as HTML', () => {
    showToast('<img src=x onerror=alert(1)>');
    const container = document.getElementById('toast-container');
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.toast-body').textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('uses role=alert for danger and role=status otherwise', () => {
    expect(showToast('a', { variant: 'danger' }).getAttribute('role')).toBe('alert');
    expect(showToast('b').getAttribute('role')).toBe('status');
  });

  it('disappears after the timeout', () => {
    vi.useFakeTimers();
    showToast('bye', { timeout: 1000 });
    expect(document.querySelectorAll('.toast')).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(document.querySelectorAll('.toast')).toHaveLength(0);
  });

  it('stays while timeout is 0', () => {
    vi.useFakeTimers();
    showToast('sticky', { timeout: 0 });
    vi.advanceTimersByTime(60000);
    expect(document.querySelectorAll('.toast')).toHaveLength(1);
  });

  it('runs the action callback and dismisses', () => {
    const onAction = vi.fn();
    showToast('update', { actionLabel: 'Atualizar', onAction, timeout: 0 });
    document.querySelector('.toast .btn-light').click();
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('.toast')).toHaveLength(0);
  });

  it('closes with the close button', () => {
    showToast('x', { timeout: 0 });
    document.querySelector('.toast .btn-close').click();
    expect(document.querySelectorAll('.toast')).toHaveLength(0);
  });
});
```

Ao final de `tests/ui.test.js`:

```js
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/toast.test.js tests/ui.test.js`
Expected: FAIL (`toast.js` não existe; sem `#toast-container`).

- [ ] **Step 3: Criar `src/toast.js`**

```js
/**
 * Mind Dump - Toast notifications
 * Plain DOM (Bootstrap classes only), so it works and is testable without Bootstrap's JS.
 */

const DEFAULT_TIMEOUT = 5000;

export function showToast(message, { variant = 'secondary', actionLabel, onAction, timeout = DEFAULT_TIMEOUT } = {}) {
  const container = document.getElementById('toast-container');
  if (!container) return null;

  const toast = document.createElement('div');
  toast.className = `toast show align-items-center text-bg-${variant} border-0`;
  toast.setAttribute('role', variant === 'danger' ? 'alert' : 'status');

  const row = document.createElement('div');
  row.className = 'd-flex';

  const text = document.createElement('div');
  text.className = 'toast-body';
  text.textContent = message;
  row.append(text);

  const dismiss = () => toast.remove();

  if (actionLabel && onAction) {
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'btn btn-sm btn-light m-auto me-2';
    action.textContent = actionLabel;
    action.addEventListener('click', () => {
      onAction();
      dismiss();
    });
    row.append(action);
  }

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'btn-close btn-close-white m-auto me-2';
  close.setAttribute('aria-label', 'Fechar');
  close.addEventListener('click', dismiss);
  row.append(close);

  toast.append(row);
  container.append(toast);

  if (timeout > 0) setTimeout(dismiss, timeout);
  return toast;
}
```

- [ ] **Step 4: Container no `index.html`**

Antes do comentário `<!-- Bootstrap 5 JS -->`, adicionar:

```html
  <!-- Toasts -->
  <div id="toast-container" class="toast-container position-fixed bottom-0 end-0 p-3" aria-live="polite"></div>

```

- [ ] **Step 5: Usar os toasts em `src/ui.js`**

Adicionar o import: `import { showToast } from './toast.js';`

Em `init()`, antes de `setupNoteInputs();`:

```js
  // Surface storage problems instead of failing silently
  storage.setErrorHandler(({ type }) => {
    const message = type === 'save'
      ? 'Não foi possível salvar. O armazenamento do navegador pode estar cheio ou bloqueado: exporte um backup.'
      : 'Não foi possível ler as notas salvas. Uma cópia do conteúdo foi mantida no armazenamento do navegador.';
    showToast(message, { variant: 'danger', timeout: 10000 });
  });

```

No handler do `import-file`, substituir os três `alert(...)` por:

```js
      if (result.success) {
        showToast(`Importação concluída: ${result.imported} adicionadas, ${result.updated} atualizadas.`, { variant: 'success' });
        renderAllCategories();
      } else {
        showToast(`Erro na importação: ${result.error}`, { variant: 'danger' });
      }
    } catch (error) {
      showToast('Erro ao ler arquivo: ' + error.message, { variant: 'danger' });
    }
```

- [ ] **Step 6: Rodar tudo**

Run: `npm test && grep -n "alert(" src/*.js`
Expected: testes PASS; o `grep` não imprime nada.

- [ ] **Step 7: Commit**

```bash
git add src/toast.js src/ui.js index.html tests/toast.test.js tests/ui.test.js
git commit -m "feat: replace alert() with toasts and surface storage failures" -m $'Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_01CMqzDWSDWW6DowMmVxfABw'
```

---

### Task 8: Sincronizar entre abas

**Files:**
- Modify: `src/ui.js` (dentro de `init`)
- Test: `tests/ui.test.js`

**Interfaces:**
- Consumes: `storage.STORAGE_KEY` (Task 3), `rerender()` (Task 6).

- [ ] **Step 1: Escrever o teste que falha** (ao final de `tests/ui.test.js`)

```js
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/ui.test.js -t "cross-tab sync"`
Expected: FAIL (o primeiro teste não encontra cards).

- [ ] **Step 3: Implementar**

Em `init()`, depois de `setupDragAndDrop();`:

```js
  // Another tab changed the notes (or cleared storage): refresh what we show
  window.addEventListener('storage', (e) => {
    if (e.key === null || e.key === storage.STORAGE_KEY) rerender();
  });
```

- [ ] **Step 4: Rodar tudo**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui.js tests/ui.test.js
git commit -m "feat: refresh notes when another tab changes storage" -m $'Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_01CMqzDWSDWW6DowMmVxfABw'
```

---

### Task 9: Offline de verdade (Bootstrap local, SW corrigida, update sem `confirm`)

**Files:**
- Create: `vendor/bootstrap/bootstrap.min.css`, `vendor/bootstrap/bootstrap.bundle.min.js`
- Modify: `index.html` (links do Bootstrap)
- Modify (reescrever): `service-worker.js`, `src/main.js`
- Modify: `manifest.json`
- Create: `tests/service-worker.test.js`

**Interfaces:**
- Consumes: `showToast` (Task 7).
- Produces: a SW responde à mensagem `{ type: 'SKIP_WAITING' }` com `skipWaiting()` (já existia); `main.js` envia essa mensagem quando o usuário clica em "Atualizar" e recarrega uma única vez em `controllerchange`.

- [ ] **Step 1: Escrever o teste-guarda que falha**

`tests/service-worker.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');

const sw = read('service-worker.js');
const html = read('index.html');
const assetsBlock = sw.match(/const ASSETS_TO_CACHE = \[([\s\S]*?)\];/)[1];
const cached = [...assetsBlock.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter(Boolean);

describe('service worker asset list', () => {
  it('only lists files that exist', () => {
    for (const file of cached) expect(existsSync(join(root, file)), file).toBe(true);
  });

  it('caches every local file index.html loads', () => {
    const refs = [...html.matchAll(/(?:href|src)="([^"#][^"]*)"/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) expect(cached, ref).toContain(ref);
  });

  it('caches every module in src/ (so new modules cannot be forgotten)', () => {
    for (const file of readdirSync(join(root, 'src'))) expect(cached, file).toContain(`src/${file}`);
  });

  it('caches every module that a src/ file imports', () => {
    for (const file of readdirSync(join(root, 'src'))) {
      const imports = [...read(`src/${file}`).matchAll(/from\s+'\.\/([^']+)'/g)].map((m) => `src/${m[1]}`);
      for (const imported of imports) expect(cached, `${file} -> ${imported}`).toContain(imported);
    }
  });

  it('needs no third-party host to run offline', () => {
    expect(html).not.toMatch(/(?:href|src)="https?:/);
    expect(sw).not.toMatch(/https?:\/\//);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/service-worker.test.js`
Expected: FAIL (a lista atual usa caminhos `/...`, então `cached` fica vazio; `index.html` ainda referencia o CDN).

- [ ] **Step 3: Vendorizar o Bootstrap e conferir a integridade**

```bash
mkdir -p vendor/bootstrap
curl -fsSL https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css -o vendor/bootstrap/bootstrap.min.css
curl -fsSL https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js -o vendor/bootstrap/bootstrap.bundle.min.js
for f in vendor/bootstrap/bootstrap.min.css vendor/bootstrap/bootstrap.bundle.min.js; do
  echo "$f sha384-$(openssl dgst -sha384 -binary "$f" | openssl base64 -A)"
done
```

Expected (os mesmos hashes SRI que o `index.html` já usa; **se não baterem, pare e não use os arquivos**):

```
vendor/bootstrap/bootstrap.min.css sha384-T3c6CoIi6uLrA9TneNEoa7RxnatzjcDSCmG1MXxSR1GAsXEV/Dwwykc2MPK8M2HN
vendor/bootstrap/bootstrap.bundle.min.js sha384-C6RzsynM9kWDrMNeT87bh95OGNyZPhcTNXj1NW7RuBCsyN/o0jlpcV8Qyq46cDfL
```

- [ ] **Step 4: Apontar o `index.html` para os arquivos locais**

Trocar a linha do CSS:

```html
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-T3c6CoIi6uLrA9TneNEoa7RxnatzjcDSCmG1MXxSR1GAsXEV/Dwwykc2MPK8M2HN" crossorigin="anonymous">
```

por:

```html
  <link href="vendor/bootstrap/bootstrap.min.css" rel="stylesheet">
```

e a linha do script:

```html
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js" integrity="sha384-C6RzsynM9kWDrMNeT87bh95OGNyZPhcTNXj1NW7RuBCsyN/o0jlpcV8Qyq46cDfL" crossorigin="anonymous"></script>
```

por:

```html
  <script src="vendor/bootstrap/bootstrap.bundle.min.js"></script>
```

- [ ] **Step 5: Reescrever `service-worker.js`**

```js
/**
 * Mind Dump - Service Worker
 * Cache-first strategy for offline support.
 *
 * Every file the app needs offline must be listed in ASSETS_TO_CACHE
 * (tests/service-worker.test.js enforces this). Bump CACHE_NAME on every
 * release that changes a cached file; otherwise returning users keep stale assets.
 * Paths are relative so the app also works when served from a sub-path.
 */

const CACHE_NAME = 'mind-dump-v3';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './styles/app.css',
  './vendor/bootstrap/bootstrap.min.css',
  './vendor/bootstrap/bootstrap.bundle.min.js',
  './src/main.js',
  './src/categories.js',
  './src/render.js',
  './src/storage.js',
  './src/toast.js',
  './src/ui.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Navigations reject cached responses that came through a redirect, so store a clean copy.
async function cleanResponse(response) {
  if (!response.redirected) return response;
  const body = await response.blob();
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

// Install: all-or-nothing. If any asset fails, the new version is not installed
// and the previous one keeps serving, instead of activating half-cached.
async function precache() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(ASSETS_TO_CACHE.map(async (url) => {
    const response = await fetch(url, { cache: 'reload' });
    if (!response.ok) throw new Error(`Failed to precache ${url}: ${response.status}`);
    await cache.put(url, await cleanResponse(response));
  }));
}

self.addEventListener('install', (event) => {
  // No skipWaiting() here: the page asks for it when the user accepts the update.
  event.waitUntil(precache());
});

// Activate: drop caches from older versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: cache-first, refreshed in the background
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then((cached) => {
        if (cached) {
          revalidate(request);
          return cached;
        }
        return fetchAndCache(request);
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request)
      .then((cached) => {
        if (cached) {
          if (isLocalAsset(new URL(request.url))) revalidate(request);
          return cached;
        }
        return fetchAndCache(request);
      })
      .catch(() => {
        if (request.destination === 'image') {
          return new Response(
            '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="#ddd" width="100" height="100"/></svg>',
            { headers: { 'Content-Type': 'image/svg+xml' } }
          );
        }
        return new Response('Offline', { status: 503 });
      })
  );
});

function isLocalAsset(url) {
  return url.origin === self.location.origin;
}

// Background refresh must never surface an error (we are usually offline when it fails)
function revalidate(request) {
  return fetchAndCache(request).catch(() => {});
}

function fetchAndCache(request) {
  return fetch(request).then((response) => {
    if (!response || response.status !== 200) return response;

    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
    return response;
  });
}

// Messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});
```

- [ ] **Step 6: Reescrever `src/main.js`**

```js
/**
 * Mind Dump - Main Application Entry Point
 * SPA + PWA for mental dump notes
 */

import * as ui from './ui.js';
import { CATEGORIES } from './categories.js';
import { showToast } from './toast.js';

// App initialization
document.addEventListener('DOMContentLoaded', () => {
  console.log('🧠 Mind Dump initialized');
  console.log('Categories:', CATEGORIES.map(c => c.name).join(', '));

  // Ask the browser not to evict our data under storage pressure (best effort, may be a no-op)
  navigator.storage?.persist?.();

  // Initialize UI (includes storage, drag & drop, export/import)
  ui.init();
});

// Service Worker registration and update flow
if ('serviceWorker' in navigator) {
  // On the very first visit the SW claims the page; that must not trigger a reload.
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./service-worker.js');
      console.log('✅ Service Worker registered:', registration.scope);

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showToast('Nova versão disponível.', {
              actionLabel: 'Atualizar',
              timeout: 0,
              onAction: () => newWorker.postMessage({ type: 'SKIP_WAITING' })
            });
          }
        });
      });
    } catch (error) {
      console.error('❌ SW registration failed:', error);
    }
  });
}
```

- [ ] **Step 7: Manifest relativo**

Em `manifest.json`, trocar `"start_url": "/",` por:

```json
  "id": "./",
  "start_url": "./",
  "scope": "./",
```

- [ ] **Step 8: Rodar tudo**

Run: `npm test`
Expected: PASS (inclui `service-worker.test.js`).

- [ ] **Step 9: Verificação manual do offline e do update** (não automatizável)

1. `npm run dev` e abrir `http://localhost:3000` no Chrome.
2. DevTools → Application → Service Workers: estado `activated`. Cache Storage → `mind-dump-v3` com 14 entradas. Esperado: nenhuma entrada de `cdn.jsdelivr.net`.
3. Network → marcar *Offline* → recarregar. Esperado: o app abre estilizado, cria/edita nota, abre modal e dropdown.
4. Se o reload offline falhar com `a redirected response was used for a request whose redirect mode is not "follow"`: o `cleanResponse` não está sendo aplicado; revise o `precache()`, não crie workaround no servidor.
5. Update: desmarcar *Offline*, trocar `CACHE_NAME` para `'mind-dump-v3-test'`, recarregar uma vez. Esperado: toast "Nova versão disponível" com botão *Atualizar*; ao clicar, a página recarrega **uma vez** e o Cache Storage passa a ter só `mind-dump-v3-test`. Reverter o `CACHE_NAME` para `'mind-dump-v3'`.
6. Repetir a verificação manual dos modais pendente da Task 6, Step 5.

- [ ] **Step 10: Commit**

```bash
git add vendor service-worker.js src/main.js index.html manifest.json tests/service-worker.test.js
git commit -m "fix: make offline reliable (local Bootstrap, safe precache, user-driven update)" -m $'Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_01CMqzDWSDWW6DowMmVxfABw'
```

---

### Task 10: Documentação, verificação final e merge local

**Files:**
- Modify: `README.md`
- Modify (reescrever): `CLAUDE.md`

- [ ] **Step 1: Atualizar o `README.md`**

- Em "Testes": trocar a linha `**Resultado:** 39 testes passando ✅` por `Rode \`npm test\` para ver o resultado atual.`
- Em "Estrutura do Projeto": acrescentar `src/categories.js`, `src/render.js`, `src/toast.js` e `vendor/bootstrap/`.
- Em "Tecnologias": trocar `Bootstrap 5 (via CDN)` por `Bootstrap 5.3.2 (local, em vendor/bootstrap/)`.
- Em "Adicionar nova categoria", substituir os 4 passos por:
  1. Edite `CATEGORIES` em `src/categories.js` (a validação de import já usa essa lista).
  2. Adicione a coluna HTML em `index.html` (mobile e desktop); `npm test` falha se faltar uma delas.
  3. Adicione a cor da categoria em `styles/app.css`.

- [ ] **Step 2: Reescrever o `CLAUDE.md`**

````markdown
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
- **Service worker cache**: `ASSETS_TO_CACHE` in `service-worker.js` is a hand-kept list; `tests/service-worker.test.js` fails if a file loaded by `index.html` or imported from `src/` is missing, or if anything references a third-party host. Still bump `CACHE_NAME` on every release that changes a cached file. Paths are relative so a sub-path deploy works. Updates are user-driven: the new SW waits until `main.js` posts `SKIP_WAITING`.
- **Import**: `validateImport` is the trust boundary for backups (id must match `^[A-Za-z0-9_-]{1,64}$`, dates must parse, `pinned` must be boolean). `mergeImport` dedupes by `id` and keeps the newer `updatedAt`; the accepted formats are a bare array or `{version, exportedAt, notes}`.
- `updateNote` always bumps `updatedAt` (including pin toggles and category moves); notes sort pinned-first, then by `updatedAt` descending.
- `tests/ui.test.js` loads the real `index.html` body into jsdom with a fake `bootstrap.Modal`, so selectors and markup stay covered together.
````

- [ ] **Step 3: Verificação final**

```bash
npm test
npm run test:coverage 2>&1 | tail -20
grep -rn "mindDump\|onclick\|alert(\|confirm(\|cdn.jsdelivr" src index.html service-worker.js
git status --short
```

Expected: tudo verde; o `grep` não imprime nada; `git status` só mostra README/CLAUDE.md.

- [ ] **Step 4: Smoke test manual com um backup hostil**

Crie `hostile.json` fora do repo (por exemplo no scratchpad da sessão) com:

```json
[{ "id": "x');alert(1);//", "text": "oi", "category": "tasks" }]
```

No app: *Importar* → escolher esse arquivo. Esperado: toast vermelho "Erro na importação: Nota sem ID válido", nenhuma nota nova, nenhum `alert`. Depois crie uma nota `R&D <plan>`, busque `amp` e confirme que o texto continua `R&D <plan>`.

- [ ] **Step 5: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: update README and CLAUDE.md for the new structure" -m $'Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_01CMqzDWSDWW6DowMmVxfABw'
```

- [ ] **Step 6: Merge local em `main` (sem push, sem PR)**

```bash
git switch main
git merge --no-ff improve/hardening -m "Merge improve/hardening: security, durability and offline fixes"
npm test
```

Expected: merge sem conflito e testes PASS em `main`. Não faça push.

---

## Self-Review

**Cobertura dos achados:** todos os itens da análise têm task (tabela "Achados cobertos") ou estão listados em "Fora de escopo" com motivo.

**Placeholders:** nenhum "TBD"/"tratar erros adequadamente". Todos os steps de código têm o código. Os passos manuais (Task 6 Step 5, Task 9 Step 9, Task 10 Step 4) existem porque modais do Bootstrap e Service Worker não rodam no jsdom; cada um diz o resultado esperado.

**Consistência de tipos/nomes:** `CATEGORIES`/`CATEGORY_IDS` (Task 1) → usados em 2, 4, 5. `STORAGE_KEY`, `setErrorHandler`, `saveAll(): boolean` (Task 3) → usados em 7 e 8. `renderNoteCard(note, categories, query, now)` (Task 4) → chamado em 5 como `renderNoteCard(note, CATEGORIES, currentSearchQuery)`. `captureFocus/restoreFocus/rerender` (Task 6) → `rerender` usado na Task 8. `showToast(message, options)` (Task 7) → usado em 7 e 9. `data-action` = `pin|edit|delete|move` e `data-category` iguais em `render.js`, `ui.js` e nos testes.

**Review Focus:** os 5 itens têm teste nas tasks indicadas (1: T2 `validateImport hardening` + T4 `keeps a hostile id…`; 2: T4 `highlightHtml` + T5 busca; 3: T3 + T7 `unreadable`; 4: T3 + T7 `saving fails`; 5: T6 `IME`).

**Riscos conhecidos:** (a) fixtures antigos de `tests/storage.test.js` podem violar as regras novas da Task 2; o step manda corrigir o fixture ou parar e perguntar; (b) a SW só é validada manualmente (Task 9 Step 9); (c) o hash do Bootstrap baixado é conferido contra o SRI que o projeto já usava.
