import * as C from "./constants";
import type { PartState, TapeCell, Hex } from "./game";
import { eq, mod } from "./geometry";
/** Expand from the prefix only. This deliberately ignores other arms and faults. */
export function resetMacro(
  part: PartState,
  col: number,
  parts: readonly PartState[],
): TapeCell[] {
  let rotation = part.rotation,
    length = part.length,
    cell: Hex = part;
  const track = parts.find(
    (p) => p.kind === "track" && p.cells!.some((h) => eq(h, part)),
  );
  for (let i = 0; i < col; i++) {
    const ins = part.tape?.[i];
    if (ins === "rotate-cw") rotation = mod(rotation + 1);
    if (ins === "rotate-ccw") rotation = mod(rotation - 1);
    if (part.kind !== "wheel" && ins === "extend")
      length = Math.min(C.ARM_MAX_LEN, length + 1);
    if (part.kind !== "wheel" && ins === "retract")
      length = Math.max(C.ARM_MIN_LEN, length - 1);
    if (track && (ins === "advance" || ins === "recede")) {
      const n =
        track.cells!.findIndex((h) => eq(h, cell)) +
        (ins === "advance" ? 1 : -1);
      cell =
        track.cells![
          track.closed
            ? mod(n, track.cells!.length)
            : Math.max(0, Math.min(track.cells!.length - 1, n))
        ];
    }
  }
  const out: TapeCell[] = part.kind === "wheel" ? [] : ["drop"];
  while (length !== part.length) {
    out.push(length > part.length ? "retract" : "extend");
    length += length > part.length ? -1 : 1;
  }
  const n = mod(part.rotation - rotation),
    cw = n <= 3;
  for (let i = 0; i < (cw ? n : 6 - n); i++)
    out.push(cw ? "rotate-cw" : "rotate-ccw");
  if (track && part.kind !== "wheel") {
    const from = track.cells!.findIndex((h) => eq(h, cell)),
      to = track.cells!.findIndex((h) => eq(h, part)),
      forward = track.closed
        ? mod(to - from, track.cells!.length)
        : to >= from
          ? to - from
          : Infinity,
      backward = track.closed
        ? mod(from - to, track.cells!.length)
        : from >= to
          ? from - to
          : Infinity;
    for (let i = 0; i < Math.min(forward, backward); i++)
      out.push(forward <= backward ? "advance" : "recede");
  }
  return out;
}
