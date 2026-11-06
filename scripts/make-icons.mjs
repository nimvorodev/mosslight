/**
 * Generates every icon Mosslight needs from one tiny 32x32 pixel drawing.
 * Run `npm run icons`. No image libraries required: we encode PNG by hand
 * with zlib and wrap the sizes in an ICO container.
 */
import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

/* ---------------------------------------------------------------- */
/* a 32x32 RGBA canvas                                              */
/* ---------------------------------------------------------------- */

const SIZE = 32;
const canvas = new Uint8Array(SIZE * SIZE * 4);

function hex(value) {
  const clean = value.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function set(x, y, color, alpha = 255) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= SIZE || py >= SIZE) return;
  const [r, g, b] = hex(color);
  const index = (py * SIZE + px) * 4;
  canvas[index] = r;
  canvas[index + 1] = g;
  canvas[index + 2] = b;
  canvas[index + 3] = alpha;
}

function fill(x, y, w, h, color, alpha = 255) {
  for (let row = 0; row < h; row += 1) {
    for (let col = 0; col < w; col += 1) {
      set(x + col, y + row, color, alpha);
    }
  }
}

function rows(y, x0, x1, color) {
  fill(x0, y, x1 - x0 + 1, 1, color);
}

const C = {
  rim: '#8fb9a2',
  rimDark: '#487a63',
  glass: '#1c4034',
  glassDeep: '#0d241f',
  shine: '#d8f3e4',
  wood: '#6b4a33',
  woodDark: '#3a271d',
  woodLight: '#9b704d',
  brass: '#c9a45a',
  brassLight: '#f0d690',
  soil: '#3b2a22',
  soilLight: '#634637',
  moss: '#5d8b50',
  mossLight: '#7fac61',
  mossBright: '#a6cd7b',
  fern: '#6fa967',
  fernLight: '#9acb7f',
  fernDark: '#365f44',
  cap: '#c96b52',
  capLight: '#ec9a77',
  stem: '#e3d3b8',
  pebble: '#8a7a68',
};

/* ---------------------------------------------------------------- */
/* draw the jar                                                     */
/* ---------------------------------------------------------------- */

// A soft rounded base plate.
fill(7, 27, 18, 2, C.woodDark);
rows(28, 8, 23, '#241811');
rows(27, 8, 23, C.wood);
fill(9, 28, 3, 1, '#241811');
fill(20, 28, 3, 1, '#241811');

// Glass body: rounded rectangle 5..26 x 6..27.
for (let y = 6; y <= 27; y += 1) {
  const inset = y === 6 ? 3 : y === 7 ? 2 : 0;
  const x0 = 5 + inset;
  const x1 = 26 - inset;
  set(x0, y, C.rim);
  set(x1, y, C.rim);
  rows(y, x0 + 1, x1 - 1, y < 9 ? C.glassDeep : C.glass);
}
rows(6, 8, 23, C.rim);
rows(7, 7, 24, C.rimDark);

// Interior light: moss floor and soil.
fill(6, 19, 20, 4, '#2c4a34');
fill(6, 22, 20, 3, C.soil);
rows(22, 6, 25, C.soilLight);
for (let x = 6; x <= 25; x += 1) {
  const bump = (x * 7) % 5 < 2 ? 1 : 0;
  set(x, 21 + bump, C.moss);
  if (x % 3 === 0) set(x, 20 + bump, C.mossLight);
  if (x % 4 === 0) set(x, 19 + bump, C.mossBright);
}
// pebbles in the glass wall
set(8, 24, C.pebble);
set(21, 25, C.pebble);
set(13, 25, '#6f6152');

// fern
for (let i = 0; i < 10; i += 1) {
  set(16 - Math.floor(i / 6), 21 - i, i % 4 === 0 ? C.fernLight : C.fern);
}
for (const [y, side, length] of [
  [19, -1, 3],
  [16, 1, 3],
  [13, -1, 2],
]) {
  for (let k = 1; k <= length; k += 1) {
    set(16 + side * k, y - Math.round(k * 0.6), k === length ? C.fernLight : C.fern);
    set(16 + side * k, y - Math.round(k * 0.6) + 1, C.fernDark);
  }
}
set(16, 10, C.fernLight);
set(15, 11, C.fernLight);

// mushroom
fill(21, 19, 1, 3, C.stem);
rows(17, 20, 23, C.cap);
rows(18, 20, 23, C.cap);
set(20, 18, C.capLight);
set(22, 17, C.capLight);

// glass shine
for (let y = 9; y <= 18; y += 1) {
  set(8, y, C.shine, y > 12 ? 120 : 190);
}
set(9, 10, C.shine, 90);
set(9, 11, C.shine, 70);

// lid + knob
fill(8, 3, 16, 2, C.wood);
rows(3, 8, 23, C.woodLight);
rows(4, 8, 23, C.woodDark);
fill(14, 1, 4, 2, C.brass);
rows(1, 14, 17, C.brassLight);

// rim outline on top of the glass
rows(6, 7, 24, C.rim);
set(6, 8, C.rimDark);
set(25, 8, C.rimDark);
rows(27, 6, 25, C.rim);

/* ---------------------------------------------------------------- */
/* PNG encoding                                                     */
/* ---------------------------------------------------------------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function nearestNeighbour(size) {
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    const sy = Math.min(SIZE - 1, Math.floor((y * SIZE) / size));
    for (let x = 0; x < size; x += 1) {
      const sx = Math.min(SIZE - 1, Math.floor((x * SIZE) / size));
      const src = (sy * SIZE + sx) * 4;
      const dst = (y * size + x) * 4;
      out[dst] = canvas[src];
      out[dst + 1] = canvas[src + 1];
      out[dst + 2] = canvas[src + 2];
      out[dst + 3] = canvas[src + 3];
    }
  }
  return out;
}

function encodePng(size) {
  const pixels = nearestNeighbour(size);
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** PNG-in-ICO works on Windows Vista and newer and keeps this script tiny. */
function encodeIco(sizes) {
  const images = sizes.map((size) => ({ size, png: encodePng(size) }));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const directory = Buffer.alloc(16 * images.length);
  let offset = 6 + directory.length;
  images.forEach((image, index) => {
    const entry = index * 16;
    directory[entry] = image.size >= 256 ? 0 : image.size;
    directory[entry + 1] = image.size >= 256 ? 0 : image.size;
    directory[entry + 2] = 0;
    directory[entry + 3] = 0;
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(image.png.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += image.png.length;
  });

  return Buffer.concat([header, directory, ...images.map((image) => image.png)]);
}

/* ---------------------------------------------------------------- */
/* write everything                                                 */
/* ---------------------------------------------------------------- */

const electronAssets = path.join(root, 'electron', 'assets');
const buildDir = path.join(root, 'build');
await mkdir(electronAssets, { recursive: true });
await mkdir(buildDir, { recursive: true });

const icon256 = encodePng(256);
const icon512 = encodePng(512);
const tray = encodePng(32);
const tray16 = encodePng(16);

await writeFile(path.join(electronAssets, 'icon.png'), icon256);
await writeFile(path.join(electronAssets, 'tray-32.png'), tray);
await writeFile(path.join(electronAssets, 'tray-16.png'), tray16);
await writeFile(path.join(electronAssets, 'icon.ico'), encodeIco([16, 32, 48, 64, 256]));
await writeFile(path.join(buildDir, 'icon.png'), icon512);
await writeFile(path.join(buildDir, 'icon.ico'), encodeIco([16, 32, 48, 64, 128, 256]));

console.log('icons written to electron/assets and build/');
