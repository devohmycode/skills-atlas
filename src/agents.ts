import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import generated from './agents.generated.json' with { type: 'json' };

export interface Agent {
  id: string;
  displayName: string;
  projectDir: string;
  /** User-level skills directory (`~` = home); absent for project-only agents. */
  globalDir?: string;
  detect: string[];
}

/** Agents accepted by `npx skills add --agent`, from `npm run sync-agents`. */
export const AGENTS: Agent[] = generated.agents;
export const AGENTS_REF: string = generated.ref;

const byId = new Map(AGENTS.map((a) => [a.id, a]));

export function getAgent(id: string): Agent | undefined {
  return byId.get(id);
}

/** Returns the unknown ids; `*` (all agents) is always valid. */
export function unknownAgents(ids: string[]): string[] {
  return ids.filter((id) => id !== '*' && !byId.has(id));
}

/** Home-relative prefixes the skills CLI lets environment variables relocate. */
const OVERRIDES: [prefix: string, env: string][] = [
  ['~/.config', 'XDG_CONFIG_HOME'],
  ['~/.claude', 'CLAUDE_CONFIG_DIR'],
  ['~/.codex', 'CODEX_HOME'],
  ['~/.vibe', 'VIBE_HOME'],
  ['~/.hermes', 'HERMES_HOME'],
  ['~/.autohand', 'AUTOHAND_HOME'],
  ['~/.grok', 'GROK_HOME'],
  ['~/.sarvam', 'SARVAM_HOME'],
];

/** Turns a `~/…` path of agents.generated.json into an absolute path, honouring env overrides. */
export function expandHome(path: string): string {
  for (const [prefix, env] of OVERRIDES) {
    const value = process.env[env]?.trim();
    if (value && (path === prefix || path.startsWith(`${prefix}/`))) return join(value, path.slice(prefix.length));
  }
  return path.startsWith('~') ? join(homedir(), path.slice(1)) : path;
}

/** Agents whose config directory exists on this machine. */
export function detectAgents(exists: (p: string) => boolean = existsSync): Agent[] {
  return AGENTS.filter((a) => a.detect.some((p) => exists(expandHome(p))));
}
