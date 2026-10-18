import { validateChallenge } from "./validation";
import type {
  OrreryState,
  PartKind,
  MoteType,
  Mode,
  Screen,
  Focus,
  Metrics,
  Challenge,
  TapeCell,
  PartState,
} from "./game";
import * as C from "./constants";
import { list, reference, type Solution } from "./content";
import {
  copy,
  start,
  spawn,
  remove,
  restPart,
  livePositions,
} from "./simulation";
import {
  initial,
  emptyEditor,
  screen,
  open,
  menuCount,
  menuRect,
  pointer,
  tapeWrite,
  cleanSelection,
  type World,
} from "./editor";
import {
  validate,
  cost,
  period,
  mod,
  eq,
  adjacent,
  tip,
  spokes,
  arm,
} from "./geometry";
function integer(n: number, min = 0, max = Number.MAX_SAFE_INTEGER): void {
  if (!Number.isInteger(n) || n < min || n > max)
    throw Error(`Expected integer in ${min}..${max}`);
}
function challenge(s: World): Challenge {
  if (!s.challenge) throw Error("No challenge open");
  return s.challenge;
}
function sim(s: World) {
  if (!s.sim) throw Error("No live run");
  return s.sim;
}
function part(s: World, id: number) {
  const p = s.editor.parts.find((p) => p.id === id);
  if (!p) throw Error("Unknown part");
  return p;
}
function mote(s: World, id: number) {
  const m = sim(s).motes.find((m) => m.id === id);
  if (!m) throw Error("Unknown mote");
  return m;
}
function pose(s: World, id: number) {
  const p = sim(s).poses.find((p) => p.part === id);
  if (!p) throw Error("Part has no live pose");
  return p;
}
const change = (state: OrreryState, fn: (s: World) => void): OrreryState => {
  const s = copy(state);
  fn(s);
  return s;
};
function placement(s: World, p: PartState): void {
  const c = challenge(s);
  validate([...s.editor.parts, p], c);
  s.editor.parts.push(copy(p));
  s.editor.nextId++;
  if (s.sim && p.tape) {
    s.sim.poses.push({
      part: p.id,
      rotation: p.rotation,
      length: p.length,
      cell: { q: p.q, r: p.r },
    });
    if (p.kind === "wheel")
      C.WHEEL_MOTES.forEach((t, i) =>
        spawn(s.sim!, tip(p, mod(p.rotation + i), 1), t, p.id),
      );
  }
}
function newPart(
  s: World,
  kind: PartKind,
  q: number,
  r: number,
  rotation: number,
  index: number | null = null,
): void {
  if (!C.PARTS.includes(kind)) throw Error("Unknown kind");
  integer(rotation, 0, 5);
  integer(q, -Number.MAX_SAFE_INTEGER);
  integer(r, -Number.MAX_SAFE_INTEGER);
  placement(s, restPart(s.editor.nextId, kind, q, r, rotation, index));
}
function discard(s: World, id: number): void {
  part(s, id);
  s.editor.parts = s.editor.parts.filter((p) => p.id !== id);
  if (s.sim) {
    remove(
      s.sim,
      s.sim.motes.filter((m) => m.wheel === id).map((m) => m.id),
    );
    s.sim.poses = s.sim.poses.filter((p) => p.part !== id);
    s.sim.grips = s.sim.grips.filter((g) => g.part !== id);
  }
  cleanSelection(s);
}
export const debug = {
  version: C.ORRERY_DEBUG_VERSION,
  reset: (s: OrreryState): OrreryState => ({ ...initial(), muted: s.muted }),
  reconcile: (s: OrreryState): OrreryState => copy(s),
  setCompletion: (s: OrreryState, enabled: boolean) =>
    change(s, (s) => {
      s.completion = enabled;
    }),
  snapshot(s: OrreryState) {
    const group = (mode: Mode) => {
      const solved = mode === "campaign" ? s.campaignSolved : s.extrasSolved,
        records = mode === "campaign" ? s.campaignRecords : s.extrasRecords,
        machines = mode === "campaign" ? s.campaignMachines : s.extrasMachines;
      return {
        count: list(mode).length,
        ...(mode === "campaign" ? { unlockedCount: s.unlockedCount } : {}),
        solved: copy(solved),
        records: copy(records),
        stashed: machines.flatMap((p, i) => (p ? [i] : [])),
        last: mode === "campaign" ? s.campaignLast : s.extrasLast,
      };
    };
    const positions = livePositions(s);
    const d = s.editor.drag;
    return {
      version: C.ORRERY_DEBUG_VERSION,
      screen: s.screen,
      mode: s.mode,
      menuIndex: s.menuIndex,
      titleIndex: s.titleIndex,
      selectIndex: s.selectIndex,
      howtoPage: s.howtoPage,
      campaign: group("campaign"),
      extras: group("extras"),
      challenge: s.challenge
        ? {
            ...copy(s.challenge),
            source: s.challengeRef?.mode ?? "custom",
            index: s.challengeRef?.index ?? null,
          }
        : null,
      editor: {
        parts: copy(s.editor.parts),
        cost: cost(s.editor.parts),
        period: period(s.editor.parts),
        selected: s.editor.selected,
        focus: s.editor.focus,
        cursor: copy(s.editor.cursor),
        drag: d
          ? d.kind === "place"
            ? {
                kind: d.kind,
                part: d.part,
                index: d.index,
                rotation: d.rotation,
                length: d.length,
                at: copy(d.at),
              }
            : d.kind === "move"
              ? {
                  kind: d.kind,
                  part: d.part,
                  from: copy(d.from),
                  at: copy(d.at),
                }
              : { kind: d.kind, part: d.part, end: d.end }
          : null,
        undoDepth: s.editor.undo.length,
        redoDepth: s.editor.redo.length,
      },
      sim: s.sim
        ? {
            status: s.sim.status,
            cycle: s.sim.cycle,
            fraction: s.sim.fraction,
            speed: s.sim.speed,
            motes: s.sim.motes.map((m) => ({ ...m, ...positions.get(m.id)! })),
            filaments: copy(s.sim.filaments),
            poses: copy(s.sim.poses),
            grips: copy(s.sim.grips),
            tallies: copy(s.sim.tallies),
            area: s.sim.areaHexes.length,
            fault: copy(s.sim.fault),
            metrics: copy(s.sim.metrics),
          }
        : null,
      pointer: copy(s.pointer),
      completion: s.completion,
      muted: s.muted,
      simTime: s.simTime,
    };
  },
  setScreen: (s: OrreryState, name: Screen) =>
    change(s, (s) => {
      if (!["title", "howto", "select", "editor"].includes(name))
        throw Error("Unknown screen");
      screen(s, name);
    }),
  setMode: (s: OrreryState, mode: Mode) =>
    change(s, (s) => {
      if (mode !== "campaign" && mode !== "extras") throw Error("Unknown mode");
      s.mode = mode;
    }),
  setMenuIndex: (s: OrreryState, n: number) =>
    change(s, (s) => {
      integer(n, 0, menuCount(s) - 1);
      if (s.screen === "select") s.selectIndex = n;
      else s.menuIndex = n;
    }),
  setSelectIndex: (s: OrreryState, n: number) =>
    change(s, (s) => {
      integer(n, 0, list(s.mode).length - 1);
      s.selectIndex = n;
    }),
  setHowtoPage: (s: OrreryState, n: number) =>
    change(s, (s) => {
      integer(n, 0, C.HOWTO_PAGES - 1);
      s.howtoPage = n;
    }),
  setUnlockedCount: (s: OrreryState, n: number) =>
    change(s, (s) => {
      integer(n, 1, list("campaign").length);
      s.unlockedCount = n;
    }),
  setSolved: (s: OrreryState, mode: Mode, index: number, solved: boolean) =>
    change(s, (s) => {
      integer(index, 0, list(mode).length - 1);
      const set = new Set(
        mode === "campaign" ? s.campaignSolved : s.extrasSolved,
      );
      if (solved) set.add(index);
      else set.delete(index);
      const arr = [...set].sort((a, b) => a - b);
      if (mode === "campaign") s.campaignSolved = arr;
      else s.extrasSolved = arr;
    }),
  setRecord: (
    s: OrreryState,
    mode: Mode,
    index: number,
    metric: keyof Metrics,
    value: number,
  ) =>
    change(s, (s) => {
      integer(index, 0, list(mode).length - 1);
      integer(value);
      if (!["cost", "cycles", "area"].includes(metric))
        throw Error("Unknown metric");
      const records = mode === "campaign" ? s.campaignRecords : s.extrasRecords;
      records[index] = {
        ...(records[index] ?? { cost: 0, cycles: 0, area: 0 }),
        [metric]: value,
      };
    }),
  setLast: (s: OrreryState, mode: Mode, index: number) =>
    change(s, (s) => {
      integer(index, 0, list(mode).length - 1);
      if (mode === "campaign") s.campaignLast = index;
      else s.extrasLast = index;
    }),
  menuItemRect: menuRect,
  openChallenge: (s: OrreryState, mode: Mode, index: number) =>
    change(s, (s) => open(s, mode, index)),
  loadChallenge: (s: OrreryState, c: Challenge) =>
    change(s, (s) => {
      s.challenge = copy(validateChallenge(c));
      s.challengeRef = null;
      s.screen = "editor";
      s.editor = emptyEditor();
      s.sim = null;
      s.menuIndex = 0;
      s.howtoPage = 0;
    }),
  referenceSolution: (_s: OrreryState, mode: Mode, index: number) => {
    integer(index, 0, list(mode).length - 1);
    return copy(reference(mode, index));
  },
  clearMachine: (s: OrreryState) =>
    change(s, (s) => {
      challenge(s);
      for (const p of [...s.editor.parts]) discard(s, p.id);
      s.editor = emptyEditor();
    }),
  placePart: (
    s: OrreryState,
    kind: PartKind,
    q: number,
    r: number,
    rotation: number,
  ) =>
    change(s, (s) => {
      if (["track", "rise", "set"].includes(kind))
        throw Error("Use specialized placement");
      newPart(s, kind, q, r, rotation);
    }),
  placeRise: (
    s: OrreryState,
    index: number,
    q: number,
    r: number,
    rotation: number,
  ) =>
    change(s, (s) => {
      integer(index, 0, challenge(s).reagents.length - 1);
      newPart(s, "rise", q, r, rotation, index);
    }),
  placeSet: (
    s: OrreryState,
    index: number,
    q: number,
    r: number,
    rotation: number,
  ) =>
    change(s, (s) => {
      integer(index, 0, challenge(s).products.length - 1);
      newPart(s, "set", q, r, rotation, index);
    }),
  placeTrack: (s: OrreryState, q: number, r: number) =>
    change(s, (s) => newPart(s, "track", q, r, 0)),
  extendTrack: (s: OrreryState, id: number, q: number, r: number) =>
    change(s, (s) => {
      const p = part(s, id);
      if (!p.cells || p.closed) throw Error("Not an open track");
      p.cells.push({ q, r });
      validate(s.editor.parts, challenge(s));
    }),
  closeTrack: (s: OrreryState, id: number) =>
    change(s, (s) => {
      const p = part(s, id);
      if (!p.cells) throw Error("Not a track");
      p.closed = true;
      validate(s.editor.parts, challenge(s));
    }),
  removePart: (s: OrreryState, id: number) =>
    change(s, (s) => {
      challenge(s);
      discard(s, id);
    }),
  setPartRotation: (s: OrreryState, id: number, rotation: number) =>
    change(s, (s) => {
      integer(rotation, 0, 5);
      const p = part(s, id);
      if (p.kind === "track" && rotation !== 0) throw Error("Track rotation");
      p.rotation = rotation;
      validate(s.editor.parts, challenge(s));
    }),
  setPartLength: (s: OrreryState, id: number, length: number) =>
    change(s, (s) => {
      integer(length, C.ARM_MIN_LEN, C.ARM_MAX_LEN);
      const p = part(s, id);
      if (!arm(p.kind)) throw Error(`No length: ${p.kind}`);
      p.length = length;
      validate(s.editor.parts, challenge(s));
    }),
  movePart: (s: OrreryState, id: number, q: number, r: number) =>
    change(s, (s) => {
      const p = part(s, id),
        dq = q - p.q,
        dr = r - p.r;
      p.q = q;
      p.r = r;
      if (p.cells) p.cells = p.cells.map((h) => ({ q: h.q + dq, r: h.r + dr }));
      validate(s.editor.parts, challenge(s));
    }),
  setTapeCell: (
    s: OrreryState,
    id: number,
    col: number,
    instruction: TapeCell,
  ) =>
    change(s, (s) => {
      challenge(s);
      integer(col);
      if (instruction !== null && !C.INSTRUCTIONS.includes(instruction))
        throw Error("Unknown instruction");
      tapeWrite(part(s, id), col, instruction);
    }),
  loadSolution: (state: OrreryState, solution: Solution) =>
    change(state, (s) => {
      challenge(s);
      for (const p of [...s.editor.parts]) discard(s, p.id);
      s.editor = emptyEditor();
      for (const a of solution.parts) {
        if (a.kind === "track") {
          if (
            !Array.isArray(a.cells) ||
            a.cells.length === 0 ||
            typeof a.closed !== "boolean"
          )
            throw Error("Invalid track document");
        } else {
          if (a.rotation === undefined) throw Error("Missing rotation");
          integer(a.rotation, 0, C.DIRS.length - 1);
          if (
            C.PARTS.indexOf(a.kind) < 6 &&
            (!Array.isArray(a.tape) || a.length === undefined)
          )
            throw Error("Missing mechanism tape or length");
        }
        const h = a.kind === "track" ? a.cells?.[0] : a;
        if (!h || h.q === undefined || h.r === undefined)
          throw Error("Missing coordinates");
        const p = restPart(
          s.editor.nextId,
          a.kind,
          h.q,
          h.r,
          a.rotation ?? 0,
          a.index ?? null,
        );
        p.length = a.length ?? 1;
        p.tape = p.tape === null ? null : copy(a.tape ?? []);
        while (p.tape?.length && p.tape[p.tape.length - 1] === null)
          p.tape.pop();
        if (a.kind === "track") {
          p.cells = copy(a.cells ?? []);
          p.closed = a.closed ?? false;
        }
        placement(s, p);
      }
    }),
  readSolution: (s: OrreryState): Solution => {
    if (!s.challenge) throw Error("No challenge open");
    return {
      parts: s.editor.parts.map((p) =>
        p.kind === "track"
          ? { kind: p.kind, cells: copy(p.cells), closed: p.closed }
          : p.tape
            ? {
                kind: p.kind,
                q: p.q,
                r: p.r,
                rotation: p.rotation,
                length: p.length,
                tape: copy(p.tape),
              }
            : p.index !== null
              ? {
                  kind: p.kind,
                  q: p.q,
                  r: p.r,
                  rotation: p.rotation,
                  index: p.index,
                }
              : { kind: p.kind, q: p.q, r: p.r, rotation: p.rotation },
      ),
    };
  },
  setSelected: (s: OrreryState, id: number | null) =>
    change(s, (s) => {
      if (id !== null) part(s, id);
      s.editor.selected = id;
    }),
  setFocus: (s: OrreryState, where: Focus) =>
    change(s, (s) => {
      if (where !== "field" && where !== "tape") throw Error("Invalid focus");
      s.editor.focus = where;
    }),
  setCursor: (s: OrreryState, id: number | null, col: number) =>
    change(s, (s) => {
      integer(col);
      if (id !== null && !part(s, id).tape) throw Error("Part has no tape");
      s.editor.cursor = id === null ? null : { part: id, col };
    }),
  pointerDown: (s: OrreryState, x: number, y: number) =>
    pointer(s, "down", x, y),
  pointerMove: (s: OrreryState, x: number, y: number) =>
    pointer(s, "move", x, y),
  pointerUp: (s: OrreryState) => pointer(s, "up", s.pointer.x, s.pointer.y),
  startRun: (s: OrreryState) => change(s, start),
  stopRun: (s: OrreryState) =>
    change(s, (s) => {
      sim(s);
      s.sim = null;
    }),
  setPaused: (s: OrreryState, paused: boolean) =>
    change(s, (s) => {
      const a = sim(s);
      if (!["paused", "running"].includes(a.status))
        throw Error("Run is halted");
      a.status = paused ? "paused" : "running";
    }),
  setSpeed: (s: OrreryState, index: number) =>
    change(s, (s) => {
      integer(index, 0, C.SPEEDS.length - 1);
      sim(s).speed = index;
    }),
  setCycle: (s: OrreryState, n: number) =>
    change(s, (s) => {
      integer(n);
      sim(s).cycle = n;
    }),
  setTally: (s: OrreryState, index: number, n: number) =>
    change(s, (s) => {
      integer(index, 0, sim(s).tallies.length - 1);
      integer(n);
      sim(s).tallies[index] = n;
    }),
  clearMotes: (s: OrreryState) =>
    change(s, (s) => {
      const a = sim(s);
      a.motes = [];
      a.filaments = [];
      a.grips = [];
    }),
  spawnMote: (s: OrreryState, q: number, r: number, type: MoteType) =>
    change(s, (s) => {
      integer(q, -Number.MAX_SAFE_INTEGER);
      integer(r, -Number.MAX_SAFE_INTEGER);
      if (!C.MOTES.includes(type)) throw Error("Unknown mote type");
      if (sim(s).motes.some((m) => eq(m, { q, r })))
        throw Error("Occupied hex");
      spawn(sim(s), { q, r }, type);
    }),
  removeMote: (s: OrreryState, id: number) =>
    change(s, (s) => {
      mote(s, id);
      remove(sim(s), [id]);
    }),
  linkMotes: (s: OrreryState, a: number, b: number, weight: number) =>
    change(s, (s) => {
      const x = mote(s, a),
        y = mote(s, b);
      if (
        !adjacent(x, y) ||
        x.wheel !== null ||
        y.wheel !== null ||
        ![1, 3].includes(weight) ||
        sim(s).filaments.some(
          (f) => (f.a === a && f.b === b) || (f.a === b && f.b === a),
        )
      )
        throw Error("Invalid filament");
      sim(s).filaments.push({ a, b, weight });
    }),
  unlinkMotes: (s: OrreryState, a: number, b: number) =>
    change(s, (s) => {
      const arr = sim(s).filaments,
        filtered = arr.filter(
          (f) => !((f.a === a && f.b === b) || (f.a === b && f.b === a)),
        );
      if (filtered.length === arr.length) throw Error("Missing filament");
      sim(s).filaments = filtered;
    }),
  setGrip: (s: OrreryState, id: number, spoke: number, m: number) =>
    change(s, (s) => {
      integer(spoke, 0, 5);
      const p = part(s, id),
        po = pose(s, id),
        mo = mote(s, m);
      if (
        !arm(p.kind) ||
        !spokes(p.kind, po.rotation).includes(spoke) ||
        !eq(mo, tip(po.cell, spoke, po.length)) ||
        mo.wheel !== null
      )
        throw Error("Invalid grip");
      sim(s).grips = sim(s).grips.filter(
        (g) => g.part !== id || g.spoke !== spoke,
      );
      sim(s).grips.push({ part: id, spoke, mote: m });
    }),
  releaseGrip: (s: OrreryState, id: number, spoke: number) =>
    change(s, (s) => {
      const p = part(s, id),
        po = pose(s, id);
      integer(spoke, 0, 5);
      if (!arm(p.kind) || !spokes(p.kind, po.rotation).includes(spoke))
        throw Error("Part has no gripper on that spoke");
      sim(s).grips = sim(s).grips.filter(
        (g) => g.part !== id || g.spoke !== spoke,
      );
    }),
  setPoseRotation: (s: OrreryState, id: number, rotation: number) =>
    change(s, (s) => {
      integer(rotation, 0, 5);
      pose(s, id).rotation = rotation;
    }),
  setPoseLength: (s: OrreryState, id: number, length: number) =>
    change(s, (s) => {
      integer(length, C.ARM_MIN_LEN, C.ARM_MAX_LEN);
      if (!arm(part(s, id).kind)) throw Error("Part has no length");
      pose(s, id).length = length;
    }),
  setPoseCell: (s: OrreryState, id: number, q: number, r: number) =>
    change(s, (s) => {
      const p = part(s, id);
      const track = s.editor.parts.find((t) => t.cells?.some((h) => eq(h, p)));
      if (!track?.cells?.some((h) => eq(h, { q, r })))
        throw Error("Not a mounted track cell");
      pose(s, id).cell = { q, r };
    }),
};
