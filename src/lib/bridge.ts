import type {
  AnyBridge,
  DisplayInfo,
  PresenceTick,
  ShellCommand,
  SnapshotMode,
  SnapshotResult,
} from './types';

const STORAGE_KEY = 'mosslight.state.v1';

const presenceListeners = new Set<(tick: PresenceTick) => void>();
const commandListeners = new Set<(command: ShellCommand) => void>();
let simulation: number | null = null;

function ensureSimulation(): void {
  if (simulation !== null) return;
  simulation = window.setInterval(() => {
    const visible = document.visibilityState === 'visible';
    const tick: PresenceTick = {
      activeSeconds: visible ? 10 : 0,
      idleSeconds: visible ? 0 : 10,
      at: Date.now(),
    };
    presenceListeners.forEach((listener) => listener(tick));
  }, 10_000);
}

function stopSimulationIfIdle(): void {
  if (simulation !== null && presenceListeners.size === 0) {
    window.clearInterval(simulation);
    simulation = null;
  }
}

const webBridge: AnyBridge = {
  isDesktop: false,
  platform: 'web',
  version: '0.1.0',
  async loadState() {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  },
  async saveState(json: string) {
    try {
      window.localStorage.setItem(STORAGE_KEY, json);
    } catch {
      // Storage can be unavailable in private windows; the preview still runs.
    }
  },
  async setExpanded() {},
  async setAlwaysOnTop() {},
  async setClickThrough(value: boolean) {
    return value;
  },
  async setLaunchAtLogin(value: boolean) {
    return value;
  },
  async getLaunchAtLogin() {
    return false;
  },
  async hideWindow() {},
  async showWindow() {},
  async getDisplay(): Promise<DisplayInfo> {
    return {
      width: window.screen.width,
      height: window.screen.height,
      scaleFactor: window.devicePixelRatio || 1,
      workArea: { x: 0, y: 0, width: window.screen.availWidth, height: window.screen.availHeight },
    };
  },
  async applySnapshot(dataUrl: string, target): Promise<SnapshotResult> {
    const anchor = document.createElement('a');
    anchor.href = dataUrl;
    anchor.download = `mosslight-${target === 'both' ? 'wallpaper' : target}.png`;
    anchor.click();
    return { ok: true };
  },
  async restoreWallpaper() {
    return { ok: false, error: 'restore is only available in the desktop app' };
  },
  async openDataFolder() {},
  async openLockScreenSettings() {},
  async notify(title: string, body: string) {
    if (!('Notification' in window)) return;
    try {
      if (Notification.permission === 'granted') {
        new Notification(title, { body });
      }
    } catch {
      // Notifications are a bonus, never a requirement.
    }
  },
  onPresence(callback) {
    presenceListeners.add(callback);
    ensureSimulation();
    return () => {
      presenceListeners.delete(callback);
      stopSimulationIfIdle();
    };
  },
  onCommand(callback) {
    commandListeners.add(callback);
    return () => {
      commandListeners.delete(callback);
    };
  },
  async setGhostMode(value: boolean) {
    return value;
  },
  async quit() {},
};

export const bridge: AnyBridge =
  typeof window !== 'undefined' && window.mosslight ? window.mosslight : webBridge;

export const isDesktop = bridge.isDesktop;

export function snapshotLabel(mode: SnapshotMode): string {
  switch (mode) {
    case 'desktop':
      return 'desktop wallpaper';
    case 'lock':
      return 'lock screen';
    case 'both':
      return 'wallpaper + lock screen';
    default:
      return 'off';
  }
}
