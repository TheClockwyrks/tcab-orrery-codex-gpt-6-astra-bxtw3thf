import { describe, it, expect } from "vitest";
import { campaign, extras, reference } from "./content";
import { debug } from "./debug";
import { initial } from "./editor";
import { advance, copy } from "./simulation";
import * as C from "./constants";
describe("shipped reference machines", () => {
  for (const mode of ["campaign", "extras"] as const)
    for (const [i, c] of (mode === "campaign" ? campaign : extras).entries())
      it(`${mode} ${i + 1}: ${c.name}`, () => {
        let s = debug.openChallenge(initial(), mode, i);
        const solution = reference(mode, i);
        s = debug.loadSolution(s, solution);
        expect(s.editor.parts.filter((p) => p.kind === "rise")).toHaveLength(
          c.reagents.length,
        );
        expect(s.editor.parts.filter((p) => p.kind === "set")).toHaveLength(
          c.products.length,
        );
        expect(
          s.editor.parts.every(
            (p) =>
              p.kind === "rise" ||
              p.kind === "set" ||
              c.permitted.includes(p.kind),
          ),
        ).toBe(true);
        s = debug.startRun(s);
        const n = copy(s);
        advance(n, C.CAMPAIGN_REFERENCE_CYCLES);
        expect(n.sim?.fault).toBeNull();
        expect(n.sim?.status).toBe("complete");
      });
  it("covers every part and increases the reference-machine scale", () => {
    const kinds = new Set(
      campaign.flatMap((_, i) =>
        reference("campaign", i).parts.map((p) => p.kind),
      ),
    );
    expect([...kinds].sort()).toEqual([...C.PARTS].sort());
    for (let i = 2; i < campaign.length; i++)
      expect(reference("campaign", i).parts.length).toBeGreaterThanOrEqual(
        reference("campaign", i - 2).parts.length,
      );
    expect(reference("campaign", 0).parts.length).toBeLessThanOrEqual(
      C.CAMPAIGN_OPENER_PARTS,
    );
    expect(
      reference("campaign", campaign.length - 1).parts.length,
    ).toBeGreaterThanOrEqual(C.CAMPAIGN_FINALE_PARTS);
  });
});
