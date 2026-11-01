'use strict';

const { app, BrowserWindow, ipcMain, shell, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const https = require('https');
const { spawn } = require('child_process');
const AdmZip = require('adm-zip');

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
    extraArgs: ''
  };
}

function defaults() {
  return {
    gamePath: '',
    profilePath: path.join(app.getPath('documents'), 'My Games', 'FarmingSimulator2025'),
    backupPath: path.join(app.getPath('userData'), 'backups'),
    closeOnLaunch: false,
    activeProfile: 'default',
    profiles: [defaultProfile()],
    servers: []
  };
}

function str(v, max = 500) {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

function sanitizeConfig(input) {
  const d = defaults();
  const c = input && typeof input === 'object' ? input : {};
  const profiles = (Array.isArray(c.profiles) ? c.profiles : [])
    .slice(0, 50)
    .map((p) => ({
      id: str(p && p.id, 64) || String(Date.now()),
      name: str(p && p.name, 60) || 'Profil',
      farm: str(p && p.farm, 60),
      notes: str(p && p.notes, 400),
      devMode: !!(p && p.devMode),
      clearShader: !!(p && p.clearShader),
      skipIntro: !!(p && p.skipIntro),
      extraArgs: str(p && p.extraArgs, 300)
    }));
  if (!profiles.length) profiles.push(defaultProfile());
  const activeProfile = profiles.some((p) => p.id === c.activeProfile) ? c.activeProfile : profiles[0].id;
  const servers = (Array.isArray(c.servers) ? c.servers : [])
    .slice(0, 20)
    .map((s) => ({
      name: str(s && s.name, 60),
      host: str(s && s.host, 200),
      port: Math.min(65535, Math.max(1, parseInt(s && s.port, 10) || 10823))
    }))
    .filter((s) => s.host);
  return {
    gamePath: str(c.gamePath) || '',
    profilePath: str(c.profilePath) || d.profilePath,
    backupPath: str(c.backupPath) || d.backupPath,
    closeOnLaunch: !!c.closeOnLaunch,
    activeProfile,
    profiles,
    servers
  };
}

function loadConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_FILE(), 'utf8'));
    return sanitizeConfig(raw);
  } catch {
    const cfg = defaults();
    if (!cfg.gamePath) cfg.gamePath = detectGame() || '';
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

function activeProfile(cfg) {
  return cfg.profiles.find((p) => p.id === cfg.activeProfile) || cfg.profiles[0];
}

// ---------------------------------------------------------------------------
// Fenster
// ---------------------------------------------------------------------------

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 980,
    minHeight: 640,
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
// IPC: Fenster & Shell
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
    if (u.protocol === 'https:' && (u.hostname === 'github.com' || u.hostname === 'www.github.com')) {
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
  else if (which === 'mods') target = path.join(cfg.profilePath, 'mods');
  else if (which === 'backups') {
    fs.mkdirSync(cfg.backupPath, { recursive: true });
    target = cfg.backupPath;
  } else if (which === 'game') target = cfg.gamePath ? path.dirname(cfg.gamePath) : '';
  if (!target || !fs.existsSync(target)) return { ok: false, error: 'Ordner nicht gefunden.' };
  const err = await shell.openPath(target);
  return err ? { ok: false, error: err } : { ok: true };
});

ipcMain.handle('dialog:pick', async (_e, kind) => {
  const props = kind === 'file' ? ['openFile'] : ['openDirectory', 'createDirectory'];
  const opts = { properties: props };
  if (kind === 'file') opts.filters = [{ name: 'Programm', extensions: ['exe'] }];
  const res = await dialog.showOpenDialog(win, opts);
  return res.canceled ? '' : res.filePaths[0];
});

// ---------------------------------------------------------------------------
// IPC: Konfiguration
// ---------------------------------------------------------------------------

ipcMain.handle('config:get', () => loadConfig());
ipcMain.handle('config:set', (_e, cfg) => saveConfig(cfg));
ipcMain.handle('game:detect', () => detectGame());

ipcMain.handle('app:info', () => ({
  version: app.getVersion(),
  platform: process.platform,
  userData: app.getPath('userData')
}));

// ---------------------------------------------------------------------------
// IPC: Spielstart
// ---------------------------------------------------------------------------

