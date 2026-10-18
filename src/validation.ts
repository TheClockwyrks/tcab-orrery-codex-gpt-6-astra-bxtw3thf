import type { Challenge, Molecule } from "./game";
import * as C from "./constants";
import { add, adjacent, eq, field, key, onField, rotate } from "./geometry";
function whole(n: number): boolean {
  return Number.isSafeInteger(n);
}
function pattern(m: Molecule, reagent: boolean): void {
  if (
    !m ||
    !Array.isArray(m.motes) ||
    !m.motes.length ||
    !Array.isArray(m.filaments)
  )
    throw Error("Invalid molecule arrays");
  const seen = new Set<string>();
  for (const h of m.motes) {
    if (
      !whole(h.q) ||
      !whole(h.r) ||
      !C.MOTES.includes(h.type) ||
      seen.has(key(h))
    )
      throw Error("Invalid or duplicate mote");
    seen.add(key(h));
  }
  const pairs = new Set<string>(),
    connected = new Set([key(m.motes[0])]);
  for (const f of m.filaments) {
    if (
      !f.a ||
      !f.b ||
      ![1, 3].includes(f.weight) ||
      !adjacent(f.a, f.b) ||
      !seen.has(key(f.a)) ||
      !seen.has(key(f.b))
    )
      throw Error("Invalid filament");
    const pair = [key(f.a), key(f.b)].sort().join("|");
    if (pairs.has(pair)) throw Error("Duplicate filament");
    pairs.add(pair);
  }
  for (let i = 0; i < m.motes.length; i++)
    for (const f of m.filaments)
      if (connected.has(key(f.a)) || connected.has(key(f.b))) {
        connected.add(key(f.a));
        connected.add(key(f.b));
      }
  if (connected.size !== m.motes.length) throw Error("Disconnected molecule");
  let cells = m.motes.map((h) => ({ q: h.q, r: h.r }));
  if (m.repeat) {
    if (reagent) throw Error("A reagent cannot repeat");
    const { vector, link } = m.repeat;
    if (
      !vector ||
      !whole(vector.q) ||
      !whole(vector.r) ||
      eq(vector, { q: 0, r: 0 }) ||
      !link ||
      ![1, 3].includes(link.weight) ||
      !adjacent(link.a, link.b) ||
      !seen.has(key(link.a)) ||
      !seen.has(key({ q: link.b.q - vector.q, r: link.b.r - vector.r }))
    )
      throw Error("Invalid repeating link");
    const next = cells.map((h) => add(h, vector));
    if (next.some((h) => seen.has(key(h))))
      throw Error("Repeating copies overlap");
    cells = [...cells, ...next];
  }
  // A relative origin need not itself be one of the molecule's occupied cells.
  const origin = cells[0];
  const fits = Array.from({ length: 6 }, (_, r) => r).some((rotation) =>
    field.some((anchor) =>
      cells.every((h) =>
        onField(
          add(
            rotate({ q: h.q - origin.q, r: h.r - origin.r }, rotation),
            anchor,
          ),
        ),
      ),
    ),
  );
  if (!fits) throw Error("Molecule does not fit the field");
}
export function validateChallenge(c: Challenge): Challenge {
  if (
    !c ||
    typeof c.name !== "string" ||
    c.name.length < 1 ||
    c.name.length > C.NAME_MAX
  )
    throw Error("Invalid challenge name");
  if (!whole(c.target) || c.target < 1) throw Error("Invalid target");
  if (
    !Array.isArray(c.reagents) ||
    !Array.isArray(c.products) ||
    !c.reagents.length ||
    !c.products.length
  )
    throw Error("Missing patterns");
  if (
    !Array.isArray(c.permitted) ||
    !c.permitted.length ||
    new Set(c.permitted).size !== c.permitted.length ||
    c.permitted.some(
      (k) => !C.PARTS.includes(k) || k === "rise" || k === "set",
    ) ||
    c.permitted.length + c.reagents.length + c.products.length > C.TRAY_MAX
  )
    throw Error("Invalid permitted tray");
  c.reagents.forEach((m) => pattern(m, true));
  c.products.forEach((m) => pattern(m, false));
  return {
    ...c,
    reagents: c.reagents.map((m) => ({ ...m, repeat: m.repeat ?? null })),
    products: c.products.map((m) => ({ ...m, repeat: m.repeat ?? null })),
  };
}
