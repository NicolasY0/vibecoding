/**
 * Generate simple solid-color PNG icon files for the extension.
 * Uses only Node.js built-in modules (zlib).
 * Usage: node scripts/generate-icons.js
 */

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '..', 'icons');

// --- CRC32 for PNG chunks ---
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// --- Build a PNG chunk ---
function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);

  const typeB = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeB, data]);
  const crcVal = crc32(crcData);
  const crcB = Buffer.alloc(4);
  crcB.writeUInt32BE(crcVal, 0);

  return Buffer.concat([len, typeB, data, crcB]);
}

// --- Build a solid RGBA PNG ---
function createPNG(width, height, r, g, b, a = 255) {
  // 8-byte PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // color type RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = createChunk('IHDR', ihdrData);

  // IDAT — raw pixel rows, each row prefixed with filter byte 0 (None)
  const rowBytes = 1 + width * 4;
  const raw = Buffer.alloc(height * rowBytes);
  for (let y = 0; y < height; y++) {
    raw[y * rowBytes] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const off = y * rowBytes + 1 + x * 4;
      raw[off] = r;
      raw[off + 1] = g;
      raw[off + 2] = b;
      raw[off + 3] = a;
    }
  }
  const compressed = zlib.deflateSync(raw);
  const idat = createChunk('IDAT', compressed);

  // IEND
  const iend = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

// --- Generate three sizes ---
// Brand color: warm teal #0ea5a0
const R = 14, G = 165, B = 160;

const sizes = [
  { name: 'icon16.png',  w: 16 },
  { name: 'icon48.png',  w: 48 },
  { name: 'icon128.png', w: 128 },
];

if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

for (const { name, w } of sizes) {
  const png = createPNG(w, w, R, G, B);
  fs.writeFileSync(path.join(ICONS_DIR, name), png);
  console.log(`✅  ${name}  (${w}×${w})  —  ${png.length} bytes`);
}

console.log('\n🎉  All icons generated in', ICONS_DIR);
