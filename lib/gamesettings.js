'use strict';

// Liest und schreibt den Mod-Ordner-Override in der gameSettings.xml des Spiels:
//   <modsDirectoryOverride active="true" directory="D:/FS25Mods"/>

const fs = require('fs');
const path = require('path');

const TAG_RE = /<modsDirectoryOverride\b([^>]*?)\/?>/i;

function attr(str, name) {
  const m = new RegExp('\\b' + name + '\\s*=\\s*"([^"]*)"', 'i').exec(str);
  return m ? m[1] : '';
}

function xmlEscape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function xmlUnescape(s) {
  return String(s).replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

function settingsFile(profilePath) {
  return path.join(profilePath, 'gameSettings.xml');
}

function readOverride(profilePath) {
  const file = settingsFile(profilePath);
  const res = { file, exists: false, hasTag: false, active: false, directory: '' };
  try {
    const text = fs.readFileSync(file, 'utf8');
    res.exists = true;
    const m = TAG_RE.exec(text);
    if (m) {
      res.hasTag = true;
      res.active = attr(m[1], 'active').toLowerCase() === 'true';
      const dir = xmlUnescape(attr(m[1], 'directory')).trim();
      res.directory = dir ? path.normalize(dir) : '';
    }
  } catch {
    /* Datei existiert (noch) nicht */
  }
  return res;
}

/**
 * Setzt den Override. dir = Pfad -> aktiv; dir = null -> deaktiviert.
 * Legt vorher eine Sicherheitskopie "gameSettings.xml.ls25launcher.bak" an.
 */
function writeOverride(profilePath, dir) {
  const file = settingsFile(profilePath);
  if (!fs.existsSync(file)) {
    throw new Error('gameSettings.xml nicht gefunden: ' + file + ' (Spiel einmal starten oder Profil-Ordner prüfen)');
  }
  const text = fs.readFileSync(file, 'utf8');
  const current = TAG_RE.exec(text);
  const keepDir = current ? xmlUnescape(attr(current[1], 'directory')) : '';
  const directory = dir ? dir.replace(/\\/g, '/') : keepDir;
  const tag = `<modsDirectoryOverride active="${dir ? 'true' : 'false'}" directory="${xmlEscape(directory)}"/>`;

  let next;
  if (current) {
    if (current[0] === tag) return false; // nichts zu tun
    next = text.replace(TAG_RE, tag);
  } else if (/<\/gameSettings>/i.test(text)) {
    next = text.replace(/<\/gameSettings>/i, `    ${tag}\n</gameSettings>`);
  } else {
    throw new Error('Unerwartetes Format der gameSettings.xml');
  }
  fs.copyFileSync(file, file + '.ls25launcher.bak');
  fs.writeFileSync(file, next, 'utf8');
  return true;
}

module.exports = { readOverride, writeOverride, settingsFile };
