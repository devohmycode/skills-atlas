import type { Skill } from '../types.js';
import { LABEL_MAP, OTHER_THEME, THEMES, type ThemeRule } from './taxonomy.js';

const NAME_WEIGHT = 3;
const DESCRIPTION_WEIGHT = 1;
const LABEL_WEIGHT = 2;
/** A second theme is kept when it scores at least this share of the first. */
const SECONDARY_RATIO = 0.6;
const SECONDARY_MIN = 3;

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compile(rule: ThemeRule): RegExp {
  const parts = rule.keywords.map((k) => {
    const wildcard = k.endsWith('*');
    const body = escape(wildcard ? k.slice(0, -1) : k).replace(/\\?[ -]/g, '[\\s-]');
    return wildcard ? `${body}[a-z0-9]*` : body;
  });
  // Word boundaries that also treat `.` and `/` inside a keyword as part of it.
  return new RegExp(`(?<![a-z0-9])(?:${parts.join('|')})(?![a-z0-9])`, 'g');
}

const COMPILED = THEMES.map((rule) => ({ id: rule.id, re: compile(rule) }));

function countMatches(re: RegExp, text: string): number {
  if (!text) return 0;
  re.lastIndex = 0;
  let n = 0;
  while (re.exec(text)) n++;
  return n;
}

export function scoreThemes(skill: Pick<Skill, 'name' | 'description' | 'labels'>): Map<string, number> {
  const name = skill.name.toLowerCase().replace(/[_-]+/g, ' ');
  const description = (skill.description ?? '').toLowerCase();
  const scores = new Map<string, number>();
  for (const { id, re } of COMPILED) {
    const score = countMatches(re, name) * NAME_WEIGHT + Math.min(countMatches(re, description), 4) * DESCRIPTION_WEIGHT;
    if (score > 0) scores.set(id, score);
  }
  for (const label of skill.labels) {
    const theme = LABEL_MAP[label.toLowerCase()];
    if (theme) scores.set(theme, (scores.get(theme) ?? 0) + LABEL_WEIGHT);
  }
  return scores;
}

/** Returns 1 or 2 theme ids, the primary first; `other` when nothing matches. */
export function classify(skill: Pick<Skill, 'name' | 'description' | 'labels'>): string[] {
  const ranked = [...scoreThemes(skill).entries()].sort((a, b) => b[1] - a[1]);
  const first = ranked[0];
  if (!first) return [OTHER_THEME.id];
  const themes = [first[0]];
  const second = ranked[1];
  if (second && second[1] >= SECONDARY_MIN && second[1] >= first[1] * SECONDARY_RATIO) themes.push(second[0]);
  return themes;
}

export function classifyAll(skills: Skill[]): Skill[] {
  for (const s of skills) s.themes = classify(s);
  return skills;
}
