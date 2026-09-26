import { z } from 'zod';
import type { RawSkill } from '../../types.js';
import { fetchJson, fetchText } from '../http.js';
import { isValidSource } from '../normalize.js';

const SITE = 'https://www.skills.sh';
const API = 'https://skills.sh';

const SearchSkill = z.object({
  source: z.string(),
  skillId: z.string().optional(),
  name: z.string(),
  installs: z.number().nullish(),
});
const SearchResponse = z.object({ skills: z.array(z.unknown()) });

const V1Skill = z.object({
  slug: z.string(),
  name: z.string().optional(),
  source: z.string(),
  installs: z.number().nullish(),
  sourceType: z.string().optional(),
  isDuplicate: z.boolean().optional(),
});
const V1Page = z.object({
  data: z.array(z.unknown()),
  pagination: z.object({ hasMore: z.boolean() }),
});

/** Extracts `owner/repo/skill` triples from a skills.sh sitemap, ranked from `firstRank`. */
export function parseSkillsSitemap(xml: string, firstRank = 1): RawSkill[] {
  const out: RawSkill[] = [];
  for (const m of xml.matchAll(/<loc>https?:\/\/(?:www\.)?skills\.sh\/([^<]+)<\/loc>/g)) {
    const parts = m[1]!.split('/').map(decodeURIComponent);
    if (parts.length !== 3) continue;
    const [owner, repo, name] = parts as [string, string, string];
    const source = `${owner}/${repo}`;
    if (isValidSource(source) && name) out.push({ origin: 'skills.sh', name, source, rank: firstRank + out.length });
  }
  return out;
}

export function mapSearchSkill(value: unknown): RawSkill | undefined {
  const parsed = SearchSkill.safeParse(value);
  if (!parsed.success || !isValidSource(parsed.data.source)) return undefined;
  const s = parsed.data;
  return { origin: 'skills.sh', name: s.name, source: s.source, installs: s.installs ?? undefined };
}

async function sitemapUrls(): Promise<string[]> {
  const index = await fetchText(`${SITE}/sitemap.xml`);
  return [...index.matchAll(/<loc>([^<]*sitemap-skills[^<]*)<\/loc>/g)].map((m) => m[1]!);
}

/**
 * Full leaderboard through the authenticated v1 API. Only used when
 * `VERCEL_OIDC_TOKEN` is set (see https://skills.sh/docs/api).
 */
async function fetchV1(token: string, log: (msg: string) => void): Promise<RawSkill[]> {
  const out: RawSkill[] = [];
  for (let page = 0; ; page++) {
    const body = V1Page.parse(
      await fetchJson(`${API}/api/v1/skills?view=all-time&page=${page}&per_page=500`, {
        headers: { authorization: `Bearer ${token}` },
      }),
    );
    for (const v of body.data) {
      const p = V1Skill.safeParse(v);
      if (!p.success || p.data.isDuplicate || p.data.sourceType === 'well-known') continue;
      if (!isValidSource(p.data.source)) continue;
      out.push({
        origin: 'skills.sh',
        name: p.data.name ?? p.data.slug,
        source: p.data.source,
        installs: p.data.installs ?? undefined,
      });
    }
    if (page % 20 === 0) log(`skills.sh v1: page ${page}, ${out.length} skills`);
    if (!body.pagination.hasMore) return out;
  }
}

export interface SkillsShOptions {
  /** Number of owners queried through `/api/search` for install counts (default 0). */
  maxOwners?: number;
  log?: (msg: string) => void;
}

/** `/api/search` allows 30 requests per minute per client; stay just under. */
const SEARCH_INTERVAL_MS = 2_100;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * skills.sh has no public listing API. Without a token we read the sitemaps
 * (≈20k most-installed skills, in popularity order), then query
 * `/api/search?owner=` for the most popular owners: it returns every skill of
 * that owner with its install count, including skills missing from the
 * sitemap. The endpoint allows 30 requests/min and in practice throttles
 * well below that (≈25 s per owner once penalised), so this is opt-in; the
 * sitemap rank alone already orders skills by popularity.
 */
export async function fetchSkillsSh(opts: SkillsShOptions = {}): Promise<RawSkill[]> {
  const log = opts.log ?? (() => {});
  const token = process.env.VERCEL_OIDC_TOKEN;
  if (token) return fetchV1(token, log);

  const fromSitemap: RawSkill[] = [];
  for (const url of await sitemapUrls()) {
    fromSitemap.push(...parseSkillsSitemap(await fetchText(url), fromSitemap.length + 1));
  }
  log(`skills.sh: ${fromSitemap.length} skills in sitemaps`);

  const owners = [...new Set(fromSitemap.map((s) => s.source.split('/')[0]!))]
    .filter((o) => o.length >= 2)
    .slice(0, opts.maxOwners ?? 0);
  const fromSearch: RawSkill[] = [];
  for (const [i, owner] of owners.entries()) {
    const started = Date.now();
    try {
      const params = new URLSearchParams({ q: owner, owner, limit: '200' });
      const body = SearchResponse.parse(await fetchJson(`${API}/api/search?${params}`));
      for (const s of body.skills) {
        const skill = mapSearchSkill(s);
        if (skill) fromSearch.push(skill);
      }
    } catch (err) {
      log(`skills.sh: search failed for ${owner} — ${err instanceof Error ? err.message : String(err)}`);
    }
    if ((i + 1) % 50 === 0) log(`skills.sh: ${i + 1}/${owners.length} owners, ${fromSearch.length} skills`);
    await sleep(Math.max(0, SEARCH_INTERVAL_MS - (Date.now() - started)));
  }
  return [...fromSitemap, ...fromSearch];
}
