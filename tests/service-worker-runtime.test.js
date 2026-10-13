import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// Runs the real service-worker.js in a sandbox with fake caches/fetch, so its decisions are tested.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'service-worker.js'), 'utf8');

function loadWorker({ cached = {}, fetchImpl = () => Promise.reject(new Error('offline')) } = {}) {
  const handlers = {};
  const put = vi.fn(() => Promise.resolve());
  const fetchMock = vi.fn(fetchImpl);
  const self = {
    addEventListener: (type, fn) => { handlers[type] = fn; },
    location: { origin: 'http://localhost' },
    clients: { claim: () => Promise.resolve() },
    skipWaiting: vi.fn()
  };
  const caches = {
    open: () => Promise.resolve({ put }),
    keys: () => Promise.resolve([]),
    delete: () => Promise.resolve(true),
    match: (req) => Promise.resolve(cached[typeof req === 'string' ? req : req.url])
  };
  vm.runInNewContext(source, { self, caches, fetch: fetchMock, Response, URL, console });
  return { handlers, put, fetchMock, self };
}

const fetchEvent = (request) => {
  let response;
  return {
    request,
    respondWith(p) { response = p; },
    get response() { return response; }
  };
};
const installEvent = () => {
  let work;
  return { waitUntil(p) { work = p; }, get work() { return work; } };
};

describe('service worker behavior', () => {
  it('serves a cached asset without touching the network or rewriting the active cache', async () => {
    const sw = loadWorker({ cached: { 'http://localhost/src/ui.js': new Response('cached') } });
    const event = fetchEvent({ method: 'GET', mode: 'cors', url: 'http://localhost/src/ui.js', destination: 'script' });

    sw.handlers.fetch(event);

    expect(await (await event.response).text()).toBe('cached');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sw.fetchMock).not.toHaveBeenCalled();
    expect(sw.put).not.toHaveBeenCalled();
  });

  it('serves navigations from the cached index.html without touching the network', async () => {
    const sw = loadWorker({ cached: { './index.html': new Response('<html>cached</html>') } });
    const event = fetchEvent({ method: 'GET', mode: 'navigate', url: 'http://localhost/', destination: 'document' });

    sw.handlers.fetch(event);

    expect(await (await event.response).text()).toBe('<html>cached</html>');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sw.fetchMock).not.toHaveBeenCalled();
    expect(sw.put).not.toHaveBeenCalled();
  });

  it('fails the install when any asset cannot be fetched (all-or-nothing)', async () => {
    const sw = loadWorker({
      fetchImpl: (url) => Promise.resolve(new Response('x', { status: url.includes('toast') ? 404 : 200 }))
    });
    const event = installEvent();

    sw.handlers.install(event);

    await expect(event.work).rejects.toThrow(/precache/i);
  });

  it('stores a redirect-free copy of redirected responses', async () => {
    const sw = loadWorker({
      fetchImpl: (url) => {
        const response = new Response('body');
        if (url === './index.html') Object.defineProperty(response, 'redirected', { value: true });
        return Promise.resolve(response);
      }
    });
    const event = installEvent();

    sw.handlers.install(event);
    await event.work;

    const stored = sw.put.mock.calls.find(([url]) => url === './index.html')[1];
    expect(stored.redirected).toBe(false);
    expect(await stored.text()).toBe('body');
  });

  it('waits for the page before activating a new version', () => {
    const sw = loadWorker({ fetchImpl: () => Promise.resolve(new Response('x')) });
    const event = installEvent();

    sw.handlers.install(event);
    expect(sw.self.skipWaiting).not.toHaveBeenCalled();

    sw.handlers.message({ data: { type: 'SKIP_WAITING' } });
    expect(sw.self.skipWaiting).toHaveBeenCalledTimes(1);
  });
});
