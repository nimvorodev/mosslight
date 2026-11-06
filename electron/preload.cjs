const { contextBridge, ipcRenderer } = require('electron');

const presenceListeners = new Set();

ipcRenderer.on('presence:tick', (_event, tick) => {
  for (const listener of presenceListeners) {
    try {
      listener(tick);
    } catch {
      // A renderer listener should never break the bridge.
    }
  }
});

const commandListeners = new Set();

ipcRenderer.on('command', (_event, command) => {
  for (const listener of commandListeners) {
    try {
      listener(command);
    } catch {
      // Same here: isolate each listener.
    }
  }
});

function subscribe(set, callback) {
  if (typeof callback !== 'function') return () => {};
  set.add(callback);
  return () => {
    set.delete(callback);
  };
}

contextBridge.exposeInMainWorld('mosslight', {
  isDesktop: true,
  platform: process.platform,
  version: process.env.MOSS_VERSION || '0.1.0',

  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (json) => ipcRenderer.invoke('state:save', json),

  setExpanded: (expanded) => ipcRenderer.invoke('window:set-expanded', Boolean(expanded)),
  setAlwaysOnTop: (value) => ipcRenderer.invoke('window:set-always-on-top', Boolean(value)),
  setClickThrough: (value) => ipcRenderer.invoke('window:set-click-through', Boolean(value)),
  setGhostMode: (value) => ipcRenderer.invoke('window:set-ghost', Boolean(value)),

  setLaunchAtLogin: (value) =>
    ipcRenderer.invoke('app:set-launch-at-login', Boolean(value)),
  getLaunchAtLogin: () => ipcRenderer.invoke('app:get-launch-at-login'),

  hideWindow: () => ipcRenderer.invoke('window:hide'),
  showWindow: () => ipcRenderer.invoke('window:show'),
  getDisplay: () => ipcRenderer.invoke('display:get'),

  applySnapshot: (dataUrl, target) =>
    ipcRenderer.invoke('snapshot:apply', dataUrl, target),
  restoreWallpaper: () => ipcRenderer.invoke('snapshot:restore'),

  openDataFolder: () => ipcRenderer.invoke('data:open-folder'),
  openLockScreenSettings: () => ipcRenderer.invoke('system:open-lock-settings'),
  notify: (title, body) => ipcRenderer.invoke('app:notify', title, body),
  quit: () => ipcRenderer.invoke('app:quit'),

  onPresence: (callback) => subscribe(presenceListeners, callback),
  onCommand: (callback) => subscribe(commandListeners, callback),
});
