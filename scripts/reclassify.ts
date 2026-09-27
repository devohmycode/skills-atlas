/**
 * Re-applies the taxonomy to an existing catalog without crawling, to tune
 * the rules in src/catalog/taxonomy.ts. Also refreshes the official flags
 * from officialskills.sh (kept as they are when it cannot be reached).
 *
 *   npm run reclassify [-- --sample other]   also prints 30 skills of a theme
 */
import { join } from 'node:path';
import { classifyAll } from '../src/catalog/classify.js';
import { compareSkills } from '../src/catalog/dedupe.js';
import { loadCatalog, saveCatalog } from '../src/catalog/load.js';
import { fetchOfficialOwners, markOfficial } from '../src/catalog/sources/official.js';
import { allThemes } from '../src/catalog/taxonomy.js';

const path = join('data', 'catalog.json.gz');
const catalog = await loadCatalog(path);
classifyAll(catalog.skills);
catalog.skills.sort(compareSkills);
try {
  catalog.stats.official = markOfficial(catalog.skills, await fetchOfficialOwners(console.log));
} catch (err) {
  console.log(`officialskills.sh unreachable, official flags kept: ${err instanceof Error ? err.message : String(err)}`);
}
catalog.themes = allThemes();
catalog.stats.byTheme = {};
for (const s of catalog.skills) for (const t of s.themes) catalog.stats.byTheme[t] = (catalog.stats.byTheme[t] ?? 0) + 1;
await saveCatalog(catalog, path);

const total = catalog.skills.length;
for (const theme of catalog.themes) {
  const n = catalog.stats.byTheme[theme.id] ?? 0;
  console.log(`  ${theme.label.padEnd(32)} ${String(n).padStart(6)}  ${((n / total) * 100).toFixed(1)}%`);
}

const sampleIdx = process.argv.indexOf('--sample');
if (sampleIdx >= 0) {
  const theme = process.argv[sampleIdx + 1] ?? 'other';
  const popular = catalog.skills.filter((s) => s.themes[0] === theme && (s.installs || s.stars));
  console.log(`\n${popular.length} popular skills in ${theme}:`);
  for (const s of popular.slice(0, 30)) console.log(`  ${s.id} | ${(s.description ?? '').slice(0, 90)}`);
}
