'use strict';

const { contextBridge, ipcRenderer } = require('electron');

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
  mods: {
    list: () => invoke('mods:list'),
    trash: (name) => invoke('mods:trash', name)
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
  status: {
    check: () => invoke('status:check')
  }
});
