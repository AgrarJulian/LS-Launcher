'use strict';

// Netzwerkfunktionen: Server-Statistik (Dedicated Server) und ModHub-Abgleich.

const http = require('http');
const https = require('https');
const net = require('net');
const { compareVersions } = require('./modinfo');

function httpGet(urlStr, { timeout = 7000, maxBytes = 1.5 * 1024 * 1024, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    let u;
    try {
      u = new URL(urlStr);
    } catch {
      return reject(new Error('Ungültige Adresse'));
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return reject(new Error('Nur http/https erlaubt'));
    const lib = u.protocol === 'https:' ? https : http;
    const started = Date.now();
    const req = lib.get(
      u,
      { timeout, headers: { 'User-Agent': 'LS25-Launcher/1.0 (+https://github.com/AgrarJulian/LS-Launcher)', ...headers } },
      (res) => {
        const chunks = [];
        let size = 0;
        res.on('data', (c) => {
          size += c.length;
          if (size > maxBytes) {
            req.destroy(new Error('Antwort zu groß'));
            return;
          }
          chunks.push(c);
        });
        res.on('end', () =>
          resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8'), ms: Date.now() - started, headers: res.headers })
        );
        res.on('error', reject);
      }
    );
    req.on('timeout', () => req.destroy(new Error('Zeitüberschreitung')));
    req.on('error', reject);
  });
}

function tcpPing(host, port, timeout = 5000) {
  return new Promise((resolve) => {
    const started = Date.now();
    const sock = new net.Socket();
    let done = false;
    const finish = (r) => {
      if (done) return;
      done = true;
      sock.destroy();
      resolve(r);
    };
    sock.setTimeout(timeout);
    sock.once('connect', () => finish({ online: true, ms: Date.now() - started, detail: 'Port offen' }));
    sock.once('timeout', () => finish({ online: false, ms: null, detail: 'Zeitüberschreitung' }));
    sock.once('error', (err) => finish({ online: false, ms: null, detail: err.code || 'Fehler' }));
    sock.connect(port, host);
  });
}

// ---------------------------------------------------------------------------
// Dedicated-Server-Statistik: /feed/dedicated-server-stats.xml?code=XXXX
// ---------------------------------------------------------------------------

function attrs(str) {
  const out = {};
  const re = /([\w:-]+)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(str))) out[m[1]] = m[2].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  return out;
}

function parseServerStats(xml) {
  const s = /<Server\b([^>]*)>/i.exec(xml);
  if (!s) throw new Error('Keine Server-Statistik in der Antwort (Code/Adresse prüfen)');
  const a = attrs(s[1]);
  const slots = /<Slots\b([^>]*)>/i.exec(xml);
  const sa = slots ? attrs(slots[1]) : {};
  const players = [];
  const re = /<Player\b([^>]*)>([\s\S]*?)<\/Player>/gi;
  let m;
  while ((m = re.exec(xml))) {
    const pa = attrs(m[1]);
    if (String(pa.isUsed).toLowerCase() === 'true') {
      players.push(m[2].replace(/<[^>]+>/g, '').trim() || '(Unbekannt)');
    }
  }
  const mods = (xml.match(/<Mod\b/gi) || []).length;
  return {
    serverName: a.name || '',
    map: a.mapName || '',
    game: a.game || '',
    version: a.version || '',
    capacity: parseInt(sa.capacity, 10) || 0,
    numUsed: parseInt(sa.numUsed, 10) || players.length,
    players,
    mods
  };
}

