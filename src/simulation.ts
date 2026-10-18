import * as C from "./constants";
import type {
  OrreryState,
  Hex,
  SimState,
  MoteState,
  FaultKind,
  PartState,
  MoteType,
} from "./game";
import {
  add,
  rotate,
  eq,
  key,
  xy,
  tip,
  spokes,
  mechanism,
  mod,
  footprint,
  cost,
  period,
} from "./geometry";
export type Mutable<T> = T extends readonly (infer U)[]
  ? Mutable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: Mutable<T[K]> }
    : T;
export const copy = <T>(s: T): Mutable<T> =>
  JSON.parse(JSON.stringify(s)) as Mutable<T>;
type World = Mutable<OrreryState>;
type Sim = Mutable<SimState>;
export function component(sim: SimState, id: number): number[] {
  const ids = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const f of sim.filaments)
      if (ids.has(f.a) !== ids.has(f.b)) {
        ids.add(f.a);
        ids.add(f.b);
        changed = true;
      }
  }
  return [...ids];
}
export function remove(sim: Sim, ids: readonly number[]): void {
  sim.motes = sim.motes.filter((m) => !ids.includes(m.id));
  sim.filaments = sim.filaments.filter(
    (f) => !ids.includes(f.a) && !ids.includes(f.b),
  );
  sim.grips = sim.grips.filter((g) => !ids.includes(g.mote));
}
export function spawn(
  sim: Sim,
  h: Hex,
  type: MoteType,
  wheel: number | null = null,
): number {
  const id = sim.nextMoteId++;
  sim.motes.push({ ...h, type, id, wheel });
  return id;
}
export function bank(s: World): void {
  const sim = s.sim!;
  const cells = [...sim.areaHexes, ...sim.motes];
  for (const p of sim.poses) {
    const part = s.editor.parts.find((a) => a.id === p.part)!;
    cells.push(
      ...spokes(part.kind, p.rotation).map((d) => tip(p.cell, d, p.length)),
    );
  }
  sim.areaHexes = [
    ...new Map(cells.map((h) => [key(h), { q: h.q, r: h.r }])).values(),
  ];
}
export function boundary(s: World): void {
  const sim = s.sim!,
    c = s.challenge!;
  const sorted = [...s.editor.parts].sort((a, b) => a.r - b.r || a.q - b.q);
  const at = (h: Hex) => sim.motes.find((m) => eq(m, h));
  const free = (m: MoteState | undefined) =>
    !!m &&
    m.wheel === null &&
    !sim.filaments.some((f) => f.a === m.id || f.b === m.id) &&
    !sim.grips.some((g) => g.mote === m.id);
  const held = (id: number) =>
    component(sim, id).some((n) => sim.grips.some((g) => g.mote === n));
  const trans = (id: number, type: MoteType) => {
    sim.motes.find((m) => m.id === id)!.type = type;
  };
  for (const wave of [
    [
      "wane",
      "mirror",
      "ascend",
      "conjoin",
      "eclipse",
      "confluence",
      "dispersion",
    ],
    ["bind", "manifold", "triune"],
    ["sunder"],
    ["void"],
  ])
    for (const p of sorted.filter((p) => wave.includes(p.kind))) {
      const hs = footprint(p, c),
        ms = hs.map(at),
        [a, b] = ms;
      const ordinary = (m: MoteState | undefined) => m && m.wheel === null;
      const essence = (m: MoteState | undefined) =>
        m && C.ESSENCES.some((t) => t === m.type);
      const planet = a ? C.PLANETS.findIndex((t) => t === a.type) : -1;
      if (p.kind === "wane" && ordinary(a) && essence(a)) trans(a!.id, "dust");
      if (
        p.kind === "mirror" &&
        essence(a) &&
        ordinary(b) &&
        b!.type === "dust"
      )
        trans(b!.id, a!.type);
      if (
        p.kind === "ascend" &&
        free(a) &&
        a!.type === "mercury" &&
        ordinary(b)
      ) {
        const n = C.PLANETS.findIndex((t) => t === b!.type);
        if (n >= 0 && n < C.PLANETS.length - 1) {
          remove(sim, [a!.id]);
          trans(b!.id, C.PLANETS[n + 1]);
        }
      }
      if (
        p.kind === "conjoin" &&
        free(a) &&
        free(b) &&
        a!.type === b!.type &&
        planet >= 0 &&
        planet < C.PLANETS.length - 1 &&
        !ms[2]
      ) {
        remove(sim, [a!.id, b!.id]);
        spawn(sim, hs[2], C.PLANETS[planet + 1]);
      }
      if (
        p.kind === "eclipse" &&
        free(a) &&
        free(b) &&
        a!.type === "dust" &&
        b!.type === "dust" &&
        !ms[2] &&
        !ms[3]
      ) {
        remove(sim, [a!.id, b!.id]);
        spawn(sim, hs[2], "umbra");
        spawn(sim, hs[3], "lumen");
      }
      if (
        p.kind === "confluence" &&
        !a &&
        ms.slice(1).every(free) &&
        C.ESSENCES.every((t) => ms.slice(1).some((m) => m!.type === t))
      ) {
        remove(
          sim,
          ms.slice(1).map((m) => m!.id),
        );
        spawn(sim, hs[0], "aether");
      }
      if (
        p.kind === "dispersion" &&
        free(a) &&
        a!.type === "aether" &&
        ms.slice(1).every((m) => !m)
      ) {
        remove(sim, [a!.id]);
        C.ESSENCES.forEach((t, i) => spawn(sim, hs[i + 1], t));
      }
      if (["bind", "manifold", "triune"].includes(p.kind) && ordinary(a)) {
        for (const b of ms.slice(1))
          if (
            ordinary(b) &&
            !sim.filaments.some(
              (f) =>
                (f.a === a!.id && f.b === b!.id) ||
                (f.b === a!.id && f.a === b!.id),
            ) &&
            (p.kind !== "triune" || (a!.type === "nova" && b!.type === "nova"))
          )
            sim.filaments.push({
              a: a!.id,
              b: b!.id,
              weight: p.kind === "triune" ? 3 : 1,
            });
      }
      if (p.kind === "sunder" && a && b)
        sim.filaments = sim.filaments.filter(
          (f) =>
            !((f.a === a.id && f.b === b.id) || (f.b === a.id && f.a === b.id)),
        );
      if (p.kind === "void" && free(a)) remove(sim, [a!.id]);
    }
  for (const p of sorted.filter((p) => p.kind === "set")) {
    const pattern = c.products[p.index!];
    const origin = at(add(rotate(pattern.motes[0], p.rotation), p));
    if (!origin || held(origin.id)) continue;
    const ids = component(sim, origin.id);
    const n = pattern.repeat ? ids.length / pattern.motes.length : 1;
    if (
      !Number.isInteger(n) ||
      (pattern.repeat && n < C.REPEAT_MIN) ||
      ids.length !== pattern.motes.length * n
    )
      continue;
    const expected: { a: number; b: number; weight: number }[] = [];
    let valid = true;
    const pos = (h: Hex, i: number) =>
      add(
        rotate(
          add(
            h,
            pattern.repeat
              ? {
                  q: pattern.repeat.vector.q * i,
                  r: pattern.repeat.vector.r * i,
                }
              : { q: 0, r: 0 },
          ),
          p.rotation,
        ),
        p,
      );
    for (let i = 0; i < n; i++) {
      for (const m of pattern.motes) {
        const found = at(pos(m, i));
        if (
          !found ||
          found.type !== m.type ||
          found.wheel !== null ||
          !ids.includes(found.id)
        )
          valid = false;
      }
      for (const f of pattern.filaments) {
        const a = at(pos(f.a, i)),
          b = at(pos(f.b, i));
        if (a && b) expected.push({ a: a.id, b: b.id, weight: f.weight });
        else valid = false;
      }
      if (pattern.repeat && i < n - 1) {
        const f = pattern.repeat.link,
          a = at(pos(f.a, i)),
          b = at(pos(f.b, i));
        if (a && b) expected.push({ a: a.id, b: b.id, weight: f.weight });
        else valid = false;
      }
    }
    const actual = sim.filaments.filter((f) => ids.includes(f.a));
    if (
      valid &&
      actual.length === expected.length &&
      expected.every((f) =>
        actual.some(
          (g) =>
            g.weight === f.weight &&
            ((g.a === f.a && g.b === f.b) || (g.a === f.b && g.b === f.a)),
        ),
      )
    ) {
      remove(sim, ids);
      sim.tallies[p.index!] += n;
    }
  }
  for (const p of sorted.filter((p) => p.kind === "rise")) {
    const pattern = c.reagents[p.index!];
    const hs = pattern.motes.map((m) => add(rotate(m, p.rotation), p));
    if (hs.some(at)) continue;
    const ids = hs.map((h, i) => spawn(sim, h, pattern.motes[i].type));
    for (const f of pattern.filaments)
      sim.filaments.push({
        a: ids[pattern.motes.findIndex((m) => eq(m, f.a))],
        b: ids[pattern.motes.findIndex((m) => eq(m, f.b))],
        weight: f.weight,
      });
  }
  bank(s);
  if (
    s.completion &&
    sorted.some((p) => p.kind === "set") &&
    sim.tallies.every((n) => n >= c.target)
  ) {
    sim.status = "complete";
    sim.fraction = 0;
    sim.metrics = {
      cost: cost(s.editor.parts),
      cycles: sim.cycle + 1,
      area: sim.areaHexes.length,
    };
    s.menuIndex = 0;
    if (s.challengeRef) {
      const { mode, index } = s.challengeRef;
      const solved = mode === "campaign" ? s.campaignSolved : s.extrasSolved;
      if (!solved.includes(index)) solved.push(index);
      solved.sort((a, b) => a - b);
      const records = mode === "campaign" ? s.campaignRecords : s.extrasRecords;
      const old = records[index];
      records[index] = old
        ? {
            cost: Math.min(old.cost, sim.metrics.cost),
            cycles: Math.min(old.cycles, sim.metrics.cycles),
            area: Math.min(old.area, sim.metrics.area),
          }
        : { ...sim.metrics };
      if (mode === "campaign")
        s.unlockedCount = Math.max(
          s.unlockedCount,
          Math.min(index + 2, s.campaignRecords.length),
        );
    }
  }
}
export function start(s: World): void {
  if (!s.challenge) throw Error("No challenge open");
  s.sim = {
    status: "running",
    cycle: 0,
    fraction: 0,
    speed: C.DEFAULT_SPEED_INDEX,
    motes: [],
    nextMoteId: 1,
    filaments: [],
    poses: [],
    grips: [],
    tallies: s.challenge.products.map(() => 0),
    areaHexes: [],
    fault: null,
    metrics: null,
  };
  for (const p of s.editor.parts) {
    s.sim.areaHexes.push(...footprint(p, s.challenge));
    if (mechanism(p.kind)) {
      s.sim.poses.push({
        part: p.id,
        cell: { q: p.q, r: p.r },
        rotation: p.rotation,
        length: p.length,
      });
      if (p.kind === "wheel")
        C.WHEEL_MOTES.forEach((t, i) =>
          spawn(s.sim!, tip(p, mod(i + p.rotation), 1), t, p.id),
        );
    }
  }
  bank(s);
  boundary(s);
}
type Motion =
  | { kind: "still" }
  | { kind: "rotate"; center: Hex; direction: number }
  | { kind: "slide"; vector: Hex };
