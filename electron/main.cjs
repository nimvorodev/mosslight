const {
  app,
  BrowserWindow,
  Menu,
  Notification,
  Tray,
  globalShortcut,
  ipcMain,
  nativeImage,
  powerMonitor,
  screen,
  shell: electronShell,
} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');

const APP_NAME = 'Mosslight';
const JAR_COMPACT_W = 400;
const JAR_COMPACT_H = 390;
const JAR_EXPANDED_W = 800;
const JAR_EXPANDED_H = 390;
const SHELF_H = 250;
const SHELF_EXPANDED_H = 644;
const PRODUCT_ID = 'app.mosslight.terrarium';
const IS_WIN = process.platform === 'win32';
const IS_MAC = process.platform === 'darwin';
const IS_SHOT = process.env.MOSS_SHOT === '1';
const DEV_URL = process.env.VITE_DEV_SERVER_URL;

app.setName(APP_NAME);
if (IS_WIN) app.setAppUserModelId(PRODUCT_ID);

if (IS_SHOT) {
  app.setPath('userData', path.join(os.tmpdir(), 'mosslight-shot-userdata'));
}

const gotLock = IS_SHOT ? true : app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  main();
}

let win = null;
let tray = null;
let isQuitting = false;
let expanded = false;
let displayMode = 'jar';
let passthrough = true;
let presenceTimer = null;
let lastPoll = Date.now();
let boundsTimer = null;
let shellSaveTimer = null;
let lastCommand = null;

let shellState = {
  x: null,
  y: null,
  alwaysOnTop: true,
  launchAtLogin: false,
};

let userDataPath = '';
let statePath = '';
let shellPath = '';

function main() {
  process.env.MOSS_VERSION = app.getVersion();

  app.on('second-instance', () => {
    showWindow();
  });

  app.whenReady().then(async () => {
    userDataPath = app.getPath('userData');
    statePath = path.join(userDataPath, 'terrarium.json');
    shellPath = path.join(userDataPath, 'window.json');
    await fsp.mkdir(userDataPath, { recursive: true });

    if (IS_SHOT) {
      await fsp.rm(statePath, { force: true }).catch(() => {});
      await fsp.rm(shellPath, { force: true }).catch(() => {});
    }

    loadShell();
    displayMode = readDisplayMode();
    passthrough = displayMode === 'shelf';
    setupIpc();
    createWindow();
    createTray();
    registerShortcuts();
    startPresence();

    screen.on('display-metrics-changed', () => {
      if (displayMode === 'shelf') applyLayout();
    });
    screen.on('display-added', () => {
      if (displayMode === 'shelf') applyLayout();
    });
    screen.on('display-removed', () => {
      if (displayMode === 'shelf') applyLayout();
    });

    if (IS_SHOT) {
      runScreenshots();
    } else {
      win.once('ready-to-show', () => {
        win.showInactive();
      });
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      showWindow();
    });
  });

  app.on('window-all-closed', () => {
    // The jar lives in the tray.
  });

  app.on('before-quit', () => {
    isQuitting = true;
    rememberPosition();
    if (presenceTimer) clearInterval(presenceTimer);
    if (boundsTimer) clearTimeout(boundsTimer);
    if (shellSaveTimer) clearTimeout(shellSaveTimer);
    globalShortcut.unregisterAll();
    if (tray && !tray.isDestroyed()) tray.destroy();
  });
}

function createWindow() {
  const home = initialPosition();
  const shape = windowBounds(home, displayMode, false);
  win = new BrowserWindow({
    x: shape.x,
    y: shape.y,
    width: shape.width,
    height: shape.height,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: displayMode === 'jar',
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    show: false,
    title: APP_NAME,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      spellcheck: false,
    },
  });

  win.setMenuBarVisibility(false);
  win.setSkipTaskbar(true);
  win.setAlwaysOnTop(shellState.alwaysOnTop, IS_MAC ? 'floating' : undefined);
  if (IS_MAC) {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
  }
  applyMouseMode();

  win.on('move', scheduleRememberPosition);
  win.on('resize', scheduleRememberPosition);
  win.on('show', rebuildTray);
  win.on('hide', rebuildTray);

  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      hideWindow();
    }
  });

  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  if (DEV_URL) {
    win.loadURL(DEV_URL);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  win.on('closed', () => {
    win = null;
  });
}

