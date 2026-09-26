import type { InstalledSkill } from '../install/run.js';
import type { Skill, Theme } from '../types.js';

export const INSTALLED_THEME: Theme = { id: 'installed', label: 'Already installed' };

export interface TreeData {
  /** Skills to show, installed ones also listed under `INSTALLED_THEME`. */
  skills: Skill[];
  /** Installed skill ids mapped to the name `skills remove` expects. */
  installed: Map<string, string>;
}

/**
 * Merges what `skills list` reports into the skills shown in the tree.
 * Installed skills are matched to the catalog by `owner/repo@name` (from the
 * lock file); those the catalog does not know, or installed without a
 * recorded source, get a synthetic entry so that they can still be unticked.
 * Installed catalog skills hidden by the filters are shown anyway.
 */
export function mergeInstalled(catalogSkills: Skill[], visible: Skill[], installed: InstalledSkill[]): TreeData {
  const key = (source: string, name: string) => `${source.toLowerCase()}@${name.toLowerCase()}`;
  const byKey = new Map(catalogSkills.map((s) => [key(s.source, s.name), s]));
  const shown = new Map(visible.map((s) => [s.id, s]));
  const ids = new Map<string, string>();

  for (const inst of installed) {
    const match = inst.source ? byKey.get(key(inst.source, inst.name)) : undefined;
    const base: Skill = match ?? {
      id: `${inst.source ?? 'local'}@${inst.name}`,
      name: inst.name,
      source: inst.source ?? 'local',
      description: inst.agents.length ? `→ ${inst.agents.join(', ')}` : undefined,
      labels: [],
      origins: [],
      themes: [],
    };
    if (ids.has(base.id)) continue;
    ids.set(base.id, inst.name);
    shown.set(base.id, { ...base, themes: [INSTALLED_THEME.id, ...base.themes] });
  }
  return { skills: [...shown.values()], installed: ids };
}