ipcMain.handle('game:launch', async () => {
  const cfg = loadConfig();
  const profile = activeProfile(cfg);

  if (!cfg.gamePath || !fs.existsSync(cfg.gamePath)) {
    return { ok: false, error: 'Spiel-Pfad nicht gefunden. Bitte in den Einstellungen festlegen.' };
  }

  if (profile.clearShader) {
    const cache = path.join(cfg.profilePath, 'shader_cache');
    try {
      if (fs.existsSync(cache) && inside(cfg.profilePath, cache)) {
        fs.rmSync(cache, { recursive: true, force: true });
      }
    } catch (err) {
      return { ok: false, error: 'Shader-Cache konnte nicht geleert werden: ' + err.message };
    }
  }

  const args = [];
  if (profile.skipIntro) args.push('-skipStartVideos');
  if (profile.devMode) args.push('-cheats', '-console');
  String(profile.extraArgs || '')
    .split(/\s+/)
    .filter((a) => /^-[A-Za-z0-9_]+$/.test(a))
    .forEach((a) => args.push(a));

  const result = await new Promise((resolve) => {
    let child;
    try {
      child = spawn(cfg.gamePath, args, {
        detached: true,
        stdio: 'ignore',
        cwd: path.dirname(cfg.gamePath)
      });
    } catch (err) {
      return resolve({ ok: false, error: err.message });
    }
    child.once('error', (err) => resolve({ ok: false, error: err.message }));
    child.once('spawn', () => {
      child.unref();
      resolve({ ok: true, args });
    });
  });

  if (result.ok && cfg.closeOnLaunch) setTimeout(() => app.quit(), 900);
  return result;
});

// ---------------------------------------------------------------------------
// IPC: Mods
// ---------------------------------------------------------------------------

ipcMain.handle('mods:list', () => {
  const cfg = loadConfig();
  const dir = path.join(cfg.profilePath, 'mods');
  if (!fs.existsSync(dir)) return { ok: false, dir, error: 'Mod-Ordner nicht gefunden.', items: [] };
  const items = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    try {
      const st = fs.statSync(p);
      if (e.isDirectory()) {
        items.push({ name: e.name, type: 'folder', size: dirSize(p), mtime: st.mtimeMs });
      } else if (e.isFile() && /\.zip$/i.test(e.name)) {
        items.push({ name: e.name, type: 'zip', size: st.size, mtime: st.mtimeMs });
      }
    } catch {
      /* ignorieren */
    }
  }
  items.sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }));
  return { ok: true, dir, items };
});

