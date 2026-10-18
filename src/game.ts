export type Screen = "title" | "howto" | "select" | "editor";

export type Mode = "campaign" | "extras";

export type MoteType =
  | "dust"
  | "nebula"
  | "comet"
  | "nova"
  | "meteor"
  | "mercury"
  | "saturn"
  | "jupiter"
  | "mars"
  | "venus"
  | "luna"
  | "sol"
  | "umbra"
  | "lumen"
  | "aether";

export type PartKind =
  | "arm"
  | "biarm"
  | "triarm"
  | "hexarm"
  | "piston"
  | "wheel"
  | "track"
  | "bind"
  | "manifold"
  | "triune"
  | "sunder"
  | "wane"
  | "mirror"
  | "ascend"
  | "conjoin"
  | "eclipse"
  | "confluence"
  | "dispersion"
  | "void"
  | "rise"
  | "set";

export type Instruction =
  | "grab"
  | "drop"
  | "rotate-cw"
  | "rotate-ccw"
  | "pivot-cw"
  | "pivot-ccw"
  | "extend"
  | "retract"
  | "advance"
  | "recede";

export type TapeCell = Instruction | null;

export type SimStatus = "running" | "paused" | "faulted" | "complete";

export type FaultKind =
  | "collision"
  | "torn"
  | "overextended"
  | "overretracted"
  | "unmounted"
  | "track-end"
  | "impossible";

export type Focus = "field" | "tape";

export interface Hex {
  readonly q: number;
  readonly r: number;
}

export interface PatternFilament {
  readonly a: Hex;
  readonly b: Hex;
  readonly weight: number;
}

export interface Molecule {
  readonly motes: readonly {
    readonly q: number;
    readonly r: number;
    readonly type: MoteType;
  }[];
  readonly filaments: readonly PatternFilament[];
  readonly repeat: {
    readonly vector: Hex;
    readonly link: PatternFilament;
  } | null;
}

export interface Challenge {
  readonly name: string;
  readonly reagents: readonly Molecule[];
  readonly products: readonly Molecule[];
  readonly permitted: readonly PartKind[];
  readonly target: number;
}

export interface PartState {
  readonly id: number;
  readonly kind: PartKind;
  readonly q: number;
  readonly r: number;
  readonly rotation: number;
  readonly length: number;
  readonly cells: readonly Hex[] | null;
  readonly closed: boolean | null;
  readonly index: number | null;
  readonly tape: readonly TapeCell[] | null;
}

export type DragState =
  | {
      readonly kind: "place";
      readonly part: PartKind;
      readonly index: number | null;
      readonly rotation: number;
      readonly length: number;
      readonly at: Hex | null;
      readonly before: readonly PartState[];
    }
  | {
      readonly kind: "move";
      readonly part: number;
      readonly from: Hex;
      readonly at: Hex | null;
      readonly rotation: number;
      readonly length: number;
      readonly before: readonly PartState[];
    }
  | {
      readonly kind: "lay";
      readonly part: number;
      readonly end: "first" | "last";
      readonly before: readonly PartState[];
    };

export interface EditorState {
  readonly parts: readonly PartState[];
  readonly nextId: number;
  readonly selected: number | null;
  readonly focus: Focus;
  readonly cursor: { readonly part: number; readonly col: number } | null;
  readonly drag: DragState | null;
  readonly undo: readonly (readonly PartState[])[];
  readonly redo: readonly (readonly PartState[])[];
}

export interface MoteState {
  readonly id: number;
  readonly q: number;
  readonly r: number;
  readonly type: MoteType;
  readonly wheel: number | null;
}

export interface SimFilament {
  readonly a: number;
  readonly b: number;
  readonly weight: number;
}

export interface Pose {
  readonly part: number;
  readonly rotation: number;
  readonly length: number;
  readonly cell: Hex;
}

export interface Grip {
  readonly part: number;
  readonly spoke: number;
  readonly mote: number;
}

export interface Metrics {
  readonly cost: number;
  readonly cycles: number;
  readonly area: number;
}

export interface SimState {
  readonly status: SimStatus;
  readonly cycle: number;
  readonly fraction: number;
  readonly speed: number;
  readonly motes: readonly MoteState[];
  readonly nextMoteId: number;
  readonly filaments: readonly SimFilament[];
  readonly poses: readonly Pose[];
  readonly grips: readonly Grip[];
  readonly tallies: readonly number[];
  readonly areaHexes: readonly Hex[];
  readonly fault: {
    readonly kind: FaultKind;
    readonly parts: readonly number[];
    readonly motes: readonly number[];
  } | null;
  readonly metrics: Metrics | null;
}