async function checkServer(s) {
  const base = { name: s.name || s.host || s.statsUrl, target: s.statsUrl ? hostOf(s.statsUrl) : `${s.host}:${s.port}` };
  if (s.statsUrl) {
    try {
      const r = await httpGet(s.statsUrl, { timeout: 7000 });
      if (r.status >= 400) return { ...base, online: false, ms: r.ms, detail: 'HTTP ' + r.status };
      const st = parseServerStats(r.body);
      return { ...base, online: true, ms: r.ms, detail: 'Statistik abgerufen', stats: st };
    } catch (err) {
      // Webinterface nicht erreichbar – ggf. läuft nur der Spielport
      const host = s.host || safeHost(s.statsUrl);
      if (host && s.port) {
        const t = await tcpPing(host, s.port);
        if (t.online) return { ...base, online: true, ms: t.ms, detail: 'Spielport offen, Statistik nicht abrufbar (' + err.message + ')' };
      }
      return { ...base, online: false, ms: null, detail: err.message };
    }
  }
  const t = await tcpPing(s.host, s.port);
  return { ...base, ...t };
}

function safeHost(u) {
  try {
    return new URL(u).hostname;
  } catch {
    return '';
  }
}
function hostOf(u) {
  try {
    const x = new URL(u);
    return x.host;
  } catch {
    return u;
  }
}

// ---------------------------------------------------------------------------
// ModHub-Abgleich (experimentell – GIANTS bietet keine öffentliche API)
// ---------------------------------------------------------------------------

const HUB = 'https://www.farming-simulator.com/mods.php?lang=de&country=de&title=fs2025';

function norm(s) {
  return String(s)
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/[^a-z0-9äöüß]+/g, ' ')
    .trim();
}

function stripTags(s) {
  return s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

async function modhubLookup({ title, version }) {
  if (!title) return { status: 'unknown', note: 'Kein Titel' };
  const searchUrl = `${HUB}&searchMod=${encodeURIComponent(title)}&filter=latest&page=0`;
  let html;
  try {
    const r = await httpGet(searchUrl, { timeout: 9000, maxBytes: 3 * 1024 * 1024, headers: { Accept: 'text/html' } });
    if (r.status >= 400) return { status: 'unknown', note: 'ModHub antwortet mit HTTP ' + r.status };
    html = r.body;
  } catch (err) {
    return { status: 'unknown', note: 'ModHub nicht erreichbar: ' + err.message };
  }

  const cands = new Map();
  const re = /<a\b[^>]*href="([^"]*[?&;]mod_id=(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const text = stripTags(m[3]);
    if (!cands.has(m[2]) || (text && text.length > (cands.get(m[2]).text || '').length)) cands.set(m[2], { id: m[2], text });
  }
  // Überschriften direkt als zusätzliche Hinweise
  const heads = [];
  const hre = /<h[2-5][^>]*>([\s\S]*?)<\/h[2-5]>/gi;
  while ((m = hre.exec(html))) heads.push(stripTags(m[1]));

  const want = norm(title);
  let hit = null;
  for (const c of cands.values()) {
    const n = norm(c.text);
    if (n && (n === want || n.includes(want) || want.includes(n))) {
      hit = c;
      break;
    }
  }
  if (!hit) {
    const known = heads.some((h) => norm(h) === want);
    return { status: known ? 'unknown' : 'notfound', note: known ? 'Gefunden, aber Seitenformat nicht erkannt' : 'Nicht im ModHub gefunden' };
  }

  const detailUrl = `${HUB}&mod_id=${hit.id}`;
  try {
    const r = await httpGet(detailUrl, { timeout: 9000, maxBytes: 3 * 1024 * 1024, headers: { Accept: 'text/html' } });
    const text = stripTags(r.body);
    const vm = /Version\s*:?\s*([0-9]+(?:\.[0-9]+){1,3})/i.exec(text);
    if (!vm) return { status: 'unknown', url: detailUrl, note: 'Version auf der ModHub-Seite nicht erkannt' };
    const latest = vm[1];
    const cmp = compareVersions(version || '0', latest);
    return { status: cmp < 0 ? 'update' : 'current', latest, url: detailUrl };
  } catch (err) {
    return { status: 'unknown', url: detailUrl, note: 'ModHub-Seite nicht lesbar: ' + err.message };
  }
}

module.exports = { httpGet, tcpPing, checkServer, parseServerStats, modhubLookup };
