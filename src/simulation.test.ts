import { describe, expect, it } from "vitest";
import { debug } from "./debug";
import { initial, action, pointer } from "./editor";
import { advance, copy } from "./simulation";
import { reference } from "./content";
import { xy } from "./geometry";
import * as C from "./constants";
function world() {
  let s = debug.openChallenge(initial(), "extras", 0);
  s = debug.startRun(s);
  s = debug.clearMotes(s);
  s = debug.setCompletion(s, false);
  return s;
}
describe("simulation", () => {
  it("delivers a six-product machine and records metrics", () => {
    let s = debug.openChallenge(initial(), "extras", 0);
    s = debug.loadSolution(s, reference("extras", 0));
    s = debug.startRun(s);
    const next = copy(s);
    advance(next, 100);
    expect(next.sim?.status).toBe("complete");
    expect(next.sim?.tallies).toEqual([6]);
    expect(next.extrasSolved).toEqual([0]);
    expect(next.sim?.metrics?.cost).toBe(20);
    expect(s.sim?.cycle).toBe(0);
  });
  it("detects the specified curved collision at 3/8", () => {
    let s = world();
    s = debug.placePart(s, "arm", 0, 0, 0);
    s = debug.spawnMote(s, 1, 0, "dust");
    s = debug.spawnMote(s, 1, 1, "dust");
    s = debug.setGrip(s, 1, 0, 1);
    s = debug.setTapeCell(s, 1, 0, "rotate-cw");
    const next = copy(s);
    advance(next, 1);
    expect(next.sim?.fault?.kind).toBe("collision");
    expect(next.sim?.fraction).toBe(3 / 8);
  });
  it("is independent of frame partition", () => {
    let s = debug.openChallenge(initial(), "extras", 0);
    s = debug.loadSolution(s, reference("extras", 0));
    s = debug.startRun(s);
    const a = copy(s),
      b = copy(s);
    advance(a, 17);
    for (let i = 0; i < 1020; i++) advance(b, 1 / 60);
    expect(b.sim?.cycle).toBe(a.sim?.cycle);
    expect(b.sim?.motes).toEqual(a.sim?.motes);
    expect(b.sim?.tallies).toEqual(a.sim?.tallies);
  });
  it("keeps compound motions rigid and detects torn grips", () => {
    let s = world();
    s = debug.placePart(s, "arm", 0, 0, 0);
    s = debug.placePart(s, "arm", 2, 0, 3);
    s = debug.spawnMote(s, 1, 0, "luna");
    s = debug.setGrip(s, 1, 0, 1);
    s = debug.setGrip(s, 2, 3, 1);
    s = debug.setTapeCell(s, 1, 0, "rotate-cw");
    const n = copy(s);
    advance(n, 1);
    expect(n.sim?.fault?.kind).toBe("torn");
  });
  it("runs transmutation before binding", () => {
    let s = world();
    s = debug.placePart(s, "wane", 0, 0, 0);
    s = debug.spawnMote(s, 0, 0, "comet");
    const n = copy(s);
    advance(n, 1);
    expect(n.sim?.motes[0].type).toBe("dust");
  });
  it("faults piston bounds at fetch", () => {
    let s = world();
    s = debug.placePart(s, "piston", 0, 0, 0);
    s = debug.setTapeCell(s, 1, 0, "retract");
    const n = copy(s);
    advance(n, 0.01);
    expect(n.sim?.fault?.kind).toBe("overretracted");
    expect(n.sim?.fraction).toBe(0);
  });
});
describe("editor", () => {
  it("places by pointer, writes tape, and preserves identities on undo", () => {
    let s = debug.openChallenge(initial(), "extras", 0);
    s = pointer(s, "down", 30, C.TRAY_Y0 + 5);
    const p = xy({ q: 0, r: 0 });
    s = pointer(s, "move", p.x, p.y);
    s = pointer(s, "up", p.x, p.y);
    expect(s.editor.parts[0].kind).toBe("arm");
    expect(s.editor.undo).toHaveLength(1);
    s = pointer(s, "down", C.TRAY_REGION_W + C.TAPE_X0 + 4, C.TAPE_Y0 + 4);
    const n = copy(s);
    action(n, "ins-grab");
    expect(n.editor.parts[0].tape).toEqual(["grab"]);
    action(n, "undo");
    expect(n.editor.parts[0].tape).toEqual([]);
    action(n, "undo");
    expect(n.editor.parts).toEqual([]);
    action(n, "redo");
    expect(n.editor.parts[0].id).toBe(1);
  });
  it("rejects overlapping sigils without altering the original state", () => {
    let s = debug.openChallenge(initial(), "extras", 0);
    s = debug.placeRise(s, 0, 0, 0, 0);
    expect(() => debug.placeSet(s, 0, 0, 0, 0)).toThrow(/rule 2/);
    expect(s.editor.parts).toHaveLength(1);
  });
  it("requires both menu edges in the same item", () => {
    let s = initial();
    const r = debug.menuItemRect(s, 1)!;
    s = pointer(s, "down", r.x + 5, r.y + 5);
    s = pointer(s, "up", r.x + 5, r.y + 5);
    expect(s.screen).toBe("select");
    expect(s.mode).toBe("extras");
  });
});
