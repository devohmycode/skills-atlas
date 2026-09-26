/**
 * Regenerates src/agents.generated.json from vercel-labs/skills `src/agents.ts`,
 * so that `--agent` values are validated against what `npx skills` accepts.
 *
 *   npm run sync-agents [-- --ref v1.7.0]
 */
import { writeFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const refIdx = args.indexOf('--ref');
const ref = refIdx >= 0 ? args[refIdx + 1] : 'main';
const url = `https://raw.githubusercontent.com/vercel-labs/skills/${ref}/src/agents.ts`;

const res = await fetch(url);
if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
const source = await res.text();

// Home-like variables of agents.ts and the directory they default to.
const BASES: Record<string, string> = {
  home: '~',
  configHome: '~/.config',
  claudeHome: '~/.claude',
  codexHome: '~/.codex',
  vibeHome: '~/.vibe',
  hermesHome: '~/.hermes',
  autohandHome: '~/.autohand',
  grokHome: '~/.grok',
  sarvamHome: '~/.sarvam',
};

interface AgentEntry {
  id: string;
  displayName: string;
  projectDir: string;
  /** User-level skills directory (`~` = home), absent for project-only agents. */
  globalDir?: string;
  /** Paths whose existence means the agent is installed (`~` = home). */
  detect: string[];
}

const body = source.slice(source.indexOf('export const agents'));
const blocks = body.split(/\n {2}(?=(?:'[a-z0-9-]+'|[a-z0-9]+): \{)/).slice(1);
const agents: AgentEntry[] = [];
for (const block of blocks) {
  const id = /^'?([a-z0-9-]+)'?: \{/.exec(block)?.[1];
  const displayName = /displayName: '([^']+)'/.exec(block)?.[1];
  const projectDir = /skillsDir: '([^']+)'/.exec(block)?.[1];
  if (!id || !displayName || !projectDir) continue;
  // `join(base, 'a')` or `join(base, 'a', 'b', …)`.
  const g = /globalSkillsDir: join\((\w+)((?:,\s*'[^']+')+)\)/.exec(block);
  const segments = g ? [...g[2]!.matchAll(/'([^']+)'/g)].map((x) => x[1]) : [];
  const globalDir = g && BASES[g[1]!]
    ? [BASES[g[1]!], ...segments].join('/')
    : /globalSkillsDir: getOpenClawGlobalSkillsDir\(\)/.test(block)
      ? '~/.openclaw/skills'
      : undefined;
  const detectBody = block.slice(block.indexOf('detectInstalled'));
  const detect: string[] = [];
  for (const m of detectBody.matchAll(/join\((\w+),\s*'([^']+)'\)/g)) {
    const base = BASES[m[1]!];
    if (base) detect.push(`${base}/${m[2]}`);
  }
  for (const m of detectBody.matchAll(/existsSync\((\w+)\)/g)) {
    const base = BASES[m[1]!];
    if (base && base !== '~') detect.push(base);
  }
  agents.push({ id, displayName, projectDir, globalDir, detect: [...new Set(detect)] });
}

if (agents.length < 20) throw new Error(`only ${agents.length} agents parsed — agents.ts format changed?`);
agents.sort((a, b) => a.id.localeCompare(b.id));
await writeFile('src/agents.generated.json', `${JSON.stringify({ ref, agents }, null, 2)}\n`);
console.log(`src/agents.generated.json: ${agents.length} agents (${ref})`);
