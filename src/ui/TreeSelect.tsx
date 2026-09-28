import { Box, Text, useInput } from 'ink';
import { useMemo, useRef, useState } from 'react';
import { groupByTheme, haystack, popularityLabel, SORT_ORDERS, sortSkills, type SortOrder } from '../catalog/query.js';
import { formatNumber, t, themeLabel } from '../i18n/index.js';
import type { InstalledEntry } from '../catalog/installed.js';
import type { Scope, Skill, Theme } from '../types.js';
import { ACCENT, BOX, Hints, Panel, useTerminalSize, type Hint } from './Layout.js';
import { isMouseInput, useListMouse } from './mouse.js';
import { fit, padStart, width } from './width.js';

type Row =
  | { kind: 'theme'; theme: Theme; skills: Skill[]; expanded: boolean }
  | { kind: 'skill'; skill: Skill; themeId: string };

export interface TreeSelectProps {
  themes: Theme[];
  skills: Skill[];
  initialSelected?: string[];
  /** Installed skill ids: ticked at start, unticking one means uninstalling it (from every scope). */
  installed?: Map<string, InstalledEntry>;
  /** Scopes read for installed skills, shown in the status line. */
  scopes?: Scope[];
  /** Starting order, changed with `s`. */
  initialSort?: SortOrder;
  /** Start with only official skills, toggled with `o`. */
  initialOfficial?: boolean;
  onSubmit: (ids: string[]) => void;
  onCancel: () => void;
}

/** Lines used around the list: header, status, search, details panel, hints (may wrap). */
const CHROME_LINES = 16;
/** Lines moved by one wheel notch. */
const WHEEL_STEP = 3;
/** Clicks up to this screen column on a theme row hit its checkbox (padding, pointer, arrow, box). */
const THEME_BOX_COLUMN = 7;
/** Marks official skills in the list and the details panel. */
const OFFICIAL_MARK = '◆';

/** Theme headers, each followed by its skills when open (always open during a search). */
function buildRows(groups: { theme: Theme; skills: Skill[] }[], expanded: Set<string>, filter: string): Row[] {
  const out: Row[] = [];
  for (const g of groups) {
    const isOpen = filter !== '' || expanded.has(g.theme.id);
    out.push({ kind: 'theme', theme: g.theme, skills: g.skills, expanded: isOpen });
    if (isOpen) for (const skill of g.skills) out.push({ kind: 'skill', skill, themeId: g.theme.id });
  }
  return out;
}

/** Long popularity for the details panel: "924,211 installs". */
function popularityLong(s: Skill): string {
  const m = t().tree;
  if (s.installs) return `${formatNumber(s.installs)} ${m.installs}`;
  if (s.stars) return `${formatNumber(s.stars)} ${m.stars}`;
  return s.rank !== undefined ? `${m.rank} #${formatNumber(s.rank)}` : '';
}

/** "project", "global" or "project + global". */
export function scopesLabel(scopes: Scope[]): string {
  return scopes.map((sc) => t().tree.where[sc]).join(' + ');
}

