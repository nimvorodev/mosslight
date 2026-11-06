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
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

const APP_NAME = 'Mosslight';
const COMPACT_W = 400;
const COMPACT_H = 390;
const EXPANDED_W = 800;
const EXPANDED_H = 390;
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
  previousWallpaper: null,
};

let userDataPath = '';
let statePath = '';
let shellPath = '';
let wallpapersPath = '';

function main() {
  process.env.MOSS_VERSION = app.getVersion();

  app.on('second-instance', () => {
    showWindow();
  });

  app.whenReady().then(async () => {
    userDataPath = app.getPath('userData');
    statePath = path.join(userDataPath, 'terrarium.json');
    shellPath = path.join(userDataPath, 'window.json');
    wallpapersPath = path.join(userDataPath, 'portraits');
    await fsp.mkdir(userDataPath, { recursive: true });
    await fsp.mkdir(wallpapersPath, { recursive: true });

    if (IS_SHOT) {
      await fsp.rm(statePath, { force: true }).catch(() => {});
      await fsp.rm(shellPath, { force: true }).catch(() => {});
    }

    loadShell();
    setupIpc();
    createWindow();
    createTray();
    registerShortcuts();
    startPresence();

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
  win = new BrowserWindow({
    x: home.x,
    y: home.y,
    width: COMPACT_W,
    height: COMPACT_H,
    minWidth: COMPACT_W,
    minHeight: COMPACT_H,
    maxWidth: EXPANDED_W,
    maxHeight: EXPANDED_H,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: true,
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
    : work.x + work.width - COMPACT_W - 26;
  let y = Number.isFinite(shellState.y)
    ? shellState.y
    : work.y + work.height - COMPACT_H - 26;

  const display = screen.getDisplayNearestPoint({
    x: Math.round(x + COMPACT_W / 2),
    y: Math.round(y + COMPACT_H / 2),
  });
  const wa = display.workArea;
  x = Math.min(Math.max(x, wa.x - COMPACT_W + 90), wa.x + wa.width - 90);
  y = Math.min(Math.max(y, wa.y), wa.y + wa.height - 50);
  return { x: Math.round(x), y: Math.round(y) };
}

function scheduleRememberPosition() {
  if (boundsTimer) clearTimeout(boundsTimer);
  boundsTimer = setTimeout(() => {
    boundsTimer = null;
    rememberPosition();
  }, 260);
}

function rememberPosition() {
  if (!win || win.isDestroyed()) return;
  const bounds = win.getBounds();
  const homeX = expanded ? bounds.x + bounds.width - COMPACT_W : bounds.x;
  const homeY = expanded ? bounds.y + bounds.height - COMPACT_H : bounds.y;
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
      label: 'Mist the jar',
      click: () => sendCommand('mist'),
    },
    {
      label: 'Portrait',
      submenu: [
        { label: 'Set desktop wallpaper', click: () => sendCommand('snapshot-desktop') },
        { label: 'Set lock screen image', click: () => sendCommand('snapshot-lock') },
        { label: 'Update both', click: () => sendCommand('snapshot-both') },
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
  const current = win.getBounds();
  const display = screen.getDisplayMatching(current);
  const work = display.workArea;
  const width = next ? EXPANDED_W : COMPACT_W;
  const height = COMPACT_H;
  const right = current.x + current.width;
  const bottom = current.y + current.height;
  let x = Math.round(right - width);
  let y = Math.round(bottom - height);
  x = Math.min(Math.max(x, work.x + 4), work.x + work.width - width - 4);
  y = Math.min(Math.max(y, work.y + 4), work.y + work.height - height - 4);
  expanded = next;
  win.setBounds({ x, y, width, height }, false);
  scheduleRememberPosition();
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
  if (win && !win.isDestroyed()) {
    if (IS_WIN || IS_MAC) {
      win.setIgnoreMouseEvents(Boolean(value), { forward: true });
    } else {
      win.setIgnoreMouseEvents(Boolean(value));
    }
  }
  rebuildTray();
  if (value) {
    notify('Ghost mode is on', 'Use Ctrl+Alt+T or the tray menu to make the jar clickable again.');
  }
  return Boolean(value);
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

  ipcMain.handle('display:get', () => {
    const display = screen.getPrimaryDisplay();
    return {
      width: display.size.width,
      height: display.size.height,
      scaleFactor: display.scaleFactor,
      workArea: display.workArea,
    };
  });

  ipcMain.handle('app:set-launch-at-login', async (_event, value) => {
    return setLaunchAtLogin(value);
  });

  ipcMain.handle('app:get-launch-at-login', () => {
    return getLaunchAtLogin();
  });

  ipcMain.handle('snapshot:apply', async (_event, dataUrl, target) => {
    try {
      return await applySnapshot(dataUrl, target);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('snapshot:restore', async () => {
    try {
      return await restoreWallpaper();
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('data:open-folder', async () => {
    await electronShell.openPath(userDataPath);
  });

  ipcMain.handle('system:open-lock-settings', async () => {
    if (IS_WIN) {
      await electronShell.openExternal('ms-settings:lockscreen').catch(() => {});
    }
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
/* portraits, wallpapers and the lock screen                           */
/* ------------------------------------------------------------------ */

function decodePng(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) {
    throw new Error('snapshot is not a PNG');
  }
  const buffer = Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64');
  if (buffer.length < 200) throw new Error('snapshot is empty');
  if (buffer.length > 80 * 1024 * 1024) throw new Error('snapshot is too large');
  return buffer;
}

async function applySnapshot(dataUrl, target) {
  const mode = target === 'desktop' || target === 'lock' || target === 'both' ? target : 'desktop';
  const buffer = decodePng(dataUrl);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(wallpapersPath, `mosslight-${stamp}.png`);
  await fsp.writeFile(file, buffer);
  void prunePortraits(file);

  if (mode === 'desktop' || mode === 'both') {
    await backupWallpaper();
  }

  let desktopOk = true;
  let lockOk = true;
  let lockPath;
  const errors = [];

  if (mode === 'desktop' || mode === 'both') {
    try {
      await setDesktopWallpaper(file);
    } catch (error) {
      desktopOk = false;
      errors.push(`desktop: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (mode === 'lock' || mode === 'both') {
    try {
      lockPath = await setLockScreen(file);
    } catch (error) {
      lockOk = false;
      errors.push(`lock screen: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const needsManualLockScreen = (mode === 'lock' || mode === 'both') && !lockOk;
  const ok = mode === 'both' ? desktopOk : mode === 'desktop' ? desktopOk : lockOk;
  return {
    ok,
    path: file,
    lockPath,
    needsManualLockScreen,
    error: ok ? undefined : errors.join(' · '),
  };
}

async function prunePortraits(keepFile) {
  try {
    const entries = await fsp.readdir(wallpapersPath, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.png')) continue;
      const full = path.join(wallpapersPath, entry.name);
      if (full === keepFile) continue;
      const stat = await fsp.stat(full);
      files.push({ full, time: stat.mtimeMs });
    }
    files.sort((a, b) => b.time - a.time);
    for (const file of files.slice(5)) {
      await fsp.rm(file.full, { force: true }).catch(() => {});
    }
  } catch {
    // cleaning is best-effort
  }
}

async function backupWallpaper() {
  if (shellState.previousWallpaper) return;
  if (!IS_WIN) return;
  const current = await readWindowsWallpaper();
  if (!current) return;
  try {
    const exists = await fsp.stat(current);
    if (!exists.isFile()) return;
    const ext = path.extname(current) || '.png';
    const backup = path.join(wallpapersPath, `original-wallpaper${ext}`);
    await fsp.copyFile(current, backup);
    shellState.previousWallpaper = backup;
    saveShellSoon();
  } catch {
    // If the current wallpaper is a virtual/spotlight file, there is nothing safe to copy.
  }
}

async function readWindowsWallpaper() {
  if (!IS_WIN) return null;
  try {
    const { stdout } = await execFileAsync(
      'reg',
      ['query', 'HKCU\\Control Panel\\Desktop', '/v', 'WallPaper'],
      { windowsHide: true, timeout: 10_000 },
    );
    const match = stdout.match(/WallPaper\s+REG_(?:SZ|EXPAND_SZ)\s+(.+?)\s*$/m);
    const value = match ? match[1].trim() : '';
    if (!value) return null;
    if (value.toLowerCase().includes('transcodedwallpaper')) {
      return value;
    }
    return value;
  } catch {
    return null;
  }
}

async function runPowerShell(script, args) {
  const scriptPath = path.join(
    os.tmpdir(),
    `mosslight-${Date.now()}-${Math.random().toString(36).slice(2)}.ps1`,
  );
  await fsp.writeFile(scriptPath, script, 'utf8');
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        scriptPath,
        ...args,
      ],
      { windowsHide: true, timeout: 45_000, maxBuffer: 1024 * 1024 },
    );
    return stdout;
  } finally {
    await fsp.rm(scriptPath, { force: true }).catch(() => {});
  }
}

const PS_SET_WALLPAPER = String.raw`
param([string]$ImagePath)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;
public static class MosslightWallpaper {
  [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
  public static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);
}
"@
$result = [MosslightWallpaper]::SystemParametersInfo(20, 0, $ImagePath, 3)
if ($result -eq 0) { throw "Windows refused the wallpaper change." }
Write-Output 'OK'
`;

const PS_SET_LOCK_SCREEN = String.raw`
param([string]$ImagePath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -like 'IAsyncOperation*' })[0]
function Await($WinRtTask, $ResultType) {
  $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
  $netTask = $asTask.Invoke($null, @($WinRtTask))
  $netTask.Wait(-1) | Out-Null
  $netTask.Result
}
$asTaskAction = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction' })[0]
function AwaitAction($WinRtAction) {
  $netTask = $asTaskAction.Invoke($null, @($WinRtAction))
  $netTask.Wait(-1) | Out-Null
}
[Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime] | Out-Null
[Windows.System.UserProfile.LockScreen,Windows.System.UserProfile,ContentType=WindowsRuntime] | Out-Null
$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($ImagePath)) ([Windows.Storage.StorageFile])
AwaitAction ([Windows.System.UserProfile.LockScreen]::SetImageFileAsync($file))
Write-Output 'OK'
`;

async function setDesktopWallpaper(file) {
  if (IS_WIN) {
    await runPowerShell(PS_SET_WALLPAPER, ['-ImagePath', file]);
    return;
  }
  if (IS_MAC) {
    await execFileAsync(
      'osascript',
      ['-e', `tell application "System Events" to set picture of every desktop to POSIX file "${file.replace(/"/g, '\\"')}"`],
      { timeout: 20_000 },
    );
    return;
  }
  const uri = `file://${file}`;
  try {
    await execFileAsync('gsettings', ['set', 'org.gnome.desktop.background', 'picture-uri', uri]);
    await execFileAsync('gsettings', ['set', 'org.gnome.desktop.background', 'picture-uri-dark', uri]);
  } catch {
    throw new Error('setting the wallpaper on this desktop is not supported yet');
  }
}

async function setLockScreen(file) {
  if (IS_WIN) {
    // Windows only lets an app nominate the lock screen picture; it may still
    // ask the user to confirm. Keep a friendly, findable copy either way.
    const folder = path.join(app.getPath('pictures'), 'Mosslight');
    const target = path.join(folder, 'lock-screen.png');
    await fsp.mkdir(folder, { recursive: true });
    await fsp.copyFile(file, target);
    await runPowerShell(PS_SET_LOCK_SCREEN, ['-ImagePath', target]);
    return target;
  }
  throw new Error('setting the lock screen is only implemented on Windows');
}

async function restoreWallpaper() {
  if (!shellState.previousWallpaper) {
    return { ok: false, error: 'there is no saved wallpaper to restore' };
  }
  try {
    await setDesktopWallpaper(shellState.previousWallpaper);
    shellState.previousWallpaper = null;
    saveShellSoon();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
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
  win.setBounds({ x: 40, y: 40, width: EXPANDED_W, height: EXPANDED_H });
  win.showInactive();
  await wait(2800);
  await win.webContents.executeJavaScript(
    "document.body.classList.add('is-web'); void 0;",
  );
  await wait(500);
  const expandedShot = await win.webContents.capturePage();
  await fsp.writeFile(path.join(outDir, 'expanded.png'), expandedShot.toPNG());

  await win.webContents.executeJavaScript(
    "document.querySelector('.close-button')?.click(); void 0;",
  );
  win.setBounds({ x: 40, y: 40, width: COMPACT_W, height: COMPACT_H });
  await wait(800);
  const compactShot = await win.webContents.capturePage();
  await fsp.writeFile(path.join(outDir, 'compact.png'), compactShot.toPNG());

  await win.webContents.executeJavaScript(
    "document.querySelector('.status-pill')?.click(); void 0;",
  );
  win.setBounds({ x: 40, y: 40, width: EXPANDED_W, height: EXPANDED_H });
  await wait(700);
  await win.webContents.executeJavaScript(
    "Array.from(document.querySelectorAll('.tabs button')).find((button) => button.textContent.includes('garden'))?.click(); void 0;",
  );
  await wait(700);
  const gardenShot = await win.webContents.capturePage();
  await fsp.writeFile(path.join(outDir, 'garden.png'), gardenShot.toPNG());

  await win.webContents.executeJavaScript(
    "Array.from(document.querySelectorAll('.tabs button')).find((button) => button.textContent.includes('settings'))?.click(); void 0;",
  );
  await wait(500);
  const settingsShot = await win.webContents.capturePage();
  await fsp.writeFile(path.join(outDir, 'settings.png'), settingsShot.toPNG());

  await wait(300);
  const portrait = await win.webContents.executeJavaScript(
    "window.__mosslightPortrait ? window.__mosslightPortrait(1920, 1080) : null",
  );
  if (typeof portrait === 'string' && portrait.startsWith('data:image/png;base64,')) {
    await fsp.writeFile(
      path.join(outDir, 'portrait.png'),
      Buffer.from(portrait.slice('data:image/png;base64,'.length), 'base64'),
    );
  }

  console.log(`[mosslight] screenshots written to ${outDir}`);
  if (lastCommand) console.log(`[mosslight] last command: ${lastCommand}`);
  isQuitting = true;
  app.quit();
}