ipcMain.handle('mods:trash', async (_e, name) => {
  const cfg = loadConfig();
  const dir = path.join(cfg.profilePath, 'mods');
  const target = path.join(dir, String(name));
  if (!inside(dir, target) || !fs.existsSync(target)) return { ok: false, error: 'Mod nicht gefunden.' };
  try {
    await shell.trashItem(target);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ---------------------------------------------------------------------------
// IPC: Savegames & Backups
// ---------------------------------------------------------------------------

ipcMain.handle('saves:list', () => {
  const cfg = loadConfig();
  if (!fs.existsSync(cfg.profilePath)) {
    return { ok: false, error: 'Profil-Ordner nicht gefunden.', items: [] };
  }
  const items = [];
  for (const e of fs.readdirSync(cfg.profilePath, { withFileTypes: true })) {
    if (!e.isDirectory() || !/^savegame\d+$/.test(e.name)) continue;
    const dir = path.join(cfg.profilePath, e.name);
    let xml = '';
    try {
      xml = fs.readFileSync(path.join(dir, 'careerSavegame.xml'), 'utf8');
    } catch {
      /* Slot ohne Daten */
    }
    items.push({
      slot: e.name,
      name: xmlTag(xml, 'savegameName') || e.name,
      map: xmlTag(xml, 'mapTitle'),
      saveDate: xmlTag(xml, 'saveDate'),
      playTime: parseFloat(xmlTag(xml, 'playTime')) || 0,
      size: dirSize(dir)
    });
  }
  items.sort((a, b) => a.slot.localeCompare(b.slot, 'de', { numeric: true }));
  return { ok: true, items };
});

ipcMain.handle('backup:list', () => {
  const cfg = loadConfig();
  if (!fs.existsSync(cfg.backupPath)) return { ok: true, dir: cfg.backupPath, items: [] };
  const items = [];
  for (const e of fs.readdirSync(cfg.backupPath, { withFileTypes: true })) {
    if (!e.isFile() || !/\.zip$/i.test(e.name)) continue;
    const st = fs.statSync(path.join(cfg.backupPath, e.name));
    const m = /^(savegame\d+)__/.exec(e.name);
    items.push({ file: e.name, slot: m ? m[1] : '', size: st.size, mtime: st.mtimeMs });
  }
  items.sort((a, b) => b.mtime - a.mtime);
  return { ok: true, dir: cfg.backupPath, items };
});

ipcMain.handle('backup:create', async (_e, slot) => {
  const cfg = loadConfig();
  if (!/^savegame\d+$/.test(String(slot))) return { ok: false, error: 'Ungültiger Slot.' };
  const src = path.join(cfg.profilePath, slot);
  if (!fs.existsSync(src)) return { ok: false, error: 'Savegame nicht gefunden.' };
  try {
    fs.mkdirSync(cfg.backupPath, { recursive: true });
    const file = `${slot}__${stamp()}.zip`;
    const zip = new AdmZip();
    zip.addLocalFolder(src, slot);
    await zip.writeZipPromise(path.join(cfg.backupPath, file));
    return { ok: true, file };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('backup:restore', async (_e, file) => {
  const cfg = loadConfig();
  const zipPath = path.join(cfg.backupPath, String(file));
  if (!inside(cfg.backupPath, zipPath) || !fs.existsSync(zipPath)) {
    return { ok: false, error: 'Backup nicht gefunden.' };
  }
  const m = /^(savegame\d+)__/.exec(String(file));
  if (!m) return { ok: false, error: 'Dateiname nicht erkannt.' };
  const slot = m[1];
  try {
    const zip = new AdmZip(zipPath);
    // Zip-Slip verhindern: nur Einträge unterhalb des Slot-Ordners zulassen
    for (const entry of zip.getEntries()) {
      const norm = entry.entryName.replace(/\\/g, '/');
      if (!(norm === slot + '/' || norm.startsWith(slot + '/')) || norm.includes('..')) {
        return { ok: false, error: 'Backup enthält unerwartete Pfade und wurde nicht wiederhergestellt.' };
      }
    }
    const target = path.join(cfg.profilePath, slot);
    // Sicherheitskopie des aktuellen Stands
    if (fs.existsSync(target)) {
      const safety = new AdmZip();
      safety.addLocalFolder(target, slot);
      fs.mkdirSync(cfg.backupPath, { recursive: true });
      await safety.writeZipPromise(path.join(cfg.backupPath, `${slot}__${stamp()}_vor-wiederherstellung.zip`));
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
// IPC: Server-Status
// ---------------------------------------------------------------------------

function checkHttps(name, url) {
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

function checkTcp(name, host, port) {
  return new Promise((resolve) => {
    const started = Date.now();
    const sock = new net.Socket();
    let done = false;
    const finish = (r) => {
      if (done) return;
      done = true;
      sock.destroy();
      resolve({ name, target: `${host}:${port}`, ...r });
    };
    sock.setTimeout(5000);
    sock.once('connect', () => finish({ online: true, ms: Date.now() - started, detail: 'Port offen' }));
    sock.once('timeout', () => finish({ online: false, ms: null, detail: 'Zeitüberschreitung' }));
    sock.once('error', (err) => finish({ online: false, ms: null, detail: err.code || 'Fehler' }));
    sock.connect(port, host);
  });
}

ipcMain.handle('status:check', async () => {
  const cfg = loadConfig();
  const official = await Promise.all([
    checkHttps('GIANTS Software', 'https://www.giants-software.com/'),
    checkHttps('Farming Simulator', 'https://www.farming-simulator.com/'),
    checkHttps('ModHub', 'https://www.farming-simulator.com/mods.php')
  ]);
  const custom = await Promise.all(cfg.servers.map((s) => checkTcp(s.name || s.host, s.host, s.port)));
  return { official, custom, checkedAt: Date.now() };
});
