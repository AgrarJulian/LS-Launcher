'use strict';

const { contextBridge, ipcRenderer, webUtils } = require('electron');

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('launcher', {
  win: {
    minimize: () => invoke('win:minimize'),
    toggleMaximize: () => invoke('win:toggleMaximize'),
    close: () => invoke('win:close'),
    onState: (cb) => ipcRenderer.on('win:state', (_e, maximized) => cb(maximized))
  },
  config: {
    get: () => invoke('config:get'),
    set: (cfg) => invoke('config:set', cfg)
  },
  appInfo: () => invoke('app:info'),
  detectGame: () => invoke('game:detect'),
  launch: () => invoke('game:launch'),
  pick: (kind) => invoke('dialog:pick', kind),
  openFolder: (which) => invoke('shell:openFolder', which),
  openExternal: (url) => invoke('shell:external', url),
  pathFor: (file) => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return '';
    }
  },
  modFolderInfo: () => invoke('modfolder:info'),
  applyProfile: () => invoke('profile:apply'),
  mods: {
    list: (spec) => invoke('mods:list', spec),
    toggle: (file) => invoke('mods:toggle', file),
    trash: (file) => invoke('mods:trash', file),
    reveal: (file) => invoke('mods:reveal', file),
    install: (files, overwrite) => invoke('mods:install', files, overwrite),
    conflicts: () => invoke('mods:conflicts'),
    modhub: (q) => invoke('modhub:check', q)
  },
  saves: {
    list: () => invoke('saves:list')
  },
  backups: {
    list: () => invoke('backup:list'),
    create: (slot) => invoke('backup:create', slot),
    restore: (file) => invoke('backup:restore', file),
    remove: (file) => invoke('backup:delete', file)
  },
  log: {
    analyze: (sig) => invoke('log:analyze', sig)
  },
  status: {
    check: () => invoke('status:check')
  }
});
