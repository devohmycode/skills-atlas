import { describe, expect, it } from 'vitest';
import { assemble } from '../src/catalog/build.js';
import { classify } from '../src/catalog/classify.js';
import { compareSkills, dedupe } from '../src/catalog/dedupe.js';
import { findSkillDir, guessPaths } from '../src/catalog/enrich.js';
import { INSTALLED_THEME, mergeInstalled } from '../src/catalog/installed.js';
import {
  cleanDescription,
  fixMojibake,
  frontmatterDescription,
  parseGitHubUrl,
} from '../src/catalog/normalize.js';
import { groupByTheme, querySkills, resolveTheme } from '../src/catalog/query.js';
import { langFlag, LANGUAGES, normalizeLang } from '../src/i18n/index.js';
import { mapEntry as mapClaudePlugins } from '../src/catalog/sources/claude-plugins-dev.js';
import { mapSearchSkill, parseSkillsSitemap } from '../src/catalog/sources/skills-sh.js';
import { mapEntry as mapSmithery } from '../src/catalog/sources/smithery.js';
import claudePluginsPage from './fixtures/claude-plugins-dev.json' with { type: 'json' };
import smitheryPage from './fixtures/smithery.json' with { type: 'json' };

describe('normalize', () => {
  it('parses GitHub tree URLs', () => {
    expect(parseGitHubUrl('https://github.com/anthropics/claude-code/tree/main/plugins/fd/skills/fd')).toEqual({
      source: 'anthropics/claude-code',
      path: 'plugins/fd/skills/fd',
    });
    expect(parseGitHubUrl('https://github.com/o/r.git')).toEqual({ source: 'o/r', path: undefined });
    expect(parseGitHubUrl('https://gitlab.com/o/r')).toBeUndefined();
  });

  it('repairs double-encoded UTF-8', () => {
    const latin1 = (s: string) => Buffer.from(s, 'utf8').toString('latin1');
    const cp1252 = (s: string) => new TextDecoder('windows-1252').decode(Buffer.from(s, 'utf8'));
    expect(fixMojibake(latin1('飞书即时通讯'))).toBe('飞书即时通讯');
    expect(fixMojibake(cp1252('コーディング — “quotes”'))).toBe('コーディング — “quotes”');
    expect(fixMojibake('Ã©tÃ©')).toBe('été');
    expect(fixMojibake('déjà vu')).toBe('déjà vu');
  });

  it('drops YAML block indicators left as descriptions', () => {
    expect(cleanDescription('>')).toBeUndefined();
    expect(cleanDescription('|-')).toBeUndefined();
    expect(cleanDescription('  a \n  b ')).toBe('a b');
  });

  it('reads inline, quoted and block descriptions from SKILL.md', () => {
    expect(frontmatterDescription('---\nname: x\ndescription: Plain text.\n---\nbody')).toBe('Plain text.');
    expect(frontmatterDescription('---\ndescription: "Quoted: yes"\n---')).toBe('Quoted: yes');
    expect(frontmatterDescription('---\nname: x\ndescription: >\n  Folded\n  lines.\nlicense: MIT\n---')).toBe('Folded lines.');
    expect(frontmatterDescription('no frontmatter')).toBeUndefined();
  });
});

describe('sources', () => {
  it('maps claude-plugins.dev entries', () => {
    const skills = claudePluginsPage.skills.map(mapClaudePlugins);
    expect(skills[0]).toMatchObject({
      origin: 'claude-plugins.dev',
      name: 'frontend-design',
      source: 'anthropics/claude-code',
      path: 'plugins/frontend-design/skills/frontend-design',
      installs: 23292,
      stars: 52420,
    });
  });

  it('maps Smithery entries, taking the name from the git path', () => {
    const skills = smitheryPage.skills.map(mapSmithery);
    expect(skills[0]).toMatchObject({ name: 'smithery-ai-cli', source: 'smithery-ai/cli' });
    expect(skills[1]).toMatchObject({ name: 'frontend-design', labels: ['Design', 'Coding'], stars: 63077 });
  });

  it('parses skills.sh sitemaps and search results', () => {
    const xml = `<urlset><url><loc>https://www.skills.sh/vercel-labs/skills/find-skills</loc></url>
      <url><loc>https://www.skills.sh/vercel-labs</loc></url></urlset>`;
    expect(parseSkillsSitemap(xml)).toEqual([
      { origin: 'skills.sh', name: 'find-skills', source: 'vercel-labs/skills', rank: 1 },
    ]);
    expect(mapSearchSkill({ source: 'supabase/agent-skills', name: 'supabase', installs: 5 })).toEqual({
      origin: 'skills.sh',
      name: 'supabase',
      source: 'supabase/agent-skills',
      installs: 5,
    });
    expect(mapSearchSkill({ source: 'vercel.com', name: 'x' })).toBeUndefined();
  });
});