export interface PointerState {
  readonly x: number;
  readonly y: number;
  readonly down: boolean;
}

export interface OrreryState {
  readonly screen: Screen;
  readonly mode: Mode;
  readonly menuIndex: number;
  readonly titleIndex: number;
  readonly selectIndex: number;
  readonly howtoPage: number;

  readonly unlockedCount: number;
  readonly campaignSolved: readonly number[];
  readonly extrasSolved: readonly number[];
  readonly campaignRecords: readonly (Metrics | null)[];
  readonly extrasRecords: readonly (Metrics | null)[];
  readonly campaignMachines: readonly (readonly PartState[] | null)[];
  readonly extrasMachines: readonly (readonly PartState[] | null)[];
  readonly campaignLast: number;
  readonly extrasLast: number;

  readonly challenge: Challenge | null;
  readonly challengeRef: { readonly mode: Mode; readonly index: number } | null;
  readonly editor: EditorState;
  readonly sim: SimState | null;

  readonly pointer: PointerState;
  readonly completion: boolean;
  readonly simTime: number;
  readonly muted: boolean;
}

import type { Game } from "@clockwyrks/simple-2d";
import type { ParticleSystem } from "@clockwyrks/particle-runtime";
import { ParticleCanvasPlayer } from "@clockwyrks/particle-runtime/canvas";
import * as C from "./constants";
import { debug } from "./debug";
import {
  initial,
  action,
  pointer,
  carryMenuPress,
  pointerCue,
  machineCue,
  menuCount,
} from "./editor";
import { copy, advance, livePositions } from "./simulation";
import { cost, period, xy } from "./geometry";
import { render, images, palette } from "./render";
export type OrreryDebugApi = typeof debug;
export const BACKGROUND = palette.sky;
const systems = new Map<string, ParticleSystem>();
let frameDelta = 0;
const pendingEffects: { name: string; x: number; y: number }[] = [];
let effects: {
  player: ParticleCanvasPlayer | null;
  system: ParticleSystem;
  x: number;
  y: number;
  age: number;
}[] = [];
export const game: Game<OrreryState, OrreryDebugApi> = {
  async initialize(api) {
    for (const name of C.ACTIONS)
      api.input.register(name, { keys: [...C.BINDINGS[name]] });
    const paths = [
      ...Object.values(C.MOTE_SPRITE_PATHS),
      ...Object.values(C.FILAMENT_SPRITE_PATHS),
      ...Object.values(C.SIGIL_GLYPH_PATHS),
      ...Object.values(C.INSTRUCTION_GLYPH_PATHS),
      ...Object.values(C.HUB_PATHS),
      ...Object.values(C.GRIPPER_PATHS),
      C.WHEEL_HUB_PATH,
      C.FIXTURE_MOUNT_PATH,
      ...Object.values(C.APERTURE_SHEETS).flatMap((dir) =>
        Array.from({ length: C.APERTURE_FRAMES }, (_, i) => `${dir}/${i}.png`),
      ),
    ];
    await Promise.all([
      ...paths.map(async (path) =>
        images.set(path, await api.assets.loadImage(path)),
      ),
      ...Object.entries(C.CUE_PATHS).map(([cue, path]) =>
        api.audio.load(cue, path),
      ),
      ...Object.entries(C.PARTICLE_PATHS).map(async ([name, path]) =>
        systems.set(
          name,
          JSON.parse(
            await (await api.assets.load(path)).text(),
          ) as ParticleSystem,
        ),
      ),
    ]);
    api.diagnostics.register("screen", (s) => `${s.screen} / ${s.mode}`);
    api.diagnostics.register(
      "challenge",
      (s) =>
        `${s.challenge?.name ?? "—"} / ${s.challengeRef?.mode ?? "custom"}`,
    );
    api.diagnostics.register(
      "machine",
      (s) =>
        `${s.editor.parts.length} parts / cost ${cost(s.editor.parts)} / period ${period(s.editor.parts)}`,
    );
    api.diagnostics.register("run", (s) =>
      s.sim
        ? `${s.sim.status} / ${s.sim.cycle} + ${s.sim.fraction.toFixed(3)} / speed ${s.sim.speed}`
        : "editing",
    );
    api.diagnostics.register("products", (s) =>
      s.sim
        ? s.sim.tallies.map((n) => `${n}/${s.challenge!.target}`).join(" · ")
        : "—",
    );
    api.diagnostics.register(
      "field",
      (s) =>
        `${s.sim?.motes.length ?? 0} motes / area ${s.sim?.areaHexes.length ?? 0} / ${s.sim?.fault?.kind ?? "clear"}`,
    );
    api.diagnostics.register(
      "hands",
      (s) =>
        `${s.editor.focus} / ${s.pointer.x.toFixed(0)},${s.pointer.y.toFixed(0)}`,
    );
    effects = [];
    pendingEffects.length = 0;
    return [initial(), debug];
  },
  update(state, api, dt) {
    let s = copy(state);
    carryMenuPress(state, s);
    frameDelta = dt;
    if (state.simTime === 0) {
      effects = [];
      pendingEffects.length = 0;
    }
    s.simTime += dt;
    const cues = new Set<string>();
    const posedCue = pointerCue(state);
    if (posedCue) cues.add(posedCue);
    const beforeParts = copy(s.editor.parts);
    let confirmed = false;
    for (const name of C.ACTIONS)
      if (api.input.pressed(name)) {
        if (name === "mute") api.audio.setMuted(!api.audio.muted());
        else {
          const before = s.sim;
          if (name === "confirm" && menuCount(s) > 0) confirmed = true;
          action(s, name);
          if (!before && s.sim) cues.add(C.CUES.start);
        }
      }
    for (const sample of api.input.pointerSamples())
      s = copyWithPress(
        pointer(s, sample.type, sample.x, sample.y, !confirmed),
      );
    const editedCue = machineCue(beforeParts, s.editor.parts);
    if (editedCue) cues.add(editedCue);
    const beforeSim = copy(state.sim ?? s.sim);
    if (s.sim?.status === "running") advance(s, dt * C.SPEEDS[s.sim.speed]);
    if (s.sim && beforeSim) {
      s.sim.tallies.forEach((n, i) => {
        if (n > beforeSim.tallies[i]) {
          cues.add(C.CUES.constellation);
          const set = s.editor.parts.find(
            (p) => p.kind === "set" && p.index === i,
          );
          if (set) pendingEffects.push({ name: "deliver", ...xy(set) });
        }
      });
      if (s.sim.status === "faulted" && beforeSim.status !== "faulted") {
        cues.add(C.CUES.halt);
        const positions = livePositions(s),
          fault = s.sim.fault!;
        const pos =
          fault.motes
            .map((id) => positions.get(id)!)
            .sort((a, b) => a.y - b.y || a.x - b.x)[0] ??
          xy(
            s.editor.parts.find((p) => p.id === fault.parts[0]) ?? {
              q: 0,
              r: 0,
            },
          );
        pendingEffects.push({ name: "fault", ...pos });
      }
      if (s.sim.status === "complete" && beforeSim.status !== "complete") {
        cues.add(C.CUES.complete);
        pendingEffects.push({ name: "complete", ...xy({ q: 0, r: 0 }) });
      }
    }
    pointerCue(s);
    for (const cue of cues) api.audio.play(cue);
    api.audio.loop(C.CUES.music);
    s.muted = api.audio.muted();
    return s;
  },
  render(state, api) {
    render(api.ctx, state);
    for (const event of pendingEffects.splice(0)) {
      const system = systems.get(event.name);
      if (system)
        effects.push({
          player: null,
          system,
          x: event.x,
          y: event.y,
          age: 0,
        });
    }
    for (const effect of effects) {
      api.ctx.save();
      const w = api.ctx.canvas.width,
        h = api.ctx.canvas.height;
      api.ctx.translate(effect.x - 120, effect.y - 120);
      api.ctx.scale(240 / w, 240 / h);
      effect.player ??= new ParticleCanvasPlayer(effect.system, api.ctx, {
        clear: false,
        composite: "lighter",
        pixelRadius: 1,
      });
      effect.player.update(frameDelta);
      api.ctx.restore();
      effect.age += frameDelta;
    }
    effects = effects.filter((e) => e.age < 2.5);
  },
};
function copyWithPress(s: OrreryState) {
  const next = copy(s);
  carryMenuPress(s, next);
  return next;
}
