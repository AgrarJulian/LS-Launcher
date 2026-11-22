'use strict';

const { app, BrowserWindow, ipcMain, shell, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const os = require('os');
const { spawn, execFile } = require('child_process');
const AdmZip = require('adm-zip');

const { ZipFile } = require('./lib/zip');
const { readModInfo, readModIcon, scanScripts, VALID_ID } = require('./lib/modinfo');
const gameSettings = require('./lib/gamesettings');
const { parseLog } = require('./lib/log');
const netlib = require('./lib/net');
const crypto = require('crypto');
const RPC = require('discord-rpc');
const DISCORD_APP_ID = '1567209388068970666';
let companionServer = null, companionToken = '', companionTelemetry = null;

const tick = () => new Promise((r) => setImmediate(r));

// ---------------------------------------------------------------------------
// Konfiguration
// ---------------------------------------------------------------------------

const CONFIG_FILE = () => path.join(app.getPath('userData'), 'config.json');

function defaultProfile() {
  return {
    id: 'default',
    name: 'Standard',
    farm: 'Mein Hof',
    notes: '',
    devMode: false,
    clearShader: false,
    skipIntro: true,
    extraArgs: '',
    modFolderMode: 'keep', // keep = gameSettings.xml unverändert lassen | default | custom
    modFolder: '',
    savegame: '',
    autoStartSave: false,
    modMode: 'all', // all | selection
    modSelection: []
  };
}

function defaults() {
  return {
    gamePath: '',
    profilePath: path.join(app.getPath('documents'), 'My Games', 'FarmingSimulator2025'),
    backupPath: path.join(app.getPath('userData'), 'backups'),
    logPath: '',
    modsPath: '',
    lowPerformanceMode: false,
    closeOnLaunch: false,
    autoBackup: false,
    autoBackupKeep: 10,
    activeProfile: 'default',
    profiles: [defaultProfile()],
    servers: []
  };
}

function str(v, max = 500) {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

function sanitizeProfile(p) {
  const d = defaultProfile();
  const mode = ['keep', 'default', 'custom'].includes(p && p.modFolderMode) ? p.modFolderMode : d.modFolderMode;
  return {
    id: str(p && p.id, 64) || String(Date.now()),
    name: str(p && p.name, 60) || 'Profil',
    farm: str(p && p.farm, 60),
    notes: str(p && p.notes, 400),
    devMode: !!(p && p.devMode),
    clearShader: !!(p && p.clearShader),
    skipIntro: !!(p && p.skipIntro),
    extraArgs: str(p && p.extraArgs, 300),
    modFolderMode: mode,
    modFolder: str(p && p.modFolder, 500),
    savegame: /^savegame\d+$/.test(p && p.savegame) ? p.savegame : '',
    autoStartSave: !!(p && p.autoStartSave),
    modMode: p && p.modMode === 'selection' ? 'selection' : 'all',
    modSelection: (Array.isArray(p && p.modSelection) ? p.modSelection : []).slice(0, 2000).map((s) => str(s, 120)).filter(Boolean)
  };
}

function sanitizeConfig(input) {
  const d = defaults();
  const c = input && typeof input === 'object' ? input : {};
  const profiles = (Array.isArray(c.profiles) ? c.profiles : []).slice(0, 50).map(sanitizeProfile);
  if (!profiles.length) profiles.push(defaultProfile());
  const activeProfile = profiles.some((p) => p.id === c.activeProfile) ? c.activeProfile : profiles[0].id;
  const servers = (Array.isArray(c.servers) ? c.servers : [])
    .slice(0, 30)
    .map((s) => {
      const statsUrl = /^https?:\/\//i.test(str(s && s.statsUrl, 600)) ? str(s.statsUrl, 600) : '';
      return {
        name: str(s && s.name, 60),
        host: str(s && s.host, 200),
        port: Math.min(65535, Math.max(1, parseInt(s && s.port, 10) || 10823)),
        statsUrl
      };
    })
    .filter((s) => s.host || s.statsUrl);
  return {
    gamePath: str(c.gamePath),
    profilePath: str(c.profilePath) || d.profilePath,
    backupPath: str(c.backupPath) || d.backupPath,
    logPath: str(c.logPath),
    modsPath: str(c.modsPath),
    lowPerformanceMode: c.lowPerformanceMode === true,
    closeOnLaunch: !!c.closeOnLaunch,
    autoBackup: !!c.autoBackup,
    autoBackupKeep: Math.min(50, Math.max(1, parseInt(c.autoBackupKeep, 10) || 10)),
    activeProfile,
    profiles,
    servers
  };
}

function loadConfig() {
  try {
    return sanitizeConfig(JSON.parse(fs.readFileSync(CONFIG_FILE(), 'utf8')));
  } catch {
    const cfg = defaults();
    cfg.gamePath = detectGame() || '';
    return cfg;
  }
}

function saveConfig(cfg) {
  const clean = sanitizeConfig(cfg);
  fs.mkdirSync(path.dirname(CONFIG_FILE()), { recursive: true });
  fs.writeFileSync(CONFIG_FILE(), JSON.stringify(clean, null, 2));
  return clean;
}

function detectGame() {
  const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const candidates = [
    path.join(pf86, 'Farming Simulator 2025', 'FarmingSimulator2025.exe'),
    path.join(pf, 'Farming Simulator 2025', 'FarmingSimulator2025.exe'),
    path.join(pf86, 'Steam', 'steamapps', 'common', 'Farming Simulator 25', 'FarmingSimulator2025.exe'),
    path.join(pf, 'Steam', 'steamapps', 'common', 'Farming Simulator 25', 'FarmingSimulator2025.exe'),
    path.join(pf, 'Epic Games', 'FarmingSimulator25', 'FarmingSimulator2025.exe'),
    'D:\\SteamLibrary\\steamapps\\common\\Farming Simulator 25\\FarmingSimulator2025.exe'
  ];
  return candidates.find((p) => fs.existsSync(p)) || '';
}

const activeProfile = (cfg) => cfg.profiles.find((p) => p.id === cfg.activeProfile) || cfg.profiles[0];

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

function inside(base, target) {
  const rel = path.relative(path.resolve(base), path.resolve(target));
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function dirSize(dir, depth = 0) {
  let total = 0;
  if (depth > 12) return 0;
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    try {
      if (e.isDirectory()) total += dirSize(p, depth + 1);
      else if (e.isFile()) total += fs.statSync(p).size;
    } catch {
      /* ignorieren */
    }
  }
  return total;
}

function xmlTag(xml, tag) {
  const m = new RegExp('<' + tag + '>([^<]*)</' + tag + '>').exec(xml);
  return m ? m[1].trim() : '';
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

function isGameRunning() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve(false);
    execFile(
      'tasklist',
      ['/FI', 'IMAGENAME eq FarmingSimulator2025.exe', '/FO', 'CSV', '/NH'],
      { timeout: 4000, windowsHide: true },
      (err, out) => resolve(!err && /FarmingSimulator2025\.exe/i.test(out || ''))
    );
  });
}

// ---------------------------------------------------------------------------
// Mod-Ordner (gameSettings.xml!)
// ---------------------------------------------------------------------------

/**
 * Ermittelt den aktiven Mod-Ordner:
 *  - Profil mit eigenem Ordner  -> dieser Ordner
 *  - Profil "Spiel-Standard"    -> <Profil-Ordner>\mods
 *  - sonst                      -> modsDirectoryOverride aus der gameSettings.xml (falls aktiv), sonst <Profil-Ordner>\mods
 */
function resolveModsDir(cfg, spec) {
  const p = spec || activeProfile(cfg);
  if (cfg.modsPath) return { dir: path.normalize(cfg.modsPath), source: 'settings', settingsFile: gameSettings.settingsFile(cfg.profilePath) };
  if (p.modFolderMode === 'custom' && p.modFolder) return { dir: path.normalize(p.modFolder), source: 'profile' };
  if (p.modFolderMode === 'default') return { dir: path.join(cfg.profilePath, 'mods'), source: 'default' };
  const o = gameSettings.readOverride(cfg.profilePath);
  if (o.active && o.directory) return { dir: o.directory, source: 'gameSettings', settingsFile: o.file };
  return { dir: path.join(cfg.profilePath, 'mods'), source: 'default', settingsFile: o.file };
}

