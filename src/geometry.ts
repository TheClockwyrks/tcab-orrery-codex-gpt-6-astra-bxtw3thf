import * as C from "./constants";
import type { Hex, PartState, Challenge, PartKind } from "./game";
export const mod = (n: number, d = 6) => ((n % d) + d) % d;
export const eq = (a: Hex, b: Hex) => a.q === b.q && a.r === b.r;
export const key = (a: Hex) => `${a.q},${a.r}`;
export const add = (a: Hex, b: Hex): Hex => ({ q: a.q + b.q, r: a.r + b.r });
export function rotate(h: Hex, n: number): Hex {
  let { q, r } = h;
  for (let i = 0; i < mod(n); i++) [q, r] = [-r, q + r];
  return { q, r };
}
export const onField = (h: Hex) =>
  Math.max(Math.abs(h.q), Math.abs(h.r), Math.abs(h.q + h.r)) <= C.FIELD_R;
export const adjacent = (a: Hex, b: Hex) =>
  C.DIRS.some(([q, r]) => a.q + q === b.q && a.r + r === b.r);
export const xy = (h: Hex) => ({
  x: C.FIELD_CX + C.HEX_PITCH * (h.q + h.r / 2),
  y: C.FIELD_CY + ((C.HEX_PITCH * Math.sqrt(3)) / 2) * h.r,
});
export const field: Hex[] = [];
for (let r = -C.FIELD_R; r <= C.FIELD_R; r++)
  for (let q = -C.FIELD_R; q <= C.FIELD_R; q++)
    if (onField({ q, r })) field.push({ q, r });
export function target(x: number, y: number): Hex | null {
  let best: Hex | null = null,
    dist = C.HEX_HIT_R ** 2 + 1e-8;
  for (const h of field) {
    const p = xy(h),
      d = (x - p.x) ** 2 + (y - p.y) ** 2;
    if (d < dist - 1e-8) {
      best = h;
      dist = d;
    }
  }
  return best;
}
export const mechanism = (kind: PartKind) => C.PARTS.indexOf(kind) < 6;
export const arm = (kind: PartKind) => C.PARTS.indexOf(kind) < 5;
export function spokes(kind: PartKind, rotation: number): number[] {
  return (
    kind === "biarm"
      ? [0, 3]
      : kind === "triarm"
        ? [0, 2, 4]
        : kind === "hexarm" || kind === "wheel"
          ? [0, 1, 2, 3, 4, 5]
          : [0]
  ).map((n) => mod(n + rotation));
}
export function tip(cell: Hex, d: number, length: number): Hex {
  const [q, r] = C.DIRS[mod(d)];
  return { q: cell.q + q * length, r: cell.r + r * length };
}
const footprints: Partial<Record<PartKind, number[][]>> = {
  bind: [
    [0, 0],
    [1, 0],
  ],
  triune: [
    [0, 0],
    [1, 0],
  ],
  sunder: [
    [0, 0],
    [1, 0],
  ],
  mirror: [
    [0, 0],
    [1, 0],
  ],
  ascend: [
    [0, 0],
    [1, 0],
  ],
  manifold: [
    [0, 0],
    [1, 0],
    [-1, 1],
    [0, -1],
  ],
  conjoin: [
    [0, 0],
    [1, 0],
    [0, 1],
  ],
  eclipse: [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, -1],
  ],
  confluence: [
    [0, 0],
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ],
  dispersion: [
    [0, 0],
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ],
  void: [[0, 0], ...C.DIRS.map((d) => [...d])],
};
export function footprint(p: PartState, c: Challenge): Hex[] {
  if (p.kind === "track") return [...p.cells!];
  let local: Hex[] = (footprints[p.kind] ?? [[0, 0]]).map(([q, r]) => ({
    q,
    r,
  }));
  if (p.kind === "rise" || p.kind === "set") {
    const pattern = (p.kind === "rise" ? c.reagents : c.products)[p.index!];
    if (!pattern) throw Error("Invalid pattern index");
    local = [...pattern.motes];
    if (p.kind === "set" && pattern.repeat)
      local.push(...pattern.motes.map((h) => add(h, pattern.repeat!.vector)));
  }
  return local.map((h) => add(rotate(h, p.rotation), p));
}
export function validate(parts: readonly PartState[], c: Challenge): void {
  const sig = new Set<string>(),
    track = new Set<string>(),
    bases = new Set<string>(),
    rings = new Set<string>(),
    ports = new Set<string>();
  for (const p of parts) {
    if (
      !C.PARTS.includes(p.kind) ||
      !Number.isInteger(p.q) ||
      !Number.isInteger(p.r) ||
      !Number.isInteger(p.rotation) ||
      p.rotation < 0 ||
      p.rotation >= C.DIRS.length ||
      !Number.isInteger(p.length) ||
      p.length < C.ARM_MIN_LEN ||
      p.length > C.ARM_MAX_LEN ||
      (!arm(p.kind) && p.length !== 1)
    )
      throw Error("Invalid part pose");
    if (p.kind === "track" && (!p.cells?.length || p.rotation !== 0))
      throw Error("Placement rule 6: invalid track");
    if (
      (p.kind === "rise" || p.kind === "set") &&
      (!Number.isInteger(p.index) || p.index! < 0)
    )
      throw Error("Invalid pattern index");
    if (p.tape?.some((i) => i !== null && !C.INSTRUCTIONS.includes(i)))
      throw Error("Unknown instruction");
    const cells = footprint(p, c);
    if (cells.some((h) => !onField(h)))
      throw Error("Placement rule 1: outside field");
    if (mechanism(p.kind)) {
      if (bases.has(key(p))) throw Error("Placement rule 4: shared anchor");
      bases.add(key(p));
      if (p.kind === "wheel")
        for (const d of C.DIRS) {
          const k = key(add(p, { q: d[0], r: d[1] }));
          if (rings.has(k)) throw Error("Placement rule 4: overlapping wheels");
          rings.add(k);
        }
    } else if (p.kind === "track") {
      for (const h of cells) {
        const k = key(h);
        if (sig.has(k)) throw Error("Placement rule 2: sigil overlap");
        if (track.has(k)) throw Error("Placement rule 3: track overlap");
        track.add(k);
      }
      if (
        cells.some((h, i) => i > 0 && !adjacent(h, cells[i - 1])) ||
        (p.closed &&
          (cells.length < 3 || !adjacent(cells[0], cells[cells.length - 1])))
      )
        throw Error("Placement rule 6: disconnected track");
    } else {
      for (const h of cells) {
        const k = key(h);
        if (sig.has(k) || track.has(k))
          throw Error("Placement rule 2: sigil overlap");
        sig.add(k);
      }
      if (p.kind === "rise" || p.kind === "set") {
        const k = `${p.kind}${p.index}`;
        if (ports.has(k)) throw Error("Placement rule 5: duplicate aperture");
        ports.add(k);
      }
    }
  }
}
export const cost = (parts: readonly PartState[]) =>
  parts.reduce(
    (n, p) =>
      n + C.PART_COSTS[p.kind] * (p.kind === "track" ? p.cells!.length : 1),
    0,
  );
export const period = (parts: readonly PartState[]) =>
  Math.max(1, ...parts.map((p) => p.tape?.length ?? 0));
