export type Origin = 'claude-plugins.dev' | 'smithery' | 'skills.sh';

/** A skill as reported by one source, before merging. */
export interface RawSkill {
  origin: Origin;
  /** Skill name as `npx skills add --skill` expects it (frontmatter `name`). */
  name: string;
  /** Installable source, `owner/repo` on GitHub. */
  source: string;
  /** Path of the skill directory inside the repo, when known. */
  path?: string;
  description?: string;
  installs?: number;
  stars?: number;
  /** Position in the skills.sh sitemaps, which list the most installed skills first. */
  rank?: number;
  /** Categories assigned by the source itself (Smithery…). */
  labels?: string[];
}

/** A merged, classified catalog entry. */
export interface Skill {
  /** `owner/repo@name` — also accepted by `npx skills add`. */
  id: string;
  name: string;
  source: string;
  path?: string;
  description?: string;
  installs?: number;
  stars?: number;
  rank?: number;
  labels: string[];
  origins: Origin[];
  /** Theme ids, 1 or 2, the first being the primary theme. */
  themes: string[];
}

export interface Theme {
  id: string;
  label: string;
}

export interface Catalog {
  version: 1;
  generatedAt: string;
  themes: Theme[];
  skills: Skill[];
  stats: {
    raw: Record<Origin, number>;
    merged: number;
    byTheme: Record<string, number>;
  };
}

export type Scope = 'project' | 'global';
export type InstallMethod = 'symlink' | 'copy';

export interface InstallOptions {
  agents: string[];
  scope: Scope;
  method: InstallMethod;
  skillsVersion: string;
}
