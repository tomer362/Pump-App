/**
 * Renders the PWA raster icons from the single SVG source.
 *
 * iOS ignores SVG icons for the Home Screen, so PNGs are required; generating
 * them from one source keeps the mark in sync instead of drifting across four
 * hand-exported files.
 *
 *   node scripts/generate-icons.mjs
 */
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";

const svg = readFileSync("public/icon.svg", "utf8");

const TARGETS = [
  { file: "public/icon-192.png", size: 192, padding: 0 },
  { file: "public/icon-512.png", size: 512, padding: 0 },
  { file: "public/apple-icon.png", size: 180, padding: 0 },
  // Maskable icons get cropped to a circle on Android, so the mark is inset
  // into the safe zone (~80% of the canvas).
  { file: "public/icon-maskable.png", size: 512, padding: 0.1 },
];

const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ??
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});

for (const { file, size, padding } of TARGETS) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  const inset = Math.round(size * padding);
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:#0B0B0C">
       <div style="width:${size}px;height:${size}px;display:grid;place-items:center;background:#0B0B0C">
         <div style="width:${size - inset * 2}px;height:${size - inset * 2}px">${svg}</div>
       </div>
     </body></html>`,
  );
  const buf = await page.screenshot({ omitBackground: false });
  writeFileSync(file, buf);
  await page.close();
  console.log(`  ${file} (${size}×${size})`);
}

await browser.close();
console.log("Icons generated.");