describe('dedupe', () => {
  it('merges the same skill across sources', () => {
    const [merged, ...rest] = dedupe([
      { origin: 'skills.sh', name: 'PDF', source: 'anthropics/skills', installs: 100 },
      { origin: 'claude-plugins.dev', name: 'pdf', source: 'Anthropics/skills', installs: 10, stars: 5, description: 'Handle PDFs' },
      { origin: 'smithery', name: 'pdf', source: 'anthropics/skills', labels: ['Productivity'] },
    ]);
    expect(rest).toHaveLength(0);
    expect(merged).toMatchObject({
      id: 'anthropics/skills@PDF',
      installs: 100,
      stars: 5,
      description: 'Handle PDFs',
      labels: ['Productivity'],
      origins: ['skills.sh', 'claude-plugins.dev', 'smithery'],
    });
  });
});

describe('classify', () => {
  it('uses the name, the description and source labels', () => {
    expect(classify({ name: 'react-best-practices', description: 'React and Next.js patterns', labels: [] })[0]).toBe('frontend');
    expect(classify({ name: 'supabase-postgres', description: 'Postgres performance', labels: [] })[0]).toBe('databases');
    expect(classify({ name: 'pdf', description: 'Extract text from PDF documents', labels: [] })[0]).toBe('documents');
    expect(classify({ name: 'zzz', labels: ['Security'] })).toEqual(['security']);
    expect(classify({ name: 'zzz', labels: [] })).toEqual(['other']);
  });

  it('keeps a second theme only when it scores close to the first', () => {
    const themes = classify({ name: 'docker-postgres', description: 'Run a Postgres database in Docker', labels: [] });
    expect(themes).toHaveLength(2);
    expect(themes).toEqual(expect.arrayContaining(['devops', 'databases']));
  });
});

describe('query', () => {
  const catalog = assemble({
    'skills.sh': [
      { origin: 'skills.sh', name: 'react-hooks', source: 'a/b', installs: 50, description: 'React hooks' },
      { origin: 'skills.sh', name: 'pentest', source: 'c/d', installs: 5, description: 'Security testing' },
    ],
    'claude-plugins.dev': [{ origin: 'claude-plugins.dev', name: 'unknown-thing', source: 'e/f' }],
    smithery: [],
  });

  it('sorts by popularity and hides skills without signal by default', () => {
    expect(catalog.skills[0]!.name).toBe('react-hooks');
    expect(querySkills(catalog).map((s) => s.name)).toEqual(['react-hooks', 'pentest']);
    expect(querySkills(catalog, { all: true })).toHaveLength(3);
  });

  it('filters by theme, search and installs', () => {
    expect(querySkills(catalog, { themes: ['security'] }).map((s) => s.name)).toEqual(['pentest']);
    expect(querySkills(catalog, { search: 'hooks react' }).map((s) => s.name)).toEqual(['react-hooks']);
    expect(querySkills(catalog, { minInstalls: 10 })).toHaveLength(1);
  });

  it('resolves themes by id or label, accents ignored', () => {
    expect(resolveTheme(catalog, 'securite')?.id).toBe('security');
    expect(resolveTheme(catalog, 'Security')?.id).toBe('security');
    expect(resolveTheme(catalog, 'bases de donnees')?.id).toBe('databases');
    expect(resolveTheme(catalog, 'frontend')?.id).toBe('frontend');
    expect(resolveTheme(catalog, 'nope')).toBeUndefined();
  });

  it('groups skills under every theme they belong to', () => {
    const groups = groupByTheme(catalog.themes, querySkills(catalog));
    expect(groups.map((g) => g.theme.id)).toContain('frontend');
    expect(groups.every((g) => g.skills.length > 0)).toBe(true);
  });
});

