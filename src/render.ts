import type { OrreryState, PartState, Hex, Molecule } from "./game";
import * as C from "./constants";
import {
  xy,
  validate,
  field,
  footprint,
  mechanism,
  spokes,
  period,
  cost,
  target,
  rotate,
  add,
} from "./geometry";
import { livePositions, plan, restPart } from "./simulation";
import { tray, rows, scroll, menuRect, menuCount, solvedItems } from "./editor";
import { list, lessons } from "./content";
export const images = new Map<string, ImageBitmap>();
export const palette = {
  sky: "#080f1b",
  panel: "#0c1624",
  line: "#263849",
  gold: "#c8a976",
  bright: "#f2dfba",
  muted: "#8195a8",
  teal: "#8ed6d0",
};
type Context = CanvasRenderingContext2D;
function text(
  ctx: Context,
  str: string,
  x: number,
  y: number,
  size = 14,
  color = palette.muted,
  font = "monospace",
): void {
  ctx.fillStyle = color;
  ctx.font = `${size}px ${font}`;
  ctx.fillText(str, x, y);
}
function line(
  ctx: Context,
  x: number,
  y: number,
  a: number,
  b: number,
  color = palette.line,
  width = 1,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(a, b);
  ctx.stroke();
}
function circle(
  ctx: Context,
  x: number,
  y: number,
  r: number,
  color = palette.line,
  width = 1,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}
