'use strict';

const fs = require('fs');
const path = require('path');
const { ZipFile } = require('./zip');
const { ddsToPngDataUrl } = require('./dds');

// ---------------------------------------------------------------------------
// XML-Helfer (modDesc.xml ist klein und regelmäßig genug für gezielte Regex)
// ---------------------------------------------------------------------------

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&amp;/g, '&');
}

function clean(s) {
  return decodeEntities(String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'))
    .replace(/\s+/g, ' ')
    .trim();
}

function block(xml, tag) {
  const m = new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + tag + '>', 'i').exec(xml);
  return m ? m[1] : null;
}

function localized(xml, tag) {
  const b = block(xml, tag);
  if (b == null) return '';
  for (const lang of ['de', 'en']) {
    const v = block(b, lang);
    if (v != null && clean(v)) return clean(v);
  }
  const any = /<([a-z]{2})(?:\s[^>]*)?>([\s\S]*?)<\/\1>/i.exec(b);
  if (any && clean(any[2])) return clean(any[2]);
  return clean(b.replace(/<[^>]+>/g, ''));
}

function parseModDesc(xml) {
  const dv = /<modDesc\b[^>]*\bdescVersion\s*=\s*"(\d+)"/i.exec(xml);
  const mp = /<multiplayer\b[^>]*\bsupported\s*=\s*"(true|false)"/i.exec(xml);
  const icon = block(xml, 'iconFilename');
  const version = block(xml, 'version');
  const author = block(xml, 'author');
  const storeCategory = /<storeItem\b[^>]*\bcategory\s*=\s*"([^"]+)"/i.exec(xml);
  const categoryBlock = block(xml, 'category');
  return {
    title: localized(xml, 'title'),
    description: localized(xml, 'description'),
    version: version ? clean(version) : '',
    author: author ? clean(author) : '',
    descVersion: dv ? parseInt(dv[1], 10) : 0,
    multiplayer: mp ? mp[1] === 'true' : null,
    iconFilename: icon ? clean(icon) : '',
    category: storeCategory ? clean(storeCategory[1]) : categoryBlock ? clean(categoryBlock.replace(/<[^>]+>/g, ' ')) : ''
  };
}

// ---------------------------------------------------------------------------
// Mod lesen (ZIP oder entpackter Ordner)
// ---------------------------------------------------------------------------

const VALID_ID = /^[A-Za-z_][A-Za-z0-9_]*$/;
const MIN_DESC_VERSION = 90; // FS25

function mimeFor(name) {
  const ext = path.extname(name).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return '';
}

function iconCandidates(iconFilename) {
  if (!iconFilename) return [];
  const list = [iconFilename];
  const base = iconFilename.replace(/\.[^.\\/]+$/, '');
  for (const ext of ['.dds', '.png', '.jpg']) list.push(base + ext);
  return Array.from(new Set(list));
}

function iconToDataUrl(name, buf) {
  const mime = mimeFor(name);
  if (mime) return `data:${mime};base64,${buf.toString('base64')}`;
  if (/\.dds$/i.test(name)) return ddsToPngDataUrl(buf, 128);
  throw new Error('Unbekanntes Icon-Format');
}

/**
 * @param {string} full  Pfad zur Datei/zum Ordner
 * @param {string} fileName  Dateiname im Mod-Ordner (kann auf .bak enden)
 */
