import { resetMacro } from "./macros";
import * as C from "./constants";
import type {
  OrreryState,
  EditorState,
  PartState,
  PartKind,
  Mode,
  Screen,
  TapeCell,
} from "./game";
import { list } from "./content";
import { copy, type Mutable, restPart, start, advance } from "./simulation";
import {
  target,
  mechanism,
  footprint,
  eq,
  validate,
  mod,
  adjacent,
  arm,
} from "./geometry";
export type World = Mutable<OrreryState>;
export const emptyEditor = (): Mutable<EditorState> => ({
  parts: [],
  nextId: 1,
  selected: null,
  focus: "field",
  cursor: null,
  drag: null,
  undo: [],
  redo: [],
});
export function initial(): OrreryState {
  return {
    screen: "title",
    mode: "campaign",
    menuIndex: 0,
    titleIndex: 0,
    selectIndex: 0,
    howtoPage: 0,
    unlockedCount: 1,
    campaignSolved: [],
    extrasSolved: [],
    campaignRecords: list("campaign").map(() => null),
    extrasRecords: list("extras").map(() => null),
    campaignMachines: list("campaign").map(() => null),
    extrasMachines: list("extras").map(() => null),
    campaignLast: 0,
    extrasLast: 0,
    challenge: null,
    challengeRef: null,
    editor: emptyEditor(),
    sim: null,
    pointer: { x: 0, y: 0, down: false },
    completion: true,
    simTime: 0,
    muted: false,
  };
}
export function stash(s: World): void {
  if (s.challengeRef) {
    const { mode, index } = s.challengeRef;
    (mode === "campaign" ? s.campaignMachines : s.extrasMachines)[index] = copy(
      s.editor.parts,
    );
  }
}
export function screen(s: World, name: Screen): void {
  if (name === "editor") {
    if (!s.challenge) throw Error("No challenge open");
    s.screen = name;
    return;
  }
  stash(s);
  s.screen = name;
  s.challenge = null;
  s.challengeRef = null;
  s.sim = null;
  s.editor = emptyEditor();
  s.howtoPage = 0;
  s.menuIndex = name === "title" ? s.titleIndex : 0;
  if (name === "select")
    s.selectIndex = s.mode === "campaign" ? s.campaignLast : s.extrasLast;
}
export function open(
  s: World,
  mode: Mode,
  index: number,
  restore = false,
): void {
  const c = list(mode)[index];
  if (!c) throw Error("Challenge index outside bounds");
  if (restore) stash(s);
  s.mode = mode;
  s.challenge = copy(c);
  s.challengeRef = { mode, index };
  s.screen = "editor";
  s.sim = null;
  s.editor = emptyEditor();
  s.howtoPage = 0;
  s.menuIndex = 0;
  if (restore) {
    s.editor.parts = copy(
      (mode === "campaign" ? s.campaignMachines : s.extrasMachines)[index] ??
        [],
    );
    s.editor.nextId = Math.max(0, ...s.editor.parts.map((p) => p.id)) + 1;
    if (mode === "campaign") s.campaignLast = index;
    else s.extrasLast = index;
  }
}
export function cleanSelection(s: World): void {
  if (!s.editor.parts.some((p) => p.id === s.editor.selected))
    s.editor.selected = null;
  if (!s.editor.parts.some((p) => p.id === s.editor.cursor?.part))
    s.editor.cursor = null;
}
export function history(s: World, before: readonly PartState[]): void {
  if (JSON.stringify(before) !== JSON.stringify(s.editor.parts)) {
    s.editor.undo.push(copy(before));
    s.editor.redo = [];
  }
  cleanSelection(s);
}
export function edit(s: World, fn: () => void): void {
  const before = copy(s.editor.parts);
  try {
    fn();
    validate(s.editor.parts, s.challenge!);
    history(s, before);
  } catch {
    s.editor.parts = before;
  }
}
export const tray = (
  s: OrreryState,
): { kind: PartKind; index: number | null }[] =>
  s.challenge
    ? [
        ...C.PARTS.filter((k) => s.challenge!.permitted.includes(k)).map(
          (kind) => ({ kind, index: null }),
        ),
        ...s.challenge.reagents.map((_, index) => ({
          kind: "rise" as const,
          index,
        })),
        ...s.challenge.products.map((_, index) => ({
          kind: "set" as const,
          index,
        })),
      ]
    : [];
