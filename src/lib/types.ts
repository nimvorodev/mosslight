export type SpeciesId =
  | 'fern'
  | 'mushroom'
  | 'flower'
  | 'succulent'
  | 'vine'
  | 'crystal';

export type CreatureId = 'snail' | 'ladybug' | 'firefly' | 'frog';

/** How Mosslight lives on the desktop: a floating jar or a full-width shelf. */
export type DisplayMode = 'jar' | 'shelf';

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
  display: DisplayMode;
  alwaysOnTop: boolean;
  launchAtLogin: boolean;
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
  | 'display-jar'
  | 'display-shelf'
  | 'toggle-pause'
  | 'welcome'
  | 'focus-window';

export interface MosslightBridge {
  isDesktop: true;
  platform: string;
  version: string;
  loadState: () => Promise<string | null>;
  saveState: (json: string) => Promise<void>;
  setExpanded: (expanded: boolean) => Promise<void>;
  setDisplayMode: (mode: DisplayMode) => Promise<void>;
  setPassthrough: (value: boolean) => Promise<void>;
  setAlwaysOnTop: (value: boolean) => Promise<void>;
  setClickThrough: (value: boolean) => Promise<boolean>;
  setLaunchAtLogin: (value: boolean) => Promise<boolean>;
  getLaunchAtLogin: () => Promise<boolean>;
  hideWindow: () => Promise<void>;
  showWindow: () => Promise<void>;
  openDataFolder: () => Promise<void>;
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
  setDisplayMode: (mode: DisplayMode) => Promise<void>;
  setPassthrough: (value: boolean) => Promise<void>;
  setAlwaysOnTop: (value: boolean) => Promise<void>;
  setClickThrough: (value: boolean) => Promise<boolean>;
  setLaunchAtLogin: (value: boolean) => Promise<boolean>;
  getLaunchAtLogin: () => Promise<boolean>;
  hideWindow: () => Promise<void>;
  showWindow: () => Promise<void>;
  openDataFolder: () => Promise<void>;
  notify: (title: string, body: string) => Promise<void>;
  onPresence: (callback: (tick: PresenceTick) => void) => () => void;
  onCommand: (callback: (command: ShellCommand) => void) => () => void;
  setGhostMode: (value: boolean) => Promise<boolean>;
  quit: () => Promise<void>;
}

export type AnyBridge = MosslightBridge | WebBridge;
