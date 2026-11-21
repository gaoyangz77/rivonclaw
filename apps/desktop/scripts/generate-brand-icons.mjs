#!/usr/bin/env node
/**
 * Regenerate the Desktop app and tray icons from build/brand-mark.svg.
 *
 * build/brand-mark.svg is the single source of the TK mark on the Desktop side.
 * The Panel also serves it as the sidebar logo (its Vite publicDir is
 * ../desktop/build), and the website keeps its own copy of the same mark, so a
 * change to the mark has to land in both places.
 *
 * Writes into build/:
 *   icon.icns     macOS app icon, drawn on Apple's icon grid
 *   icon.png      512px of the macOS artwork: Linux packages and the dev Dock icon
 *   icon.ico      Windows app icon, a full-bleed tile at 16-256px
 *   trayIcon.png  44px colour mark (22pt at 2x); tray/tray-icon.ts adds the status dot
 *
 * macOS only: rasterises with Google Chrome through Playwright and packs the
 * ICNS with iconutil. The ICO is written here, in the same layout as the icon it
 * replaced (32-bit BMP frames with an AND mask): ImageMagick 7's ICO writer
 * produced a corrupt 256px frame when this script was written.
 *
 *   cd apps/desktop && node scripts/generate-brand-icons.mjs
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const DESKTOP_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BUILD_DIR = path.join(DESKTOP_DIR, "build");
const MARK_SVG = fs.readFileSync(path.join(BUILD_DIR, "brand-mark.svg"), "utf8");

const viewBoxMatch = /<svg[^>]*\sviewBox="([^"]+)"/.exec(MARK_SVG);
if (!viewBoxMatch) throw new Error("brand-mark.svg: root <svg> has no viewBox");
const MARK_VIEWBOX = viewBoxMatch[1];
const [, , MARK_WIDTH, MARK_HEIGHT] = MARK_VIEWBOX.split(/\s+/).map(Number);
const MARK_BODY = MARK_SVG.replace(/^[\s\S]*?<svg[^>]*>/, "")
  .replace(/<\/svg>\s*$/, "")
  .replace(/<title>[\s\S]*?<\/title>|<desc>[\s\S]*?<\/desc>/g, "");

/** Dark ground shared with the website (--page #080A12, --card #0F1424). */
const TILE_TOP = "#1B2342";
const TILE_BOTTOM = "#080A12";
const TILE_HAIRLINE = "rgb(160 172 214 / 18%)";

/** The mark, `width` px wide, centred in a `size` px canvas. */
function placedMark(size, width) {
  const height = (width * MARK_HEIGHT) / MARK_WIDTH;
  const x = (size - width) / 2;
  const y = (size - height) / 2;
  return `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${MARK_VIEWBOX}">${MARK_BODY}</svg>`;
}

/**
 * The mark on a rounded dark tile.
 * inset/radius are fractions of the canvas; markRatio is the mark's width as a
 * fraction of the tile.
 */
function tileIcon(size, { inset, radius, markRatio, shadow }) {
  const offset = size * inset;
  const side = size - offset * 2;
  const rx = size * radius;
  const hairline = size >= 64 ? size / 512 : 0;
  const filter = shadow
    ? `<filter id="tile-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="${size * 0.01}" stdDeviation="${size * 0.012}" flood-color="#000" flood-opacity="0.3"/></filter>`
    : "";
  const stroke = hairline
    ? `<rect x="${offset + hairline / 2}" y="${offset + hairline / 2}" width="${side - hairline}" height="${side - hairline}" rx="${rx - hairline / 2}" fill="none" stroke="${TILE_HAIRLINE}" stroke-width="${hairline}"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<defs><linearGradient id="tile-ground" x1="0.3" y1="0" x2="0.7" y2="1"><stop offset="0" stop-color="${TILE_TOP}"/><stop offset="1" stop-color="${TILE_BOTTOM}"/></linearGradient>${filter}</defs>
<rect x="${offset}" y="${offset}" width="${side}" height="${side}" rx="${rx}" fill="url(#tile-ground)"${shadow ? ' filter="url(#tile-shadow)"' : ""}/>
${stroke}
${placedMark(size, side * markRatio)}
</svg>`;
}

/** Apple's grid: an 824px tile with a ~185px corner on a 1024px canvas. */
function macIcon(size) {
  return tileIcon(size, {
    inset: 100 / 1024,
    radius: 185 / 1024,
    markRatio: size <= 32 ? 0.78 : 0.66,
    shadow: size >= 64,
  });
}