async function applyModFolder(cfg, profile) {
  if (profile.modFolderMode === 'keep' || (profile.modFolderMode === 'custom' && !profile.modFolder)) {
    return { ok: true, changed: false };
  }
  if (await isGameRunning()) {
    return { ok: false, error: 'Das Spiel läuft – der Mod-Ordner kann erst nach dem Beenden gewechselt werden.' };
  }
  try {
    let changed;
    if (profile.modFolderMode === 'custom') {
      fs.mkdirSync(profile.modFolder, { recursive: true });
      changed = gameSettings.writeOverride(cfg.profilePath, path.normalize(profile.modFolder));
    } else {
      changed = gameSettings.writeOverride(cfg.profilePath, null);
    }
    return { ok: true, changed };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function applyModSelection(dir, selection) {
  const want = new Set(selection.map((s) => s.toLowerCase()));
  const res = { enabled: 0, disabled: 0, skipped: 0 };
  if (!fs.existsSync(dir)) return res;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const name = e.name;
    const isBak = /\.bak$/i.test(name);
    const id = name.replace(/\.bak$/i, '').replace(/\.zip$/i, '');
    const full = path.join(dir, name);
    if (e.isDirectory()) {
      if (!isBak && !fs.existsSync(path.join(full, 'modDesc.xml'))) continue;
    } else if (!/\.zip(\.bak)?$/i.test(name)) continue;

    const shouldBeOn = want.has(id.toLowerCase());
    try {
      if (shouldBeOn && isBak) {
        const target = full.replace(/\.bak$/i, '');
        if (fs.existsSync(target)) res.skipped++;
        else (fs.renameSync(full, target), res.enabled++);
      } else if (!shouldBeOn && !isBak) {
        const target = full + '.bak';
        if (fs.existsSync(target)) res.skipped++;
        else (fs.renameSync(full, target), res.disabled++);
      }
    } catch {
      res.skipped++;
    }
  }
  return res;
}

// --- Mod-Liste ----------------------------------------------------------------

const modCache = new Map();
const modIconCache = new Map();
const scriptCache = new Map();

async function listMods(dir) {
  if (!fs.existsSync(dir)) return { ok: false, dir, error: 'Mod-Ordner nicht gefunden.', items: [] };
  const cfg = loadConfig();
  const logs = getLogAnalysis(cfg, null);
  const byMod = logs && logs.ok ? logs.byMod || {} : {};
  const items = [];
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const name = e.name;
    if (!(e.isDirectory() || /\.zip(\.bak)?$/i.test(name))) continue;
    const full = path.join(dir, name);
    let st;
    try {
      st = fs.statSync(full);
    } catch {
      continue;
    }
    const key = `${full}|${st.mtimeMs}|${st.size}`;
    let info = modCache.get(key);
    if (!info) {
      try {
        info = readModInfo(full, name, { includeIcon: false });
        if (e.isDirectory()) info.size = dirSize(full);
        modCache.set(key, info);
      } catch (err) {
        info = { id: name, file: name, kind: 'zip', enabled: !/\.bak$/i.test(name), title: name, version: '', author: '', description: '', descVersion: 0, multiplayer: null, icon: null, size: st.size, mtime: st.mtimeMs, errors: [{ sev: 'error', text: 'Nicht lesbar: ' + err.message }] };
      }
    }
    const lc = byMod[info.id.toLowerCase()] || { errors: 0, warnings: 0 };
    items.push({ ...info, logErrors: lc.errors, logWarnings: lc.warnings });
    if (++n % 6 === 0) await tick();
  }
  items.sort((a, b) => a.title.localeCompare(b.title, 'de', { sensitivity: 'base' }));
  return { ok: true, dir, items };
}

ipcMain.handle('mods:list', async (_e, spec) => {
  const cfg = loadConfig();
  const sp = spec && typeof spec === 'object' ? sanitizeProfile({ ...activeProfile(cfg), modFolderMode: spec.modFolderMode, modFolder: spec.modFolder }) : null;
  const r = resolveModsDir(cfg, sp);
  const out = await listMods(r.dir);
  return { ...out, source: r.source, settingsFile: r.settingsFile || '' };
});

ipcMain.handle('mods:icon', (_e, file) => {
  const cfg = loadConfig();
  const mp = modPath(cfg, file);
  if (!mp || !fs.existsSync(mp.target)) return null;
  try {
    const st = fs.statSync(mp.target);
    const key = `${path.resolve(mp.target)}|${st.mtimeMs}|${st.size}`;
    if (modIconCache.has(key)) return modIconCache.get(key);
    const icon = readModIcon(mp.target, path.basename(mp.target));
    if (icon) {
      modIconCache.set(key, icon);
      if (modIconCache.size > 300) modIconCache.delete(modIconCache.keys().next().value);
    }
    return icon;
  } catch { return null; }
});

function modPath(cfg, file) {
  const { dir } = resolveModsDir(cfg);
  const target = path.join(dir, String(file));
  return inside(dir, target) ? { dir, target } : null;
}

ipcMain.handle('mods:export-manifest', async () => {
  const cfg = loadConfig(), profile = activeProfile(cfg), { dir } = resolveModsDir(cfg);
  const mods = [];
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (/\.bak$/i.test(e.name)) continue;
      const id = e.name.replace(/\.zip$/i, ''), full = path.join(dir, e.name);
      if (profile.modMode === 'selection' && !profile.modSelection.some((x) => x.toLowerCase() === id.toLowerCase())) continue;
      if (!(e.isDirectory() && fs.existsSync(path.join(full, 'modDesc.xml')) || e.isFile() && /\.zip$/i.test(e.name))) continue;
      const st = fs.statSync(full);
      let info = { title: id, version: '', author: '' };
      try { info = readModInfo(full, e.name); } catch { /* Include as an unresolved manifest entry. */ }
      mods.push({ id, file: e.name, title: info.title, version: info.version, author: info.author, size: e.isFile() ? st.size : dirSize(full) });
    }
  } catch (err) { return { ok: false, error: err.message }; }
  const output = await dialog.showSaveDialog(win, { defaultPath: `${profile.name.replace(/[^\w.-]+/g, '_')}-Agri-Nexus-Modpack.json`, filters: [{ name: 'Agri Nexus Modpack-Manifest', extensions: ['json'] }] });
  if (output.canceled || !output.filePath) return { ok: false, canceled: true };
  const manifest = { format: 'Agri Nexus Modpack Manifest', version: 1, createdAt: new Date().toISOString(), profile: profile.name, farm: profile.farm, game: 'Farming Simulator 25', count: mods.length, mods };
  try { fs.writeFileSync(output.filePath, JSON.stringify(manifest, null, 2), 'utf8'); return { ok: true, file: output.filePath, count: mods.length }; }
  catch (err) { return { ok: false, error: err.message }; }
});

ipcMain.handle('mods:performance-report', async () => {
  const cfg = loadConfig(), { dir } = resolveModsDir(cfg), mods = [], assets = [];
  if (!fs.existsSync(dir)) return { ok: false, error: 'Mod-Ordner nicht gefunden.' };
  let totalBytes = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (/\.bak$/i.test(e.name)) continue;
    const full = path.join(dir, e.name);
    try {
      if (e.isFile() && /\.zip$/i.test(e.name)) {
        const st = fs.statSync(full); totalBytes += st.size;
        const zip = new ZipFile(full); let expanded = 0;
        try {
          for (const entry of zip.entries.values()) {
            expanded += entry.usize;
            const ext = path.extname(entry.name).toLowerCase();
            if (['.dds', '.png', '.tga', '.i3d'].includes(ext) && (entry.usize >= 64 * 1024 * 1024 || ['.png', '.tga'].includes(ext) && entry.usize >= 16 * 1024 * 1024 || ext === '.dds' && entry.usize >= 32 * 1024 * 1024 && entry.method === 0)) assets.push({ mod: e.name, file: entry.name, size: entry.usize, type: ext, note: entry.method === 0 && ext === '.dds' ? 'Große DDS-Datei ohne ZIP-Kompression' : 'Sehr große Einzeldatei' });
          }
        } finally { zip.close(); }
        mods.push({ name: e.name, size: st.size, expanded, large: st.size >= 512 * 1024 * 1024 });
      } else if (e.isDirectory() && fs.existsSync(path.join(full, 'modDesc.xml'))) {
        const size = dirSize(full); totalBytes += size; mods.push({ name: e.name, size, expanded: size, large: size >= 512 * 1024 * 1024 });
      }
    } catch (err) { mods.push({ name: e.name, size: 0, large: false, error: err.message }); }
  }
  mods.sort((a, b) => b.size - a.size);
  assets.sort((a, b) => b.size - a.size);
  return { ok: true, totalBytes, mods: mods.slice(0, 30), largeCount: mods.filter((m) => m.large).length, assets: assets.slice(0, 50), assetCount: assets.length, log: getLogAnalysis(cfg, null) };
});

