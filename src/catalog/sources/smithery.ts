import pLimit from 'p-limit';
import { z } from 'zod';
import type { RawSkill } from '../../types.js';
import { fetchJson } from '../http.js';
import { cleanDescription, isValidSource, parseGitHubUrl } from '../normalize.js';

const BASE = 'https://registry.smithery.ai/skills';
const PAGE_SIZE = 100;

const Entry = z.object({
  slug: z.string(),
  displayName: z.string().nullish(),
  description: z.string().nullish(),
  gitUrl: z.string().nullish(),
  externalStars: z.number().nullish(),
  uniqueUsers: z.number().nullish(),
  categories: z.array(z.string()).nullish(),
});
const Page = z.object({
  skills: z.array(z.unknown()),
  pagination: z.object({ totalPages: z.number(), totalCount: z.number().optional() }),
});

/**
 * The installable name is the last segment of the git path (the skill
 * directory, which the spec requires to equal the frontmatter `name`);
 * Smithery's `displayName` is sometimes prefixed with the namespace.
 */
export function mapEntry(value: unknown): RawSkill | undefined {
  const parsed = Entry.safeParse(value);
  if (!parsed.success) return undefined;
  const e = parsed.data;
  const gh = e.gitUrl ? parseGitHubUrl(e.gitUrl) : undefined;
  if (!gh || !isValidSource(gh.source)) return undefined;
  const dirName = gh.path?.split('/').pop();
  const name = dirName || e.displayName || e.slug;
  return {
    origin: 'smithery',
    name: name.trim(),
    source: gh.source,
    path: gh.path,
    description: cleanDescription(e.description),
    stars: e.externalStars ?? undefined,
    labels: e.categories ?? [],
  };
}

export const SMITHERY_CATEGORIES = [
  'Coding', 'Productivity', 'Design', 'Data & Analytics', 'DevOps', 'Business',
  'AI & ML', 'Writing', 'Communication', 'Planning', 'Research', 'Security',
];

/**
 * The registry never serves more than 5 pages of 100 per query, so the full
 * listing is out of reach. We take the top 500 overall and the top 500 of each
 * category: Smithery is mostly useful here for its category labels.
 */
export async function fetchSmithery(log: (msg: string) => void = () => {}): Promise<RawSkill[]> {
  const queries = ['', ...SMITHERY_CATEGORIES.map((c) => `&category=${encodeURIComponent(c)}`)];
  const limit = pLimit(4);
  const tasks = queries.flatMap((q) =>
    [1, 2, 3, 4, 5].map((p) =>
      limit(async () => {
        const page = Page.parse(await fetchJson(`${BASE}?page=${p}&pageSize=${PAGE_SIZE}${q}`));
        return p <= page.pagination.totalPages ? page.skills : [];
      }),
    ),
  );
  const pages = await Promise.all(tasks);
  log(`smithery: ${tasks.length} pages`);
  const out: RawSkill[] = [];
  for (const entry of pages.flat()) {
    const skill = mapEntry(entry);
    if (skill) out.push(skill);
  }
  return out;
}