export const rows = (s: OrreryState) =>
  s.editor.parts.filter((p) => p.tape !== null);
export function scroll(s: OrreryState) {
  return {
    row: Math.max(
      0,
      rows(s).findIndex((p) => p.id === s.editor.cursor?.part) -
        (C.TAPE_ROWS_VISIBLE - 1),
    ),
    col: Math.max(0, (s.editor.cursor?.col ?? 0) - (C.TAPE_COLS_VISIBLE - 1)),
  };
}
export function solvedItems(s: OrreryState): string[] {
  return s.challengeRef && s.challengeRef.index < list(s.mode).length - 1
    ? [...C.SOLVED_ITEMS]
    : C.SOLVED_ITEMS.slice(1);
}
export function menuCount(s: OrreryState): number {
  return s.screen === "title"
    ? C.TITLE_ITEMS.length
    : s.screen === "howto"
      ? 1
      : s.screen === "select"
        ? list(s.mode).length
        : s.sim?.status === "complete"
          ? solvedItems(s).length
          : 0;
}
export function menuRect(
  s: OrreryState,
  i: number,
): { x: number; y: number; w: number; h: number } | null {
  if (i < 0 || i >= menuCount(s)) return null;
  if (s.screen === "title") return { x: 150, y: 365 + i * 65, w: 345, h: 50 };
  if (s.screen === "select") {
    const height = Math.min(45, 480 / list(s.mode).length);
    return { x: 180, y: 155 + i * height, w: 920, h: height - 4 };
  }
  if (s.screen === "howto") return { x: 160, y: 610, w: 300, h: 48 };
  return { x: 445, y: 355 + i * 52, w: 390, h: 45 };
}
export function confirm(s: World): void {
  if (s.screen === "title") {
    s.titleIndex = s.menuIndex;
    if (s.menuIndex === 2) screen(s, "howto");
    else {
      s.mode = s.menuIndex === 0 ? "campaign" : "extras";
      screen(s, "select");
    }
  } else if (s.screen === "howto") screen(s, "title");
  else if (s.screen === "select") {
    if (s.mode === "extras" || s.selectIndex < s.unlockedCount)
      open(s, s.mode, s.selectIndex, true);
  } else if (s.sim?.status === "complete") {
    const item = solvedItems(s)[s.menuIndex];
    if (item === C.SOLVED_ITEMS[0])
      open(s, s.mode, s.challengeRef!.index + 1, true);
    else if (item === C.SOLVED_ITEMS[1]) s.sim = null;
    else screen(s, "select");
  }
}
const menuPress = new WeakMap<object, number>();
function resolvePointer(
  state: OrreryState,
  type: "down" | "move" | "up",
  x: number,
  y: number,
  allowTake = true,
): OrreryState {
  const s = copy(state),
    prior = menuPress.get(state);
  s.pointer = {
    x,
    y,
    down: type === "down" ? true : type === "up" ? false : s.pointer.down,
  };
  if (menuCount(s)) {
    let hit = -1;
    for (let i = 0; i < menuCount(s); i++) {
      const r = menuRect(s, i)!;
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) hit = i;
    }
    if (hit >= 0) {
      if (s.screen === "select") s.selectIndex = hit;
      else s.menuIndex = hit;
    }
    if (type === "down") menuPress.set(s, hit);
    else if (type === "up") {
      if (allowTake && hit >= 0 && prior === hit) confirm(s);
    } else if (prior !== undefined) menuPress.set(s, prior);
    return s;
  }
  if (s.screen !== "editor") return s;
  const e = s.editor,
    h = target(x, y);
  if (type === "down") {
    e.focus = x >= C.TRAY_REGION_W && y >= C.TAPE_Y0 ? "tape" : "field";
    if (s.sim) return s;
    if (e.focus === "tape") {
      const sc = scroll(s),
        row = rows(s)[sc.row + Math.floor((y - C.TAPE_Y0) / C.TAPE_ROW_H)];
      if (row && x < C.TRAY_REGION_W + C.TAPE_LABEL_W)
        e.cursor = { part: row.id, col: 0 };
      else if (row && x >= C.TRAY_REGION_W + C.TAPE_X0)
        e.cursor = {
          part: row.id,
          col:
            sc.col +
            Math.floor((x - C.TRAY_REGION_W - C.TAPE_X0) / C.TAPE_CELL_W),
        };
      return s;
    }
    if (x >= C.TRAY_X0 && x < C.TRAY_X0 + C.TRAY_W && y >= C.TRAY_Y0) {
      const item = tray(s)[Math.floor((y - C.TRAY_Y0) / C.TRAY_SLOT_H)];
      if (
        item &&
        !(
          (item.kind === "rise" || item.kind === "set") &&
          e.parts.some((p) => p.kind === item.kind && p.index === item.index)
        )
      )
        e.drag = {
          kind: "place",
          part: item.kind,
          index: item.index,
          rotation: 0,
          length: 1,
          at: h,
          before: copy(e.parts),
        };
      return s;
    }
    if (
      x < C.TRAY_REGION_W ||
      x >= C.READOUT_X0 ||
      y < C.HEADING_H ||
      y >= C.TAPE_Y0
    )
      return s;
    const p = h
      ? [...e.parts]
          .sort((a, b) => Number(mechanism(b.kind)) - Number(mechanism(a.kind)))
          .find((p) => footprint(p, s.challenge!).some((a) => eq(a, h)))
      : undefined;
    e.selected = p?.id ?? null;
    if (p && h) {
      if (p.tape) e.cursor = { part: p.id, col: 0 };
      if (
        p.kind === "track" &&
        !p.closed &&
        (eq(h, p.cells![0]) || eq(h, p.cells![p.cells!.length - 1]))
      )
        e.drag = {
          kind: "lay",
          part: p.id,
          end:
            p.cells!.length === 1 || eq(h, p.cells![p.cells!.length - 1])
              ? "last"
              : "first",
          before: copy(e.parts),
        };
      else
        e.drag = {
          kind: "move",
          part: p.id,
          from: h,
          at: h,
          rotation: p.rotation,
          length: p.length,
          before: copy(e.parts),
        };
    }
  } else if (type === "move" && e.drag) {
    if (e.drag.kind !== "lay") e.drag.at = h;
    else if (h) {
      const d = e.drag,
        p = e.parts.find((p) => p.id === d.part)!,
        cells = p.cells!,
        path = d.end === "first" ? [...cells].reverse() : [...cells];
      if (path.length > 1 && eq(h, path[path.length - 2])) path.pop();
      else if (
        path.length >= 3 &&
        eq(h, path[0]) &&
        adjacent(h, path[path.length - 1])
      ) {
        p.closed = true;
        history(s, d.before);
        e.drag = null;
        return s;
      } else if (
        adjacent(h, path[path.length - 1]) &&
        !path.some((a) => eq(a, h))
      )
        path.push(h);
      const before = p.cells;
      p.cells = d.end === "first" ? path.reverse() : path;
      p.q = p.cells[0].q;
      p.r = p.cells[0].r;
      try {
        validate(e.parts, s.challenge!);
      } catch {
        p.cells = before;
        p.q = before![0].q;
        p.r = before![0].r;
      }
    }
  } else if (type === "up" && e.drag) {
    const d = e.drag;
    if (d.kind === "lay") {
      history(s, d.before);
    } else if (d.at || d.kind === "move") {
      const before = copy(e.parts);
      try {
        let p;
        if (d.kind === "place") {
          p = restPart(e.nextId, d.part, d.at!.q, d.at!.r, d.rotation, d.index);
          p.length = d.length;
          e.parts.push(p);
        } else {
          p = e.parts.find((p) => p.id === d.part)!;
          const dq = d.at ? d.at.q - d.from.q : 0,
            dr = d.at ? d.at.r - d.from.r : 0;
          p.q += dq;
          p.r += dr;
          if (p.cells)
            p.cells = p.cells.map((h) => ({ q: h.q + dq, r: h.r + dr }));
          p.rotation = d.rotation;
          p.length = d.length;
        }
        validate(e.parts, s.challenge!);
        if (d.kind === "place") e.nextId++;
        e.selected = p.id;
        if (p.tape) e.cursor = { part: p.id, col: 0 };
        history(s, d.before);
      } catch {
        e.parts = before;
        if (d.kind === "move") {
          const p = e.parts.find((p) => p.id === d.part)!;
          const original = copy(p);
          p.rotation = d.rotation;
          p.length = d.length;
          try {
            validate(e.parts, s.challenge!);
            history(s, d.before);
          } catch {
            e.parts = e.parts.map((p) => (p.id === original.id ? original : p));
          }
        }
      }
    }
    e.drag = null;
  }
  return s;
}
export function tapeWrite(
  p: Mutable<PartState>,
  col: number,
  value: TapeCell,
): void {
  if (!p.tape) throw Error("Part has no tape");
  while (p.tape.length <= col) p.tape.push(null);
  p.tape[col] = value;
  while (p.tape.length && p.tape[p.tape.length - 1] === null) p.tape.pop();
}
export function action(s: World, name: string): void {
  if (s.editor.drag) {
    const d = s.editor.drag;
    if (d.kind === "lay") return;
    const kind =
      d.kind === "place"
        ? d.part
        : s.editor.parts.find((p) => p.id === d.part)!.kind;
    if (name === "part-cw" && kind !== "track")
      d.rotation = mod(d.rotation + 1);
    if (name === "part-ccw" && kind !== "track")
      d.rotation = mod(d.rotation - 1);
    if (name === "part-grow" && arm(kind))
      d.length = Math.min(C.ARM_MAX_LEN, d.length + 1);
    if (name === "part-shrink" && arm(kind))
      d.length = Math.max(C.ARM_MIN_LEN, d.length - 1);
    return;
  }
  if (name === "back") {
    if (s.screen === "editor") {
      if (s.sim) s.sim = null;
      else screen(s, "select");
    } else if (s.screen !== "title") screen(s, "title");
    return;
  }
  if (menuCount(s)) {
    if (name === "confirm") confirm(s);
    if (name === "up" || name === "down") {
      const d = name === "up" ? -1 : 1;
      if (s.screen === "select")
        s.selectIndex = mod(s.selectIndex + d, menuCount(s));
      else s.menuIndex = mod(s.menuIndex + d, menuCount(s));
    }
    if (s.screen === "howto" && (name === "left" || name === "right"))
      s.howtoPage = Math.max(
        0,
        Math.min(C.HOWTO_PAGES - 1, s.howtoPage + (name === "left" ? -1 : 1)),
      );
    return;
  }
  if (s.screen !== "editor") return;
  if (name === "play" || name === "step") {
    if (!s.sim) {
      if (
        !tray(s)
          .filter((t) => t.kind === "rise" || t.kind === "set")
          .every((t) =>
            s.editor.parts.some(
              (p) => p.kind === t.kind && p.index === t.index,
            ),
          )
      )
        return;
      start(s);
      if (name === "step") (s as World).sim!.status = "paused";
    } else if (s.sim.status === "running" || s.sim.status === "paused") {
      if (name === "play")
        s.sim.status = s.sim.status === "running" ? "paused" : "running";
      else {
        s.sim.status = "running";
        advance(s, 1 - s.sim.fraction);
        if (s.sim.status === "running") s.sim.status = "paused";
      }
    }
    return;
  }
  if (s.sim) {
    if (
      ["running", "paused"].includes(s.sim.status) &&
      (name === "speed-up" || name === "speed-down")
    )
      s.sim.speed = Math.max(
        0,
        Math.min(
          C.SPEEDS.length - 1,
          s.sim.speed + (name === "speed-up" ? 1 : -1),
        ),
      );
    return;
  }
  const e = s.editor;
  if (name === "undo" || name === "redo") {
    const from = name === "undo" ? e.undo : e.redo,
      to = name === "undo" ? e.redo : e.undo;
    if (from.length) {
      to.push(copy(e.parts));
      e.parts = from.pop()!;
      cleanSelection(s);
    }
    return;
  }
  if (e.focus === "field") {
    const p = e.parts.find((p) => p.id === e.selected);
    if (!p) return;
    edit(s, () => {
      if (name === "part-delete")
        e.parts = e.parts.filter((a) => a.id !== p.id);
      if (name === "part-cw" && p.kind !== "track")
        p.rotation = mod(p.rotation + 1);
      if (name === "part-ccw" && p.kind !== "track")
        p.rotation = mod(p.rotation - 1);
      if (name === "part-grow" && arm(p.kind))
        p.length = Math.min(C.ARM_MAX_LEN, p.length + 1);
      if (name === "part-shrink" && arm(p.kind))
        p.length = Math.max(C.ARM_MIN_LEN, p.length - 1);
    });
  } else if (e.cursor) {
    const cursor = e.cursor,
      p = e.parts.find((p) => p.id === cursor.part)!;
    if (name === "left") cursor.col = Math.max(0, cursor.col - 1);
    if (name === "right") cursor.col++;
    if (name === "up" || name === "down") {
      const rs = rows(s),
        index = rs.findIndex((p) => p.id === cursor.part);
      cursor.part = rs[mod(index + (name === "up" ? -1 : 1), rs.length)].id;
    }
    if (name.startsWith("ins-"))
      edit(s, () => {
        const ins = name.slice(4);
        if (C.INSTRUCTIONS.some((i) => i === ins)) {
          tapeWrite(p, cursor.col, ins as TapeCell);
          cursor.col++;
        } else if (ins === "blank") tapeWrite(p, cursor.col, null);
        else if (ins === "erase" && cursor.col > 0)
          tapeWrite(p, --cursor.col, null);
        else if (ins === "repeat") {
          const cells = Array.from(
            { length: cursor.col },
            (_, i) => p.tape![i] ?? null,
          );
          for (const cell of cells) tapeWrite(p, cursor.col++, cell);
        } else if (ins === "reset") {
          for (const cell of resetMacro(p, cursor.col, e.parts))
            tapeWrite(p, cursor.col++, cell);
        }
      });
  }
}
export function carryMenuPress(from: OrreryState, to: OrreryState): void {
  const press = menuPress.get(from);
  if (press !== undefined) menuPress.set(to, press);
  const cue = editCues.get(from);
  if (cue) editCues.set(to, cue);
}