ipcMain.handle('mods:toggle', async (_e, file) => {
  const cfg = loadConfig();
  const mp = modPath(cfg, file);
  if (!mp || !fs.existsSync(mp.target)) return { ok: false, error: 'Mod nicht gefunden.' };
  if (!/\.zip(\.bak)?$/i.test(mp.target) && !fs.statSync(mp.target).isDirectory()) return { ok: false, error: 'Nicht unterstützt.' };
  const isBak = /\.bak$/i.test(mp.target);
  const next = isBak ? mp.target.replace(/\.bak$/i, '') : mp.target + '.bak';
  if (fs.existsSync(next)) return { ok: false, error: 'Zieldatei existiert bereits: ' + path.basename(next) };
  try {
    fs.renameSync(mp.target, next);
    return { ok: true, enabled: isBak };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('mods:trash', async (_e, file) => {
  const cfg = loadConfig();
  const mp = modPath(cfg, file);
  if (!mp || !fs.existsSync(mp.target)) return { ok: false, error: 'Mod nicht gefunden.' };
  try {
    await shell.trashItem(mp.target);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('mods:reveal', (_e, file) => {
  const cfg = loadConfig();
  const mp = modPath(cfg, file);
  if (!mp || !fs.existsSync(mp.target)) return false;
  shell.showItemInFolder(mp.target);
  return true;
});

// --- Drag-&-Drop-Installer ------------------------------------------------------

function safeModId(base) {
  let id = base.replace(/\.zip$/i, '').replace(/[^A-Za-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  if (!id) id = 'mod';
  if (/^\d/.test(id)) id = 'mod_' + id;
  return id;
}

ipcMain.handle('mods:install', async (_e, files, overwrite) => {
  const cfg = loadConfig();
  const { dir } = resolveModsDir(cfg);
  const allow = new Set(Array.isArray(overwrite) ? overwrite.map(String) : []);
  const results = [];
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    return { ok: false, error: 'Mod-Ordner nicht beschreibbar: ' + err.message, results };
  }
  for (const p of (Array.isArray(files) ? files : []).slice(0, 50)) {
    const base = path.basename(String(p));
    if (!/\.zip$/i.test(base)) {
      results.push({ src: base, ok: false, error: 'Keine .zip-Datei' });
      continue;
    }
    try {
      const z = new ZipFile(p);
      const valid = z.has('modDesc.xml');
      z.close();
      if (!valid) {
        results.push({ src: base, ok: false, error: 'Kein gültiger Mod (modDesc.xml fehlt im Archiv-Hauptverzeichnis)' });
        continue;
      }
    } catch (err) {
      results.push({ src: base, ok: false, error: 'ZIP nicht lesbar: ' + err.message });
      continue;
    }
    const name = safeModId(base) + '.zip';
    const dest = path.join(dir, name);
    const exists = fs.existsSync(dest) || fs.existsSync(dest + '.bak');
    if (exists && !allow.has(name)) {
      results.push({ src: base, name, ok: false, exists: true, path: String(p) });
      continue;
    }
    try {
      if (fs.existsSync(dest + '.bak')) fs.rmSync(dest + '.bak');
      fs.copyFileSync(String(p), dest);
      results.push({ src: base, name, ok: true, renamed: name !== base });
    } catch (err) {
      results.push({ src: base, name, ok: false, error: err.message });
    }
  }
  return { ok: true, dir, results };
});

// --- Konflikt-Checker -------------------------------------------------------------

ipcMain.handle('mods:conflicts', async () => {
  const cfg = loadConfig();
  const { dir } = resolveModsDir(cfg);
  const list = await listMods(dir);
  if (!list.ok) return { ok: false, error: list.error };
  const enabled = list.items.filter((m) => m.enabled);
  const byTarget = new Map();
  let scripts = 0;
  let n = 0;
  for (const m of enabled) {
    const full = path.join(dir, m.file);
    let st;
    try {
      st = fs.statSync(full);
    } catch {
      continue;
    }
    const key = `${full}|${st.mtimeMs}|${st.size}`;
    let sc = scriptCache.get(key);
    if (!sc) {
      sc = scanScripts(full, m.file);
      scriptCache.set(key, sc);
    }
    scripts += sc.scripts;
    for (const o of sc.overrides) {
      if (!byTarget.has(o.target)) byTarget.set(o.target, new Map());
      const mods = byTarget.get(o.target);
      if (!mods.has(m.id)) mods.set(m.id, { id: m.id, title: m.title, modes: new Set() });
      mods.get(m.id).modes.add(o.mode);
    }
    if (++n % 4 === 0) await tick();
  }

  const conflicts = [];
  for (const [target, mods] of byTarget) {
    const over = Array.from(mods.values()).filter((x) => x.modes.has('overwrittenFunction'));
    if (over.length >= 2) {
      conflicts.push({
        target,
        severity: 'warn',
        mods: Array.from(mods.values()).map((x) => ({ id: x.id, title: x.title, modes: Array.from(x.modes) }))
      });
    }
  }
  conflicts.sort((a, b) => b.mods.length - a.mods.length || a.target.localeCompare(b.target));

  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
  const groups = new Map();
  for (const m of enabled) {
    if (!m.title || m.title === m.id) continue;
    const k = norm(m.title) + '|' + norm(m.author);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(m);
  }
  const duplicates = Array.from(groups.values())
    .filter((g) => g.length > 1)
    .map((g) => ({ title: g[0].title, mods: g.map((m) => ({ id: m.id, version: m.version })) }));

  return { ok: true, scanned: enabled.length, scripts, conflicts: conflicts.slice(0, 200), duplicates };
});

// --- ModHub -------------------------------------------------------------------------

const hubCache = new Map();
ipcMain.handle('modhub:check', async (_e, q) => {
  const title = str(q && q.title, 200);
  const version = str(q && q.version, 40);
  const key = title + '|' + version;
  if (hubCache.has(key)) return hubCache.get(key);
  const r = await netlib.modhubLookup({ title, version });
  if (r.status !== 'unknown') hubCache.set(key, r);
  return r;
});

// ---------------------------------------------------------------------------
// Log-Analyse
// ---------------------------------------------------------------------------

let logCache = { sig: '', data: null };

function findLog(cfg) {
  if (cfg.logPath && fs.existsSync(cfg.logPath)) return { file: cfg.logPath };
  const names = ['log.txt', 'game.log.txt', 'game.log', 'gameLog.txt'];
  const tried = names.map((n) => path.join(cfg.profilePath, n));
  const hit = tried.find((p) => fs.existsSync(p));
  return hit ? { file: hit } : { file: '', tried };
}

let bootTimer = null;
function readBootRuns() {
  try { return JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'boot-times.json'), 'utf8')); } catch { return []; }
}
function saveBootRun(run) {
  const file = path.join(app.getPath('userData'), 'boot-times.json');
  const runs = [run, ...readBootRuns()].slice(0, 30);
  try { fs.writeFileSync(file, JSON.stringify(runs, null, 2), 'utf8'); } catch { /* best effort */ }
}
function startBootTracker(cfg) {
  if (bootTimer) clearInterval(bootTimer);
  const startedAt = Date.now(), logFile = findLog(cfg).file;
  if (!logFile) { saveBootRun({ startedAt, durationMs: null, marker: 'Keine log.txt gefunden', profile: activeProfile(cfg).name }); return; }
  let previousSize = 0, previousMtime = 0, previousBirthtime = 0, previousIno = 0;
  try { const st = fs.statSync(logFile); previousSize = st.size; previousMtime = st.mtimeMs; previousBirthtime = st.birthtimeMs; previousIno = st.ino; } catch {}
  bootTimer = setInterval(() => {
    if (Date.now() - startedAt > 10 * 60 * 1000) {
      clearInterval(bootTimer); bootTimer = null;
      saveBootRun({ startedAt, durationMs: null, marker: 'Kein Ladeabschluss-Marker innerhalb von 10 Minuten', profile: activeProfile(cfg).name }); return;
    }
    try {
      const st = fs.statSync(logFile);
      if (st.size === previousSize && st.mtimeMs === previousMtime && st.birthtimeMs === previousBirthtime && st.ino === previousIno) return;
      const reset = st.size < previousSize || st.size === previousSize && st.mtimeMs !== previousMtime || st.birthtimeMs !== previousBirthtime || st.ino !== previousIno;
      const offset = reset ? Math.max(0, st.size - 512 * 1024) : Math.max(previousSize, st.size - 512 * 1024);
      const length = Math.max(0, st.size - offset), fd = fs.openSync(logFile, 'r'), buffer = Buffer.alloc(length);
      try { fs.readSync(fd, buffer, 0, length, offset); } finally { fs.closeSync(fd); }
      previousSize = st.size; previousMtime = st.mtimeMs; previousBirthtime = st.birthtimeMs; previousIno = st.ino;
      const text = buffer.toString('utf8');
      const marker = text.match(/(?:finished|completed)\s+(?:loading|starting)|(?:loading|starting).{0,40}(?:finished|complete|completed)|(?:game|map).{0,30}(?:ready|loaded)|(?:savegame|career).{0,30}loaded/i);
      if (marker) { clearInterval(bootTimer); bootTimer = null; saveBootRun({ startedAt, durationMs: Date.now() - startedAt, marker: marker[0], profile: activeProfile(cfg).name }); }
    } catch { /* log created after game spawn */ }
  }, 1500).unref();
}
ipcMain.handle('performance:boot', () => readBootRuns());

function getLogAnalysis(cfg, lastSig) {
  const f = findLog(cfg);
  if (!f.file) return { ok: false, error: 'Keine Log-Datei gefunden.', tried: f.tried || [cfg.logPath] };
  let st;
  try {
    st = fs.statSync(f.file);
  } catch (err) {
    return { ok: false, error: err.message };
  }
  const sig = `${f.file}|${st.size}|${st.mtimeMs}`;
  if (lastSig && lastSig === sig) return { ok: true, unchanged: true, sig };
  if (logCache.sig === sig) return { ...logCache.data, sig };
  try {
    const MAX = 8 * 1024 * 1024;
    const fd = fs.openSync(f.file, 'r');
    const len = Math.min(st.size, MAX);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, st.size - len);
    fs.closeSync(fd);
    const parsed = parseLog(buf.toString('utf8'));
    const data = {
      ok: true,
      file: f.file,
      size: st.size,
      mtime: st.mtimeMs,
      truncated: st.size > MAX,
      counts: parsed.counts,
      byMod: parsed.byMod,
      lineCount: parsed.lineCount,
      entries: parsed.entries.slice(0, 1500)
    };
    logCache = { sig, data };
    return { ...data, sig };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

ipcMain.handle('log:analyze', (_e, lastSig) => getLogAnalysis(loadConfig(), lastSig ? String(lastSig) : null));

// ---------------------------------------------------------------------------
// Fenster
// ---------------------------------------------------------------------------

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1240,
    height: 800,
    minWidth: 1000,
    minHeight: 660,
    frame: false,
    backgroundColor: '#0a0d0b',
    title: 'Agri Nexus',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.on('maximize', () => win.webContents.send('win:state', true));
  win.on('unmaximize', () => win.webContents.send('win:state', false));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(createWindow);
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => { try { if (discord) discord.destroy(); } catch {} try { if (companionServer) companionServer.close(); } catch {} });
  app.whenReady().then(startDiscordRPC);
  setInterval(() => { if (!win || !win.isMinimized()) updatePresence(); }, 60000).unref();
}

// ---------------------------------------------------------------------------
// IPC: Fenster, Shell, Konfiguration
// ---------------------------------------------------------------------------

ipcMain.handle('win:minimize', () => win && win.minimize());
ipcMain.handle('win:toggleMaximize', () => {
  if (!win) return;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
});
ipcMain.handle('win:close', () => win && win.close());

ipcMain.handle('shell:external', (_e, url) => {
  try {
    const u = new URL(String(url));
    if (u.protocol === 'https:' && ['github.com', 'www.github.com', 'www.farming-simulator.com'].includes(u.hostname)) {
      shell.openExternal(u.toString());
      return true;
    }
  } catch {
    /* ungültig */
  }
  return false;
});
ipcMain.handle('clipboard:writeText', (_e, value) => { require('electron').clipboard.writeText(String(value || '').slice(0, 2000)); return true; });

ipcMain.handle('shell:openFolder', async (_e, which) => {
  const cfg = loadConfig();
  let target = '';
  if (which === 'profile') target = cfg.profilePath;
  else if (which === 'mods') target = resolveModsDir(cfg).dir;
  else if (which === 'backups') {
    fs.mkdirSync(cfg.backupPath, { recursive: true });
    target = cfg.backupPath;
  } else if (which === 'game') target = cfg.gamePath ? path.dirname(cfg.gamePath) : '';
  else if (which === 'log') {
    const f = findLog(cfg);
    if (f.file) return shell.showItemInFolder(f.file), { ok: true };
  }
  if (!target || !fs.existsSync(target)) return { ok: false, error: 'Ordner nicht gefunden.' };
  const err = await shell.openPath(target);
  return err ? { ok: false, error: err } : { ok: true };
});

ipcMain.handle('dialog:pick', async (_e, kind) => {
  const props = kind === 'dir' ? ['openDirectory', 'createDirectory'] : ['openFile'];
  const opts = { properties: props };
  if (kind === 'file') opts.filters = [{ name: 'Programm', extensions: ['exe'] }];
  if (kind === 'log') opts.filters = [{ name: 'Log-Datei', extensions: ['txt', 'log'] }];
  const res = await dialog.showOpenDialog(win, opts);
  return res.canceled ? '' : res.filePaths[0];
});

ipcMain.handle('config:get', () => loadConfig());
ipcMain.handle('config:set', (_e, cfg) => {
  const saved = saveConfig(cfg);
  try {
    if (saved.modsPath) { fs.mkdirSync(saved.modsPath, { recursive: true }); gameSettings.writeOverride(saved.profilePath, path.normalize(saved.modsPath)); }
    else if (fs.existsSync(gameSettings.settingsFile(saved.profilePath))) gameSettings.writeOverride(saved.profilePath, null);
  }
  catch (err) { return { ...saved, settingsError: err.message }; }
  return saved;
});
ipcMain.handle('game:detect', () => detectGame());
ipcMain.handle('app:info', () => ({ version: app.getVersion(), platform: process.platform, userData: app.getPath('userData') }));

ipcMain.handle('modfolder:info', () => {
  const cfg = loadConfig();
  const r = resolveModsDir(cfg);
  const o = gameSettings.readOverride(cfg.profilePath);
  return { ...r, gameSettings: o };
});

const syncTransfers = new Map();
const profilePackages = new Map();
const hashCache = new Map();
const HASH_CACHE_LIMIT = 5000;
function hashFile(file, key, onProgress) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(file, { highWaterMark: 1024 * 1024 });
    const limited = loadConfig().lowPerformanceMode;
    const bytesPerSecond = 24 * 1024 * 1024;
    let bytes = 0;
    stream.on('data', (chunk) => {
      hash.update(chunk); bytes += chunk.length;
      if (onProgress) onProgress(bytes);
      if (limited) {
        const wait = Math.max(0, Math.ceil(bytes * 1000 / bytesPerSecond) - (Date.now() - started));
        if (wait) { stream.pause(); setTimeout(() => stream.resume(), wait); }
      }
    });
    const started = Date.now();
    stream.on('error', reject);
    stream.on('end', () => {
      const digest = hash.digest('hex');
      hashCache.set(key, digest);
      if (hashCache.size > HASH_CACHE_LIMIT) hashCache.delete(hashCache.keys().next().value);
      resolve(digest);
    });
  });
}
ipcMain.handle('sync:profile', async () => {
  const cfg = loadConfig(), profile = activeProfile(cfg), { dir } = resolveModsDir(cfg), zip = new AdmZip();
  zip.addFile('profile.json', Buffer.from(JSON.stringify(profile), 'utf8'));
  if (fs.existsSync(dir)) for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (/\.bak$/i.test(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isFile() && /\.zip$/i.test(e.name)) zip.addLocalFile(full, 'mods');
    else if (e.isDirectory() && fs.existsSync(path.join(full, 'modDesc.xml'))) zip.addLocalFolder(full, `mods/${e.name}`);
  }
  if (profile.savegame && /^savegame\d+$/.test(profile.savegame)) {
    const save = path.join(cfg.profilePath, profile.savegame);
    if (fs.existsSync(save)) zip.addLocalFolder(save, `savegames/${profile.savegame}`);
    else profile.savegame = '';
  }
  const token = crypto.randomBytes(16).toString('hex'), file = path.join(app.getPath('temp'), `agri-nexus-profile-${token}.zip`);
  await zip.writeZipPromise(file); const size = fs.statSync(file).size; profilePackages.set(token, { file, size });
  return { token, name: 'AgriNexusProfile.zip', size };
});
ipcMain.handle('sync:manifest', async (event) => {
  const { dir } = resolveModsDir(loadConfig());
  const items = [];
  const names = fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => /^[^\\/]+\.zip$/i.test(name)) : [];
  const totalBytes = names.reduce((sum, name) => { try { return sum + fs.statSync(path.join(dir, name)).size; } catch { return sum; } }, 0);
  let bytesDone = 0, lastReport = 0;
  if (fs.existsSync(dir)) for (let index = 0; index < names.length; index++) {
    const name = names[index];
    const file = path.join(dir, name);
    try {
      const st = fs.statSync(file);
      if (!st.isFile()) continue;
      const key = `${path.resolve(file)}|${st.size}|${st.mtimeMs}|${st.ctimeMs}`;
      let sha256 = hashCache.get(key);
      if (sha256) { hashCache.delete(key); hashCache.set(key, sha256); bytesDone += st.size; }
      else {
        let fileProgress = 0;
        sha256 = await hashFile(file, key, (current) => {
          bytesDone += current - fileProgress; fileProgress = current;
          const now = Date.now();
          if (now - lastReport >= 500) { lastReport = now; event.sender.send('sync:progress', { done: index, total: names.length, bytesDone, totalBytes, name }); }
        });
      }
      items.push({ name, size: st.size, sha256 });
      event.sender.send('sync:progress', { done: index + 1, total: names.length, bytesDone, totalBytes, name });
    } catch { /* file changed during scan */ }
  }
  event.sender.send('sync:progress', { done: names.length, total: names.length, bytesDone: totalBytes, totalBytes, complete: true });
  return { dir, items };
});
ipcMain.handle('sync:read', (_e, name, offset, length) => {
  const pkgToken = String(name).startsWith('profile:') ? String(name).slice(8) : '';
  const pkg = profilePackages.get(pkgToken);
  if (pkg) {
    const start = Math.max(0, Math.min(pkg.size, Number(offset) || 0)), size = Math.max(0, Math.min(48 * 1024, Number(length) || 0, pkg.size - start));
    const fd = fs.openSync(pkg.file, 'r'), buf = Buffer.alloc(size); try { fs.readSync(fd, buf, 0, size, start); } finally { fs.closeSync(fd); }
    if (start + size >= pkg.size) { profilePackages.delete(pkgToken); try { fs.rmSync(pkg.file, { force: true }); } catch {} }
    return buf.toString('base64');
  }
  const { dir } = resolveModsDir(loadConfig());
  const safe = path.basename(String(name));
  if (!/^[^\\/]+\.zip$/i.test(safe)) throw new Error('Nur ZIP-Mods werden synchronisiert.');
  const file = path.join(dir, safe), st = fs.statSync(file);
  const start = Math.max(0, Math.min(st.size, Number(offset) || 0));
  const size = Math.max(0, Math.min(256 * 1024, Number(length) || 0, st.size - start));
  const fd = fs.openSync(file, 'r'), buf = Buffer.alloc(size);
  try { fs.readSync(fd, buf, 0, size, start); } finally { fs.closeSync(fd); }
  return buf.toString('base64');
});
ipcMain.handle('sync:begin', (_e, name, size) => {
  const safe = path.basename(String(name));
  if (!(safe === 'AgriNexusProfile.zip' || /^[^\\/]+\.zip$/i.test(safe)) || !Number.isSafeInteger(Number(size)) || Number(size) < 1 || Number(size) > 2 * 1024 * 1024 * 1024) throw new Error('Ungültige Datei oder Dateigröße.');
  const tmp = path.join(app.getPath('temp'), `agri-nexus-${crypto.randomBytes(12).toString('hex')}.part`);
  fs.writeFileSync(tmp, ''); const token = crypto.randomBytes(16).toString('hex');
  syncTransfers.set(token, { tmp, name: safe, size: Number(size), received: 0 }); return token;
});
ipcMain.handle('sync:chunk', (_e, token, data) => {
  const t = syncTransfers.get(String(token)); if (!t) throw new Error('Transfer unbekannt.');
  const b = Buffer.from(String(data), 'base64'); if (b.length > 256 * 1024 || t.received + b.length > t.size) throw new Error('Ungültiger Datenblock.');
  fs.appendFileSync(t.tmp, b); t.received += b.length; return t.received;
});
ipcMain.handle('sync:finish', async (_e, token) => {
  const t = syncTransfers.get(String(token)); if (!t) throw new Error('Transfer unbekannt.'); syncTransfers.delete(String(token));
  try {
    if (await isGameRunning()) throw new Error('Bitte das Spiel vor dem Import beenden.');
    if (t.received !== t.size) throw new Error('Transfer unvollständig.');
    const z = new AdmZip(t.tmp);
    if (t.name === 'AgriNexusProfile.zip') {
      const entries = z.getEntries(), safeEntry = (name) => !name.startsWith('/') && !name.includes('\\') && !name.split('/').some((part) => part === '..');
      if (entries.some((e) => !safeEntry(e.entryName)) || !z.getEntry('profile.json')) throw new Error('Profilpaket ungültig.');
      const cfg = loadConfig(), incoming = sanitizeProfile(JSON.parse(z.readAsText('profile.json')));
      incoming.id = `sync-${Date.now()}`; incoming.name = `${incoming.name} (Sync)`; incoming.modFolderMode = 'default'; incoming.modFolder = '';
      const sourceSave = incoming.savegame;
      if (sourceSave) {
        let slot = 1; while (fs.existsSync(path.join(cfg.profilePath, `savegame${slot}`))) slot++;
        incoming.savegame = `savegame${slot}`;
      }
      const modsDir = resolveModsDir(cfg).dir; fs.mkdirSync(modsDir, { recursive: true });
      for (const e of entries) {
        if (e.isDirectory || e.entryName === 'profile.json') continue;
        if (e.entryName.startsWith('mods/')) {
          const rel = e.entryName.slice(5), dest = path.join(modsDir, rel);
          if (!inside(modsDir, dest)) throw new Error('Ungültiger Mod-Pfad im Profilpaket.');
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          if (fs.existsSync(dest)) fs.copyFileSync(dest, dest + '.sync-backup');
          fs.writeFileSync(dest, e.getData());
        } else if (e.entryName.startsWith('savegames/')) {
          let rel = e.entryName.slice('savegames/'.length);
          if (sourceSave && incoming.savegame) rel = rel.replace(new RegExp('^' + sourceSave + '(?=/)'), incoming.savegame);
          const dest = path.join(cfg.profilePath, rel);
          if (!/^savegame\d+(\\|\/|$)/.test(rel) || !inside(cfg.profilePath, dest)) throw new Error('Ungültiger Savegame-Pfad im Profilpaket.');
          fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, e.getData());
        } else throw new Error('Unbekannter Inhalt im Profilpaket.');
      }
      cfg.profiles.push(incoming); cfg.activeProfile = incoming.id; saveConfig(cfg);
      fs.rmSync(t.tmp, { force: true }); return { ok: true, file: incoming.name, profile: true };
    }
    if (!z.getEntry('modDesc.xml')) throw new Error('ZIP enthält keine modDesc.xml.');
    const { dir } = resolveModsDir(loadConfig()); fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, t.name); if (fs.existsSync(dest)) { fs.copyFileSync(dest, dest + '.sync-backup'); fs.rmSync(dest, { force: true }); }
    fs.renameSync(t.tmp, dest); return { ok: true, file: t.name };
  } catch (err) { try { fs.rmSync(t.tmp, { force: true }); } catch {} return { ok: false, error: err.message }; }
});

