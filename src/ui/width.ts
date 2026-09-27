import stringWidth from 'string-width';

/**
 * Terminal columns taken by a string: Chinese, Japanese and Korean characters (and most emoji)
 * take two, so `.length` and `padEnd` misalign any column holding them.
 */
export const width = (text: string): number => stringWidth(text);

export function padEnd(text: string, columns: number): string {
  return text + ' '.repeat(Math.max(0, columns - width(text)));
}

export function padStart(text: string, columns: number): string {
  return ' '.repeat(Math.max(0, columns - width(text))) + text;
}

/** Exactly `columns` wide: padded, or cut with an ellipsis (never splitting a wide character). */
export function fit(text: string, columns: number): string {
  if (columns <= 0) return '';
  if (width(text) <= columns) return padEnd(text, columns);
  let out = '';
  let used = 0;
  for (const char of text) {
    const w = width(char);
    if (used + w > columns - 1) break;
    out += char;
    used += w;
  }
  return `${out}…${' '.repeat(columns - 1 - used)}`;
}
