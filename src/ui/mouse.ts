import { useStdin, type DOMElement } from 'ink';
import { useEffect, useId, useRef, useState, type RefObject } from 'react';

/** Alternate screen, then buttons (1000) and every motion (1003, for hovering) in the SGR format (1006). */
const ENABLE = '\u001B[?1049h\u001B[H\u001B[?1000h\u001B[?1003h\u001B[?1006h';
const DISABLE = '\u001B[?1003l\u001B[?1000l\u001B[?1006l\u001B[?1049l';
/** Pointer shape (OSC 22): a hand over clickable things where the terminal supports it, ignored elsewhere. */
const pointerShape = (shape: 'pointer' | 'default') => `\u001B]22;${shape}\u001B\\`;

/** SGR mouse report, with or without its ESC (`useInput` strips it): `[<button;x;y` then M (press) or m (release). */
const SGR = /^\u001B?\[<(\d+);(\d+);(\d+)([Mm])$/;

export type MouseKind = 'click' | 'release' | 'move' | 'wheelUp' | 'wheelDown' | 'other';

export interface MouseEvent {
  kind: MouseKind;
  /** 1-based screen column and line, as the terminal reports them. */
  x: number;
  y: number;
}

export function parseMouse(input: string): MouseEvent | undefined {
  const match = SGR.exec(input);
  if (!match) return undefined;
  const [, b, x, y, final] = match;
  const button = Number(b);
  // Bits 2-4 carry shift/meta/ctrl, bit 5 motion (with or without a button held).
  const code = button & ~0b111100;
  let kind: MouseKind = 'other';
  if (button & 0b100000) kind = 'move';
  else if (code === 64) kind = 'wheelUp';
  else if (code === 65) kind = 'wheelDown';
  else if (code === 0) kind = final === 'M' ? 'click' : 'release';
  return { kind, x: Number(x), y: Number(y) };
}

/** Mouse reports reach `useInput` too: key handlers skip them with this. */
export const isMouseInput = (input: string) => SGR.test(input);

let active = false;

/**
 * Switches to the alternate screen and turns mouse reporting on, so that screen line 1 is Ink's
 * first line. Returns the function that restores the terminal; it also runs on exit.
 */
export function enableMouse(): () => void {
  if (active || !process.stdout.isTTY) return () => {};
  active = true;
  process.stdout.write(ENABLE);
  const restore = () => {
    if (!active) return;
    active = false;
    hovering.clear();
    process.stdout.write(pointerShape('default') + DISABLE);
    process.off('exit', restore);
  };
  process.on('exit', restore);
  return restore;
}

/** Clickable things under the mouse: the pointer is a hand while there is one. */
const hovering = new Set<string>();

/** Marks the thing `id` as hovered or not, and switches the pointer shape when that changes. */
function setHovering(id: string, on: boolean): void {
  if (!active || hovering.has(id) === on) return;
  const before = hovering.size > 0;
  if (on) hovering.add(id);
  else hovering.delete(id);
  if (before !== hovering.size > 0) process.stdout.write(pointerShape(hovering.size ? 'pointer' : 'default'));
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Where an element sits on the screen, 0-based: the Yoga offsets summed up to the root. */
function screenRect(node: DOMElement | null): Rect | undefined {
  if (!node?.yogaNode) return undefined;
  let top = 0;
  let left = 0;
  for (let n: DOMElement | undefined = node; n; n = n.parentNode) {
    if (!n.yogaNode) return undefined;
    top += n.yogaNode.getComputedTop();
    left += n.yogaNode.getComputedLeft();
  }
  return { top, left, width: node.yogaNode.getComputedWidth(), height: node.yogaNode.getComputedHeight() };
}

export interface BoxMouseEvent extends MouseEvent {
  /** Line inside the element, 0-based (negative or past its height when outside). */
  line: number;
}

/**
 * Calls `handler` for every mouse report while mouse reporting is on. Attach the returned ref to a
 * `<Box>`: `line` is then relative to its top, so that a list maps a click to an item.
 */
export function useMouse(handler: (event: BoxMouseEvent) => void, isActive = true): RefObject<DOMElement | null> {
  const ref = useRef<DOMElement>(null);
  const { internal_eventEmitter } = useStdin();
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    if (!isActive || !internal_eventEmitter) return;
    const onInput = (data: string) => {
      const event = parseMouse(data);
      if (!event) return;
      const top = screenRect(ref.current)?.top ?? 0;
      latest.current({ ...event, line: event.y - 1 - top });
    };
    internal_eventEmitter.on('input', onInput);
    return () => {
      internal_eventEmitter.removeListener('input', onInput);
    };
  }, [isActive, internal_eventEmitter]);
  return ref;
}

/**
 * A button: calls `onPress` on a click inside the `<Box>` holding the returned ref, and tells
 * whether the mouse is over it, for a hover style. Without `onPress` it is inert.
 */
export function useClick(onPress: (() => void) | undefined): { ref: RefObject<DOMElement | null>; hovered: boolean } {
  const id = useId();
  const [hovered, setHovered] = useState(false);
  const enabled = onPress !== undefined;
  const ref = useMouse((e) => {
    if (e.kind !== 'move' && e.kind !== 'click') return;
    const rect = screenRect(ref.current);
    const x = e.x - 1;
    const y = e.y - 1;
    const inside = !!rect && y >= rect.top && y < rect.top + rect.height && x >= rect.left && x < rect.left + rect.width;
    setHovered(inside);
    setHovering(id, inside);
    if (e.kind === 'click' && inside) onPress?.();
  }, enabled);
  // A button that turns inert or goes away is no longer a clickable thing under the mouse.
  useEffect(() => {
    if (enabled) return;
    setHovered(false);
    setHovering(id, false);
  }, [enabled, id]);
  useEffect(() => () => setHovering(id, false), [id]);
  return { ref, hovered: enabled && hovered };
}

/**
 * Mouse over a list of `lineCount` lines: attach `ref` to the list `<Box>`; `onMouse` gets every
 * report (clicks, wheel) and `hover` is the line under the mouse, when it holds an item.
 */
export function useListMouse(
  lineCount: number,
  onMouse: (event: BoxMouseEvent) => void,
): { ref: RefObject<DOMElement | null>; hover: number | undefined } {
  const id = useId();
  const [hover, setHover] = useState<number>();
  const ref = useMouse((e) => {
    if (e.kind === 'move' || e.kind === 'click') {
      const line = e.line >= 0 && e.line < lineCount ? e.line : undefined;
      setHover(line);
      setHovering(id, line !== undefined);
    }
    onMouse(e);
  });
  useEffect(() => () => setHovering(id, false), [id]);
  return { ref, hover: hover !== undefined && hover < lineCount ? hover : undefined };
}