ipcMain.handle('gallery:list', () => {
  const dir = path.join(loadConfig().profilePath, 'screenshots');
  if (!fs.existsSync(dir)) return { dir, items: [] };
  return { dir, items: fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile() && /\.(png|jpe?g|webp)$/i.test(e.name)).map((e) => {
    const file = path.join(dir, e.name); let tags = null;
    try { tags = JSON.parse(fs.readFileSync(file + '.agri-nexus.json', 'utf8')); } catch { /* no context tags yet */ }
    return { name: e.name, mtime: fs.statSync(file).mtimeMs, tags };
  }).sort((a,b) => b.mtime-a.mtime) };
});
function galleryFile(name) { const dir = path.join(loadConfig().profilePath, 'screenshots'), file = path.join(dir, path.basename(String(name))); return inside(dir, file) && /\.(png|jpe?g|webp)$/i.test(file) && fs.existsSync(file) ? file : ''; }
ipcMain.handle('gallery:image', (_e, name) => { const f = galleryFile(name); if (!f) return ''; const ext = path.extname(f).slice(1).toLowerCase().replace('jpg','jpeg'); return `data:image/${ext};base64,${fs.readFileSync(f).toString('base64')}`; });
ipcMain.handle('gallery:copy', (_e, name) => { const f = galleryFile(name); if (!f) return false; const { clipboard, nativeImage } = require('electron'); clipboard.writeImage(nativeImage.createFromPath(f)); return true; });
ipcMain.handle('gallery:reveal', (_e, name) => { const f = galleryFile(name); if (!f) return false; shell.showItemInFolder(f); return true; });
ipcMain.handle('gallery:open', async () => { const dir = path.join(loadConfig().profilePath, 'screenshots'); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); return shell.openPath(dir); });
ipcMain.handle('gallery:tag', (_e, name, input) => {
  const file = galleryFile(name); if (!file) return { ok: false, error: 'Screenshot nicht gefunden.' };
  const cfg = loadConfig(), profile = activeProfile(cfg), tags = { profile: String(profile.name).slice(0, 60), profileId: profile.id, savegame: String(input?.savegame || '').slice(0, 32), map: String(input?.map || '').slice(0, 80), taggedAt: Date.now() };
  if (tags.savegame && !/^savegame\d+$/.test(tags.savegame)) return { ok: false, error: 'Ungültiger Spielstand.' };
  try { fs.writeFileSync(file + '.agri-nexus.json', JSON.stringify(tags, null, 2), 'utf8'); return { ok: true, tags }; }
  catch (err) { return { ok: false, error: err.message }; }
});

