import { Box, Text, useStdout } from 'ink';
import type { ReactNode } from 'react';
import { t } from '../i18n/index.js';
import { logo } from './logo.js';

export const ACCENT = 'cyan';

export type StepId = 'scope' | 'select' | 'agents' | 'method' | 'confirm';
export const STEPS: StepId[] = ['select', 'scope', 'agents', 'method', 'confirm'];

export function useTerminalSize(): { columns: number; rows: number } {
  const { stdout } = useStdout();
  return { columns: stdout?.columns ?? 80, rows: stdout?.rows ?? 24 };
}

/** Full ASCII logo and tagline, for the first screens when the terminal is tall enough. */
export function Banner() {
  const { columns } = useTerminalSize();
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text>{logo(columns)}</Text>
      <Text dimColor>{t().tagline}</Text>
    </Box>
  );
}

/** One-line title and the wizard steps, the current one highlighted. */
export function Header({ step }: { step: StepId }) {
  const current = STEPS.indexOf(step);
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold color={ACCENT}>
          SKILLS ATLAS
        </Text>
        <Text dimColor>{'  ·  '}</Text>
        {STEPS.map((s, i) => (
          <Text key={s}>
            {i > 0 && <Text dimColor>{'  ›  '}</Text>}
            {i < current ? (
              <Text color="green">✓ {t().steps[s]}</Text>
            ) : i === current ? (
              <Text bold color={ACCENT}>
                ● {t().steps[s]}
              </Text>
            ) : (
              <Text dimColor>○ {t().steps[s]}</Text>
            )}
          </Text>
        ))}
      </Box>
    </Box>
  );
}

/** Key hints: keys in the accent color, actions dimmed. */
export function Hints({ items }: { items: [key: string, action: string][] }) {
  return (
    <Box marginTop={1} flexWrap="wrap" columnGap={3}>
      {items.map(([k, action]) => (
        <Text key={k}>
          <Text bold color={ACCENT}>
            {k}
          </Text>{' '}
          <Text dimColor>{action}</Text>
        </Text>
      ))}
    </Box>
  );
}

/** Rounded panel for details and summaries. */
export function Panel({ children, color = 'gray', title }: { children: ReactNode; color?: string; title?: string }) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={color} paddingX={1}>
      {title && (
        <Text bold color={color === 'gray' ? undefined : color}>
          {title}
        </Text>
      )}
      {children}
    </Box>
  );
}

/** Checkbox glyphs: ticked, partly ticked (groups), empty. */
export const BOX = { on: '◉', some: '◐', off: '○' } as const;
