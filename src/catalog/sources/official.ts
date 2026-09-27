import type { Skill } from '../../types.js';
import { fetchText } from '../http.js';

const SITEMAP = 'https://officialskills.sh/sitemap.xml';

/**
 * GitHub owners of the skills listed on officialskills.sh, lowercased. Its
 * sitemap has one `/<owner>/<repo>/<skill>` page per skill; the repo segment
 * is not always the real repository, so only the owner is kept.
 */
export function parseOfficialSitemap(xml: string): Set<string> {
  const owners = new Set<string>();
  for (const m of xml.matchAll(/<loc>https?:\/\/(?:www\.)?officialskills\.sh\/([^<]+)<\/loc>/g)) {
    const parts = m[1]!.replace(/\/$/, '').split('/');
    if (parts.length === 3 && parts.every(Boolean)) owners.add(decodeURIComponent(parts[0]!).toLowerCase());
  }
  return owners;
}

export async function fetchOfficialOwners(log: (msg: string) => void = () => {}): Promise<Set<string>> {
  const owners = parseOfficialSitemap(await fetchText(SITEMAP));
  log(`officialskills.sh: ${owners.size} official publishers`);
  return owners;
}

/** Flags the skills published by an official owner; returns how many were flagged. */
export function markOfficial(skills: Skill[], owners: Set<string>): number {
  let n = 0;
  for (const s of skills) {
    const official = owners.has(s.source.split('/')[0]!.toLowerCase());
    if (official) {
      s.official = true;
      n++;
    } else delete s.official;
  }
  return n;
}
