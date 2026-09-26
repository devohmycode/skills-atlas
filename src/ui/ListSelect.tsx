import { Box, Text, useInput } from 'ink';
import { useMemo, useState } from 'react';
import { t } from '../i18n/index.js';
import { ACCENT, BOX, Hints, useTerminalSize } from './Layout.js';

export interface Item<T extends string> {
  value: T;
  label: string;
  hint?: string;
  /** Short highlighted tag after the label (e.g. "detected"). */
  badge?: string;
}

export interface ListSelectProps<T extends string> {
  title: string;
  items: Item<T>[];
  multiple?: boolean;
  initial?: T[];
  onSubmit: (values: T[]) => void;
  onCancel: () => void;
}

/** Lines used around the list: header, title, filter, hints. */
const CHROME_LINES = 10;

/** Single or multiple choice list with type-to-filter, used by the wizard steps. */
export function ListSelect<T extends string>({ title, items, multiple, initial = [], onSubmit, onCancel }: ListSelectProps<T>) {
  const m = t();
  const { rows } = useTerminalSize();
  const [selected, setSelected] = useState<Set<T>>(new Set(initial));
  const [filter, setFilter] = useState('');
  const [cursor, setCursor] = useState(() => Math.max(0, items.findIndex((i) => i.value === initial[0])));

  const shown = useMemo(() => {
    const f = filter.toLowerCase();
    return f ? items.filter((i) => `${i.value} ${i.label}`.toLowerCase().includes(f)) : items;
  }, [items, filter]);
  const height = Math.max(3, Math.min(shown.length, rows - CHROME_LINES));
  const current = Math.min(cursor, Math.max(0, shown.length - 1));
  const top = Math.max(0, Math.min(current - Math.floor(height / 2), shown.length - height));
  const labelW = Math.min(28, Math.max(...items.map((i) => i.label.length + (i.badge ? i.badge.length + 3 : 0)))) + 2;

  useInput((input, key) => {
    const item = shown[current];
    if (key.upArrow) setCursor(Math.max(0, current - 1));
    else if (key.downArrow) setCursor(Math.min(shown.length - 1, current + 1));
    else if (key.pageUp) setCursor(Math.max(0, current - height));
    else if (key.pageDown) setCursor(Math.min(shown.length - 1, current + height));
    else if (key.escape) {
      if (filter) setFilter('');
      else onCancel();
    } else if (key.return) {
      if (!multiple) {
        if (item) onSubmit([item.value]);
      } else if (selected.size > 0) onSubmit(items.map((i) => i.value).filter((v) => selected.has(v)));
    } else if (multiple && input === ' ' && item) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(item.value)) next.delete(item.value);
        else next.add(item.value);
        return next;
      });
    } else if (key.backspace || key.delete) {
      setFilter((f) => f.slice(0, -1));
      setCursor(0);
    } else if (multiple && input && input !== ' ' && !key.ctrl && !key.meta && !key.tab) {
      setFilter((f) => f + input);
      setCursor(0);
    }
  });

  const hints: [string, string][] = multiple
    ? [
        ['↑↓', m.keys.move],
        [m.keyNames.space, m.keys.toggle],
        ['abc', m.keys.typeToFilter],
        [m.keyNames.enter, m.keys.continue],
        [m.keyNames.esc, m.keys.back],
      ]
    : [
        ['↑↓', m.keys.move],
        [m.keyNames.enter, m.keys.choose],
        [m.keyNames.esc, m.keys.back],
      ];

  return (
    <Box flexDirection="column">
      <Text bold>{title}</Text>
      {multiple && (
        <Text>
          <Text color="green">
            {BOX.on} {m.agents.selected(selected.size)}
          </Text>
          {filter ? <Text color="yellow">{`   / ${filter}`}</Text> : null}
        </Text>
      )}
      <Box marginBottom={1} />
      {shown.slice(top, top + height).map((item, i) => {
        const focused = top + i === current;
        const on = selected.has(item.value);
        const mark = multiple ? (on ? BOX.on : BOX.off) : focused ? BOX.on : BOX.off;
        const labelText = `${item.label}${item.badge ? ` · ${item.badge}` : ''}`;
        return (
          <Text key={item.value} wrap="truncate-end">
            <Text color={ACCENT}>{focused ? '❯ ' : '  '}</Text>
            <Text color={(multiple ? on : focused) ? 'green' : 'gray'}>{mark} </Text>
            <Text bold={focused} color={focused ? ACCENT : undefined}>
              {item.label}
            </Text>
            {item.badge && <Text color="green">{` · ${item.badge}`}</Text>}
            <Text>{' '.repeat(Math.max(1, labelW - labelText.length))}</Text>
            {item.hint && <Text dimColor>{item.hint}</Text>}
          </Text>
        );
      })}
      <Hints items={hints} />
    </Box>
  );
}
