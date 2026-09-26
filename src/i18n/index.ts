import type { Theme } from '../types.js';
import { en, type Messages } from './en.js';
import { fr } from './fr.js';

/** Available translations. Adding a language = one file implementing `Messages` + one entry here. */
export const LANGUAGES = { en, fr } satisfies Record<string, Messages>;
export type Lang = keyof typeof LANGUAGES;
export const DEFAULT_LANG: Lang = 'en';

let current: Lang = DEFAULT_LANG;

export function isLang(value: string | undefined): value is Lang {
  return !!value && Object.hasOwn(LANGUAGES, value);
}

/** Accepts `fr`, `FR`, `fr-FR`, `fr_FR.UTF-8`… */
export function normalizeLang(value: string | undefined): Lang | undefined {
  const code = value?.trim().toLowerCase().split(/[-_.]/)[0];
  return isLang(code) ? code : undefined;
}

export function setLang(lang: Lang): void {
  current = lang;
}

export function getLang(): Lang {
  return current;
}

/** Messages of the current language. */
export function t(): Messages {
  return LANGUAGES[current];
}

/** Display label of a theme in the current language, falling back to the catalog label. */
export function themeLabel(theme: Theme): string {
  return t().themes[theme.id] ?? theme.label;
}

/** Every label a theme is known by, in any language: used to resolve `--theme`. */
export function themeAliases(theme: Theme): string[] {
  return [theme.id, theme.label, ...Object.values(LANGUAGES).map((m) => m.themes[theme.id]).filter((l): l is string => !!l)];
}

/** Locale-aware number formatting (`71,571` / `71 571`). */
export function formatNumber(n: number): string {
  return n.toLocaleString(current === 'fr' ? 'fr-FR' : 'en-US');
}

/** Value of `-l fr`, `-l=fr`, `--lang fr` or `--lang=fr`, ignoring anything after `--`. */
export function langFlag(argv: string[]): string | undefined {
  const end = argv.indexOf('--');
  const args = end < 0 ? argv : argv.slice(0, end);
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === '-l' || a === '--lang') return args[i + 1] ?? '';
    const m = /^(?:-l|--lang)=(.*)$/.exec(a);
    if (m) return m[1];
  }
  return undefined;
}
