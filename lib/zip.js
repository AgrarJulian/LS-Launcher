'use strict';

// Minimaler ZIP-Leser: liest nur das Inhaltsverzeichnis und einzelne Einträge,
// ohne die ganze (oft mehrere hundert MB große) Mod-Datei in den Speicher zu laden.

const fs = require('fs');
const zlib = require('zlib');

class ZipFile {
  constructor(file) {
    this.fd = fs.openSync(file, 'r');
    this.entries = new Map(); // normalisierter Name (klein) -> Eintrag
    try {
      this._readDirectory();
    } catch (err) {
      this.close();
      throw err;
    }
  }

  _readDirectory() {
    const size = fs.fstatSync(this.fd).size;
    if (size < 22) throw new Error('Datei zu klein für ein ZIP-Archiv');
    const tailLen = Math.min(size, 65557);
    const tail = Buffer.alloc(tailLen);
    fs.readSync(this.fd, tail, 0, tailLen, size - tailLen);

    let eocd = -1;
    for (let i = tailLen - 22; i >= 0; i--) {
      if (tail.readUInt32LE(i) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new Error('Kein gültiges ZIP-Archiv (Verzeichnis nicht gefunden)');

    const count = tail.readUInt16LE(eocd + 10);
    const cdSize = tail.readUInt32LE(eocd + 12);
    const cdOffset = tail.readUInt32LE(eocd + 16);
    if (cdOffset === 0xffffffff || cdSize === 0xffffffff) throw new Error('ZIP64 wird nicht unterstützt');
    if (cdOffset + cdSize > size) throw new Error('ZIP-Verzeichnis beschädigt');

    const cd = Buffer.alloc(cdSize);
    fs.readSync(this.fd, cd, 0, cdSize, cdOffset);

    let p = 0;
    for (let i = 0; i < count && p + 46 <= cd.length; i++) {
      if (cd.readUInt32LE(p) !== 0x02014b50) throw new Error('ZIP-Verzeichnis beschädigt');
      const flags = cd.readUInt16LE(p + 8);
      const method = cd.readUInt16LE(p + 10);
      const csize = cd.readUInt32LE(p + 20);
      const usize = cd.readUInt32LE(p + 24);
      const nameLen = cd.readUInt16LE(p + 28);
      const extraLen = cd.readUInt16LE(p + 30);
      const commentLen = cd.readUInt16LE(p + 32);
      const offset = cd.readUInt32LE(p + 42);
      const name = cd.toString(flags & 0x800 ? 'utf8' : 'latin1', p + 46, p + 46 + nameLen).replace(/\\/g, '/');
      if (!name.endsWith('/')) {
        this.entries.set(name.toLowerCase(), { name, method, csize, usize, offset });
      }
      p += 46 + nameLen + extraLen + commentLen;
    }
  }

  has(name) {
    return this.entries.has(String(name).replace(/\\/g, '/').toLowerCase());
  }

  get(name) {
    return this.entries.get(String(name).replace(/\\/g, '/').toLowerCase());
  }

  names() {
    return Array.from(this.entries.values()).map((e) => e.name);
  }

  read(name, maxSize = 8 * 1024 * 1024) {
    const e = typeof name === 'string' ? this.get(name) : name;
    if (!e) return null;
    if (e.usize > maxSize) throw new Error('Eintrag zu groß: ' + e.name);
    const head = Buffer.alloc(30);
    fs.readSync(this.fd, head, 0, 30, e.offset);
    if (head.readUInt32LE(0) !== 0x04034b50) throw new Error('Lokaler Header beschädigt: ' + e.name);
    const start = e.offset + 30 + head.readUInt16LE(26) + head.readUInt16LE(28);
    const raw = Buffer.alloc(e.csize);
    fs.readSync(this.fd, raw, 0, e.csize, start);
    if (e.method === 0) return raw;
    if (e.method === 8) return zlib.inflateRawSync(raw);
    throw new Error('Kompressionsmethode ' + e.method + ' wird nicht unterstützt');
  }

  close() {
    if (this.fd != null) {
      try {
        fs.closeSync(this.fd);
      } catch {
        /* ignorieren */
      }
      this.fd = null;
    }
  }
}

module.exports = { ZipFile };
