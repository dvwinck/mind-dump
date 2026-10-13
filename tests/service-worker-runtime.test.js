import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// Runs the real service-worker.js in a sandbox with fake caches/fetch, so its decisions are tested.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'service-worker.js'), 'utf8');

const keyOf = (req) => (typeof req === 'string' ? req : req.url);

// cached:    entries of the ACTIVE cache (what caches.open(CACHE_NAME) sees)
// elsewhere: entries that only exist in some other cache version (visible to a global caches.match)
function loadWorker({ cached = {}, elsewhere = {}, cacheNames = [], fetchImpl = () => Promise.reject(new Error('offline')) } = {}) {
  const handlers = {};
  const put = vi.fn(() => Promise.resolve());
  const deleted = [];
  const fetchMock = vi.fn(fetchImpl);
  const claim = vi.fn(() => Promise.resolve());
  const self = {
    addEventListener: (type, fn) => { handlers[type] = fn; },
    location: { origin: 'http://localhost' },
    clients: { claim },
    skipWaiting: vi.fn()
  };
  const cache = { put, match: (req) => Promise.resolve(cached[keyOf(req)]) };
  const caches = {
    open: () => Promise.resolve(cache),
    keys: () => Promise.resolve(cacheNames),
    delete: (name) => { deleted.push(name); return Promise.resolve(true); },
    match: (req) => Promise.resolve(elsewhere[keyOf(req)] ?? cached[keyOf(req)])
  };
  vm.runInNewContext(source, { self, caches, fetch: fetchMock, Response, URL, console });
  return { handlers, put, fetchMock, self, deleted, claim };
}

const fetchEvent = (request) => {
  let response;
  return {
    request,
    respondWith(p) { response = p; },
    get response() { return response; }
  };
};
const waitEvent = () => {
  let work;
  return { waitUntil(p) { work = p; }, get work() { return work; } };
};
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const asset = (url, extra = {}) => ({ method: 'GET', mode: 'cors', url, destination: 'script', ...extra });

