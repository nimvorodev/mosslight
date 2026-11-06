import type { AnyBridge, PresenceTick, ShellCommand } from './types';

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
  async setDisplayMode() {},
  async setPassthrough() {},
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
  async openDataFolder() {},
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
  async exportCutting(json: string, suggestedName: string) {
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = suggestedName || 'mosslight-cutting.moss';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      return true;
    } catch {
      return false;
    }
  },
  importCutting() {
    return new Promise<string | null>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.moss,application/json';
      input.style.display = 'none';
      const finish = (value: string | null) => {
        input.remove();
        resolve(value);
      };
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (!file) {
          finish(null);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => finish(typeof reader.result === 'string' ? reader.result : null);
        reader.onerror = () => finish(null);
        reader.readAsText(file);
      });
      input.addEventListener('cancel', () => finish(null));
      document.body.appendChild(input);
      input.click();
    });
  },
  async quit() {},
};

export const bridge: AnyBridge =
  typeof window !== 'undefined' && window.mosslight ? window.mosslight : webBridge;

export const isDesktop = bridge.isDesktop;