function readModInfo(full, fileName, { includeIcon = false } = {}) {
  const st = fs.statSync(full);
  const isDir = st.isDirectory();
  const disabled = /\.bak$/i.test(fileName);
  const id = fileName.replace(/\.bak$/i, '').replace(/\.zip$/i, '');
  const info = {
    id,
    file: fileName,
    kind: isDir ? 'folder' : 'zip',
    enabled: !disabled,
    title: '',
    version: '',
    author: '',
    description: '',
    descVersion: 0,
    multiplayer: null,
    category: '',
    icon: null,
    size: 0,
    mtime: st.mtimeMs,
    errors: []
  };
  const err = (sev, text) => info.errors.push({ sev, text });

  if (!VALID_ID.test(id)) {
    err('error', 'Ungültiger Dateiname: erlaubt sind nur Buchstaben, Zahlen und _, kein Leerzeichen/Punkt, keine Zahl am Anfang. Das Spiel lädt diesen Mod nicht.');
  }
  if (!isDir && !/\.zip(\.bak)?$/i.test(fileName)) {
    err('error', 'Datei ist keine .zip-Datei.');
  }

  let xml = '';
  let readIcon = null; // (name) => Buffer|null

  try {
    if (isDir) {
      const mdPath = path.join(full, 'modDesc.xml');
      if (fs.existsSync(mdPath)) xml = fs.readFileSync(mdPath, 'utf8');
      readIcon = (n) => {
        const p = path.join(full, n);
        return p.startsWith(full) && fs.existsSync(p) ? fs.readFileSync(p) : null;
      };
    } else {
      info.size = st.size;
      const zip = new ZipFile(full);
      try {
        const md = zip.get('modDesc.xml');
        if (md) xml = zip.read(md, 2 * 1024 * 1024).toString('utf8');
        // Manche Archive enthalten einen Wurzelordner – das akzeptiert das Spiel nicht
        if (!md) {
          const nested = zip.names().find((n) => /(^|\/)moddesc\.xml$/i.test(n));
          if (nested) err('error', 'modDesc.xml liegt in einem Unterordner des ZIPs (falsch gepackt). Das Spiel kann den Mod nicht laden.');
        }
        readIcon = (n) => {
          const e = zip.get(n);
          return e ? zip.read(e, 6 * 1024 * 1024) : null;
        };
        // Icon sofort lesen, solange das ZIP offen ist
        if (xml) {
          const meta = parseModDesc(xml);
          if (includeIcon) {
            for (const cand of iconCandidates(meta.iconFilename)) {
              const buf = readIcon(cand);
              if (!buf) continue;
              try {
                info.icon = iconToDataUrl(cand, buf);
              } catch (e) {
                err('info', 'Icon konnte nicht angezeigt werden (' + e.message + ').');
              }
              break;
            }
          }
          info._iconMissing = !!meta.iconFilename && !iconCandidates(meta.iconFilename).some((c) => zip.has(c));
        }
      } finally {
        zip.close();
      }
    }
  } catch (e) {
    err('error', 'Archiv nicht lesbar: ' + e.message);
  }

  if (isDir) {
    info.size = 0; // Größe wird vom Aufrufer (gecacht) berechnet
    if (xml) {
      const meta = parseModDesc(xml);
      if (includeIcon) {
        for (const cand of iconCandidates(meta.iconFilename)) {
          try {
            const buf = readIcon && readIcon(cand);
            if (!buf) continue;
            info.icon = iconToDataUrl(cand, buf);
          } catch (e) {
            err('info', 'Icon konnte nicht angezeigt werden (' + e.message + ').');
          }
          break;
        }
      }
      info._iconMissing = !!meta.iconFilename && !iconCandidates(meta.iconFilename).some((c) => fs.existsSync(path.join(full, c)));
    }
  }

  if (xml) {
    const meta = parseModDesc(xml);
    info.title = meta.title;
    info.version = meta.version;
    info.author = meta.author;
    info.description = meta.description;
    info.descVersion = meta.descVersion;
    info.multiplayer = meta.multiplayer;
    info.category = meta.category;
    if (!meta.title) err('warn', 'Kein Titel in der modDesc.xml angegeben.');
    if (!meta.version) err('warn', 'Keine Versionsnummer in der modDesc.xml angegeben.');
    if (!meta.author) err('info', 'Kein Modder/Autor in der modDesc.xml angegeben.');
    if (!meta.iconFilename) err('info', 'Der Mod hat kein Icon definiert.');
    else if (info._iconMissing) err('warn', 'Das in der modDesc.xml angegebene Icon fehlt im Mod.');
    if (meta.descVersion && meta.descVersion < MIN_DESC_VERSION) {
      err('warn', `Für eine ältere Spielversion gebaut (descVersion ${meta.descVersion}, FS25 nutzt ${MIN_DESC_VERSION} oder höher). Der Mod funktioniert evtl. nicht.`);
    }
  } else if (!info.errors.some((e) => /modDesc|Archiv nicht lesbar/.test(e.text))) {
    err('error', 'modDesc.xml fehlt – das ist kein gültiger Mod.');
  }
  delete info._iconMissing;

  if (!info.title) info.title = id;
  return info;
}

