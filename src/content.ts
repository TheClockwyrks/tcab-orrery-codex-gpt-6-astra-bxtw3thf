import type { Challenge, PartKind, PartState, TapeCell } from "./game";
import extrasData from "./extras.json";
import campaignData from "./campaign.json";
import campaignReferences from "./campaign-references.json";
import extraReferences from "./references.json";
export type SolutionPart = Partial<Omit<PartState, "id">> & { kind: PartKind };
export interface Solution {
  parts: SolutionPart[];
}
export const extras: Challenge[] = extrasData.map((c) => ({
  ...c,
  reagents: c.reagents.map((m) => ({ ...m, repeat: null })),
  products: c.products.map((m) => ({
    ...m,
    repeat: "repeat" in m ? m.repeat : null,
  })),
})) as Challenge[];
export const campaign: Challenge[] = (campaignData as Challenge[]).map((c) => ({
  ...c,
  reagents: c.reagents.map((m) => ({ ...m, repeat: m.repeat ?? null })),
  products: c.products.map((m) => ({ ...m, repeat: m.repeat ?? null })),
}));
export function list(mode: "campaign" | "extras"): Challenge[] {
  if (mode !== "campaign" && mode !== "extras") throw Error("Unknown mode");
  return mode === "campaign" ? campaign : extras;
}
export const carryTape: TapeCell[] = [
  "grab",
  "rotate-cw",
  "rotate-cw",
  "rotate-cw",
  "drop",
  "rotate-ccw",
  "rotate-ccw",
  "rotate-ccw",
];
export function reference(
  mode: "campaign" | "extras",
  index: number,
): Solution {
  return (mode === "campaign" ? campaignReferences : extraReferences)[
    index
  ] as Solution;
}
export const lessons = [
  [
    "THE SKY IS YOUR WORKBENCH",
    "Each challenge asks for a constellation. Take its reagents, shape them, and deliver the product six times.",
    "Motes are celestial bodies; filaments bind them into rigid constellations.",
    "Dust • four essences • mercury • six planets • shadow & light • aether",
  ],
  [
    "GIVE THE HEAVENS A MACHINE",
    "Drag parts from the left tray onto the hex field. Rises supply reagents; sets receive products.",
    "Arms grab and carry. Q / E rotate; W / S change reach. X removes a selected part.",
    "The wheel carries essence fixtures. Track carries a mounted arm. Sigils transform the motes above them.",
  ],
  [
    "WRITE A LITTLE ORBIT",
    "Click an arm’s tape, then write instructions. All tapes loop on the longest tape’s period.",
    "G grab · V drop · A / D rotate · Z / C pivot · W / S extend / retract",
    "T / B travel · R reset · Y repeat · Delete blank · Backspace erase · U / I undo / redo",
  ],
  [
    "SET IT IN MOTION",
    "Space starts or pauses. N advances one cycle. Comma / period change speed.",
    "Motes collide along their entire paths. A fault freezes the machine and names the cause.",
    "Escape stops the run so you can adjust the machine. M toggles sound on every screen.",
  ],
  [
    "AN ELEGANT SOLUTION",
    "Deliver every product six times to finish. Then improve your machine.",
    "Cost counts your parts. Cycles measure time. Area counts every hex you touch. Lower is better.",
    "Campaign opens one challenge at a time. Extras offers ten independent problems from the start.",
  ],
];