describe('ordering', () => {
  it('puts skills.sh-ranked skills first, in rank order, then by popularity', () => {
    const mk = (id: string, extra: object) => ({ id, name: id, source: 'o/r', labels: [], origins: [], themes: [], ...extra });
    const sorted = [
      mk('small-but-ranked', { rank: 2 }),
      mk('many-stars', { stars: 9000 }),
      mk('top', { rank: 1, installs: 10 }),
      mk('few-installs', { installs: 50 }),
    ].sort(compareSkills);
    expect(sorted.map((s) => s.id)).toEqual(['top', 'small-but-ranked', 'many-stars', 'few-installs']);
  });
});

describe('enrich', () => {
  it('locates a skill directory in a repository tree', () => {
    const paths = ['README.md', 'skills/pdf/SKILL.md', 'plugins/x/skills/pdf/SKILL.md', 'skills/docx/SKILL.md'];
    expect(findSkillDir(paths, 'pdf')).toBe('skills/pdf');
    expect(findSkillDir(paths, 'PDF')).toBe('skills/pdf');
    expect(findSkillDir(paths, 'xlsx')).toBeUndefined();
    expect(findSkillDir(['SKILL.md', 'README.md'], 'solo')).toBe('');
  });

  it('guesses the usual layouts first', () => {
    expect(guessPaths('pdf')[0]).toBe('skills/pdf');
  });
});

describe('installed skills', () => {
  const mk = (source: string, name: string, themes: string[]) => ({ id: `${source}@${name}`, name, source, labels: [], origins: [], themes });
  const pdf = mk('anthropics/skills', 'pdf', ['documents']);
  const hidden = mk('a/b', 'rare', ['code']);
  const catalogSkills = [pdf, hidden, mk('c/d', 'other', ['ai'])];

  it('matches installed skills to the catalog, even hidden ones, and adds unknown ones', () => {
    const tree = mergeInstalled(catalogSkills, [pdf], [
      { name: 'PDF', source: 'Anthropics/skills', scope: 'project', agents: ['Claude Code'] },
      { name: 'rare', source: 'a/b', scope: 'project', agents: [] },
      { name: 'homemade', scope: 'project', agents: ['Codex'] },
    ]);
    expect([...tree.installed.entries()]).toEqual([
      ['anthropics/skills@pdf', 'PDF'],
      ['a/b@rare', 'rare'],
      ['local@homemade', 'homemade'],
    ]);
    const byId = new Map(tree.skills.map((s) => [s.id, s]));
    expect(byId.get('anthropics/skills@pdf')!.themes).toEqual([INSTALLED_THEME.id, 'documents']);
    expect(byId.get('a/b@rare')!.themes).toEqual([INSTALLED_THEME.id, 'code']);
    expect(byId.get('local@homemade')!.description).toContain('Codex');
    expect(tree.skills).toHaveLength(3);
    // The catalog itself is untouched.
    expect(pdf.themes).toEqual(['documents']);
  });
});

describe('i18n', () => {
  it('normalizes language codes', () => {
    expect(normalizeLang('FR')).toBe('fr');
    expect(normalizeLang('fr_FR.UTF-8')).toBe('fr');
    expect(normalizeLang('en-US')).toBe('en');
    expect(normalizeLang('de')).toBeUndefined();
    expect(normalizeLang(undefined)).toBeUndefined();
  });

  it('reads -l / --lang anywhere before --', () => {
    expect(langFlag(['-l', 'fr'])).toBe('fr');
    expect(langFlag(['themes', '--lang', 'en'])).toBe('en');
    expect(langFlag(['-l=fr', 'list'])).toBe('fr');
    expect(langFlag(['--lang=fr'])).toBe('fr');
    expect(langFlag(['list', '--', '-l', 'fr'])).toBeUndefined();
    expect(langFlag(['list'])).toBeUndefined();
    expect(langFlag(['-l'])).toBe('');
  });

  it('translates every theme in every language', () => {
    const ids = [...Object.keys(LANGUAGES.en.themes)];
    for (const messages of Object.values(LANGUAGES)) {
      for (const id of ids) expect(messages.themes[id], id).toBeTruthy();
    }
  });
});
