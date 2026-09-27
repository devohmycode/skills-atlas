import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveCatalog } from '../src/catalog/load.js';
import { loadLatestCatalog, MAX_AGE_MS } from '../src/catalog/remote.js';
import type { Catalog } from '../src/types.js';

const catalog = (generatedAt: string): Catalog => ({
  version: 1,
  generatedAt,
  themes: [],
  skills: [],
  stats: { raw: { 'skills.sh': 0, 'claude-plugins.dev': 0, smithery: 0 }, merged: 0, byTheme: {} },
});
const gz = (c: Catalog) => gzipSync(JSON.stringify(c));
const ok = (c: Catalog, etag = '"v2"') => new Response(gz(c), { status: 200, headers: { etag } });

let dir: string;
let bundledPath: string;
beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'skills-atlas-'));
  bundledPath = join(dir, 'bundled.json.gz');
  await saveCatalog(catalog('2026-09-01T00:00:00Z'), bundledPath);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('latest catalog', () => {
  it('downloads the remote catalog, caches it, and reuses it while fresh', async () => {
    const fetch = vi.fn(async () => ok(catalog('2026-09-27T00:00:00Z')));
    const opts = { dir: join(dir, 'cache'), bundledPath, fetch, now: 1_000 };
    expect((await loadLatestCatalog(opts)).generatedAt).toBe('2026-09-27T00:00:00Z');
    expect(JSON.parse(readFileSync(join(dir, 'cache', 'catalog.meta.json'), 'utf8'))).toMatchObject({ etag: '"v2"' });
    expect((await loadLatestCatalog({ ...opts, now: 1_000 + MAX_AGE_MS - 1 })).generatedAt).toBe('2026-09-27T00:00:00Z');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('revalidates a stale cache with its ETag', async () => {
    const cache = join(dir, 'cache');
    await loadLatestCatalog({ dir: cache, bundledPath, now: 0, fetch: async () => ok(catalog('2026-09-27T00:00:00Z')) });
    const fetch = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(null, { status: 304 }));
    const got = await loadLatestCatalog({ dir: cache, bundledPath, now: MAX_AGE_MS, fetch });
    expect(got.generatedAt).toBe('2026-09-27T00:00:00Z');
    expect(fetch.mock.calls[0]![1]).toMatchObject({ headers: { 'if-none-match': '"v2"' } });
  });

  it('falls back to the bundled catalog when the download fails, and waits before retrying', async () => {
    const fetch = vi.fn(async () => {
      throw new Error('offline');
    });
    const opts = { dir: join(dir, 'cache'), bundledPath, fetch, now: 0 };
    expect((await loadLatestCatalog(opts)).generatedAt).toBe('2026-09-01T00:00:00Z');
    await loadLatestCatalog({ ...opts, now: 60_000 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('prefers the bundled catalog when it is newer than the cache (package upgraded)', async () => {
    const cache = join(dir, 'cache');
    await loadLatestCatalog({ dir: cache, bundledPath, now: 0, fetch: async () => ok(catalog('2026-08-01T00:00:00Z')) });
    const got = await loadLatestCatalog({ dir: cache, bundledPath, now: 1, offline: true });
    expect(got.generatedAt).toBe('2026-09-01T00:00:00Z');
  });

  it('never downloads when offline', async () => {
    const fetch = vi.fn();
    const got = await loadLatestCatalog({ dir: join(dir, 'cache'), bundledPath, fetch, offline: true });
    expect(got.generatedAt).toBe('2026-09-01T00:00:00Z');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects a corrupt download and keeps the bundled catalog', async () => {
    const fetch = async () => new Response('not a catalog', { status: 200 });
    const got = await loadLatestCatalog({ dir: join(dir, 'cache'), bundledPath, fetch, now: 0 });
    expect(got.generatedAt).toBe('2026-09-01T00:00:00Z');
  });
});
