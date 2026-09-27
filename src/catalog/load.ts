import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';
import type { Catalog } from '../types.js';

/** Default snapshot: `data/catalog.json.gz`, found next to `dist/` or `src/catalog/`. */
export function defaultCatalogPath(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 4; i++) {
    const candidate = join(dir, 'data', 'catalog.json.gz');
    if (existsSync(candidate)) return candidate;
    dir = dirname(dir);
  }
  return join(process.cwd(), 'data', 'catalog.json.gz');
}

export function decodeCatalog(buf: Buffer): Catalog {
  // gzip magic number: 1f 8b
  const text = buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf).toString('utf8') : buf.toString('utf8');
  const catalog = JSON.parse(text) as Catalog;
  if (catalog.version !== 1 || !Array.isArray(catalog.skills)) throw new Error('unsupported catalog format');
  return catalog;
}

/** Loads the catalog from a local path (`.json` or `.json.gz`) or an http(s) URL. */
export async function loadCatalog(location = defaultCatalogPath()): Promise<Catalog> {
  if (/^https?:\/\//.test(location)) {
    const res = await fetch(location, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${location}`);
    return decodeCatalog(Buffer.from(await res.arrayBuffer()));
  }
  if (!existsSync(location)) {
    throw new Error(`catalog not found at ${location} — run \`npm run crawl\` or pass --catalog <path|url>`);
  }
  return decodeCatalog(await readFile(location));
}

export async function saveCatalog(catalog: Catalog, path: string): Promise<number> {
  const buf = gzipSync(JSON.stringify(catalog), { level: 9 });
  await writeFile(path, buf);
  return buf.length;
}