function initialPosition() {
  const primary = screen.getPrimaryDisplay();
  const work = primary.workArea;
  let x = Number.isFinite(shellState.x)
    ? shellState.x
    : work.x + work.width - JAR_COMPACT_W - 26;
  let y = Number.isFinite(shellState.y)
    ? shellState.y
    : work.y + work.height - JAR_COMPACT_H - 26;

  const display = screen.getDisplayNearestPoint({
    x: Math.round(x + JAR_COMPACT_W / 2),
    y: Math.round(y + JAR_COMPACT_H / 2),
  });
  const wa = display.workArea;
  x = Math.min(Math.max(x, wa.x - JAR_COMPACT_W + 90), wa.x + wa.width - 90);
  y = Math.min(Math.max(y, wa.y), wa.y + wa.height - 50);
  return { x: Math.round(x), y: Math.round(y) };
}

/** The jar's size for its remembered top-left home (expanded grows leftward). */
function windowBounds(home, mode, isExpanded) {
  if (mode === 'shelf') {
    const anchor = win && !win.isDestroyed() ? win.getBounds() : null;
    const display = anchor
      ? screen.getDisplayMatching(anchor)
      : screen.getDisplayNearestPoint({ x: home.x, y: home.y });
    const work = display.workArea;
    const height = Math.min(
      isExpanded ? SHELF_EXPANDED_H : SHELF_H,
      work.height,
    );
    return {
      x: work.x,
      y: work.y + work.height - height,
      width: work.width,
      height,
    };
  }

  const display = screen.getDisplayNearestPoint({ x: home.x, y: home.y });
  const work = display.workArea;
  const width = isExpanded ? JAR_EXPANDED_W : JAR_COMPACT_W;
  const height = isExpanded ? JAR_EXPANDED_H : JAR_COMPACT_H;
  const x = isExpanded ? home.x - (JAR_EXPANDED_W - JAR_COMPACT_W) : home.x;
  return {
    x: Math.round(Math.min(Math.max(x, work.x + 4), work.x + work.width - width - 4)),
    y: Math.round(
      Math.min(Math.max(home.y, work.y + 4), work.y + work.height - height - 4),
    ),
    width,
    height,
  };
}

function applyLayout() {
  if (!win || win.isDestroyed()) return;
  const home = initialPosition();
  const shape = windowBounds(home, displayMode, expanded);
  win.setBounds(shape, false);
}

function applyMouseMode() {
  if (!win || win.isDestroyed()) return;
  const ignore = Boolean(shellState.ghost) || (displayMode === 'shelf' && passthrough);
  if (IS_WIN || IS_MAC) {
    win.setIgnoreMouseEvents(ignore, { forward: true });
  } else {
    win.setIgnoreMouseEvents(ignore);
  }
}

function readDisplayMode() {
  try {
    const raw = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    return raw?.settings?.display === 'shelf' ? 'shelf' : 'jar';
  } catch {
    return 'jar';
  }
}

function scheduleRememberPosition() {
  if (boundsTimer) clearTimeout(boundsTimer);
  boundsTimer = setTimeout(() => {
    boundsTimer = null;
    rememberPosition();
  }, 260);
}

function rememberPosition() {
  if (!win || win.isDestroyed() || displayMode === 'shelf') return;
  const bounds = win.getBounds();
  const homeX = expanded ? bounds.x + bounds.width - JAR_COMPACT_W : bounds.x;
  const homeY = expanded ? bounds.y + bounds.height - JAR_COMPACT_H : bounds.y;
  if (shellState.x === homeX && shellState.y === homeY) return;
  shellState.x = homeX;
  shellState.y = homeY;
  saveShellSoon();
}