function sprite(
  ctx: Context,
  path: string,
  x: number,
  y: number,
  angle = 0,
  alpha = 1,
): void {
  const image = images.get(path);
  if (!image) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.drawImage(image, -image.width / 2, -image.height / 2);
  ctx.restore();
}
function hex(ctx: Context, h: Hex, color = palette.line, fill?: string): void {
  const p = xy(h);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = ((i + 0.5) * Math.PI) / 3;
    const x = p.x + (Math.cos(a) * C.HEX_PITCH) / Math.sqrt(3),
      y = p.y + (Math.sin(a) * C.HEX_PITCH) / Math.sqrt(3);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = color;
  ctx.stroke();
}
function sky(ctx: Context): void {
  ctx.fillStyle = palette.sky;
  ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
  const g = ctx.createRadialGradient(710, 290, 20, 710, 290, 650);
  g.addColorStop(0, "#142a3b");
  g.addColorStop(0.6, "#0c1829");
  g.addColorStop(1, palette.sky);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
  for (let i = 0; i < 135; i++) {
    const x = (i * 317 + 79) % C.STAGE_W,
      y = (i * i * 13 + 37) % C.STAGE_H;
    ctx.fillStyle = i % 5 ? "#7592ad50" : "#d9d5bc90";
    ctx.fillRect(x, y, i % 7 === 0 ? 2 : 1, 1);
  }
}
function menu(ctx: Context, s: OrreryState, labels: readonly string[]): void {
  for (let i = 0; i < menuCount(s); i++) {
    const r = menuRect(s, i)!,
      selected = (s.screen === "select" ? s.selectIndex : s.menuIndex) === i;
    ctx.fillStyle = selected ? "#bca57519" : "#0a142277";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    line(
      ctx,
      r.x,
      r.y + r.h,
      r.x + r.w,
      r.y + r.h,
      selected ? palette.gold : palette.line,
    );
    if (selected) {
      ctx.fillStyle = palette.gold;
      ctx.fillRect(r.x, r.y, 3, r.h);
    }
    text(
      ctx,
      selected ? "›" : "·",
      r.x + 17,
      r.y + r.h / 2 + 6,
      22,
      selected ? palette.bright : palette.muted,
    );
    text(
      ctx,
      labels[i],
      r.x + 47,
      r.y + r.h / 2 + 5,
      14,
      selected ? palette.bright : palette.muted,
    );
  }
}
function ornament(ctx: Context, time: number): void {
  const x = 880,
    y = 338;
  for (let r = 80; r <= 252; r += 43) {
    circle(ctx, x, y, r, r === 252 ? "#7e73516a" : "#334552");
    circle(ctx, x, y, r + 4, "#233542");
  }
  for (let i = 0; i < 60; i++) {
    const a = (i * Math.PI) / 30;
    line(
      ctx,
      x + Math.cos(a) * 246,
      y + Math.sin(a) * 246,
      x + Math.cos(a) * (i % 5 ? 251 : 259),
      y + Math.sin(a) * (i % 5 ? 251 : 259),
      "#8f805b",
    );
  }
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + time * 0.07,
      r = 125 + (i % 2) * 85,
      px = x + Math.cos(a) * r,
      py = y + Math.sin(a) * r;
    line(ctx, x, y, px, py, "#7e7255", 3);
    line(ctx, x, y, px, py, "#cbb27b", 1);
    circle(ctx, px, py, 28, "#716b53");
    sprite(ctx, C.MOTE_SPRITE_PATHS[C.PLANETS[i]], px, py);
  }
  sprite(ctx, C.WHEEL_HUB_PATH, x, y, time * 0.07);
  circle(ctx, x, y, 40, palette.gold);
  text(ctx, "VI", x - 9, y + 70, 16, palette.gold, "serif");
}
function pattern(ctx: Context, m: Molecule, p: PartState, alpha: number): void {
  for (const f of m.filaments) {
    const a = xy(add(rotate(f.a, p.rotation), p)),
      b = xy(add(rotate(f.b, p.rotation), p));
    sprite(
      ctx,
      f.weight === 3
        ? C.FILAMENT_SPRITE_PATHS.triune
        : C.FILAMENT_SPRITE_PATHS.plain,
      (a.x + b.x) / 2,
      (a.y + b.y) / 2,
      Math.atan2(b.y - a.y, b.x - a.x),
      alpha,
    );
  }
  for (const mte of m.motes) {
    const a = xy(add(rotate(mte, p.rotation), p));
    sprite(ctx, C.MOTE_SPRITE_PATHS[mte.type], a.x, a.y, 0, alpha);
  }
}
function drawPart(
  ctx: Context,
  s: OrreryState,
  p: PartState,
  ghost = false,
): void {
  const anchor = xy(p);
  if (p.kind === "track") {
    const cells = p.closed ? [...p.cells!, p.cells![0]] : p.cells!;
    cells.forEach((h, i) => {
      const a = xy(h);
      circle(ctx, a.x, a.y, 8, "#968164", 2);
      if (i) {
        const b = xy(cells[i - 1]);
        line(ctx, a.x, a.y, b.x, b.y, "#766b56", 7);
        line(ctx, a.x, a.y, b.x, b.y, "#d0b383", 1);
      }
    });
    return;
  }
  if (!mechanism(p.kind)) {
    for (const h of footprint(p, s.challenge!))
      hex(ctx, h, "#80795b70", "#ac98530b");
    if (p.kind === "rise" || p.kind === "set") {
      sprite(
        ctx,
        `${C.APERTURE_SHEETS[p.kind]}/${Math.floor(s.simTime / C.APERTURE_FRAME_TIME) % C.APERTURE_FRAMES}.png`,
        anchor.x,
        anchor.y,
      );
      pattern(
        ctx,
        (p.kind === "rise" ? s.challenge!.reagents : s.challenge!.products)[
          p.index!
        ],
        p,
        s.sim?.motes.some((m) => m.q === p.q && m.r === p.r) ? 0.12 : 0.45,
      );
      const repeating =
        p.kind === "set" ? s.challenge!.products[p.index!].repeat : null;
      if (repeating) {
        const shifted = add(p, rotate(repeating.vector, p.rotation));
        pattern(
          ctx,
          s.challenge!.products[p.index!],
          { ...p, ...shifted },
          0.3,
        );
      }
      text(
        ctx,
        `${p.kind === "rise" ? "IN" : "OUT"} ${(p.index ?? 0) + 1}`,
        anchor.x - 20,
        anchor.y + 35,
        9,
        p.kind === "rise" ? palette.teal : palette.gold,
      );
    } else
      sprite(
        ctx,
        C.SIGIL_GLYPH_PATHS[p.kind as keyof typeof C.SIGIL_GLYPH_PATHS],
        anchor.x,
        anchor.y,
      );
    return;
  }
  let base = anchor,
    rotation = p.rotation,
    length = p.length;
  const pose = s.sim?.poses.find((a) => a.part === p.id);
  if (pose && !ghost) {
    base = xy(pose.cell);
    rotation = pose.rotation;
    length = pose.length;
    const ins = p.tape?.[s.sim!.cycle % period(s.editor.parts)],
      t = s.sim!.fraction;
    if (ins === "rotate-cw") rotation += t;
    if (ins === "rotate-ccw") rotation -= t;
    if (ins === "extend") length += t;
    if (ins === "retract") length -= t;
    if (ins === "advance" || ins === "recede") {
      const next = plan(s).poses.find((a) => a.part === p.id);
      if (next) {
        const b = xy(next.cell);
        base = {
          x: base.x + (b.x - base.x) * t,
          y: base.y + (b.y - base.y) * t,
        };
      }
    }
  }
  for (const d of spokes(p.kind, 0)) {
    const a = ((d + rotation) * Math.PI) / 3,
      x = base.x + Math.cos(a) * C.HEX_PITCH * length,
      y = base.y + Math.sin(a) * C.HEX_PITCH * length;
    line(ctx, base.x, base.y, x, y, "#060d16", 9);
    line(ctx, base.x, base.y, x, y, "#9f8964", 5);
    line(ctx, base.x, base.y, x, y, "#ead4a0", 1);
    if (p.kind !== "wheel") {
      const hold = s.sim?.grips.some(
        (g) =>
          g.part === p.id &&
          g.spoke === (d + (pose?.rotation ?? p.rotation)) % 6,
      );
      sprite(
        ctx,
        hold ? C.GRIPPER_PATHS.closed : C.GRIPPER_PATHS.open,
        x,
        y,
        a,
      );
    } else sprite(ctx, C.FIXTURE_MOUNT_PATH, x, y, a);
  }
  if (s.sim?.fault?.parts.includes(p.id))
    circle(ctx, base.x, base.y, 27, "#f18c7c", 2);
  sprite(
    ctx,
    p.kind === "wheel"
      ? C.WHEEL_HUB_PATH
      : p.kind === "piston"
        ? C.HUB_PATHS.piston
        : C.HUB_PATHS.arm,
    base.x,
    base.y,
    (rotation * Math.PI) / 3,
  );
  text(ctx, `A${p.id}`, base.x - 10, base.y - 25, 10, palette.bright);
}
export function render(ctx: Context, s: OrreryState): void {
  sky(ctx);
  if (s.screen === "title") {
    ornament(ctx, s.simTime);
    text(ctx, "THE CELESTIAL WORKSHOP", 152, 156, 12, palette.gold);
    text(ctx, C.TITLE_TEXT, 144, 266, 92, palette.bright, "Georgia, serif");
    text(ctx, C.TAGLINE_TEXT, 152, 307, 14, palette.muted);
    line(ctx, 152, 334, 493, 334, palette.gold);
    menu(ctx, s, C.TITLE_ITEMS);
    text(ctx, "A puzzle of matter, motion & exquisite machines.", 152, 622, 13);
    text(ctx, "↑ ↓  CHOOSE     ENTER  OPEN     M  SOUND", 152, 661, 11);
    return;
  }
  if (s.screen === "select") {
    text(ctx, "ORRERY / " + s.mode.toUpperCase(), 180, 76, 12, palette.gold);
    text(
      ctx,
      s.mode === "campaign"
        ? "The celestial syllabus"
        : "The independent workshop",
      180,
      123,
      34,
      palette.bright,
      "Georgia, serif",
    );
    const labels = list(s.mode).map(
      (c, i) => `${String(i + 1).padStart(2, "0")}   ${c.name}`,
    );
    menu(ctx, s, labels);
    for (let i = 0; i < labels.length; i++) {
      const r = menuRect(s, i)!,
        solved = (
          s.mode === "campaign" ? s.campaignSolved : s.extrasSolved
        ).includes(i),
        locked = s.mode === "campaign" && i >= s.unlockedCount,
        record = (s.mode === "campaign" ? s.campaignRecords : s.extrasRecords)[
          i
        ];
      text(
        ctx,
        locked ? "LOCKED" : solved ? "✓ SOLVED" : "OPEN",
        945,
        r.y + 25,
        11,
        locked ? palette.muted : palette.gold,
      );
      if (solved && record)
        text(
          ctx,
          `COST ${record.cost}  CYCLES ${record.cycles}  AREA ${record.area}`,
          620,
          r.y + 25,
          10,
        );
    }
    text(ctx, "↑ ↓  CHOOSE     ENTER  OPEN     ESC  RETURN", 180, 670, 12);
    return;
  }
  if (s.screen === "howto") {
    const lesson = lessons[s.howtoPage];
    text(
      ctx,
      `WORKSHOP NOTES     ${s.howtoPage + 1} / ${C.HOWTO_PAGES}`,
      160,
      104,
      12,
      palette.gold,
    );
    text(ctx, lesson[0], 160, 180, 35, palette.bright, "Georgia, serif");
    if (s.howtoPage === 1) {
      text(ctx, lesson[1], 160, 230, 13);
      text(ctx, lesson[2], 160, 258, 13);
      text(
        ctx,
        "Wheel: six essence fixtures. Track: a railway for an arm's base.",
        160,
        286,
        13,
      );
      const descriptions = [
        "BIND / joins two motes",
        "MANIFOLD / joins three neighbors",
        "TRIUNE / a heavy bond between novas",
        "SUNDER / cuts one filament",
        "WANE / essence becomes dust",
        "MIRROR / copies essence onto dust",
        "ASCEND / mercury raises a planet",
        "CONJOIN / two planets become one",
        "ECLIPSE / dust becomes dark and light",
        "CONFLUENCE / four essences, one aether",
        "DISPERSION / aether, four essences",
        "VOID / consumes a loose mote",
      ];
      Object.entries(C.SIGIL_GLYPH_PATHS).forEach(([, path], i) => {
        const x = 175 + Math.floor(i / 6) * 490,
          y = 326 + (i % 6) * 42;
        sprite(ctx, path, x, y);
        text(ctx, descriptions[i], x + 34, y + 5, 12, palette.bright);
      });
    } else {
      lesson.slice(1).forEach((l, i) => text(ctx, l, 160, 250 + i * 48, 15));
      C.MOTES.forEach((m, i) => {
        sprite(ctx, C.MOTE_SPRITE_PATHS[m], 180 + i * 65, 480);
        text(ctx, m, 158 + i * 65, 521, 9);
      });
    }
    menu(ctx, s, ["RETURN TO THE WORKSHOP"]);
    text(ctx, "← →  TURN PAGE", 840, 642, 12, palette.gold);
    return;
  }
  // The fixed editor regions clip their own content.
  ctx.fillStyle = palette.panel;
  ctx.fillRect(0, 0, C.STAGE_W, C.HEADING_H);
  ctx.fillRect(0, C.HEADING_H, C.TRAY_REGION_W, C.STAGE_H);
  ctx.fillRect(
    C.READOUT_X0,
    C.HEADING_H,
    C.STAGE_W - C.READOUT_X0,
    C.TAPE_Y0 - C.HEADING_H,
  );
  ctx.fillRect(
    C.TRAY_REGION_W,
    C.TAPE_Y0,
    C.STAGE_W - C.TRAY_REGION_W,
    C.STAGE_H - C.TAPE_Y0,
  );
  line(ctx, 0, C.HEADING_H, C.STAGE_W, C.HEADING_H);
  line(ctx, C.TRAY_REGION_W, C.HEADING_H, C.TRAY_REGION_W, C.STAGE_H);
  line(ctx, C.READOUT_X0, C.HEADING_H, C.READOUT_X0, C.TAPE_Y0);
  line(ctx, C.TRAY_REGION_W, C.TAPE_Y0, C.STAGE_W, C.TAPE_Y0, palette.gold);
  text(ctx, "O R R E R Y", 20, 29, 17, palette.gold, "Georgia, serif");
  text(
    ctx,
    s.challenge?.name ?? "",
    252,
    30,
    21,
    palette.bright,
    "Georgia, serif",
  );
  text(ctx, `COST  ${cost(s.editor.parts)}`, 775, 29, 12, palette.gold);
  const missing = tray(s).filter(
    (t) =>
      (t.kind === "rise" || t.kind === "set") &&
      !s.editor.parts.some((p) => p.kind === t.kind && p.index === t.index),
  );
  text(
    ctx,
    missing.length
      ? `PLACE ${missing.map((t) => t.kind.toUpperCase() + " " + (t.index! + 1)).join(" · ")}`
      : s.sim
        ? "ESC  RETURN TO EDITOR"
        : "SPACE  SET IN MOTION",
    1019,
    28,
    10,
    palette.teal,
  );
  tray(s).forEach((entry, i) => {
    const y = C.TRAY_Y0 + i * C.TRAY_SLOT_H,
      spent =
        entry.index !== null &&
        s.editor.parts.some(
          (p) => p.kind === entry.kind && p.index === entry.index,
        );
    ctx.fillStyle = i % 2 ? "#142031" : "#101c2c";
    ctx.fillRect(C.TRAY_X0, y, C.TRAY_W, C.TRAY_SLOT_H - 2);
    text(
      ctx,
      String(i + 1).padStart(2, "0"),
      18,
      y + 19,
      9,
      spent ? "#485a69" : palette.gold,
    );
    text(
      ctx,
      entry.kind.toUpperCase() +
        (entry.index !== null ? " " + (entry.index + 1) : ""),
      44,
      y + 19,
      12,
      spent ? "#485a69" : palette.bright,
    );
    text(
      ctx,
      spent ? "✓" : String(C.PART_COSTS[entry.kind]),
      187,
      y + 19,
      11,
      palette.gold,
    );
  });
  text(ctx, "WORKBENCH", 18, 570, 10, palette.gold);
  [
    "DRAG    place / move",
    "Q E     turn part",
    "W S     change reach",
    "X       remove part",
    "U I     undo / redo",
    "M       toggle sound",
  ].forEach((l, i) => text(ctx, l, 18, 596 + i * 19, 10));
  ctx.save();
  ctx.beginPath();
  ctx.rect(
    C.TRAY_REGION_W,
    C.HEADING_H,
    C.READOUT_X0 - C.TRAY_REGION_W,
    C.TAPE_Y0 - C.HEADING_H,
  );
  ctx.clip();
  circle(ctx, C.FIELD_CX, C.FIELD_CY, 252, "#5b63503a");
  for (const h of field) hex(ctx, h, "#243c4b70");
  for (const h of field) {
    const p = xy(h);
    ctx.fillStyle = "#62788960";
    ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
  }
  text(ctx, "N", C.FIELD_CX - 4, 65, 10, palette.gold);
  text(ctx, "CELESTIAL PLANE / AXIAL GRID", 245, 538, 9, palette.muted);
  for (const p of s.editor.parts.filter((p) => !mechanism(p.kind)))
    drawPart(ctx, s, p);
  for (const p of s.editor.parts.filter((p) => mechanism(p.kind)))
    drawPart(ctx, s, p);
  if (s.sim) {
    const positions = livePositions(s);
    for (const f of s.sim.filaments) {
      const a = positions.get(f.a)!,
        b = positions.get(f.b)!;
      sprite(
        ctx,
        f.weight === 3
          ? C.FILAMENT_SPRITE_PATHS.triune
          : C.FILAMENT_SPRITE_PATHS.plain,
        (a.x + b.x) / 2,
        (a.y + b.y) / 2,
        Math.atan2(b.y - a.y, b.x - a.x),
      );
    }
    for (const m of s.sim.motes) {
      const p = positions.get(m.id)!;
      if (m.wheel !== null) sprite(ctx, C.FIXTURE_MOUNT_PATH, p.x, p.y);
      sprite(ctx, C.MOTE_SPRITE_PATHS[m.type], p.x, p.y);
      if (s.sim.fault?.motes.includes(m.id))
        circle(ctx, p.x, p.y, 24, "#f18c7c", 2);
    }
  }
  const selected = s.editor.parts.find((p) => p.id === s.editor.selected);
  if (selected) {
    const p = xy(selected);
    circle(ctx, p.x, p.y, 25, palette.teal, 2);
  }
  const h = target(s.pointer.x, s.pointer.y);
  if (h && !s.sim) hex(ctx, h, palette.teal, "#8ed6d013");
  const d = s.editor.drag;
  if (d && d.kind !== "lay" && d.at) {
    let ghost: PartState;
    if (d.kind === "place") {
      ghost = {
        ...restPart(-1, d.part, d.at.q, d.at.r, d.rotation, d.index),
        length: d.length,
      };
    } else {
      const p = s.editor.parts.find((p) => p.id === d.part)!;
      ghost = {
        ...p,
        q: p.q + d.at.q - d.from.q,
        r: p.r + d.at.r - d.from.r,
        rotation: d.rotation,
        length: d.length,
        cells:
          p.cells?.map((h) => ({
            q: h.q + d.at!.q - d.from.q,
            r: h.r + d.at!.r - d.from.r,
          })) ?? null,
      };
    }
    let legal = true;
    try {
      validate(
        [
          ...s.editor.parts.filter(
            (p) => d.kind === "place" || p.id !== d.part,
          ),
          ghost,
        ],
        s.challenge!,
      );
    } catch {
      legal = false;
    }
    for (const h of footprint(ghost, s.challenge!))
      hex(
        ctx,
        h,
        legal ? palette.teal : "#ef8a7b",
        legal ? "#8ed6d015" : "#ef8a7b25",
      );
    ctx.globalAlpha = 0.6;
    drawPart(ctx, s, ghost, true);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  text(ctx, "MACHINE TELEMETRY", 1030, 80, 11, palette.gold);
  text(
    ctx,
    (s.sim?.status ?? "design").toUpperCase(),
    1030,
    119,
    25,
    palette.bright,
    "Georgia, serif",
  );
  line(ctx, 1030, 139, 1256, 139);
  const stats = [
    ["CYCLE", String(s.sim?.cycle ?? 0)],
    ["PERIOD", String(period(s.editor.parts))],
    ["SPEED", `${C.SPEEDS[s.sim?.speed ?? C.DEFAULT_SPEED_INDEX]} / sec`],
    ["AREA", String(s.sim?.areaHexes.length ?? 0)],
  ];
  stats.forEach(([label, value], i) => {
    text(ctx, label, 1030, 168 + i * 30, 11);
    text(ctx, value, 1172, 168 + i * 30, 15, palette.bright);
  });
  line(ctx, 1030, 281, 1256, 281);
  text(ctx, "PRODUCTS / DELIVERY", 1030, 309, 10, palette.gold);
  s.challenge?.products.forEach((m, i) => {
    text(
      ctx,
      m.motes
        .map((m) => m.type)
        .join(" + ")
        .slice(0, 24),
      1030,
      341 + i * 42,
      11,
      palette.bright,
    );
    text(
      ctx,
      `${s.sim?.tallies[i] ?? 0} / ${s.challenge!.target}`,
      1195,
      359 + i * 42,
      14,
      palette.teal,
    );
  });
  text(ctx, "Space  play / pause", 1030, 456, 11);
  text(ctx, "N      single cycle", 1030, 479, 11);
  text(ctx, ", .    change speed", 1030, 502, 11);
  text(ctx, "Esc    stop / leave", 1030, 525, 11);
  const sc = scroll(s);
  rows(s)
    .slice(sc.row, sc.row + C.TAPE_ROWS_VISIBLE)
    .forEach((p, i) => {
      const y = C.TAPE_Y0 + i * C.TAPE_ROW_H;
      ctx.fillStyle = i % 2 ? "#102033" : "#0c192a";
      ctx.fillRect(
        C.TRAY_REGION_W,
        y,
        C.STAGE_W - C.TRAY_REGION_W,
        C.TAPE_ROW_H,
      );
      text(
        ctx,
        `A${p.id} ${p.tape!.length}/${period(s.editor.parts)}`,
        235,
        y + 19,
        10,
        palette.gold,
      );
      for (let j = 0; j < C.TAPE_COLS_VISIBLE; j++) {
        const col = j + sc.col,
          x = C.TRAY_REGION_W + C.TAPE_X0 + j * C.TAPE_CELL_W;
        ctx.strokeStyle = palette.line;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, C.TAPE_CELL_W, C.TAPE_ROW_H);
        if (s.sim && col === s.sim.cycle % period(s.editor.parts)) {
          ctx.fillStyle = "#d5b57730";
          ctx.fillRect(x, y, C.TAPE_CELL_W, C.TAPE_ROW_H);
        }
        const ins = p.tape![col];
        if (ins)
          sprite(
            ctx,
            C.INSTRUCTION_GLYPH_PATHS[ins],
            x + C.TAPE_CELL_W / 2,
            y + C.TAPE_ROW_H / 2,
          );
        if (s.editor.cursor?.part === p.id && s.editor.cursor.col === col) {
          ctx.strokeStyle = palette.teal;
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 1, y + 1, C.TAPE_CELL_W - 2, C.TAPE_ROW_H - 2);
        }
      }
    });
  if (!rows(s).length)
    text(
      ctx,
      "Place an arm, then click its tape to compose an orbit.",
      250,
      598,
      14,
    );
  text(
    ctx,
    "G grab  V drop  A D turn  Z C pivot  W S reach  T B travel  R reset  Y repeat",
    242,
    714,
    10,
    palette.muted,
  );
  if (s.sim?.status === "faulted") {
    ctx.fillStyle = "#572b2bcb";
    ctx.fillRect(342, 65, 548, 45);
    text(
      ctx,
      `HALTED / ${s.sim.fault!.kind.toUpperCase()} — Escape to edit`,
      360,
      94,
      14,
      "#ffb8a4",
    );
  }
  if (s.sim?.status === "complete") {
    ctx.fillStyle = "#07131acb";
    ctx.fillRect(396, 167, 488, 366);
    ctx.strokeStyle = palette.gold;
    ctx.strokeRect(396, 167, 488, 366);
    text(
      ctx,
      "✦  " + C.SOLVED_TITLE_TEXT,
      440,
      213,
      23,
      palette.bright,
      "Georgia, serif",
    );
    text(
      ctx,
      "A little order, drawn from the infinite.",
      440,
      246,
      12,
      palette.muted,
    );
    const m = s.sim.metrics!;
    text(
      ctx,
      `COST ${m.cost}    CYCLES ${m.cycles}    AREA ${m.area}`,
      440,
      290,
      14,
      palette.teal,
    );
    const records = s.challengeRef
      ? (s.challengeRef.mode === "campaign"
          ? s.campaignRecords
          : s.extrasRecords)[s.challengeRef.index]
      : null;
    const recordText = records
      ? `BEST  ${records.cost === m.cost ? "★" : ""}COST ${records.cost}  ${records.cycles === m.cycles ? "★" : ""}CYCLES ${records.cycles}  ${records.area === m.area ? "★" : ""}AREA ${records.area}`
      : "CUSTOM MACHINE / SESSION ONLY";
    text(ctx, recordText, 440, 323, 10, palette.gold);
    menu(ctx, s, solvedItems(s));
  }
}
