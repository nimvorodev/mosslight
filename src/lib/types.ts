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

export interface PlantParent {
  species: SpeciesId;
  plantedAt: number;
}

export interface Plant {
  id: string;
  species: SpeciesId;
  slot: number;
  /** 0 = seed, 1 = fully grown */
  growth: number;
  plantedAt: number;
  seed: number;
  /** Set when this plant was grown from a cutting rather than a spore. */
  parent?: PlantParent;
}

/** A finished task, remembered as a star in the night sky. */
export interface TaskStar {
  id: string;
  taskId: string;
  text: string;
  at: number;
  /** 0..1 across the visible sky. */
  x: number;
  /** 0..1 down the visible sky. */
  y: number;
  size: number;
  /** 0..3, picks a star tint. */
  color: number;
}

export interface FocusSession {
  startedAt: number;
  endsAt: number;
  minutes: number;
}

/** A portable .moss cutting. Everything here is local and plain JSON. */
export interface CuttingFile {
  kind: 'mosslight-cutting';
  version: 1;
  species: SpeciesId;
  growth: number;
  seed: number;
  plantedAt: number;
  takenAt: number;
  parent?: PlantParent;
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
  /** Finished tasks, kept as a slow-fading constellation. */
  stars: TaskStar[];
  /** Quiet milliseconds collected while the jar is alone. */
  restMs: number;
  focus: FocusSession | null;
  lastFocusDoneAt: number;
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
  exportCutting: (json: string, suggestedName: string) => Promise<boolean>;
  importCutting: () => Promise<string | null>;
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
  exportCutting: (json: string, suggestedName: string) => Promise<boolean>;
  importCutting: () => Promise<string | null>;
  quit: () => Promise<void>;
}

export type AnyBridge = MosslightBridge | WebBridge;