describe('service worker fetch', () => {
  it('serves a cached asset without touching the network or rewriting the active cache', async () => {
    const sw = loadWorker({ cached: { 'http://localhost/src/ui.js': new Response('cached') } });
    const event = fetchEvent(asset('http://localhost/src/ui.js'));

    sw.handlers.fetch(event);

    expect(await (await event.response).text()).toBe('cached');
    await tick();
    expect(sw.fetchMock).not.toHaveBeenCalled();
    expect(sw.put).not.toHaveBeenCalled();
  });

  it('serves navigations from the cached index.html without touching the network', async () => {
    const sw = loadWorker({ cached: { './index.html': new Response('<html>cached</html>') } });
    const event = fetchEvent(asset('http://localhost/', { mode: 'navigate', destination: 'document' }));

    sw.handlers.fetch(event);

    expect(await (await event.response).text()).toBe('<html>cached</html>');
    await tick();
    expect(sw.fetchMock).not.toHaveBeenCalled();
    expect(sw.put).not.toHaveBeenCalled();
  });

  it('only trusts the active cache, never a copy left in another version', async () => {
    const sw = loadWorker({
      elsewhere: { 'http://localhost/src/ui.js': new Response('stale from another version') },
      fetchImpl: () => Promise.resolve(new Response('network'))
    });
    const event = fetchEvent(asset('http://localhost/src/ui.js'));

    sw.handlers.fetch(event);

    expect(await (await event.response).text()).toBe('network');
    expect(sw.fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ignores requests that are not GET', () => {
    const sw = loadWorker();
    const event = fetchEvent(asset('http://localhost/api', { method: 'POST' }));

    sw.handlers.fetch(event);

    expect(event.response).toBeUndefined();
    expect(sw.fetchMock).not.toHaveBeenCalled();
  });

  it('caches a successful network response for a URL that was not precached', async () => {
    const sw = loadWorker({ fetchImpl: () => Promise.resolve(new Response('fresh')) });
    const request = asset('http://localhost/extra.js');
    const event = fetchEvent(request);

    sw.handlers.fetch(event);

    expect(await (await event.response).text()).toBe('fresh');
    await tick();
    expect(sw.put).toHaveBeenCalledTimes(1);
    expect(sw.put.mock.calls[0][0]).toBe(request);
  });

  it('does not cache a non-200 network response', async () => {
    const sw = loadWorker({ fetchImpl: () => Promise.resolve(new Response('nope', { status: 404 })) });
    const event = fetchEvent(asset('http://localhost/missing.js'));

    sw.handlers.fetch(event);

    expect((await event.response).status).toBe(404);
    await tick();
    expect(sw.put).not.toHaveBeenCalled();
  });

  it('answers an uncached image with an SVG placeholder when offline', async () => {
    const sw = loadWorker();
    const event = fetchEvent(asset('http://localhost/pic.png', { destination: 'image' }));

    sw.handlers.fetch(event);

    expect((await event.response).headers.get('Content-Type')).toBe('image/svg+xml');
  });

  it('answers any other uncached request with 503 when offline', async () => {
    const sw = loadWorker();
    const event = fetchEvent(asset('http://localhost/data.json', { destination: '' }));

    sw.handlers.fetch(event);

    expect((await event.response).status).toBe(503);
  });
});

describe('service worker lifecycle', () => {
  it('fails the install when any asset cannot be fetched (all-or-nothing)', async () => {
    const sw = loadWorker({
      fetchImpl: (url) => Promise.resolve(new Response('x', { status: url.includes('toast') ? 404 : 200 }))
    });
    const event = waitEvent();

    sw.handlers.install(event);

    await expect(event.work).rejects.toThrow(/precache/i);
  });

  it('fetches every asset bypassing the HTTP cache', async () => {
    const sw = loadWorker({ fetchImpl: () => Promise.resolve(new Response('x')) });
    const event = waitEvent();

    sw.handlers.install(event);
    await event.work;

    expect(sw.fetchMock.mock.calls.length).toBeGreaterThan(5);
    for (const [, options] of sw.fetchMock.mock.calls) expect(options).toEqual({ cache: 'reload' });
  });

  it('stores a redirect-free copy of redirected responses', async () => {
    const sw = loadWorker({
      fetchImpl: (url) => {
        const response = new Response('body', { status: 200, statusText: 'OK', headers: { 'X-Test': '1' } });
        if (url === './index.html') Object.defineProperty(response, 'redirected', { value: true });
        return Promise.resolve(response);
      }
    });
    const event = waitEvent();

    sw.handlers.install(event);
    await event.work;

    const stored = sw.put.mock.calls.find(([url]) => url === './index.html')[1];
    expect(stored.redirected).toBe(false);
    expect(stored.status).toBe(200);
    expect(stored.headers.get('X-Test')).toBe('1');
    expect(await stored.text()).toBe('body');
  });

  it('does not activate a new version until the page asks', async () => {
    const sw = loadWorker({ fetchImpl: () => Promise.resolve(new Response('x')) });
    const event = waitEvent();

    sw.handlers.install(event);
    await event.work; // a skipWaiting chained after the precache would have run by now
    await tick();
    expect(sw.self.skipWaiting).not.toHaveBeenCalled();

    sw.handlers.message({ data: { type: 'SKIP_WAITING' } });
    expect(sw.self.skipWaiting).toHaveBeenCalledTimes(1);
  });

  it('drops caches of older versions on activate and then claims the clients', async () => {
    const sw = loadWorker({ cacheNames: ['mind-dump-v2', 'mind-dump-v3'] });
    const event = waitEvent();

    sw.handlers.activate(event);
    await event.work;

    expect(sw.deleted).toEqual(['mind-dump-v2']);
    expect(sw.claim).toHaveBeenCalledTimes(1);
  });

  it('reports its cache version on GET_VERSION and tolerates a missing port', () => {
    const sw = loadWorker();
    const postMessage = vi.fn();

    sw.handlers.message({ data: { type: 'GET_VERSION' }, ports: [{ postMessage }] });
    expect(postMessage).toHaveBeenCalledWith({ version: expect.stringMatching(/^mind-dump-v\d+/) });

    expect(() => sw.handlers.message({ data: { type: 'GET_VERSION' } })).not.toThrow();
  });
});
