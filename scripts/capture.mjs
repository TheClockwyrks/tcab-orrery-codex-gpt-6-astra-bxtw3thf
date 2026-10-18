/* global window, console */
import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173/scripts/capture.html");
await page.waitForFunction(() => !!window.captureEngine);
const frames = async (n) =>
  page.evaluate((n) => window.captureEngine.advance(n), n);
const key = async (k) => {
  await page.keyboard.down(k);
  await frames(1);
  await page.keyboard.up(k);
  await frames(1);
};
await page.screenshot({ path: "showcase/title.png" });
await key("Enter");
await key("Enter");
await page.evaluate(() => window.captureEngine.startRecording());
await frames(30);
const drag = async (slot, q, r) => {
  await page.mouse.move(100, 56 + slot * 30 + 15);
  await page.mouse.down();
  await frames(8);
  const x = 616 + 48 * (q + r / 2),
    y = 304 + ((48 * Math.sqrt(3)) / 2) * r;
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(
      100 + ((x - 100) * i) / 20,
      56 + slot * 30 + 15 + ((y - (56 + slot * 30 + 15)) * i) / 20,
    );
    await frames(1);
  }
  await page.mouse.up();
  await frames(12);
};
await drag(1, -1, 0);
await drag(2, 1, 0);
await drag(0, 0, 0);
await key("e");
await key("e");
await key("e");
await page.mouse.click(324, 574);
await frames(8);
for (const k of ["g", "d", "d", "d", "v", "a", "a", "a"]) {
  await key(k);
  await frames(10);
}
await frames(35);
await key("Space");
await frames(45);
await page.screenshot({ path: "showcase/machine.png" });
await frames(920);
const status = await page.evaluate(
  () => window.captureEngine.state.sim?.status,
);
if (status !== "complete") throw Error("Showcase failed: " + status);
await frames(90);
await page.screenshot({ path: "showcase/complete.png" });
const recording = await page.evaluate(() =>
  window.captureEngine.stopRecording(),
);
await writeFile(
  "showcase/first-orbit.json.gz",
  gzipSync(JSON.stringify(recording)),
);
console.log(
  JSON.stringify({
    errors,
    frames: recording.frames.length,
    seconds: recording.frames.reduce((n, f) => n + f.deltaMs, 0) / 1000,
  }),
);
await browser.close();
