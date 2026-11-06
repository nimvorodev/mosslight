export type SpeciesId =
  | 'fern'
  | 'mushroom'
  | 'flower'
  | 'succulent'
  | 'vine'
  | 'crystal';

export type CreatureId = 'snail' | 'ladybug' | 'firefly' | 'frog';

export type SnapshotMode = 'off' | 'desktop' | 'lock' | 'both';

export interface Plant {
  id: string;
  species: SpeciesId;
  slot: number;
  /** 0 = seed, 1 = fully grown */
  growth: number;
  plantedAt: number;
  seed: number;
}

export interface Creature {
  id: string;
  species: CreatureId;
  seed: number;
  arrivedAt: number;
}

export interface Task {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
  doneAt?: number;
}

export interface Settings {
  alwaysOnTop: boolean;
  launchAtLogin: boolean;
  snapshots: SnapshotMode;
  snapshotMinutes: number;
  lastSnapshotAt: number;
  paused: boolean;
  reducedMotion: boolean;
  atmosphere: boolean;
}

export interface TerrariumState {
  version: 1;
  createdAt: number;
  updatedAt: number;
  lastSeenAt: number;
  dayKey: string;
  lastTaskDay: string | null;
  streak: number;
  bestStreak: number;
  focusMsToday: number;
  focusMsTotal: number;
  sunMsToday: number;
  tasksDoneToday: number;
  tasksDoneTotal: number;
  dew: number;
  spores: number;
  tasks: Task[];
  plants: Plant[];
  creatures: Creature[];
  lastBreakAt: number;
  onboardingDone: boolean;
  seenUnlocks: SpeciesId[];
  settings: Settings;
}

export interface SpeciesDef {
  id: SpeciesId;
  name: string;
  cost: number;
  minutesToMature: number;
  blurb: string;
  unlock: UnlockRule;
}

export type UnlockRule =
  | { kind: 'always' }
  | { kind: 'tasks'; value: number }
  | { kind: 'streak'; value: number }
  | { kind: 'focusHours'; value: number };

export interface CreatureDef {
  id: CreatureId;
  name: string;
  harmony: number;
  blurb: string;
}

export interface PresenceTick {
  activeSeconds: number;
  idleSeconds: number;
  at: number;
}

export type ShellCommand =
  | 'open-tasks'
  | 'toggle-tasks'
  | 'mist'
  | 'snapshot-desktop'
  | 'snapshot-lock'
  | 'snapshot-both'
  | 'toggle-pause'
  | 'welcome'
  | 'focus-window';

export interface SnapshotResult {
  ok: boolean;
  error?: string;
  path?: string;
  lockPath?: string;
  needsManualLockScreen?: boolean;
}

export interface DisplayInfo {
  width: number;
  height: number;
  scaleFactor: number;
  workArea: { x: number; y: number; width: number; height: number };
}

export interface MosslightBridge {
  isDesktop: true;
  platform: string;
  version: string;
  loadState: () => Promise<string | null>;
  saveState: (json: string) => Promise<void>;
  setExpanded: (expanded: boolean) => Promise<void>;
  setAlwaysOnTop: (value: boolean) => Promise<void>;
  setClickThrough: (value: boolean) => Promise<boolean>;
  setLaunchAtLogin: (value: boolean) => Promise<boolean>;
  getLaunchAtLogin: () => Promise<boolean>;
  hideWindow: () => Promise<void>;
  showWindow: () => Promise<void>;
  getDisplay: () => Promise<DisplayInfo>;
  applySnapshot: (
    dataUrl: string,
    target: 'desktop' | 'lock' | 'both',
  ) => Promise<SnapshotResult>;
  restoreWallpaper: () => Promise<SnapshotResult>;
  openDataFolder: () => Promise<void>;
  openLockScreenSettings: () => Promise<void>;
  notify: (title: string, body: string) => Promise<void>;
  onPresence: (callback: (tick: PresenceTick) => void) => () => void;
  onCommand: (callback: (command: ShellCommand) => void) => () => void;
  setGhostMode: (value: boolean) => Promise<boolean>;
  quit: () => Promise<void>;
}

export interface WebBridge {
  isDesktop: false;
  platform: string;
  version: string;
  loadState: () => Promise<string | null>;
  saveState: (json: string) => Promise<void>;
  setExpanded: (expanded: boolean) => Promise<void>;
  setAlwaysOnTop: (value: boolean) => Promise<void>;
  setClickThrough: (value: boolean) => Promise<boolean>;
  setLaunchAtLogin: (value: boolean) => Promise<boolean>;
  getLaunchAtLogin: () => Promise<boolean>;
  hideWindow: () => Promise<void>;
  showWindow: () => Promise<void>;
  getDisplay: () => Promise<DisplayInfo>;
  applySnapshot: (
    dataUrl: string,
    target: 'desktop' | 'lock' | 'both',
  ) => Promise<SnapshotResult>;
  restoreWallpaper: () => Promise<SnapshotResult>;
  openDataFolder: () => Promise<void>;
  openLockScreenSettings: () => Promise<void>;
  notify: (title: string, body: string) => Promise<void>;
  onPresence: (callback: (tick: PresenceTick) => void) => () => void;
  onCommand: (callback: (command: ShellCommand) => void) => () => void;
  setGhostMode: (value: boolean) => Promise<boolean>;
  quit: () => Promise<void>;
}

export type AnyBridge = MosslightBridge | WebBridge;