const still: Motion = { kind: "still" };
export interface Plan {
  sim: Sim;
  motions: Map<number, Motion>;
  poses: Sim["poses"];
  fault: Sim["fault"];
}
export function plan(s: OrreryState): Plan {
  const sim = copy(s.sim!),
    poses = copy(sim.poses),
    motions = new Map<number, Motion>(),
    actions = new Map<number, Motion>();
  const fail = (
    kind: FaultKind,
    parts: number[],
    motes: number[] = [],
  ): Plan => ({ sim, motions, poses, fault: { kind, parts, motes } });
  const P = period(s.editor.parts);
  for (const p of s.editor.parts.filter((p) => p.tape !== null)) {
    const ins = p.tape![sim.cycle % P] ?? null,
      pose = poses.find((a) => a.part === p.id)!;
    let motion: Motion = still;
    if (p.kind === "wheel" && ins && !["rotate-cw", "rotate-ccw"].includes(ins))
      return fail("impossible", [p.id]);
    if (ins === "extend" || ins === "retract") {
      if (p.kind !== "piston") return fail("impossible", [p.id]);
      const d = ins === "extend" ? 1 : -1;
      if (pose.length + d > C.ARM_MAX_LEN) return fail("overextended", [p.id]);
      if (pose.length + d < C.ARM_MIN_LEN) return fail("overretracted", [p.id]);
      const h = tip({ q: 0, r: 0 }, pose.rotation, d);
      motion = { kind: "slide", vector: h };
      pose.length += d;
    }
    if (ins === "advance" || ins === "recede") {
      const track = s.editor.parts.find(
        (p) => p.kind === "track" && p.cells!.some((h) => eq(h, pose.cell)),
      );
      if (!track) return fail("unmounted", [p.id]);
      const index = track.cells!.findIndex((h) => eq(h, pose.cell)),
        next = index + (ins === "advance" ? 1 : -1);
      if (!track.closed && (next < 0 || next >= track.cells!.length))
        return fail("track-end", [p.id]);
      const cell = track.cells![mod(next, track.cells!.length)];
      motion = {
        kind: "slide",
        vector: { q: cell.q - pose.cell.q, r: cell.r - pose.cell.r },
      };
      pose.cell = { ...cell };
    }
    if (ins === "rotate-cw" || ins === "rotate-ccw") {
      const d = ins === "rotate-cw" ? 1 : -1;
      motion = { kind: "rotate", center: pose.cell, direction: d };
      pose.rotation = mod(pose.rotation + d);
    }
    actions.set(p.id, motion);
  }
  for (const p of s.editor.parts)
    if (p.tape?.[sim.cycle % P] === "drop")
      sim.grips = sim.grips.filter((g) => g.part !== p.id);
  for (const p of s.editor.parts)
    if (p.tape?.[sim.cycle % P] === "grab") {
      const pose = sim.poses.find((a) => a.part === p.id)!;
      for (const d of spokes(p.kind, pose.rotation)) {
        const m = sim.motes.find(
          (m) => m.wheel === null && eq(m, tip(pose.cell, d, pose.length)),
        );
        if (m && !sim.grips.some((g) => g.part === p.id && g.spoke === d))
          sim.grips.push({ part: p.id, spoke: d, mote: m.id });
      }
    }
  for (const m of sim.motes) {
    if (m.wheel !== null) {
      motions.set(m.id, actions.get(m.wheel) ?? still);
      continue;
    }
    const ids = component(sim, m.id);
    const grips = sim.grips.filter((g) => ids.includes(g.mote));
    const imposed = grips.map((g) => {
      const p = s.editor.parts.find((p) => p.id === g.part)!,
        ins = p.tape?.[sim.cycle % P];
      if (ins === "pivot-cw" || ins === "pivot-ccw") {
        const a = sim.motes.find((m) => m.id === g.mote)!;
        return {
          kind: "rotate",
          center: { q: a.q, r: a.r },
          direction: ins === "pivot-cw" ? 1 : -1,
        } as Motion;
      }
      return actions.get(g.part) ?? still;
    });
    if (imposed.some((a) => JSON.stringify(a) !== JSON.stringify(imposed[0])))
      return fail(
        "torn",
        s.editor.parts
          .filter((p) => grips.some((g) => g.part === p.id))
          .map((p) => p.id),
        ids.sort((a, b) => a - b),
      );
    motions.set(m.id, imposed[0] ?? still);
  }
  return { sim, motions, poses, fault: null };
}
export function position(
  m: Hex,
  motion: Motion | undefined,
  t: number,
): { x: number; y: number } {
  const a = xy(m);
  if (!motion || motion.kind === "still") return a;
  if (motion.kind === "slide") {
    const v = xy(motion.vector),
      zero = xy({ q: 0, r: 0 });
    return { x: a.x + (v.x - zero.x) * t, y: a.y + (v.y - zero.y) * t };
  }
  const c = xy(motion.center),
    angle = ((motion.direction * Math.PI) / 3) * t;
  return {
    x: c.x + (a.x - c.x) * Math.cos(angle) - (a.y - c.y) * Math.sin(angle),
    y: c.y + (a.x - c.x) * Math.sin(angle) + (a.y - c.y) * Math.cos(angle),
  };
}
function end(m: Hex, motion: Motion | undefined): Hex {
  if (!motion || motion.kind === "still") return m;
  if (motion.kind === "slide") return add(m, motion.vector);
  return add(
    rotate(
      { q: m.q - motion.center.q, r: m.r - motion.center.r },
      motion.direction,
    ),
    motion.center,
  );
}
export function advance(s: World, cycles: number): void {
  let remaining = cycles;
  while (s.sim?.status === "running" && remaining > 1e-10) {
    const sim = s.sim,
      p = plan(s);
    if (p.fault) {
      sim.status = "faulted";
      sim.fault = p.fault;
      sim.fraction = 0;
      break;
    }
    sim.grips = p.sim.grips;
    const to = Math.min(1, sim.fraction + remaining);
    for (let k = 1; k <= C.COLLISION_SAMPLES; k++) {
      const t = k / C.COLLISION_SAMPLES;
      if (t <= sim.fraction + 1e-10 || t > to + 1e-10) continue;
      const hit = new Set<number>();
      for (let i = 0; i < sim.motes.length; i++)
        for (let j = i + 1; j < sim.motes.length; j++) {
          const a = sim.motes[i],
            b = sim.motes[j],
            pa = position(a, p.motions.get(a.id), t),
            pb = position(b, p.motions.get(b.id), t);
          if (
            Math.hypot(pa.x - pb.x, pa.y - pb.y) <
            2 * C.MOTE_COLLIDE_R - 1e-8
          ) {
            hit.add(a.id);
            hit.add(b.id);
          }
        }
      if (hit.size) {
        sim.status = "faulted";
        sim.fault = {
          kind: "collision",
          parts: [],
          motes: [...hit].sort((a, b) => a - b),
        };
        sim.fraction = t;
        return;
      }
    }
    remaining -= to - sim.fraction;
    sim.fraction = to;
    if (to >= 1 - 1e-10) {
      sim.motes = sim.motes.map((m) => ({
        ...m,
        ...end(m, p.motions.get(m.id)),
      }));
      sim.poses = p.poses;
      sim.grips = sim.grips.map((g) => {
        const before = p.sim.poses.find((a) => a.part === g.part)!,
          after = p.poses.find((a) => a.part === g.part)!;
        return { ...g, spoke: mod(g.spoke + after.rotation - before.rotation) };
      });
      sim.fraction = 0;
      boundary(s);
      if (sim.status === "running") sim.cycle++;
    } else break;
  }
}
export function livePositions(
  s: OrreryState,
): Map<number, { x: number; y: number }> {
  if (!s.sim) return new Map();
  const p = plan(s);
  return new Map(
    s.sim.motes.map((m) => [
      m.id,
      position(m, p.motions.get(m.id), s.sim!.fraction),
    ]),
  );
}
export function restPart(
  id: number,
  kind: PartState["kind"],
  q: number,
  r: number,
  rotation = 0,
  index: number | null = null,
): Mutable<PartState> {
  return {
    id,
    kind,
    q,
    r,
    rotation,
    length: C.ARM_MIN_LEN,
    cells: kind === "track" ? [{ q, r }] : null,
    closed: kind === "track" ? false : null,
    index,
    tape: mechanism(kind) ? [] : null,
  };
}