function readModIcon(full, fileName) {
  const isDir = fs.statSync(full).isDirectory();
  let zip = null;
  try {
    let xml = '';
    let read;
    if (isDir) {
      const mdPath = path.join(full, 'modDesc.xml');
      xml = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, 'utf8') : '';
      read = (name) => {
        const target = path.resolve(full, name);
        return target.startsWith(path.resolve(full) + path.sep) && fs.existsSync(target) ? fs.readFileSync(target) : null;
      };
    } else {
      zip = new ZipFile(full);
      const md = zip.get('modDesc.xml');
      xml = md ? zip.read(md, 2 * 1024 * 1024).toString('utf8') : '';
      read = (name) => { const entry = zip.get(name); return entry ? zip.read(entry, 6 * 1024 * 1024) : null; };
    }
    if (!xml) return null;
    for (const name of iconCandidates(parseModDesc(xml).iconFilename)) {
      const data = read(name);
      if (data) return iconToDataUrl(name, data);
    }
    return null;
  } finally {
    if (zip) zip.close();
    void fileName;
  }
}

// ---------------------------------------------------------------------------
// Skript-Scan für den Konflikt-Checker
// ---------------------------------------------------------------------------

const OVERRIDE_RE = /([A-Za-z_][\w.:]*)\s*=\s*Utils\.(overwrittenFunction|appendedFunction|prependedFunction)\s*\(/g;

/** Liefert alle von einem Mod per Utils.*Function überschriebenen Funktionen. */
function scanScripts(full, fileName) {
  const out = { overrides: [], scripts: 0 };
  const isDir = fs.statSync(full).isDirectory();
  let zip = null;
  try {
    let xml = '';
    let read;
    if (isDir) {
      const p = path.join(full, 'modDesc.xml');
      xml = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
      read = (n) => {
        const f = path.join(full, n);
        return f.startsWith(full) && fs.existsSync(f) ? fs.readFileSync(f) : null;
      };
    } else {
      zip = new ZipFile(full);
      const md = zip.get('modDesc.xml');
      xml = md ? zip.read(md, 2 * 1024 * 1024).toString('utf8') : '';
      read = (n) => {
        const e = zip.get(n);
        return e ? zip.read(e, 1024 * 1024) : null;
      };
    }
    if (!xml) return out;

    const files = new Set();
    const re = /<(?:sourceFile|specialization|placeableSpecialization|class)\b[^>]*\bfilename\s*=\s*"([^"]+)"/gi;
    let m;
    while ((m = re.exec(xml))) files.add(m[1]);

    let n = 0;
    for (const f of files) {
      if (!/\.lua$/i.test(f) || n >= 60) continue;
      let buf;
      try {
        buf = read(f);
      } catch {
        continue;
      }
      if (!buf) continue;
      n++;
      const src = buf.toString('utf8').replace(/--\[\[[\s\S]*?\]\]/g, '').replace(/--[^\n]*/g, '');
      OVERRIDE_RE.lastIndex = 0;
      let o;
      while ((o = OVERRIDE_RE.exec(src))) {
        out.overrides.push({ target: o[1], mode: o[2] });
      }
    }
    out.scripts = n;
  } catch {
    /* Mod nicht lesbar: wird bereits in readModInfo gemeldet */
  } finally {
    if (zip) zip.close();
  }
  void fileName;
  return out;
}

/** Vergleicht zwei Versionsstrings (1.2.3.4). Gibt -1, 0, 1 zurück. */
function compareVersions(a, b) {
  const pa = String(a).split(/[^0-9]+/).filter(Boolean).map(Number);
  const pb = String(b).split(/[^0-9]+/).filter(Boolean).map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

module.exports = { readModInfo, readModIcon, scanScripts, parseModDesc, compareVersions, VALID_ID };