export function TreeSelect({
  themes,
  skills,
  initialSelected = [],
  installed = new Map(),
  scopes,
  initialSort = 'installs',
  initialOfficial = false,
  onSubmit,
  onCancel,
}: TreeSelectProps) {
  const m = t();
  const { columns, rows: termRows } = useTerminalSize();
  const [expanded, setExpandedState] = useState<Set<string>>(new Set());
  const [selected, setSelectedState] = useState<Set<string>>(new Set(initialSelected));
  const [cursor, setCursorState] = useState(0);
  // Keys can arrive faster than renders (held arrows, pasted input, a slow terminal): the
  // handlers read and write these through a ref, so that each key sees the previous one.
  const live = useRef({ expanded, selected, cursor });
  const setExpanded = (next: Set<string>) => {
    live.current.expanded = next;
    setExpandedState(next);
  };
  const setSelected = (next: Set<string>) => {
    live.current.selected = next;
    setSelectedState(next);
  };
  const setCursor = (next: number) => {
    live.current.cursor = next;
    setCursorState(next);
  };
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

  const rows = useMemo(() => buildRows(groups, expanded, filter), [groups, expanded, filter]);

  const height = Math.max(5, termRows - CHROME_LINES);
  const current = Math.min(cursor, Math.max(0, rows.length - 1));
  const top = Math.max(0, Math.min(current - Math.floor(height / 2), rows.length - height));
  const row = rows[current];
  const toInstall = [...selected].filter((id) => !installed.has(id)).length;
  const toRemove = [...installed.keys()].filter((id) => !selected.has(id)).length;

  // Column widths of skill rows: cursor+indent+box (8), name, source, status, popularity.
  const popW = 8;
  const statusW = Math.max(width(scopesLabel(['project', 'global'])), width(m.tree.toRemove)) + 3;
  const nameW = Math.max(18, Math.min(40, Math.floor(columns * 0.3)));
  // The screen has a 1-column padding on each side.
  const sourceW = Math.max(0, columns - 2 - 8 - nameW - 2 - statusW - 2 - popW - 1);

  /** Rows and cursor as the keys typed so far left them, even before the next render. */
  const liveRows = () => buildRows(groups, live.current.expanded, filter);
  const liveCurrent = (list: Row[]) => Math.min(live.current.cursor, Math.max(0, list.length - 1));
  const move = (delta: number) => {
    const list = liveRows();
    setCursor(Math.max(0, Math.min(list.length - 1, liveCurrent(list) + delta)));
  };
  const setOpen = (themeId: string, open: boolean) => {
    const next = new Set(live.current.expanded);
    if (open) next.add(themeId);
    else next.delete(themeId);
    setExpanded(next);
  };
  const toggle = (ids: string[]) => {
    const next = new Set(live.current.selected);
    const allOn = ids.every((id) => next.has(id));
    for (const id of ids) {
      if (allOn) next.delete(id);
      else next.add(id);
    }
    setSelected(next);
  };

  // Actions shared by the keys and the buttons of the hint bar.
  const changes = (sel: Set<string>) =>
    [...sel].some((id) => !installed.has(id)) || [...installed.keys()].some((id) => !sel.has(id));
  const canSubmit = changes(selected);
  const submit = () => onSubmit([...live.current.selected]);
  const startSearch = () => setEditingFilter(true);
  const endSearch = () => setEditingFilter(false);
  const clearSearch = () => {
    setFilter('');
    setEditingFilter(false);
    setCursor(0);
  };
  const cycleSort = () => {
    setSort((prev) => SORT_ORDERS[(SORT_ORDERS.indexOf(prev) + 1) % SORT_ORDERS.length]!);
    setCursor(0);
  };
  const toggleOfficial = () => {
    setOfficialOnly((prev) => !prev);
    setCursor(0);
  };
  const toggleAll = () =>
    setExpanded(live.current.expanded.size ? new Set() : new Set(groups.map((g) => g.theme.id)));

  // Wheel moves the cursor; a click ticks a skill, or opens a theme (ticks it on its checkbox).
  const { ref: listRef, hover } = useListMouse(Math.min(height, rows.length - top), (e) => {
    if (e.kind === 'wheelUp') move(-WHEEL_STEP);
    else if (e.kind === 'wheelDown') move(WHEEL_STEP);
    if (e.kind !== 'click' || e.line < 0 || e.line >= height) return;
    const index = top + e.line;
    const r = rows[index];
    if (!r) return;
    setEditingFilter(false);
    setCursor(index);
    if (r.kind === 'skill') toggle([r.skill.id]);
    else if (e.x <= THEME_BOX_COLUMN) toggle(r.skills.map((s) => s.id));
    else setOpen(r.theme.id, !r.expanded);
  });

  useInput((input, key) => {
    if (isMouseInput(input)) return;
    if (editingFilter) {
      if (key.return) endSearch();
      else if (key.escape) clearSearch();
      else if (key.backspace || key.delete) setFilter((f) => f.slice(0, -1));
      else if (input && !key.ctrl && !key.meta) setFilter((f) => f + input);
      setCursor(0);
      return;
    }
    const list = liveRows();
    const row = list[liveCurrent(list)];
    if (key.upArrow || input === 'k') move(-1);
    else if (key.downArrow || input === 'j') move(1);
    else if (key.pageUp) move(-height);
    else if (key.pageDown) move(height);
    else if (key.rightArrow && row?.kind === 'theme') setOpen(row.theme.id, true);
    else if (key.leftArrow && row) {
      const themeId = row.kind === 'theme' ? row.theme.id : row.themeId;
      setOpen(themeId, false);
      setCursor(liveRows().findIndex((r) => r.kind === 'theme' && r.theme.id === themeId));
    } else if (input === ' ' && row) {
      toggle(row.kind === 'theme' ? row.skills.map((s) => s.id) : [row.skill.id]);
    } else if (input === '/') startSearch();
    else if (input === 's') cycleSort();
    else if (input === 'o') toggleOfficial();
    else if (input === 'a') toggleAll();
    else if (key.escape && filter) setFilter('');
    else if (key.return && changes(live.current.selected)) submit();
    else if (key.return && row?.kind === 'theme') setOpen(row.theme.id, !row.expanded);
    else if (input === 'q' || key.escape) onCancel();
  });

  // Buttons do what their key does; continue is only clickable once something changes.
  const hints: Hint[] = editingFilter
    ? [
        [m.keyNames.enter, m.keys.done, endSearch],
        [m.keyNames.esc, m.keys.clear, clearSearch],
      ]
    : [
        [m.keyNames.space, m.keys.toggle],
        ['/', m.keys.search, startSearch],
        ...(filter ? [[m.keyNames.esc, m.keys.clear, clearSearch] as Hint] : []),
        ['a', m.keys.expandAll, toggleAll],
        ['s', m.keys.sort, cycleSort],
        ['o', m.keys.official, toggleOfficial],
        [m.keyNames.enter, m.keys.continue, canSubmit ? submit : undefined],
        ['q', m.keys.quit, onCancel],
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
          {scopes && <Text dimColor>{`   ${m.tree.scope(scopesLabel(scopes))}`}</Text>}
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

      <Box ref={listRef} flexDirection="column" height={height} marginTop={1}>
        {rows.slice(top, top + height).map((r, i) => {
          const focused = top + i === current;
          // Under the mouse: a lighter pointer and an underlined name, the row a click will hit.
          const hovered = i === hover && !focused;
          const pointer = <Text color={ACCENT}>{focused ? '❯ ' : hovered ? '› ' : '  '}</Text>;
          if (r.kind === 'theme') {
            const n = r.skills.filter((s) => selected.has(s.id)).length;
            const box = n === 0 ? BOX.off : n === r.skills.length ? BOX.on : BOX.some;
            return (
              <Box key={`t:${r.theme.id}`} justifyContent="space-between">
                <Text wrap="truncate-end">
                  {pointer}
                  <Text dimColor>{r.expanded ? '▾ ' : '▸ '}</Text>
                  <Text color={n ? 'green' : undefined}>{box} </Text>
                  <Text bold underline={hovered} color={focused || hovered ? ACCENT : undefined}>
                    {themeLabel(r.theme)}
                  </Text>
                </Text>
                <Text>
                  {n > 0 && <Text color="green">{`${formatNumber(n)} ✓   `}</Text>}
                  <Text dimColor>{padStart(formatNumber(r.skills.length), 7)}</Text>
                </Text>
              </Box>
            );
          }
          const s = r.skill;
          const isOn = selected.has(s.id);
          const entry = installed.get(s.id);
          const isInstalled = entry !== undefined;
          const status = entry ? (isOn ? `● ${scopesLabel(entry.scopes)}` : `✗ ${m.tree.toRemove}`) : '';
          return (
            <Text key={`s:${r.themeId}:${s.id}`} wrap="truncate-end">
              {pointer}
              {'  '}
              <Text color="blue">{s.official ? OFFICIAL_MARK : ' '} </Text>
              <Text color={isInstalled && !isOn ? 'red' : isOn ? 'green' : 'gray'}>{isOn ? BOX.on : BOX.off} </Text>
              <Text bold={focused} underline={hovered} color={focused || hovered ? ACCENT : undefined}>
                {fit(s.name, nameW)}
              </Text>
              <Text dimColor>{`  ${fit(s.source, sourceW)}`}</Text>
              <Text color={isInstalled && !isOn ? 'red' : 'cyan'}>{`  ${fit(status, statusW)}`}</Text>
              <Text dimColor>{padStart(popularityLabel(s), popW)}</Text>
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
                {installed.has(row.skill.id) && (
                  <Text color="cyan">{`  ● ${m.tree.installedIn(scopesLabel(installed.get(row.skill.id)!.scopes))}`}</Text>
                )}
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
