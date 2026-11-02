'use strict';

// Dekodiert Mod-Icons im DDS-Format (DXT1/3/5 und unkomprimiert 32 Bit) und
// wandelt sie in ein PNG-Data-URL um, damit sie im Launcher angezeigt werden können.

const zlib = require('zlib');

function rgb565(c) {
  const r = (c >> 11) & 31;
  const g = (c >> 5) & 63;
  const b = c & 31;
  return [(r << 3) | (r >> 2), (g << 2) | (g >> 4), (b << 3) | (b >> 2)];
}

function colorBlock(buf, off, out, w, h, bx, by, hasAlphaMode, alphaFn) {
  const c0 = buf.readUInt16LE(off);
  const c1 = buf.readUInt16LE(off + 2);
  const a = rgb565(c0);
  const b = rgb565(c1);
  const pal = [a, b];
  let transparentIndex3 = false;
  if (c0 > c1 || !hasAlphaMode) {
    pal.push([(2 * a[0] + b[0]) / 3 | 0, (2 * a[1] + b[1]) / 3 | 0, (2 * a[2] + b[2]) / 3 | 0]);
    pal.push([(a[0] + 2 * b[0]) / 3 | 0, (a[1] + 2 * b[1]) / 3 | 0, (a[2] + 2 * b[2]) / 3 | 0]);
  } else {
    pal.push([(a[0] + b[0]) >> 1, (a[1] + b[1]) >> 1, (a[2] + b[2]) >> 1]);
    pal.push([0, 0, 0]);
    transparentIndex3 = true;
  }
  const bits = buf.readUInt32LE(off + 4);
  for (let py = 0; py < 4; py++) {
    for (let px = 0; px < 4; px++) {
      const x = bx * 4 + px;
      const y = by * 4 + py;
      if (x >= w || y >= h) continue;
      const idx = (bits >>> (2 * (py * 4 + px))) & 3;
      const o = (y * w + x) * 4;
      const c = pal[idx];
      out[o] = c[0];
      out[o + 1] = c[1];
      out[o + 2] = c[2];
      out[o + 3] = alphaFn ? alphaFn(px, py) : transparentIndex3 && idx === 3 ? 0 : 255;
    }
  }
}

function decodeDDS(buf) {
  if (buf.length < 128 || buf.toString('latin1', 0, 4) !== 'DDS ') throw new Error('Kein DDS');
  const height = buf.readUInt32LE(12);
  const width = buf.readUInt32LE(16);
  if (!width || !height || width > 4096 || height > 4096) throw new Error('Ungültige DDS-Größe');
  const pfFlags = buf.readUInt32LE(80);
  const fourCC = buf.toString('latin1', 84, 88);
  const bitCount = buf.readUInt32LE(88);
  const masks = [buf.readUInt32LE(92), buf.readUInt32LE(96), buf.readUInt32LE(100), buf.readUInt32LE(104)];
  const data = 128;
  const out = Buffer.alloc(width * height * 4);
  const bw = Math.ceil(width / 4);
  const bh = Math.ceil(height / 4);

  if (pfFlags & 0x4) {
    // FourCC
    if (fourCC === 'DXT1') {
      for (let by = 0; by < bh; by++)
        for (let bx = 0; bx < bw; bx++) colorBlock(buf, data + (by * bw + bx) * 8, out, width, height, bx, by, true, null);
    } else if (fourCC === 'DXT3') {
      for (let by = 0; by < bh; by++)
        for (let bx = 0; bx < bw; bx++) {
          const off = data + (by * bw + bx) * 16;
          colorBlock(buf, off + 8, out, width, height, bx, by, false, (px, py) => {
            const byte = buf[off + py * 2 + (px >> 1)];
            const nib = px & 1 ? byte >> 4 : byte & 15;
            return nib * 17;
          });
        }
    } else if (fourCC === 'DXT5') {
      for (let by = 0; by < bh; by++)
        for (let bx = 0; bx < bw; bx++) {
          const off = data + (by * bw + bx) * 16;
          const a0 = buf[off];
          const a1 = buf[off + 1];
          const al = [a0, a1];
          if (a0 > a1) for (let i = 1; i <= 6; i++) al.push(((7 - i) * a0 + i * a1) / 7 | 0);
          else {
            for (let i = 1; i <= 4; i++) al.push(((5 - i) * a0 + i * a1) / 5 | 0);
            al.push(0, 255);
          }
          // 48 Bit Alpha-Indizes
          const lo = buf.readUInt32LE(off + 2);
          const hi = buf.readUInt16LE(off + 6);
          const abits = BigInt(lo) | (BigInt(hi) << 32n);
          colorBlock(buf, off + 8, out, width, height, bx, by, false, (px, py) => al[Number((abits >> BigInt(3 * (py * 4 + px))) & 7n)]);
        }
    } else {
      throw new Error('DDS-Format ' + fourCC + ' wird nicht unterstützt');
    }
  } else if ((pfFlags & 0x40 || pfFlags & 0x2) && bitCount === 32) {
    const sh = masks.map((m) => (m ? 31 - Math.clz32(m & -m) : 0));
    for (let i = 0; i < width * height; i++) {
      const px = buf.readUInt32LE(data + i * 4);
      out[i * 4] = masks[0] ? (px & masks[0]) >>> sh[0] : 0;
      out[i * 4 + 1] = masks[1] ? (px & masks[1]) >>> sh[1] : 0;
      out[i * 4 + 2] = masks[2] ? (px & masks[2]) >>> sh[2] : 0;
      out[i * 4 + 3] = masks[3] ? (px & masks[3]) >>> sh[3] : 255;
    }
  } else {
    throw new Error('DDS-Pixelformat wird nicht unterstützt');
  }
  return { width, height, rgba: out };
}

// --- PNG-Encoder -------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function downscale({ width, height, rgba }, maxSize) {
  const f = Math.floor(Math.max(width, height) / maxSize);
  if (f < 2) return { width, height, rgba };
  const w = Math.floor(width / f);
  const h = Math.floor(height / f);
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let dy = 0; dy < f; dy++)
        for (let dx = 0; dx < f; dx++) {
          const o = ((y * f + dy) * width + (x * f + dx)) * 4;
          const al = rgba[o + 3];
          r += rgba[o] * al;
          g += rgba[o + 1] * al;
          b += rgba[o + 2] * al;
          a += al;
        }
      const o2 = (y * w + x) * 4;
      if (a > 0) {
        out[o2] = r / a;
        out[o2 + 1] = g / a;
        out[o2 + 2] = b / a;
      }
      out[o2 + 3] = a / (f * f);
    }
  return { width: w, height: h, rgba: out };
}

function encodePNG({ width, height, rgba }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bittiefe
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function ddsToPngDataUrl(buf, maxSize = 128) {
  const img = downscale(decodeDDS(buf), maxSize);
  return 'data:image/png;base64,' + encodePNG(img).toString('base64');
}

module.exports = { decodeDDS, encodePNG, ddsToPngDataUrl };
