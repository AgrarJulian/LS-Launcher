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
  copyText: (text) => invoke('clipboard:writeText', text),
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
    icon: (file) => invoke('mods:icon', file),
    toggle: (file) => invoke('mods:toggle', file),
    trash: (file) => invoke('mods:trash', file),
    reveal: (file) => invoke('mods:reveal', file),
    install: (files, overwrite) => invoke('mods:install', files, overwrite),
    conflicts: () => invoke('mods:conflicts'),
    modhub: (q) => invoke('modhub:check', q),
    exportManifest: () => invoke('mods:export-manifest'),
    performanceReport: () => invoke('mods:performance-report')
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
  saveTools: {
    inspect: (slot) => invoke('save:inspect', slot),
    edit: (slot, file, tag, occurrence, value) => invoke('save:edit', slot, file, tag, occurrence, value)
  },
  profileSnapshots: {
    save: (kind, id, name) => invoke('profile:snapshot:save', kind, id, name),
    apply: (kind, id, name) => invoke('profile:snapshot:apply', kind, id, name),
    info: (kind, id) => invoke('profile:snapshot:info', kind, id)
  },
  companion: { start: () => invoke('companion:start'), stop: () => invoke('companion:stop') },
  performance: { bootRuns: () => invoke('performance:boot') },
  log: {
    analyze: (sig) => invoke('log:analyze', sig)
  },
  status: {
    check: () => invoke('status:check')
  },
  gallery: {
    list: () => invoke('gallery:list'),
    image: (file) => invoke('gallery:image', file),
    copy: (file) => invoke('gallery:copy', file),
    reveal: (file) => invoke('gallery:reveal', file),
    open: () => invoke('gallery:open'),
    tag: (file, tags) => invoke('gallery:tag', file, tags)
  },
  sync: {
    manifest: () => invoke('sync:manifest'),
    onProgress: (callback) => { const handler = (_event, value) => callback(value); ipcRenderer.on('sync:progress', handler); return () => ipcRenderer.removeListener('sync:progress', handler); },
    profile: () => invoke('sync:profile'),
    read: (file, offset, length) => invoke('sync:read', file, offset, length),
    begin: (name, size) => invoke('sync:begin', name, size),
    chunk: (token, data) => invoke('sync:chunk', token, data),
    finish: (token) => invoke('sync:finish', token)
  },
  rp: { syncSavegame: (url) => invoke('rp:savegameSync', url) }
});
