/** Generates extension icons as PNGs with a tiny pure-Node PNG writer (no image libs). */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Uint32Array(256).map((_, n) => {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      return c >>> 0;
    });
  }
  let c = 0xffffffff;
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type);
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function png(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const lerp = (a, b, t) => a + (b - a) * t;
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const L2 = dx * dx + dy * dy || 1e-6;
  let t = ((px - ax) * dx + (py - ay) * dy) / L2;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + t * dx - px, qy = ay + t * dy - py;
  return Math.hypot(qx, qy);
}

function drawLogo(size) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = size * 0.44, cy = size * 0.42, R = size * 0.245, ring = size * 0.075;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const nx = x / size, ny = y / size;
      // rounded-square deep-navy gradient plate
      const r = size * 0.22;
      const inside =
        nx > r / size && nx < 1 - r / size || ny > r / size && ny < 1 - r / size
          ? true : false;
      let inPlate = false;
      if (inside) inPlate = true;
      else {
        const qx = Math.min(Math.max(nx * size, r), size - r);
        const qy = Math.min(Math.max(ny * size, r), size - r);
        inPlate = Math.hypot(nx * size - qx, ny * size - qy) <= r;
      }
      if (!inPlate) { buf[i + 3] = 0; continue; }
      let Rr = lerp(10, 22, ny), Gg = lerp(16, 34, ny), Bb = lerp(38, 68, ny); // navy gradient
      const paint = (r2, g2, b2, a = 1) => { Rr = lerp(Rr, r2, a); Gg = lerp(Gg, g2, a); Bb = lerp(Bb, b2, a); };
      // magnifier ring + handle
      const d = Math.hypot(x - cx, y - cy);
      if (Math.abs(d - R) < ring) paint(34, 211, 238, 0.95);
      if (segDist(x, y, cx + R * 0.72, cy + R * 0.72, size * 0.72, size * 0.72) < ring * 0.9) paint(56, 130, 246, 0.95);
      // checkmark
      if (segDist(x, y, cx - R * 0.45, cy + R * 0.02, cx - R * 0.08, cy + R * 0.42) < ring * 0.62) paint(255, 255, 255, 0.95);
      if (segDist(x, y, cx - R * 0.08, cy + R * 0.42, cx + R * 0.52, cy - R * 0.42) < ring * 0.62) paint(255, 255, 255, 0.95);
      buf[i] = Math.round(Rr); buf[i + 1] = Math.round(Gg); buf[i + 2] = Math.round(Bb); buf[i + 3] = 255;
    }
  }
  return png(size, size, buf);
}

const outDir = join(root, 'dist', 'icons');
mkdirSync(outDir, { recursive: true });
for (const s of [16, 32, 48, 128]) writeFileSync(join(outDir, `icon${s}.png`), drawLogo(s));
console.log('icons written to dist/icons');