function companionState() {
  const cfg = loadConfig(), profile = activeProfile(cfg), slot = /^savegame\d+$/.test(profile.savegame) ? profile.savegame : listSlots(cfg)[0] || '';
  let save = {};
  if (slot) try {
    const xml = fs.readFileSync(path.join(cfg.profilePath, slot, 'careerSavegame.xml'), 'utf8');
    const value = (tag) => { const m = new RegExp(`<${tag}\\b[^>]*>([^<]*)<\\/${tag}>`, 'i').exec(xml); return m ? m[1].trim() : ''; };
    save = { slot, name: value('savegameName'), map: value('mapTitle'), money: value('money'), loan: value('loan'), playTime: value('playTime') };
  } catch { save = { slot }; }
  return { profile: profile.name, farm: profile.farm || '', save, telemetry: companionTelemetry, updatedAt: Date.now() };
}
function companionUrls() {
  if (!companionServer || !companionToken) return [];
  const port = companionServer.address().port, addresses = [];
  for (const list of Object.values(os.networkInterfaces())) for (const item of list || []) if (item.family === 'IPv4' && !item.internal) addresses.push(`http://${item.address}:${port}/c/${companionToken}`);
  return addresses;
}
const COMPANION_HTML = `<!doctype html><html lang="de"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Agri Nexus Companion</title><style>body{margin:0;background:#101710;color:#ecf1e8;font:16px system-ui;padding:22px}h1{font-size:22px}small{color:#aab5a5}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}.card{background:#1b261c;border:1px solid #344235;border-radius:14px;padding:16px}.value{font-size:22px;font-weight:700;margin-top:8px;overflow-wrap:anywhere}.wide{grid-column:1/-1}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><h1>Agri Nexus · Live-Begleiter</h1><small id="updated">Verbinde …</small><div class="grid" id="data"></div><script>const box=document.getElementById('data'),updated=document.getElementById('updated');async function refresh(){try{const r=await fetch(location.pathname+'/api',{cache:'no-store'}),d=await r.json(),s=d.save||{},t=d.telemetry||{},vals=[['Profil',d.profile],['Hof',d.farm||'–'],['Spielstand',s.name||s.slot||'–'],['Karte',s.map||t.map||'–'],['Kontostand',s.money||t.money||'–'],['Kredit',s.loan||t.loan||'–'],['Preise',t.prices],['Silostände',t.silos],['Lohnaufträge',t.contracts],['Produktionen',t.production],['RP-Kasse',t.farmBalance]];box.replaceChildren();for(const [k,v] of vals){const c=document.createElement('div'),l=document.createElement('small'),x=document.createElement('div');c.className='card';l.textContent=k;x.className='value';x.textContent=String(v??'–');c.append(l,x);box.append(c)}if(Object.keys(t).length){const c=document.createElement('div'),l=document.createElement('small'),p=document.createElement('pre');c.className='card wide';l.textContent='Telemetrie';p.textContent=JSON.stringify(t,null,2);c.append(l,p);box.append(c)}updated.textContent='Zuletzt aktualisiert: '+new Date(d.updatedAt).toLocaleTimeString()}catch{updated.textContent='Verbindung fehlgeschlagen'}}refresh();setInterval(refresh,4000)</script></html>`;
ipcMain.handle('companion:start', async () => {
  if (!companionServer) {
    companionToken = crypto.randomBytes(24).toString('hex');
    const prefix = `/c/${companionToken}`;
    companionServer = http.createServer((req, res) => {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      if (pathname === prefix && req.method === 'GET') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); res.end(COMPANION_HTML); return; }
      if (pathname === `${prefix}/api` && req.method === 'GET') { res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(companionState())); return; }
      if (pathname === `${prefix}/api/telemetry` && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => { if (Buffer.byteLength(body) + chunk.length > 1024 * 1024) { res.writeHead(413); res.end(); req.destroy(); } else body += chunk.toString('utf8'); });
        req.on('end', () => { try { const d = JSON.parse(body); if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('JSON-Objekt erwartet.'); companionTelemetry = Object.fromEntries(Object.entries(d).slice(0, 100).map(([k, v]) => [String(k).slice(0, 80), typeof v === 'string' ? v.slice(0, 500) : v])); res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true}'); } catch (err) { if (!res.headersSent) { res.writeHead(400, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: err.message })); } } }); return;
      }
      res.writeHead(404, { 'content-type': 'text/plain' }); res.end('Not found');
    });
    try { await new Promise((resolve, reject) => { companionServer.once('error', reject); companionServer.listen(0, '0.0.0.0', resolve); }); companionServer.on('error', () => { companionServer = null; companionToken = ''; }); }
    catch (err) { companionServer = null; companionToken = ''; return { ok: false, error: err.message }; }
  }
  return { ok: true, port: companionServer.address().port, urls: companionUrls() };
});
ipcMain.handle('companion:stop', async () => { const server = companionServer; companionServer = null; companionToken = ''; companionTelemetry = null; if (server) await new Promise((resolve) => server.close(resolve)); return true; });

