import { themeAliases } from '../i18n/index.js';
import type { Catalog, Skill, Theme } from '../types.js';

export interface QueryOptions {
  themes?: string[];
  search?: string;
  minInstalls?: number;
  /** Keep skills with no popularity signal at all (hidden by default). */
  all?: boolean;
}

/** Matches a theme by id or label in any language, case- and accent-insensitive. */
export function resolveTheme(catalog: Catalog, input: string): Theme | undefined {
  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
  const wanted = norm(input);
  const names = (t: Theme) => themeAliases(t).map(norm);
  return (
    catalog.themes.find((t) => names(t).includes(wanted)) ??
    catalog.themes.find((t) => names(t).some((n) => n.startsWith(wanted)))
  );
}

export function haystack(s: Skill): string {
  return `${s.id} ${s.description ?? ''}`.toLowerCase();
}

/** Every whitespace-separated term must appear in the id or the description. */
export function matchesSearch(s: Skill, search: string): boolean {
  const text = haystack(s);
  return search.toLowerCase().split(/\s+/).filter(Boolean).every((term) => text.includes(term));
}

export function querySkills(catalog: Catalog, q: QueryOptions = {}): Skill[] {
  return catalog.skills.filter((s) => {
    if (!q.all && !s.installs && !s.stars && s.rank === undefined) return false;
    if (q.minInstalls && (s.installs ?? 0) < q.minInstalls) return false;
    if (q.themes?.length && !s.themes.some((t) => q.themes!.includes(t))) return false;
    if (q.search && !matchesSearch(s, q.search)) return false;
    return true;
  });
}

/** Groups skills under each of their themes, keeping catalog theme order. */
export function groupByTheme(themes: Theme[], skills: Skill[]): { theme: Theme; skills: Skill[] }[] {
  const groups = new Map<string, Skill[]>(themes.map((t) => [t.id, []]));
  for (const s of skills) for (const t of s.themes) groups.get(t)?.push(s);
  return themes.map((theme) => ({ theme, skills: groups.get(theme.id)! })).filter((g) => g.skills.length > 0);
}

/** Short popularity label: installs, else stars, else skills.sh rank. */
export function popularityLabel(s: Skill): string {
  if (s.installs) return `↓${formatCount(s.installs)}`;
  if (s.stars) return `★${formatCount(s.stars)}`;
  return s.rank !== undefined ? `#${s.rank}` : '';
}

export function formatCount(n?: number): string {
  if (!n) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