function loadShell() {
  try {
    const raw = JSON.parse(fs.readFileSync(shellPath, 'utf8'));
    shellState = { ...shellState, ...raw };
  } catch {
    // first run
  }
}

function saveShellSoon() {
  if (shellSaveTimer) clearTimeout(shellSaveTimer);
  shellSaveTimer = setTimeout(() => {
    shellSaveTimer = null;
    void fsp
      .writeFile(shellPath, JSON.stringify(shellState, null, 2), 'utf8')
      .catch(() => {});
  }, 240);
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray-32.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.isEmpty() ? nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png')) : icon);
  tray.setToolTip(APP_NAME);
  tray.on('click', () => showWindow());
  tray.on('double-click', () => showWindow());
  rebuildTray();
}

function rebuildTray() {
  if (!tray || tray.isDestroyed()) return;
  const visible = Boolean(win && !win.isDestroyed() && win.isVisible());
  const menu = Menu.buildFromTemplate([
    {
      label: visible ? 'Hide Mosslight' : 'Show Mosslight',
      click: () => (visible ? hideWindow() : showWindow()),
    },
    {
      label: 'Open field notes',
      click: () => {
        showWindow();
        sendCommand('open-tasks');
      },
    },
    { type: 'separator' },
    {
      label: 'Mist the garden',
      click: () => sendCommand('mist'),
    },
    {
      label: 'Window',
      submenu: [
        {
          label: 'Floating jar',
          type: 'radio',
          checked: displayMode === 'jar',
          click: () => sendCommand('display-jar'),
        },
        {
          label: 'Shelf above the taskbar',
          type: 'radio',
          checked: displayMode === 'shelf',
          click: () => sendCommand('display-shelf'),
        },
      ],
    },
    {
      label: 'Pause / resume growth',
      click: () => sendCommand('toggle-pause'),
    },
    { type: 'separator' },
    {
      label: 'Click-through mode',
      type: 'checkbox',
      checked: Boolean(shellState.ghost),
      click: (item) => setGhost(Boolean(item.checked)),
    },
    {
      label: 'Always on top',
      type: 'checkbox',
      checked: Boolean(shellState.alwaysOnTop),
      click: (item) => {
        setAlwaysOnTop(Boolean(item.checked));
        sendCommand('focus-window');
      },
    },
    {
      label: 'Start with Windows',
      type: 'checkbox',
      checked: Boolean(shellState.launchAtLogin),
      click: (item) => {
        void setLaunchAtLogin(Boolean(item.checked));
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Mosslight',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
}

function showWindow() {
  if (!win || win.isDestroyed()) {
    createWindow();
    win.show();
    return;
  }
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  rebuildTray();
}

function hideWindow() {
  if (!win || win.isDestroyed()) return;
  win.hide();
  rebuildTray();
}

function sendCommand(command) {
  lastCommand = command;
  if (win && !win.isDestroyed()) {
    win.webContents.send('command', command);
  }
}

function setExpanded(value) {
  if (!win || win.isDestroyed()) return;
  const next = Boolean(value);
  if (next === expanded) return;
  expanded = next;
  applyLayout();
  scheduleRememberPosition();
}

function setDisplayMode(mode) {
  if (!win || win.isDestroyed()) return displayMode;
  const next = mode === 'shelf' ? 'shelf' : 'jar';
  if (next === displayMode) {
    applyLayout();
    return displayMode;
  }
  rememberPosition();
  displayMode = next;
  passthrough = displayMode === 'shelf';
  win.setMovable(displayMode === 'jar');
  applyLayout();
  applyMouseMode();
  rebuildTray();
  return displayMode;
}

function setAlwaysOnTop(value) {
  shellState.alwaysOnTop = Boolean(value);
  saveShellSoon();
  if (win && !win.isDestroyed()) {
    win.setAlwaysOnTop(shellState.alwaysOnTop, IS_MAC ? 'floating' : undefined);
  }
  rebuildTray();
  return shellState.alwaysOnTop;
}

function setGhost(value) {
  shellState.ghost = Boolean(value);
  applyMouseMode();
  rebuildTray();
  if (value) {
    notify('Ghost mode is on', 'Use Ctrl+Alt+T or the tray menu to make the jar clickable again.');
  }
  return Boolean(value);
}

function setPassthrough(value) {
  passthrough = Boolean(value);
  applyMouseMode();
}

async function setLaunchAtLogin(value) {
  shellState.launchAtLogin = Boolean(value);
  saveShellSoon();
  try {
    if (IS_WIN || IS_MAC) {
      const settings = { openAtLogin: Boolean(value), openAsHidden: true };
      if (IS_WIN) {
        settings.path = process.execPath;
        settings.args = app.isPackaged ? [] : [app.getAppPath()];
      }
      app.setLoginItemSettings(settings);
    }
  } catch {
    // Some managed machines block login items. The toggle still persists.
  }
  return Boolean(value);
}

function getLaunchAtLogin() {
  try {
    return Boolean(app.getLoginItemSettings().openAtLogin);
  } catch {
    return Boolean(shellState.launchAtLogin);
  }
}

function registerShortcuts() {
  try {
    globalShortcut.register('CommandOrControl+Alt+T', () => {
      setGhost(!shellState.ghost);
    });
    globalShortcut.register('CommandOrControl+Alt+M', () => {
      if (win && !win.isDestroyed() && win.isVisible()) hideWindow();
      else showWindow();
    });
    globalShortcut.register('CommandOrControl+Alt+S', () => {
      sendCommand(displayMode === 'shelf' ? 'display-jar' : 'display-shelf');
    });
  } catch {
    // Shortcuts are optional.
  }
}

function startPresence() {
  lastPoll = Date.now();
  presenceTimer = setInterval(() => {
    if (!win || win.isDestroyed()) return;
    const now = Date.now();
    const elapsed = Math.round((now - lastPoll) / 1000);
    lastPoll = now;
    let idleSeconds = 0;
    try {
      idleSeconds = powerMonitor.getSystemIdleTime();
    } catch {
      idleSeconds = 0;
    }
    const activeSeconds =
      idleSeconds < 60 && elapsed > 0 && elapsed <= 30 ? Math.min(elapsed, 15) : 0;
    win.webContents.send('presence:tick', {
      activeSeconds,
      idleSeconds,
      at: now,
    });
  }, 10_000);

  powerMonitor.on('lock-screen', () => {
    lastPoll = Date.now();
    if (win && !win.isDestroyed()) {
      win.webContents.send('presence:tick', {
        activeSeconds: 0,
        idleSeconds: 999,
        at: Date.now(),
      });
    }
  });
  powerMonitor.on('suspend', () => {
    lastPoll = Date.now();
  });
  powerMonitor.on('resume', () => {
    lastPoll = Date.now();
  });
}

function setupIpc() {
  ipcMain.handle('state:load', async () => {
    try {
      return await fsp.readFile(statePath, 'utf8');
    } catch {
      return null;
    }
  });

  ipcMain.handle('state:save', async (_event, json) => {
    if (typeof json !== 'string' || json.length > 2_500_000) {
      throw new Error('invalid state payload');
    }
    try {
      JSON.parse(json);
    } catch {
      throw new Error('state is not valid JSON');
    }
    const temp = `${statePath}.tmp`;
    await fsp.writeFile(temp, json, 'utf8');
    try {
      await fsp.rename(temp, statePath);
    } catch {
      await fsp.writeFile(statePath, json, 'utf8');
      await fsp.rm(temp, { force: true }).catch(() => {});
    }
  });

  ipcMain.handle('window:set-expanded', (_event, value) => {
    setExpanded(value);
  });

  ipcMain.handle('window:set-display-mode', (_event, mode) => {
    return setDisplayMode(mode);
  });

  ipcMain.handle('window:set-passthrough', (_event, value) => {
    setPassthrough(value);
  });

  ipcMain.handle('window:set-always-on-top', (_event, value) => {
    return setAlwaysOnTop(value);
  });

  ipcMain.handle('window:set-click-through', (_event, value) => {
    return setGhost(value);
  });

  ipcMain.handle('window:set-ghost', (_event, value) => {
    return setGhost(value);
  });

  ipcMain.handle('window:hide', () => {
    hideWindow();
  });

  ipcMain.handle('window:show', () => {
    showWindow();
  });

  ipcMain.handle('app:set-launch-at-login', async (_event, value) => {
    return setLaunchAtLogin(value);
  });

  ipcMain.handle('app:get-launch-at-login', () => {
    return getLaunchAtLogin();
  });

  ipcMain.handle('data:open-folder', async () => {
    await electronShell.openPath(userDataPath);
  });

  ipcMain.handle('app:notify', (_event, title, body) => {
    notify(String(title), String(body));
  });

  ipcMain.handle('app:quit', () => {
    isQuitting = true;
    app.quit();
  });
}

function notify(title, body) {
  try {
    if (Notification.isSupported()) {
      new Notification({
        title,
        body,
        icon: path.join(__dirname, 'assets', 'icon.png'),
        silent: true,
      }).show();
    }
  } catch {
    // Notifications are a nicety, not a requirement.
  }
}

/* ------------------------------------------------------------------ */
/* screenshots for development                                         */
/* ------------------------------------------------------------------ */

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runScreenshots() {
  const outDir = process.env.MOSS_SHOT_DIR || path.join(os.tmpdir(), 'mosslight-shots');
  await fsp.mkdir(outDir, { recursive: true });
  win.showInactive();
  await wait(2800);
  await win.webContents.executeJavaScript(
    "document.body.classList.add('is-web'); void 0;",
  );
  await wait(500);

  const shoot = async (name) => {
    const image = await win.webContents.capturePage();
    await fsp.writeFile(path.join(outDir, name), image.toPNG());
  };

  await shoot('expanded.png');

  await win.webContents.executeJavaScript(
    "document.querySelector('.close-button')?.click(); void 0;",
  );
  await wait(800);
  await shoot('compact.png');

  await win.webContents.executeJavaScript(
    "document.querySelector('.status-pill')?.click(); void 0;",
  );
  await wait(700);
  await win.webContents.executeJavaScript(
    "Array.from(document.querySelectorAll('.tabs button')).find((button) => button.textContent.includes('garden'))?.click(); void 0;",
  );
  await wait(700);
  await shoot('garden.png');

  await win.webContents.executeJavaScript(
    "Array.from(document.querySelectorAll('.tabs button')).find((button) => button.textContent.includes('settings'))?.click(); void 0;",
  );
  await wait(500);
  await shoot('settings.png');

  await win.webContents.executeJavaScript(
    "document.querySelector('[data-display-mode=\"shelf\"]')?.click(); void 0;",
  );
  await wait(900);
  await win.webContents.executeJavaScript(
    "Array.from(document.querySelectorAll('.tabs button')).find((button) => button.textContent.includes('today'))?.click(); void 0;",
  );
  await wait(3800);
  await shoot('shelf-notes.png');

  await win.webContents.executeJavaScript(
    "document.querySelector('.close-button')?.click(); void 0;",
  );
  await wait(900);
  await shoot('shelf.png');

  console.log(`[mosslight] screenshots written to ${outDir}`);
  if (lastCommand) console.log(`[mosslight] last command: ${lastCommand}`);
  isQuitting = true;
  app.quit();
}
