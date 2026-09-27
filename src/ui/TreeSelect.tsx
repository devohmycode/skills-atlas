import { Box, Text, useInput } from 'ink';
import { useMemo, useState } from 'react';
import { groupByTheme, haystack, popularityLabel, SORT_ORDERS, sortSkills, type SortOrder } from '../catalog/query.js';
import { formatNumber, t, themeLabel } from '../i18n/index.js';
import type { Skill, Theme } from '../types.js';
import { ACCENT, BOX, Hints, Panel, useTerminalSize } from './Layout.js';

type Row =
  | { kind: 'theme'; theme: Theme; skills: Skill[]; expanded: boolean }
  | { kind: 'skill'; skill: Skill; themeId: string };

export interface TreeSelectProps {
  themes: Theme[];
  skills: Skill[];
  initialSelected?: string[];
  /** Installed skill ids: ticked at start, unticking one means uninstalling it. */
  installed?: Map<string, string>;
  /** Shown in the status line. */
  scope?: string;
  /** Starting order, changed with `s`. */
  initialSort?: SortOrder;
  /** Start with only official skills, toggled with `o`. */
  initialOfficial?: boolean;
  onSubmit: (ids: string[]) => void;
  onCancel: () => void;
}

/** Lines used around the list: header, status, search, details panel, hints (may wrap). */
const CHROME_LINES = 16;
/** Marks official skills in the list and the details panel. */
const OFFICIAL_MARK = '◆';

function fit(text: string, width: number): string {
  if (width <= 0) return '';
  if (text.length <= width) return text.padEnd(width);
  return `${text.slice(0, Math.max(0, width - 1))}…`;
}

/** Long popularity for the details panel: "924,211 installs". */
function popularityLong(s: Skill): string {
  const m = t().tree;
  if (s.installs) return `${formatNumber(s.installs)} ${m.installs}`;
  if (s.stars) return `${formatNumber(s.stars)} ${m.stars}`;
  return s.rank !== undefined ? `${m.rank} #${formatNumber(s.rank)}` : '';
}

