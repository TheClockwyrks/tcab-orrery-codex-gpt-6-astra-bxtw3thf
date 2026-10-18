import { expect, it } from "vitest";
import { debug } from "./debug";
import { initial, action, pointer } from "./editor";
import { copy, advance } from "./simulation";
import { xy } from "./geometry";
import { resetMacro } from "./macros";
import { validateChallenge } from "./validation";
import { extras } from "./content";
it("resets a piston rotation, length and closed-track position in order", () => {
  let s = debug.openChallenge(initial(), "extras", 0);
  s = debug.placeTrack(s, 0, 0);
  s = debug.extendTrack(s, 1, 1, 0);
  s = debug.extendTrack(s, 1, 0, 1);
  s = debug.closeTrack(s, 1);
  s = debug.placePart(s, "piston", 0, 0, 0);
  for (const [i, ins] of (
    ["extend", "rotate-cw", "advance"] as const
  ).entries())
    s = debug.setTapeCell(s, 2, i, ins);
  expect(resetMacro(s.editor.parts[1], 3, s.editor.parts)).toEqual([
    "drop",
    "retract",
    "rotate-ccw",
    "recede",
  ]);
});
it("lays track through every pointer sample and undoes the whole gesture", () => {
  let s = debug.openChallenge(initial(), "extras", 9);
  s = debug.placeTrack(s, 0, 0);
  const a = xy({ q: 0, r: 0 }),
    b = xy({ q: 1, r: 0 }),
    c = xy({ q: 1, r: -1 });
  s = pointer(s, "down", a.x, a.y);
  s = pointer(s, "move", b.x, b.y);
  s = pointer(s, "move", c.x, c.y);
  s = pointer(s, "up", c.x, c.y);
  expect(s.editor.parts[0].cells).toHaveLength(3);
  const n = copy(s);
  action(n, "undo");
  expect(n.editor.parts[0].cells).toHaveLength(1);
});
it("preserves ghost rotation when a move is released outside the field", () => {
  let s = debug.openChallenge(initial(), "extras", 0);
  s = debug.placePart(s, "arm", 0, 0, 0);
  const p = xy({ q: 0, r: 0 });
  s = pointer(s, "down", p.x, p.y);
  const n = copy(s);
  action(n, "part-cw");
  s = pointer(n, "move", 0, 0);
  s = pointer(s, "up", 0, 0);
  expect(s.editor.parts[0].rotation).toBe(1);
  expect(s.editor.parts[0].q).toBe(0);
});
it("faults an open track at its end and wraps a closed track", () => {
  let s = debug.openChallenge(initial(), "extras", 0);
  s = debug.placeTrack(s, 0, 0);
  s = debug.extendTrack(s, 1, 1, 0);
  s = debug.placePart(s, "arm", 0, 0, 0);
  s = debug.setTapeCell(s, 2, 0, "advance");
  s = debug.startRun(s);
  const n = copy(s);
  advance(n, 2);
  expect(n.sim?.fault?.kind).toBe("track-end");
});
it("rejects disconnected and overlapping repeated molecule documents", () => {
  const c = copy(extras[0]);
  c.reagents[0].motes.push({ q: 1, r: 0, type: "sol" });
  expect(() => validateChallenge(c)).toThrow(/Disconnected/);
  const r = copy(extras[9]);
  r.products[0].repeat!.vector = { q: 0, r: 0 };
  expect(() => validateChallenge(r)).toThrow(/repeating/);
});
it("keeps challenge stashes independent and restores tapes on return", () => {
  let s = debug.openChallenge(initial(), "campaign", 0);
  s = debug.placePart(s, "arm", 0, 0, 0);
  s = debug.setTapeCell(s, 1, 4, "grab");
  const n = copy(s);
  action(n, "back");
  expect(n.campaignMachines[0]?.[0].tape).toEqual([
    null,
    null,
    null,
    null,
    "grab",
  ]);
  action(n, "confirm");
  expect(n.editor.parts[0].tape).toEqual([null, null, null, null, "grab"]);
  expect(n.editor.undo).toEqual([]);
});