const editCues = new WeakMap<object, string>();
export function pointer(
  state: OrreryState,
  type: "down" | "move" | "up",
  x: number,
  y: number,
  allowTake = true,
): OrreryState {
  const next = resolvePointer(state, type, x, y, allowTake);
  if (
    type === "up" &&
    (JSON.stringify(state.editor.parts) !== JSON.stringify(next.editor.parts) ||
      state.editor.undo.length !== next.editor.undo.length)
  ) {
    const cue = machineCue(state.editor.parts, next.editor.parts);
    if (cue) editCues.set(next, cue);
  } else {
    const cue = editCues.get(state);
    if (cue) editCues.set(next, cue);
  }
  return next;
}
export function pointerCue(state: OrreryState): string | null {
  const cue = editCues.get(state) ?? null;
  editCues.delete(state);
  return cue;
}

export function machineCue(
  before: readonly PartState[],
  after: readonly PartState[],
): string | null {
  if (after.length < before.length) return C.CUES.erase;
  if (after.length > before.length) return C.CUES.place;
  const shape = (parts: readonly PartState[]) =>
    parts.map(({ id, kind, q, r, rotation, length, cells, closed, index }) => ({
      id,
      kind,
      q,
      r,
      rotation,
      length,
      cells,
      closed,
      index,
    }));
  return JSON.stringify(shape(before)) !== JSON.stringify(shape(after))
    ? C.CUES.place
    : null;
}
