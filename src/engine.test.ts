/// <reference types="node" />
import { afterEach, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { createEngine, ConstantClock } from "@clockwyrks/simple-2d";
import { game, BACKGROUND } from "./game";
import * as C from "./constants";
afterEach(() => vi.unstubAllGlobals());
it("runs the actual game over the engine clock, input, canvas and debug surface", async () => {
  const canvas = createCanvas(C.STAGE_W, C.STAGE_H),
    events = new EventTarget();
  vi.stubGlobal(
    "fetch",
    async (path: string) => new Response(await readFile(path)),
  );
  vi.stubGlobal("createImageBitmap", async (blob: Blob) =>
    loadImage(Buffer.from(await blob.arrayBuffer())),
  );
  const engine = createEngine({
    canvas: canvas as unknown as HTMLCanvasElement,
    width: C.STAGE_W,
    height: C.STAGE_H,
    background: BACKGROUND,
    layout: C.LAYOUT,
    clock: new ConstantClock(1000 / 60),
    surface: {
      cssWidth: () => C.STAGE_W,
      cssHeight: () => C.STAGE_H,
      dpr: () => 1,
      events: () => events,
    },
    game: {
      ...game,
      initialize: (api) =>
        game.initialize({
          ...api,
          audio: {
            ...api.audio,
            load: async (cue) =>
              api.audio.define(cue, { freq: 440, durationMs: 60 }),
          },
        }),
    },
  });
  const cues: string[] = [];
  engine.events.on("cue:played", (event) => cues.push(event.cue));
  await engine.initialize();
  await engine.advance(1);
  expect(engine.debug.snapshot(engine.state).screen).toBe("title");
  const press = async (code: string) => {
    events.dispatchEvent(
      Object.assign(new Event("keydown"), { code, repeat: false }),
    );
    await engine.advance(1);
    events.dispatchEvent(Object.assign(new Event("keyup"), { code }));
    await engine.advance(1);
  };
  await press("Enter");
  await press("Enter");
  expect(engine.state.screen).toBe("editor");
  engine.apply((s) =>
    engine.debug.loadSolution(
      s,
      engine.debug.referenceSolution(s, "campaign", 0),
    ),
  );
  await press("Space");
  engine.apply((s) => engine.debug.setSpeed(s, 3));
  await engine.advance(100);
  expect(engine.state.sim?.status).toBe("complete");
  expect(engine.state.campaignSolved).toEqual([0]);
  expect(engine.state.unlockedCount).toBe(2);
  expect(engine.diagnostics().length).toBeGreaterThanOrEqual(7);
  expect(canvas.toBuffer("image/png").byteLength).toBeGreaterThan(10000);
  await press("Escape");
  expect(engine.state.sim).toBeNull();
  expect(cues.filter((c) => c === C.CUES.start)).toHaveLength(1);
  expect(cues.filter((c) => c === C.CUES.constellation)).toHaveLength(6);
  expect(cues.filter((c) => c === C.CUES.complete)).toHaveLength(1);
  expect(cues.filter((c) => c === C.CUES.place)).toHaveLength(0);
  engine.apply((s) => engine.debug.pointerDown(s, C.FIELD_CX, C.FIELD_CY));
  engine.apply((s) =>
    engine.debug.pointerMove(
      s,
      C.FIELD_CX + C.HEX_PITCH / 2,
      C.FIELD_CY + (C.HEX_PITCH * Math.sqrt(3)) / 2,
    ),
  );
  engine.apply((s) => engine.debug.pointerUp(s));
  expect(cues.filter((c) => c === C.CUES.place)).toHaveLength(0);
  await engine.advance(3);
  expect(cues.filter((c) => c === C.CUES.place)).toHaveLength(1);
  engine.destroy();
}, 30000);
