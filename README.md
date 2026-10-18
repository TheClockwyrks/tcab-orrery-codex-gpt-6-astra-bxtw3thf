# Orrery

A browser puzzle about programming brass machines to carry, bind, and transform celestial motes. Build on a hex field, write looping instruction tapes, and deliver six of each product. Improve three independent records: cost, cycles, and area.

Includes a sixteen-challenge Campaign, ten standalone Extras, verified reference machines, produced sprites and animated apertures, particle effects, six sound cues, and a 32.8-second ambient score. Progress lasts for the current session.

## Run

Requires Node.js compatible with Vite 8.

```sh
npm ci
npm run dev
```

```sh
npm run build
npm run preview
```

The production site is `dist/index.html`. Serve `dist/` from any static host, including beneath a URL sub-path. All runtime resources are local and page-relative. The committed `assets/` directory is exposed through `public/assets`; production builds copy it without running any asset-generation tools.

## Controls

- Menus: arrow keys and Enter, or pointer/touch. Escape returns.
- Build: drag parts from the tray. Drag placed parts to move them. Q/E rotate; W/S change arm length; X deletes. Drag an open track's end to extend or shorten it.
- Tape: click a cell, then G grab, V drop, A/D rotate, Z/C pivot, W/S extend/retract, T/B advance/recede. R writes a reset; Y repeats the prefix. Delete blanks a cell; Backspace erases the previous one. Arrow keys move the cursor.
- U/I undo/redo edits.
- Space starts or pauses; N steps; comma/period change speed; Escape stops.
- M toggles sound. Backtick toggles the engine diagnostics.

## Verification and source

```sh
npm run typecheck
npm run lint
npm run format
npm test
```

The simulation, placement geometry, editor transitions, debug surface, and renderer live in separate modules under `src/`. State transitions copy their input; the renderer never changes game state. The engine owns input, audio, assets, timing, and diagnostics. Reference solutions are available through `engine.debug.referenceSolution`, and tests run all 26 to completion within the specified cycle limit.

`showcase/` contains screenshots and a 22.5-second draw-command replay captured from a machine built with the editor. `scripts/capture.html` and `scripts/capture.mjs` are development-only capture tools; with the dev server running, `node scripts/capture.mjs` recreates the media. They are not included in the production site.

`scripts/produce_assets.py` documents the one-time art and sound authoring process. It requires the authoring binaries supplied during development and is never called by install, test, or build. The generated PNG, JSON, WAV, and MIDI files are committed.
