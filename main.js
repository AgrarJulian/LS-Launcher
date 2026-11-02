'use strict';

const { app, BrowserWindow, ipcMain, shell, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { spawn, execFile } = require('child_process');
const AdmZip = require('adm-zip');

const { ZipFile } = require('./lib/zip');
const { readModInfo, scanScripts, VALID_ID } = require('./lib/modinfo');
const gameSettings = require('./lib/gamesettings');
const { parseLog } = require('./lib/log');
const netlib = require('./lib/net');

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
        info = readModInfo(full, name);
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

function modPath(cfg, file) {
  const { dir } = resolveModsDir(cfg);
  const target = path.join(dir, String(file));
  return inside(dir, target) ? { dir, target } : null;
}

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
    title: 'LS25 Launcher',
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
ipcMain.handle('config:set', (_e, cfg) => saveConfig(cfg));
ipcMain.handle('game:detect', () => detectGame());
ipcMain.handle('app:info', () => ({ version: app.getVersion(), platform: process.platform, userData: app.getPath('userData') }));

ipcMain.handle('modfolder:info', () => {
  const cfg = loadConfig();
  const r = resolveModsDir(cfg);
  const o = gameSettings.readOverride(cfg.profilePath);
  return { ...r, gameSettings: o };
});

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
      child = spawn(cfg.gamePath, args, { detached: true, stdio: 'ignore', cwd: path.dirname(cfg.gamePath) });
    } catch (err) {
      return resolve({ ok: false, error: err.message });
    }
    child.once('error', (err) => resolve({ ok: false, error: err.message }));
    child.once('spawn', () => {
      child.unref();
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