/** Windows draws icons edge to edge, and 16-32px needs the mark as large as it fits. */
function windowsIcon(size) {
  return tileIcon(size, {
    inset: size <= 32 ? 0 : 1 / 32,
    radius: 0.2,
    markRatio: size <= 32 ? 0.82 : 0.7,
    shadow: false,
  });
}

function trayIcon(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${placedMark(size, size - 2)}</svg>`;
}

const ICONSET = [
  [16, "icon_16x16"],
  [32, "icon_16x16@2x"],
  [32, "icon_32x32"],
  [64, "icon_32x32@2x"],
  [128, "icon_128x128"],
  [256, "icon_128x128@2x"],
  [256, "icon_256x256"],
  [512, "icon_256x256@2x"],
  [512, "icon_512x512"],
  [1024, "icon_512x512@2x"],
];
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];
const TRAY_SIZE = 44;

/**
 * One ICO frame: a 32-bit bottom-up BGRA bitmap followed by the 1-bit AND
 * mask, whose bit is set where the pixel is fully transparent.
 */
function icoFrame(size, rgba) {
  const maskStride = Math.ceil(size / 32) * 4;
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8); // XOR bitmap + AND mask
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  header.writeUInt32LE(size * size * 4 + maskStride * size, 20);
  const pixels = Buffer.alloc(size * size * 4);
  const mask = Buffer.alloc(maskStride * size);
  for (let y = 0; y < size; y++) {
    const row = size - 1 - y;
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4;
      const dst = (row * size + x) * 4;
      pixels[dst] = rgba[src + 2];
      pixels[dst + 1] = rgba[src + 1];
      pixels[dst + 2] = rgba[src];
      pixels[dst + 3] = rgba[src + 3];
      if (rgba[src + 3] === 0) mask[row * maskStride + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return Buffer.concat([header, pixels, mask]);
}

function icoFile(frames) {
  const directory = Buffer.alloc(6 + 16 * frames.length);
  directory.writeUInt16LE(1, 2); // type: icon
  directory.writeUInt16LE(frames.length, 4);
  let offset = directory.length;
  frames.forEach(({ size, data }, index) => {
    const entry = 6 + 16 * index;
    directory.writeUInt8(size >= 256 ? 0 : size, entry); // 0 means 256
    directory.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(data.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([directory, ...frames.map((frame) => frame.data)]);
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "brand-icons-"));
try {
  const page = await browser.newPage();

  /** Draw the SVG on a size x size canvas; returns the PNG and the raw RGBA. */
  async function rasterize(svg, size) {
    const { png, rgba } = await page.evaluate(
      async ({ svg, size }) => {
        const image = new Image(size, size);
        image.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, size, size);
        const bytes = context.getImageData(0, 0, size, size).data;
        let binary = "";
        for (let i = 0; i < bytes.length; i += 0x8000) {
          binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        }
        return { png: canvas.toDataURL("image/png").split(",")[1], rgba: btoa(binary) };
      },
      { svg, size },
    );
    return { png: Buffer.from(png, "base64"), rgba: Buffer.from(rgba, "base64") };
  }

  const iconset = path.join(tmp, "icon.iconset");
  fs.mkdirSync(iconset);
  for (const [size, name] of ICONSET) {
    fs.writeFileSync(path.join(iconset, `${name}.png`), (await rasterize(macIcon(size), size)).png);
  }
  execFileSync("iconutil", ["-c", "icns", "-o", path.join(BUILD_DIR, "icon.icns"), iconset]);
  fs.copyFileSync(path.join(iconset, "icon_512x512.png"), path.join(BUILD_DIR, "icon.png"));

  const frames = [];
  for (const size of ICO_SIZES) {
    frames.push({ size, data: icoFrame(size, (await rasterize(windowsIcon(size), size)).rgba) });
  }
  fs.writeFileSync(path.join(BUILD_DIR, "icon.ico"), icoFile(frames));

  fs.writeFileSync(
    path.join(BUILD_DIR, "trayIcon.png"),
    (await rasterize(trayIcon(TRAY_SIZE), TRAY_SIZE)).png,
  );
} finally {
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log("generate-brand-icons: wrote build/icon.icns, icon.png, icon.ico, trayIcon.png");