export function TreeSelect({
  themes,
  skills,
  initialSelected = [],
  installed = new Map(),
  scope,
  initialSort = 'installs',
  initialOfficial = false,
  onSubmit,
  onCancel,
}: TreeSelectProps) {
  const m = t();
  const { columns, rows: termRows } = useTerminalSize();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));
  const [cursor, setCursor] = useState(0);
  const [filter, setFilter] = useState('');
  const [editingFilter, setEditingFilter] = useState(false);
  const [sort, setSort] = useState<SortOrder>(initialSort);
  const [officialOnly, setOfficialOnly] = useState(initialOfficial);

  const texts = useMemo(() => new Map(skills.map((s) => [s.id, haystack(s)])), [skills]);
  const sorted = useMemo(() => sortSkills(skills, sort), [skills, sort]);
  const visible = useMemo(() => {
    const terms = filter.toLowerCase().split(/\s+/).filter(Boolean);
    return sorted.filter(
      (s) => (!officialOnly || s.official) && terms.every((term) => texts.get(s.id)!.includes(term)),
    );
  }, [sorted, texts, filter, officialOnly]);
  const groups = useMemo(() => groupByTheme(themes, visible), [themes, visible]);

  const rows = useMemo(() => {
    const out: Row[] = [];
    for (const g of groups) {
      // A search expands every group so that matches are visible.
      const isOpen = filter !== '' || expanded.has(g.theme.id);
      out.push({ kind: 'theme', theme: g.theme, skills: g.skills, expanded: isOpen });
      if (isOpen) for (const skill of g.skills) out.push({ kind: 'skill', skill, themeId: g.theme.id });
    }
    return out;
  }, [groups, expanded, filter]);

  const height = Math.max(5, termRows - CHROME_LINES);
  const current = Math.min(cursor, Math.max(0, rows.length - 1));
  const top = Math.max(0, Math.min(current - Math.floor(height / 2), rows.length - height));
  const row = rows[current];
  const toInstall = [...selected].filter((id) => !installed.has(id)).length;
  const toRemove = [...installed.keys()].filter((id) => !selected.has(id)).length;

  // Column widths of skill rows: cursor+indent+box (8), name, source, status, popularity.
  const popW = 8;
  const statusW = Math.max(m.tree.installed.length, m.tree.toRemove.length) + 3;
  const nameW = Math.max(18, Math.min(40, Math.floor(columns * 0.3)));
  // The screen has a 1-column padding on each side.
  const sourceW = Math.max(0, columns - 2 - 8 - nameW - 2 - statusW - 2 - popW - 1);

  const move = (delta: number) => setCursor(Math.max(0, Math.min(rows.length - 1, current + delta)));
  const setOpen = (themeId: string, open: boolean) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (open) next.add(themeId);
      else next.delete(themeId);
      return next;
    });
  const toggle = (ids: string[]) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = ids.every((id) => next.has(id));
      for (const id of ids) {
        if (allOn) next.delete(id);
        else next.add(id);
      }
      return next;
    });

  useInput((input, key) => {
    if (editingFilter) {
      if (key.return) setEditingFilter(false);
      else if (key.escape) {
        setFilter('');
        setEditingFilter(false);
      } else if (key.backspace || key.delete) setFilter((f) => f.slice(0, -1));
      else if (input && !key.ctrl && !key.meta) setFilter((f) => f + input);
      setCursor(0);
      return;
    }
    if (key.upArrow || input === 'k') move(-1);
    else if (key.downArrow || input === 'j') move(1);
    else if (key.pageUp) move(-height);
    else if (key.pageDown) move(height);
    else if (key.rightArrow && row?.kind === 'theme') setOpen(row.theme.id, true);
    else if (key.leftArrow && row) {
      const themeId = row.kind === 'theme' ? row.theme.id : row.themeId;
      setOpen(themeId, false);
      setCursor(rows.findIndex((r) => r.kind === 'theme' && r.theme.id === themeId));
    } else if (input === ' ' && row) {
      toggle(row.kind === 'theme' ? row.skills.map((s) => s.id) : [row.skill.id]);
    } else if (input === '/') setEditingFilter(true);
    else if (input === 's') {
      setSort((prev) => SORT_ORDERS[(SORT_ORDERS.indexOf(prev) + 1) % SORT_ORDERS.length]!);
      setCursor(0);
    } else if (input === 'o') {
      setOfficialOnly((prev) => !prev);
      setCursor(0);
    } else if (input === 'a') setExpanded((prev) => (prev.size ? new Set() : new Set(groups.map((g) => g.theme.id))));
    else if (key.escape && filter) setFilter('');
    else if (key.return && (toInstall > 0 || toRemove > 0)) onSubmit([...selected]);
    else if (key.return && row?.kind === 'theme') setOpen(row.theme.id, !row.expanded);
    else if (input === 'q' || key.escape) onCancel();
  });

  const hints: [string, string][] = editingFilter
    ? [
        [m.keyNames.enter, m.keys.done],
        [m.keyNames.esc, m.keys.clear],
      ]
    : [
        ['↑↓', m.keys.move],
        ['→←', `${m.keys.expand}/${m.keys.collapse}`],
        [m.keyNames.space, m.keys.toggle],
        ['/', m.keys.search],
        ['a', m.keys.expandAll],
        ['s', m.keys.sort],
        ['o', m.keys.official],
        [m.keyNames.enter, m.keys.continue],
        ['q', m.keys.quit],
      ];

  return (
    <Box flexDirection="column">
      {/* Status line: counts on the left, position on the right. */}
      <Box justifyContent="space-between">
        <Text>
          <Text bold>{m.tree.skills(formatNumber(visible.length))}</Text>
          <Text dimColor>{'   '}</Text>
          <Text color="green">
            {BOX.on} {m.tree.selected(selected.size)}
          </Text>
          {(toInstall > 0 || toRemove > 0) && (
            <Text>
              {'   '}
              <Text color="green">+{toInstall}</Text> <Text color="red">−{toRemove}</Text>
            </Text>
          )}
          {scope && <Text dimColor>{`   ${m.tree.scope(scope === 'global' ? m.scope.global : m.scope.project)}`}</Text>}
          <Text dimColor>{`   ${m.tree.sortedBy(m.tree.sort[sort])}`}</Text>
          {officialOnly && <Text color="blue">{`   ${OFFICIAL_MARK} ${m.tree.officialOnly}`}</Text>}
        </Text>
        <Text dimColor>{rows.length ? m.tree.position(formatNumber(current + 1), formatNumber(rows.length)) : ''}</Text>
      </Box>

      {/* Search line: always reserved so that the list does not jump. */}
      <Text>
        <Text color={editingFilter ? ACCENT : 'gray'}>/ {m.tree.searchLabel}: </Text>
        {filter ? <Text color="yellow">{filter}</Text> : editingFilter ? <Text dimColor>{m.tree.searchPlaceholder}</Text> : null}
        {editingFilter && <Text color={ACCENT}>▌</Text>}
      </Text>

      <Box flexDirection="column" height={height} marginTop={1}>
        {rows.slice(top, top + height).map((r, i) => {
          const focused = top + i === current;
          const pointer = <Text color={ACCENT}>{focused ? '❯ ' : '  '}</Text>;
          if (r.kind === 'theme') {
            const n = r.skills.filter((s) => selected.has(s.id)).length;
            const box = n === 0 ? BOX.off : n === r.skills.length ? BOX.on : BOX.some;
            return (
              <Box key={`t:${r.theme.id}`} justifyContent="space-between">
                <Text wrap="truncate-end">
                  {pointer}
                  <Text dimColor>{r.expanded ? '▾ ' : '▸ '}</Text>
                  <Text color={n ? 'green' : undefined}>{box} </Text>
                  <Text bold color={focused ? ACCENT : undefined}>
                    {themeLabel(r.theme)}
                  </Text>
                </Text>
                <Text>
                  {n > 0 && <Text color="green">{`${formatNumber(n)} ✓   `}</Text>}
                  <Text dimColor>{formatNumber(r.skills.length).padStart(7)}</Text>
                </Text>
              </Box>
            );
          }
          const s = r.skill;
          const isOn = selected.has(s.id);
          const isInstalled = installed.has(s.id);
          const status = isInstalled ? (isOn ? `● ${m.tree.installed}` : `✗ ${m.tree.toRemove}`) : '';
          return (
            <Text key={`s:${r.themeId}:${s.id}`} wrap="truncate-end">
              {pointer}
              {'  '}
              <Text color="blue">{s.official ? OFFICIAL_MARK : ' '} </Text>
              <Text color={isInstalled && !isOn ? 'red' : isOn ? 'green' : 'gray'}>{isOn ? BOX.on : BOX.off} </Text>
              <Text bold={focused} color={focused ? ACCENT : undefined}>
                {fit(s.name, nameW)}
              </Text>
              <Text dimColor>{`  ${fit(s.source, sourceW)}`}</Text>
              <Text color={isInstalled && !isOn ? 'red' : 'cyan'}>{`  ${fit(status, statusW)}`}</Text>
              <Text dimColor>{popularityLabel(s).padStart(popW)}</Text>
            </Text>
          );
        })}
      </Box>

      <Panel>
        {row?.kind === 'skill' ? (
          <>
            <Box justifyContent="space-between">
              <Text wrap="truncate-end">
                <Text bold>{row.skill.name}</Text>
                <Text dimColor>{`  ${row.skill.source}`}</Text>
                {row.skill.official && <Text color="blue">{`  ${OFFICIAL_MARK} ${m.tree.official}`}</Text>}
              </Text>
              <Text dimColor>{popularityLong(row.skill)}</Text>
            </Box>
            <Box height={2} overflow="hidden">
              <Text wrap="wrap">{row.skill.description ?? m.tree.noDescription}</Text>
            </Box>
          </>
        ) : row ? (
          <>
            <Text>
              <Text bold>{themeLabel(row.theme)}</Text>
              <Text dimColor>{`  ${m.tree.skills(formatNumber(row.skills.length))}`}</Text>
            </Text>
            <Box height={2}>
              <Text dimColor>{m.tree.groupHint}</Text>
            </Box>
          </>
        ) : (
          <Box height={3}>
            <Text dimColor>{m.tree.noMatch}</Text>
          </Box>
        )}
      </Panel>

      <Hints items={hints} />
    </Box>
  );
}
