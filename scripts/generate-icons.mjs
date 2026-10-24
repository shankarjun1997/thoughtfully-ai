import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const p = (...parts) => path.join(root, ...parts);

async function ensureDir(dir) {
  await mkdir(p(dir), { recursive: true });
}

async function svgBuffer(file) {
  return readFile(p(file));
}

async function png(svg, size, out, options = {}) {
  await ensureDir(path.dirname(p(out)));
  await sharp(svg, { density: 384 })
    .resize(size, size, { fit: "cover" })
    .png({ compressionLevel: 9, ...options })
    .toFile(p(out));
  console.log("wrote", out, `${size}x${size}`);
}

async function pngBuffer(svg, size) {
  return sharp(svg, { density: 384 }).resize(size, size, { fit: "cover" }).png({ compressionLevel: 9 }).toBuffer();
}

function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  const directory = [];
  let offset = 6 + entries.length * 16;
  for (const entry of entries) {
    const item = Buffer.alloc(16);
    item.writeUInt8(entry.size >= 256 ? 0 : entry.size, 0);
    item.writeUInt8(entry.size >= 256 ? 0 : entry.size, 1);
    item.writeUInt8(0, 2);
    item.writeUInt8(0, 3);
    item.writeUInt16LE(1, 4);
    item.writeUInt16LE(32, 6);
    item.writeUInt32LE(entry.buffer.length, 8);
    item.writeUInt32LE(offset, 12);
    directory.push(item);
    offset += entry.buffer.length;
  }

  return Buffer.concat([header, ...directory, ...entries.map((entry) => entry.buffer)]);
}

async function main() {
  const rounded = await svgBuffer("resources/icon-rounded.svg");
  const full = await svgBuffer("resources/icon-full.svg");
  const foreground = await svgBuffer("resources/icon-foreground.svg");
  const background = await svgBuffer("resources/icon-background.svg");
  const splash = await svgBuffer("resources/splash.svg");
  const splashDark = await svgBuffer("resources/splash-dark.svg");

  await png(rounded, 192, "public/icon-192.png");
  await png(rounded, 512, "public/icon-512.png");
  await png(full, 512, "public/icon-maskable-512.png");
  await png(full, 180, "public/apple-touch-icon.png");
  await png(rounded, 32, "public/favicon-32.png");

  await copyFile(p("resources/icon-rounded.svg"), p("app/icon.svg"));
  await png(full, 180, "app/apple-icon.png");

  const icoEntries = [];
  for (const size of [16, 32, 48]) {
    icoEntries.push({ size, buffer: await pngBuffer(rounded, size) });
  }
  await writeFile(p("app/favicon.ico"), buildIco(icoEntries));
  console.log("wrote app/favicon.ico (16, 32, 48)");

  await ensureDir("resources");
  await png(full, 1024, "resources/icon.png");
  await png(full, 1024, "resources/icon-only.png");
  await png(background, 1024, "resources/icon-background.png");

  const inner = await sharp(foreground, { density: 384 }).resize(620, 620, { fit: "contain" }).png().toBuffer();
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: inner, gravity: "centre" }])
    .png({ compressionLevel: 9 })
    .toFile(p("resources/icon-foreground.png"));
  console.log("wrote resources/icon-foreground.png 1024x1024 (safe-zone flower)");

  const splashPng = await sharp(splash, { density: 144 }).resize(2732, 2732, { fit: "cover" }).png({ compressionLevel: 9 }).toBuffer();
  const splashOut = p("resources/splash.png");
  await writeFile(splashOut, splashPng);
  console.log("wrote resources/splash.png 2732x2732");

  const splashDarkPng = await sharp(splashDark, { density: 144 }).resize(2732, 2732, { fit: "cover" }).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(p("resources/splash-dark.png"), splashDarkPng);
  console.log("wrote resources/splash-dark.png 2732x2732");

  await copyFile(p("resources/logo-mark.svg"), p("public/logo-mark.svg"));
  console.log("wrote public/logo-mark.svg");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