ipcMain.handle('rp:savegameSync', async (_e, url) => {
  let parsed;
  try { parsed = new URL(String(url)); } catch { return { ok: false, error: 'Ungültige Savegame-URL.' }; }
  if (parsed.protocol !== 'https:') return { ok: false, error: 'Savegame-Sync akzeptiert nur HTTPS-Adressen.' };
  try {
    const result = await netlib.httpGet(parsed.toString(), { timeout: 20000, maxBytes: 16 * 1024 * 1024 });
    if (result.status !== 200 || !/<careerSavegame\b/i.test(result.body)) return { ok: false, error: `Keine careerSavegame.xml erhalten (HTTP ${result.status || 'Fehler'}).` };
    const cfg = loadConfig(), dir = path.join(cfg.profilePath, 'agri-nexus-admin'); fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'careerSavegame.xml');
    if (fs.existsSync(file)) fs.copyFileSync(file, file + '.bak');
    fs.writeFileSync(file, result.body, 'utf8');
    return { ok: true, file, downloadedAt: Date.now(), bytes: Buffer.byteLength(result.body, 'utf8') };
  } catch (err) { return { ok: false, error: err.message }; }
});

let discord = null, discordReady = false;
async function updatePresence(details = 'Launcher geöffnet') {
  if (!discordReady || !discord) return;
  const cfg = loadConfig(), p = activeProfile(cfg);
  let activeMods = 0;
  let map = '';
  const dir = resolveModsDir(cfg).dir;
  try {
    const selected = p.modMode === 'selection' ? new Set(p.modSelection.map((x) => x.toLowerCase())) : null;
    activeMods = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => {
      const valid = !/\.bak$/i.test(e.name) && (e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'modDesc.xml')) || e.isFile() && /\.zip$/i.test(e.name));
      const id = e.name.replace(/\.zip$/i, '').toLowerCase();
      return valid && (!selected || selected.has(id));
    }).length;
  } catch { /* no mod directory yet */ }
  try { if (p.savegame) map = xmlTag(fs.readFileSync(path.join(cfg.profilePath, p.savegame, 'careerSavegame.xml'), 'utf8'), 'mapTitle'); } catch { /* no save selected */ }
  try { const current = await isGameRunning(); discord.setActivity({ details: current ? `Farming Simulator 25${map ? ' · ' + map : ' wird gespielt'}` : String(details).slice(0, 128), state: `${p.name}${map ? ' · ' + map : ''} · ${activeMods} aktive Mods`.slice(0, 128), largeImageKey: 'agri_nexus', largeImageText: 'Agri Nexus', instance: false }); } catch { /* Discord may be closed */ }
}
function startDiscordRPC() {
  try {
    RPC.register(DISCORD_APP_ID); discord = new RPC.Client({ transport: 'ipc' });
    discord.on('ready', () => { discordReady = true; updatePresence(); });
    discord.on('disconnected', () => { discordReady = false; });
    discord.login({ clientId: DISCORD_APP_ID }).catch(() => { discordReady = false; });
  } catch { discordReady = false; }
}

// Aktives Profil → Mod-Ordner in gameSettings.xml umstellen
ipcMain.handle('profile:apply', async () => {
  const cfg = loadConfig();
  const profile = activeProfile(cfg);
  const r = await applyModFolder(cfg, profile);
  return { ...r, dir: resolveModsDir(cfg).dir };
});

// ---------------------------------------------------------------------------
// Backups
// ---------------------------------------------------------------------------

async function createBackup(cfg, slot, tag) {
  const src = path.join(cfg.profilePath, slot);
  if (!fs.existsSync(src)) throw new Error('Savegame nicht gefunden: ' + slot);
  fs.mkdirSync(cfg.backupPath, { recursive: true });
  const file = `${slot}__${stamp()}${tag ? '_' + tag : ''}.zip`;
  const zip = new AdmZip();
  zip.addLocalFolder(src, slot);
  await zip.writeZipPromise(path.join(cfg.backupPath, file));
  return file;
}

async function pruneAuto(cfg, slot, keep) {
  if (!fs.existsSync(cfg.backupPath)) return 0;
  const autos = fs
    .readdirSync(cfg.backupPath)
    .filter((f) => f.startsWith(slot + '__') && /_auto\.zip$/i.test(f))
    .map((f) => ({ f, t: fs.statSync(path.join(cfg.backupPath, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  let removed = 0;
  for (const old of autos.slice(keep)) {
    try {
      await shell.trashItem(path.join(cfg.backupPath, old.f));
      removed++;
    } catch {
      /* ignorieren */
    }
  }
  return removed;
}

function listSlots(cfg) {
  if (!fs.existsSync(cfg.profilePath)) return [];
  return fs
    .readdirSync(cfg.profilePath, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^savegame\d+$/.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));
}

ipcMain.handle('saves:list', () => {
  const cfg = loadConfig();
  if (!fs.existsSync(cfg.profilePath)) return { ok: false, error: 'Profil-Ordner nicht gefunden.', items: [] };
  const items = listSlots(cfg).map((slot) => {
    const dir = path.join(cfg.profilePath, slot);
    let xml = '';
    try {
      xml = fs.readFileSync(path.join(dir, 'careerSavegame.xml'), 'utf8');
    } catch {
      /* Slot ohne Daten */
    }
    return {
      slot,
      name: xmlTag(xml, 'savegameName') || slot,
      map: xmlTag(xml, 'mapTitle'),
      saveDate: xmlTag(xml, 'saveDate'),
      playTime: parseFloat(xmlTag(xml, 'playTime')) || 0,
      size: dirSize(dir)
    };
  });
  return { ok: true, items };
});

const BACKUP_RE = /^(savegame\d+)__(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})(?:_(auto|vor-wiederherstellung))?\.zip$/i;

ipcMain.handle('backup:list', () => {
  const cfg = loadConfig();
  if (!fs.existsSync(cfg.backupPath)) return { ok: true, dir: cfg.backupPath, items: [] };
  const items = [];
  for (const e of fs.readdirSync(cfg.backupPath, { withFileTypes: true })) {
    if (!e.isFile() || !/\.zip$/i.test(e.name)) continue;
    const st = fs.statSync(path.join(cfg.backupPath, e.name));
    const m = BACKUP_RE.exec(e.name);
    const when = m ? new Date(+m[2], +m[3] - 1, +m[4], +m[5], +m[6], +m[7]).getTime() : st.mtimeMs;
    const kind = m && m[8] ? (m[8].toLowerCase() === 'auto' ? 'auto' : 'safety') : 'manual';
    items.push({ file: e.name, slot: m ? m[1] : '', kind, when, size: st.size, mtime: st.mtimeMs });
  }
  items.sort((a, b) => b.when - a.when);
  return { ok: true, dir: cfg.backupPath, items };
});

ipcMain.handle('backup:create', async (_e, slot) => {
  const cfg = loadConfig();
  if (!/^savegame\d+$/.test(String(slot))) return { ok: false, error: 'Ungültiger Slot.' };
  try {
    return { ok: true, file: await createBackup(cfg, slot, '') };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('backup:restore', async (_e, file) => {
  const cfg = loadConfig();
  const zipPath = path.join(cfg.backupPath, String(file));
  if (!inside(cfg.backupPath, zipPath) || !fs.existsSync(zipPath)) return { ok: false, error: 'Backup nicht gefunden.' };
  const m = /^(savegame\d+)__/.exec(String(file));
  if (!m) return { ok: false, error: 'Dateiname nicht erkannt.' };
  const slot = m[1];
  if (await isGameRunning()) return { ok: false, error: 'Das Spiel läuft. Bitte erst beenden.' };
  try {
    const zip = new AdmZip(zipPath);
    for (const entry of zip.getEntries()) {
      const norm = entry.entryName.replace(/\\/g, '/');
      if (!(norm === slot + '/' || norm.startsWith(slot + '/')) || norm.includes('..')) {
        return { ok: false, error: 'Backup enthält unerwartete Pfade und wurde nicht wiederhergestellt.' };
      }
    }
    const target = path.join(cfg.profilePath, slot);
    if (fs.existsSync(target)) {
      await createBackup(cfg, slot, 'vor-wiederherstellung');
      fs.rmSync(target, { recursive: true, force: true });
    }
    zip.extractAllTo(cfg.profilePath, true);
    return { ok: true, slot };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('backup:delete', async (_e, file) => {
  const cfg = loadConfig();
  const target = path.join(cfg.backupPath, String(file));
  if (!inside(cfg.backupPath, target) || !fs.existsSync(target)) return { ok: false, error: 'Backup nicht gefunden.' };
  try {
    await shell.trashItem(target);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Safe, allow-listed scalar editor and XML health scan. Every edit first creates
// a complete timestamped ZIP backup of the selected savegame slot.
const SAVE_XML_FILES = ['careerSavegame.xml', 'environment.xml', 'fields.xml', 'farmland.xml', 'vehicles.xml', 'placeables.xml'];
const NUMERIC_XML_VALUE = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;
function validateXml(text) {
  const source = String(text).replace(/<!--[\s\S]*?-->/g, '').replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '').replace(/<\?[\s\S]*?\?>/g, '').replace(/<!DOCTYPE[^>]*>/gi, '');
  const stack = [], tags = source.match(/<[^>]+>/g) || [];
  for (const token of tags) {
    if (/^<\s*!/.test(token)) continue;
    const close = /^<\s*\/\s*([\w:.-]+)/.exec(token);
    if (close) { if (stack.pop() !== close[1]) return `Unerwartetes Abschluss-Element </${close[1]}>`; continue; }
    const open = /^<\s*([\w:.-]+)/.exec(token);
    if (!open) return 'Ungültiges XML-Element gefunden.';
    if (!/\/\s*>$/.test(token)) stack.push(open[1]);
  }
  return stack.length ? `Nicht geschlossenes Element <${stack[stack.length - 1]}>` : '';
}
function saveSlotDir(cfg, slot) {
  if (!/^savegame\d+$/.test(String(slot))) return '';
  const dir = path.join(cfg.profilePath, String(slot));
  return inside(cfg.profilePath, dir) ? dir : '';
}
ipcMain.handle('save:inspect', (_e, slot) => {
  const cfg = loadConfig(), dir = saveSlotDir(cfg, slot);
  if (!dir || !fs.existsSync(dir)) return { ok: false, error: 'Savegame-Slot nicht gefunden.', fields: [], issues: [] };
  const fields = [], issues = [];
  for (const name of SAVE_XML_FILES) {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) continue;
    try {
      const st = fs.statSync(file);
      if (st.size > 32 * 1024 * 1024) { issues.push({ file: name, issue: `Datei ist ungewöhnlich groß (${(st.size / 1024 / 1024).toFixed(1)} MiB).` }); continue; }
      const xml = fs.readFileSync(file, 'utf8'), invalid = validateXml(xml);
      if (invalid) issues.push({ file: name, issue: invalid });
      const occurrences = new Map();
      const re = /<([\w:.-]+)\b[^>]*>\s*([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)\s*<\/\1\s*>/g;
      let match;
      while ((match = re.exec(xml)) && fields.length < 800) {
        const occurrence = occurrences.get(match[1]) || 0; occurrences.set(match[1], occurrence + 1);
        fields.push({ file: name, tag: match[1], occurrence, value: match[2] });
      }
      if (name === 'vehicles.xml' && /<vehicle\b/i.test(xml) && !/<vehicles\b/i.test(xml)) issues.push({ file: name, issue: 'Fahrzeug-Einträge gefunden, aber kein <vehicles>-Wurzelelement. Datei manuell prüfen.' });
    } catch (err) { issues.push({ file: name, issue: err.message }); }
  }
  return { ok: true, fields, issues };
});
ipcMain.handle('save:edit', async (_e, slot, name, tag, occurrence, value) => {
  const cfg = loadConfig(), dir = saveSlotDir(cfg, slot);
  if (!dir || !SAVE_XML_FILES.includes(String(name))) return { ok: false, error: 'Ungültiger Slot oder XML-Datei.' };
  if (!/^[\w:.-]{1,80}$/.test(String(tag)) || !Number.isFinite(Number(value)) || !NUMERIC_XML_VALUE.test(String(value))) return { ok: false, error: 'Bitte einen gültigen numerischen Wert eingeben.' };
  if (await isGameRunning()) return { ok: false, error: 'Das Spiel läuft. Bitte erst beenden.' };
  const file = path.join(dir, name);
  try {
    const xml = fs.readFileSync(file, 'utf8'), targetOccurrence = Math.max(0, Number(occurrence) || 0);
    const escapedTag = String(tag).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(<${escapedTag}\\b[^>]*>\\s*)([-+]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][-+]?\\d+)?)(\\s*<\\/${escapedTag}\\s*>)`, 'g');
    let index = 0, found = false;
    const next = xml.replace(re, (whole, open, old, close) => index++ === targetOccurrence ? (found = true, open + String(value) + close) : whole);
    if (!found) return { ok: false, error: 'Das XML-Feld hat sich geändert. Bitte neu laden.' };
    const backup = await createBackup(cfg, String(slot), 'vor-wiederherstellung');
    fs.copyFileSync(file, file + '.agri-nexus.bak');
    fs.writeFileSync(file, next, 'utf8');
    return { ok: true, backup };
  } catch (err) { return { ok: false, error: err.message }; }
});

const profileSnapshotDir = (kind) => path.join(app.getPath('userData'), 'profile-snapshots', kind);
function safeProfileId(id) { return /^[A-Za-z0-9_-]{1,64}$/.test(String(id)) ? String(id) : ''; }
ipcMain.handle('profile:snapshot:save', async (_e, kind, id, name) => {
  const cfg = loadConfig(), profileId = safeProfileId(id), presetName = String(name || '').trim().slice(0, 50);
  if (!profileId || !['inputBinding', 'graphics'].includes(kind)) return { ok: false, error: 'Ungültiges Profil.' };
  if (kind === 'graphics' && !presetName) return { ok: false, error: 'Bitte einen Namen für das Grafik-Preset eingeben.' };
  const source = path.join(cfg.profilePath, kind === 'inputBinding' ? 'inputBinding.xml' : 'gameSettings.xml');
  if (!fs.existsSync(source)) return { ok: false, error: `${path.basename(source)} wurde nicht gefunden.` };
  const dir = kind === 'graphics' ? path.join(profileSnapshotDir(kind), profileId) : profileSnapshotDir(kind); fs.mkdirSync(dir, { recursive: true });
  const slug = presetName.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'preset';
  const destination = path.join(dir, kind === 'graphics' ? `${slug}.xml` : `${profileId}.xml`);
  try { fs.copyFileSync(source, destination); return { ok: true, file: destination, mtime: fs.statSync(destination).mtimeMs }; }
  catch (err) { return { ok: false, error: err.message }; }
});
ipcMain.handle('profile:snapshot:apply', async (_e, kind, id, name) => {
  const cfg = loadConfig(), profileId = safeProfileId(id);
  if (!profileId || !['inputBinding', 'graphics'].includes(kind)) return { ok: false, error: 'Ungültiges Profil.' };
  if (await isGameRunning()) return { ok: false, error: 'Das Spiel läuft. Bitte erst beenden.' };
  const preset = String(name || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  const source = kind === 'graphics' ? path.join(profileSnapshotDir(kind), profileId, `${preset}.xml`) : path.join(profileSnapshotDir(kind), `${profileId}.xml`);
  const destination = path.join(cfg.profilePath, kind === 'inputBinding' ? 'inputBinding.xml' : 'gameSettings.xml');
  if (!fs.existsSync(source)) return { ok: false, error: 'Für dieses Profil wurde noch keine Sicherung gespeichert.' };
  try {
    if (!fs.existsSync(destination)) return { ok: false, error: `${path.basename(destination)} wurde nicht gefunden.` };
    const savedOverride = kind === 'graphics' ? gameSettings.readOverride(cfg.profilePath) : null;
    fs.copyFileSync(destination, destination + '.agri-nexus.bak');
    fs.copyFileSync(source, destination);
    if (kind === 'graphics') gameSettings.writeOverride(cfg.profilePath, cfg.modsPath || (savedOverride && savedOverride.active ? savedOverride.directory : null));
    return { ok: true, backup: destination + '.agri-nexus.bak' };
  } catch (err) { return { ok: false, error: err.message }; }
});
ipcMain.handle('profile:snapshot:info', (_e, kind, id) => {
  const profileId = safeProfileId(id);
  if (!profileId || !['inputBinding', 'graphics'].includes(kind)) return null;
  const dir = kind === 'graphics' ? path.join(profileSnapshotDir(kind), profileId) : profileSnapshotDir(kind);
  if (kind === 'graphics') {
    try { return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith('.xml')).map((e) => { const file = path.join(dir, e.name), st = fs.statSync(file); return { name: path.basename(e.name, '.xml'), file, mtime: st.mtimeMs, size: st.size }; }); } catch { return []; }
  }
  const file = path.join(dir, `${profileId}.xml`);
  try { const st = fs.statSync(file); return { file, mtime: st.mtimeMs, size: st.size }; } catch { return null; }
});

// ---------------------------------------------------------------------------
// Spielstart
// ---------------------------------------------------------------------------

ipcMain.handle('game:launch', async () => {
  const cfg = loadConfig();
  const profile = activeProfile(cfg);
  const notes = [];

  if (!cfg.gamePath || !fs.existsSync(cfg.gamePath)) {
    return { ok: false, error: 'Spiel-Pfad nicht gefunden. Bitte in den Einstellungen festlegen.' };
  }
  if (await isGameRunning()) return { ok: false, error: 'Der Landwirtschafts-Simulator 25 läuft bereits.' };

  // 1) Mod-Ordner des Profils in die gameSettings.xml schreiben
  const mf = await applyModFolder(cfg, profile);
  if (!mf.ok) return { ok: false, error: mf.error };
  if (mf.changed) notes.push('Mod-Ordner gewechselt');

  // 2) Mod-Zuweisung (nicht gewählte Mods → .bak)
  if (profile.modMode === 'selection') {
    const { dir } = resolveModsDir(cfg);
    const r = applyModSelection(dir, profile.modSelection);
    notes.push(`Mods: ${r.enabled} aktiviert, ${r.disabled} deaktiviert`);
  }

  // 3) Auto-Backup
  if (cfg.autoBackup) {
    const slots = profile.savegame ? [profile.savegame] : listSlots(cfg);
    let made = 0;
    for (const slot of slots) {
      try {
        await createBackup(cfg, slot, 'auto');
        await pruneAuto(cfg, slot, cfg.autoBackupKeep);
        made++;
      } catch (err) {
        return { ok: false, error: 'Auto-Backup fehlgeschlagen (Spiel wurde nicht gestartet): ' + err.message };
      }
    }
    if (made) notes.push(`${made} Backup${made > 1 ? 's' : ''} erstellt`);
  }

  // 4) Shader-Cache
  if (profile.clearShader) {
    const cache = path.join(cfg.profilePath, 'shader_cache');
    try {
      if (fs.existsSync(cache) && inside(cfg.profilePath, cache)) fs.rmSync(cache, { recursive: true, force: true });
    } catch (err) {
      return { ok: false, error: 'Shader-Cache konnte nicht geleert werden: ' + err.message };
    }
  }

  const args = [];
  if (profile.skipIntro) args.push('-skipStartVideos');
  if (profile.devMode) args.push('-cheats', '-console');
  if (profile.autoStartSave && /^savegame(\d+)$/.test(profile.savegame)) {
    args.push('-autoStartSavegameId', /^savegame(\d+)$/.exec(profile.savegame)[1]);
  }
  String(profile.extraArgs || '')
    .split(/\s+/)
    .filter((a) => /^-[A-Za-z0-9_]+$/.test(a))
    .forEach((a) => args.push(a));

  const result = await new Promise((resolve) => {
    let child;
    try {
      startBootTracker(cfg);
      child = spawn(cfg.gamePath, args, { detached: true, stdio: 'ignore', cwd: path.dirname(cfg.gamePath) });
    } catch (err) {
      if (bootTimer) { clearInterval(bootTimer); bootTimer = null; }
      return resolve({ ok: false, error: err.message });
    }
    child.once('error', (err) => { if (bootTimer) { clearInterval(bootTimer); bootTimer = null; saveBootRun({ startedAt: Date.now(), durationMs: null, marker: err.message, profile: profile.name }); } resolve({ ok: false, error: err.message }); });
    child.once('spawn', () => {
      child.unref();
      updatePresence('Farming Simulator 25 wird gespielt');
      resolve({ ok: true, args, notes });
    });
  });

  if (result.ok && cfg.closeOnLaunch) setTimeout(() => app.quit(), 900);
  return result;
});

// ---------------------------------------------------------------------------
// Server-Status
// ---------------------------------------------------------------------------

function checkOfficial(name, url) {
  return new Promise((resolve) => {
    const started = Date.now();
    let done = false;
    const finish = (r) => {
      if (!done) {
        done = true;
        resolve({ name, target: url, ...r });
      }
    };
    try {
      const req = https.request(url, { method: 'HEAD', timeout: 6000 }, (res) => {
        res.resume();
        finish({ online: res.statusCode < 500, ms: Date.now() - started, detail: 'HTTP ' + res.statusCode });
      });
      req.on('timeout', () => {
        req.destroy();
        finish({ online: false, ms: null, detail: 'Zeitüberschreitung' });
      });
      req.on('error', (err) => finish({ online: false, ms: null, detail: err.code || 'Fehler' }));
      req.end();
    } catch (err) {
      finish({ online: false, ms: null, detail: err.message });
    }
  });
}

ipcMain.handle('status:check', async () => {
  const cfg = loadConfig();
  const [official, custom] = await Promise.all([
    Promise.all([
      checkOfficial('GIANTS Software', 'https://www.giants-software.com/'),
      checkOfficial('Farming Simulator', 'https://www.farming-simulator.com/'),
      checkOfficial('ModHub', 'https://www.farming-simulator.com/mods.php')
    ]),
    Promise.all(cfg.servers.map((s) => netlib.checkServer(s)))
  ]);
  return { official, custom, checkedAt: Date.now() };
});

void VALID_ID;
