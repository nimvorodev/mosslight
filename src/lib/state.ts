import { PLANT_SLOTS } from './layout';
import {
  CREATURES,
  CREATURE_ORDER,
  SPECIES,
  SPECIES_ORDER,
  creatureIsUnlocked,
  harmony,
  isSpeciesUnlocked,
} from './species';
import { makeStar } from './constellations';
import type {
  Creature,
  CreatureId,
  CuttingFile,
  FocusSession,
  Plant,
  PlantParent,
  Settings,
  SpeciesId,
  Task,
  TaskStar,
  TerrariumState,
} from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

export const SUN_CAP_MS = 6 * 60 * 60 * 1000;
export const MIST_COST = 2;
export const MIST_GROWTH = 0.045;
export const TASK_DEW = 4;
export const TASK_SPORES = 1;
export const TASK_GROWTH = 0.015;
export const BREAK_DEW = 2;
export const MAX_TASKS = 30;
export const MAX_PLANTS = PLANT_SLOTS.length;
export const MAX_STARS = 60;
export const STAR_RETENTION_MS = 45 * DAY_MS;
export const REST_MOSS_FULL_MS = 24 * 60 * 60 * 1000;
export const OFFLINE_REST_CAP_MS = 8 * 60 * 60 * 1000;
export const CUTTING_MIN_GROWTH = 0.6;
export const CUTTING_TRIM = 0.04;
export const FOCUS_MIN_MINUTES = 5;
export const FOCUS_MAX_MINUTES = 120;
export const FOCUS_DEFAULT_MINUTES = 25;

export const DEFAULT_SETTINGS: Settings = {
  display: 'jar',
  alwaysOnTop: true,
  launchAtLogin: false,
  paused: false,
  reducedMotion: false,
  atmosphere: true,
};

const pad = (value: number) => String(value).padStart(2, '0');

export function localDayKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dayKeyOffset(timestamp: number, days: number): string {
  const date = new Date(timestamp);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function makeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2_000_000_000);
}

export function makeInitialState(now = Date.now()): TerrariumState {
  const plants: Plant[] = [
    {
      id: makeId('pl'),
      species: 'fern',
      slot: 4,
      growth: 0.84,
      plantedAt: now - 2 * 24 * 3_600_000,
      seed: 17_311,
    },
    {
      id: makeId('pl'),
      species: 'mushroom',
      slot: 5,
      growth: 0.52,
      plantedAt: now - 3 * 24 * 3_600_000,
      seed: 58_927,
    },
    {
      id: makeId('pl'),
      species: 'succulent',
      slot: 2,
      growth: 0.46,
      plantedAt: now - 4 * 24 * 3_600_000,
      seed: 44_412,
    },
    {
      id: makeId('pl'),
      species: 'fern',
      slot: 0,
      growth: 0.34,
      plantedAt: now - 2 * 24 * 3_600_000,
      seed: 27_119,
    },
  ];
  const creatures: Creature[] = [
    {
      id: makeId('cr'),
      species: 'snail',
      seed: 4_211,
      arrivedAt: now - 24 * 3_600_000,
    },
  ];

  return {
    version: 1,
    createdAt: now,
    updatedAt: now,
    lastSeenAt: now,
    dayKey: localDayKey(now),
    lastTaskDay: null,
    streak: 0,
    bestStreak: 0,
    focusMsToday: 0,
    focusMsTotal: 0,
    sunMsToday: 0,
    tasksDoneToday: 0,
    tasksDoneTotal: 0,
    dew: 4,
    spores: 2,
    tasks: [],
    plants,
    creatures,
    stars: [],
    restMs: 0,
    focus: null,
    lastFocusDoneAt: 0,
    lastBreakAt: 0,
    onboardingDone: false,
    seenUnlocks: ['fern', 'mushroom'],
    settings: { ...DEFAULT_SETTINGS },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isSpecies(value: unknown): value is SpeciesId {
  return typeof value === 'string' && value in SPECIES;
}

function isCreature(value: unknown): value is CreatureId {
  return typeof value === 'string' && value in CREATURES;
}

function boolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Saved settings can outlive a version of the app, so never trust their shape. */
function sanitizeSettings(input: unknown): Settings {
  const raw = input && typeof input === 'object' ? (input as Partial<Settings>) : {};
  return {
    display: raw.display === 'shelf' ? 'shelf' : 'jar',
    alwaysOnTop: boolean(raw.alwaysOnTop, DEFAULT_SETTINGS.alwaysOnTop),
    launchAtLogin: boolean(raw.launchAtLogin, DEFAULT_SETTINGS.launchAtLogin),
    paused: boolean(raw.paused, DEFAULT_SETTINGS.paused),
    reducedMotion: boolean(raw.reducedMotion, DEFAULT_SETTINGS.reducedMotion),
    atmosphere: boolean(raw.atmosphere, DEFAULT_SETTINGS.atmosphere),
  };
}

function sanitizeParent(input: unknown): PlantParent | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const raw = input as Partial<PlantParent>;
  if (!isSpecies(raw.species)) return undefined;
  return {
    species: raw.species,
    plantedAt: finite(raw.plantedAt, Date.now()),
  };
}

function sanitizePlants(input: unknown): Plant[] {
  if (!Array.isArray(input)) return [];
  const usedSlots = new Set<number>();
  const usedIds = new Set<string>();
  const plants: Plant[] = [];
  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Partial<Plant>;
    if (!isSpecies(raw.species)) continue;
    const slot = Math.round(finite(raw.slot, -1));
    if (slot < 0 || slot >= PLANT_SLOTS.length || usedSlots.has(slot)) continue;
    usedSlots.add(slot);
    let id = typeof raw.id === 'string' ? raw.id : makeId('pl');
    if (!id || usedIds.has(id)) id = makeId('pl');
    usedIds.add(id);
    const parent = sanitizeParent(raw.parent);
    plants.push({
      id,
      species: raw.species,
      slot,
      growth: clamp(finite(raw.growth, 0.1), 0, 1),
      plantedAt: finite(raw.plantedAt, Date.now()),
      seed: Math.floor(finite(raw.seed, randomSeed())),
      ...(parent ? { parent } : {}),
    });
  }
  return plants.slice(0, MAX_PLANTS);
}

function sanitizeCreatures(input: unknown): Creature[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<CreatureId>();
  const creatures: Creature[] = [];
  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Partial<Creature>;
    if (!isCreature(raw.species) || seen.has(raw.species)) continue;
    seen.add(raw.species);
    creatures.push({
      id: typeof raw.id === 'string' ? raw.id : makeId('cr'),
      species: raw.species,
      seed: Math.floor(finite(raw.seed, randomSeed())),
      arrivedAt: finite(raw.arrivedAt, Date.now()),
    });
  }
  return creatures;
}

function sanitizeTasks(input: unknown): Task[] {
  if (!Array.isArray(input)) return [];
  const tasks: Task[] = [];
  const usedIds = new Set<string>();
  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Partial<Task>;
    const text = typeof raw.text === 'string' ? raw.text.trim().slice(0, 140) : '';
    if (!text) continue;
    let id = typeof raw.id === 'string' ? raw.id : makeId('tk');
    if (!id || usedIds.has(id)) id = makeId('tk');
    usedIds.add(id);
    tasks.push({
      id,
      text,
      done: Boolean(raw.done),
      createdAt: finite(raw.createdAt, Date.now()),
      doneAt: typeof raw.doneAt === 'number' ? raw.doneAt : undefined,
    });
  }
  return tasks.slice(-MAX_TASKS);
}

/** Keep the sky recent and finite; old stars are allowed to fade. */
export function pruneStars(stars: TaskStar[], now = Date.now()): TaskStar[] {
  return stars
    .filter((star) => Number.isFinite(star.at) && now - star.at <= STAR_RETENTION_MS)
    .sort((a, b) => a.at - b.at)
    .slice(-MAX_STARS);
}

function sanitizeStars(input: unknown, now: number): TaskStar[] {
  if (!Array.isArray(input)) return [];
  const stars: TaskStar[] = [];
  const usedIds = new Set<string>();
  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Partial<TaskStar>;
    const text = typeof raw.text === 'string' ? raw.text.trim().slice(0, 140) : '';
    if (!text) continue;
    const taskId = typeof raw.taskId === 'string' ? raw.taskId : makeId('tk');
    let id = typeof raw.id === 'string' ? raw.id : `st_${taskId}`;
    if (!id || usedIds.has(id)) id = makeId('st');
    usedIds.add(id);
    stars.push({
      id,
      taskId,
      text,
      at: finite(raw.at, now),
      x: clamp(finite(raw.x, 0.5), 0.04, 0.96),
      y: clamp(finite(raw.y, 0.3), 0.04, 0.94),
      size: clamp(Math.round(finite(raw.size, 1)), 1, 2),
      color: clamp(Math.round(finite(raw.color, 0)), 0, 3),
    });
  }
  return pruneStars(stars, now);
}

function sanitizeFocus(input: unknown, now: number): FocusSession | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Partial<FocusSession>;
  const minutes = clamp(
    Math.round(finite(raw.minutes, FOCUS_DEFAULT_MINUTES)),
    FOCUS_MIN_MINUTES,
    FOCUS_MAX_MINUTES,
  );
  const startedAt = Math.min(now, finite(raw.startedAt, now - 60_000));
  const proposedEnd = finite(raw.endsAt, startedAt + minutes * 60_000);
  const endsAt = Math.min(proposedEnd, startedAt + FOCUS_MAX_MINUTES * 60_000);
  if (endsAt <= now) return null;
  return { startedAt, endsAt, minutes };
}

export function normalizeState(input: unknown, now = Date.now()): TerrariumState {
  if (!input || typeof input !== 'object') return makeInitialState(now);
  const raw = input as Partial<TerrariumState>;
  if (raw.version !== 1) return makeInitialState(now);

  const settings = sanitizeSettings(raw.settings);

  const state: TerrariumState = {
    version: 1,
    createdAt: finite(raw.createdAt, now),
    updatedAt: finite(raw.updatedAt, now),
    lastSeenAt: finite(raw.lastSeenAt, now),
    dayKey: typeof raw.dayKey === 'string' ? raw.dayKey : localDayKey(now),
    lastTaskDay: typeof raw.lastTaskDay === 'string' ? raw.lastTaskDay : null,
    streak: Math.max(0, Math.floor(finite(raw.streak, 0))),
    bestStreak: Math.max(0, Math.floor(finite(raw.bestStreak, 0))),
    focusMsToday: Math.max(0, finite(raw.focusMsToday, 0)),
    focusMsTotal: Math.max(0, finite(raw.focusMsTotal, 0)),
    sunMsToday: Math.max(0, finite(raw.sunMsToday, 0)),
    tasksDoneToday: Math.max(0, Math.floor(finite(raw.tasksDoneToday, 0))),
    tasksDoneTotal: Math.max(0, Math.floor(finite(raw.tasksDoneTotal, 0))),
    dew: Math.max(0, Math.floor(finite(raw.dew, 0))),
    spores: Math.max(0, Math.floor(finite(raw.spores, 0))),
    tasks: sanitizeTasks(raw.tasks),
    plants: sanitizePlants(raw.plants),
    creatures: sanitizeCreatures(raw.creatures),
    stars: sanitizeStars(raw.stars, now),
    restMs: clamp(finite(raw.restMs, 0), 0, REST_MOSS_FULL_MS),
    focus: sanitizeFocus(raw.focus, now),
    lastFocusDoneAt: Math.max(0, finite(raw.lastFocusDoneAt, 0)),
    lastBreakAt: Math.max(0, finite(raw.lastBreakAt, 0)),
    onboardingDone: Boolean(raw.onboardingDone),
    seenUnlocks: Array.isArray(raw.seenUnlocks)
      ? Array.from(new Set(raw.seenUnlocks.filter(isSpecies)))
      : ['fern', 'mushroom'],
    settings,
  };

  if (state.plants.length === 0) {
    state.plants = makeInitialState(now).plants;
  }

  return normalizeDay(state, now);
}

export function normalizeDay(state: TerrariumState, now = Date.now()): TerrariumState {
  const key = localDayKey(now);
  if (key === state.dayKey) return state;

  const yesterday = dayKeyOffset(now, -1);
  const streak =
    state.lastTaskDay === key || state.lastTaskDay === yesterday ? state.streak : 0;

  return {
    ...state,
    dayKey: key,
    streak,
    focusMsToday: 0,
    sunMsToday: 0,
    tasksDoneToday: 0,
    tasks: state.tasks.filter((task) => !task.done),
    updatedAt: now,
  };
}

export function addTask(
  state: TerrariumState,
  text: string,
  now = Date.now(),
): { state: TerrariumState; error?: string } {
  const trimmed = text.trim().slice(0, 140);
  if (!trimmed) return { state, error: 'write a small thing first' };
  const open = state.tasks.filter((task) => !task.done).length;
  if (open >= MAX_TASKS) {
    return { state, error: 'that is enough for today' };
  }
  const task: Task = {
    id: makeId('tk'),
    text: trimmed,
    done: false,
    createdAt: now,
  };
  return {
    state: {
      ...state,
      tasks: [...state.tasks, task],
      updatedAt: now,
    },
  };
}

export function deleteTask(
  state: TerrariumState,
  taskId: string,
  now = Date.now(),
): TerrariumState {
  return {
    ...state,
    tasks: state.tasks.filter((task) => task.id !== taskId || task.done),
    updatedAt: now,
  };
}

export function completeTask(
  state: TerrariumState,
  taskId: string,
  now = Date.now(),
): { state: TerrariumState; completed: boolean; newStreak: boolean } {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task || task.done) return { state, completed: false, newStreak: false };

  const today = localDayKey(now);
  const yesterday = dayKeyOffset(now, -1);
  const newStreak = state.lastTaskDay !== today;
  const streak = newStreak
    ? state.lastTaskDay === yesterday
      ? state.streak + 1
      : 1
    : state.streak;

  const next: TerrariumState = {
    ...state,
    tasks: state.tasks.map((item) =>
      item.id === taskId ? { ...item, done: true, doneAt: now } : item,
    ),
    stars: pruneStars(
      [...state.stars, makeStar(task.id, task.text, now, state.stars.length)],
      now,
    ),
    tasksDoneToday: state.tasksDoneToday + 1,
    tasksDoneTotal: state.tasksDoneTotal + 1,
    dew: state.dew + TASK_DEW,
    spores: state.spores + TASK_SPORES,
    streak,
    bestStreak: Math.max(state.bestStreak, streak),
    lastTaskDay: today,
    plants: state.settings.paused
      ? state.plants
      : state.plants.map((plant) =>
          plant.growth < 1
            ? { ...plant, growth: clamp(plant.growth + TASK_GROWTH, 0, 1) }
            : plant,
        ),
    updatedAt: now,
  };
  return { state: next, completed: true, newStreak };
}

export function plantSpecies(
  state: TerrariumState,
  species: SpeciesId,
  now = Date.now(),
): { state: TerrariumState; error?: string; planted?: boolean } {
  const def = SPECIES[species];
  if (!def) return { state, error: 'unknown seed' };
  if (!isSpeciesUnlocked(state, def)) return { state, error: 'this seed is still locked' };
  if (state.spores < def.cost) return { state, error: 'not enough spores' };
  if (state.plants.length >= MAX_PLANTS) return { state, error: 'the jar is full' };

  const used = new Set(state.plants.map((plant) => plant.slot));
  const slot = PLANT_SLOTS.findIndex((_, index) => !used.has(index));
  if (slot < 0) return { state, error: 'the jar is full' };

  const plant: Plant = {
    id: makeId('pl'),
    species,
    slot,
    growth: 0.03,
    plantedAt: now,
    seed: randomSeed(),
  };
  return {
    state: {
      ...state,
      spores: state.spores - def.cost,
      plants: [...state.plants, plant],
      updatedAt: now,
    },
    planted: true,
  };
}

export function mistPlants(
  state: TerrariumState,
  now = Date.now(),
): { state: TerrariumState; error?: string; matured: SpeciesId[] } {
  if (state.settings.paused) return { state, error: 'the jar is resting', matured: [] };
  if (state.dew < MIST_COST) return { state, error: 'not enough dew', matured: [] };
  if (state.plants.length === 0) return { state, error: 'nothing to mist yet', matured: [] };

  const matured: SpeciesId[] = [];
  const plants = state.plants.map((plant) => {
    if (plant.growth >= 1) return plant;
    const growth = clamp(plant.growth + MIST_GROWTH, 0, 1);
    if (growth >= 1) matured.push(plant.species);
    return { ...plant, growth };
  });

  return {
    state: {
      ...state,
      dew: state.dew - MIST_COST,
      plants,
      updatedAt: now,
    },
    matured,
  };
}

export function grantBreak(
  state: TerrariumState,
  now = Date.now(),
): TerrariumState {
  return {
    ...state,
    dew: state.dew + BREAK_DEW,
    lastBreakAt: now,
    updatedAt: now,
  };
}

/** 0..1, for the little moss patch that only grows in your absence. */
export function restLevel(restMs: number): number {
  return clamp(restMs / REST_MOSS_FULL_MS, 0, 1);
}

export function addRest(
  state: TerrariumState,
  quietMs: number,
  now = Date.now(),
): TerrariumState {
  const added = Math.max(0, Math.min(quietMs, OFFLINE_REST_CAP_MS));
  if (added <= 0) return state;
  return {
    ...state,
    restMs: clamp(state.restMs + added, 0, REST_MOSS_FULL_MS),
    lastSeenAt: now,
    updatedAt: now,
  };
}

/** On launch, the time the app was closed becomes quiet moss, capped at 8h. */
export function applyOfflineRest(state: TerrariumState, now = Date.now()): TerrariumState {
  const away = now - state.lastSeenAt;
  if (away < 60_000) return state;
  return addRest(state, away, now);
}

export function startFocus(
  state: TerrariumState,
  minutes: number,
  now = Date.now(),
): { state: TerrariumState; error?: string } {
  if (state.focus && now < state.focus.endsAt) {
    return { state, error: 'a dusk is already settling' };
  }
  const rounded = clamp(
    Math.round(Number.isFinite(minutes) ? minutes : FOCUS_DEFAULT_MINUTES),
    FOCUS_MIN_MINUTES,
    FOCUS_MAX_MINUTES,
  );
  const focus: FocusSession = {
    startedAt: now,
    endsAt: now + rounded * 60_000,
    minutes: rounded,
  };
  return { state: { ...state, focus, updatedAt: now } };
}

export function endFocus(
  state: TerrariumState,
  now = Date.now(),
  completed = false,
): TerrariumState {
  if (!state.focus) return state;
  return {
    ...state,
    focus: null,
    lastFocusDoneAt: completed ? now : state.lastFocusDoneAt,
    updatedAt: now,
  };
}

export function tickFocus(
  state: TerrariumState,
  now = Date.now(),
): { state: TerrariumState; completed: boolean } {
  if (!state.focus) return { state, completed: false };
  if (now < state.focus.endsAt) return { state, completed: false };
  return { state: endFocus(state, now, true), completed: true };
}

export function focusRemainingMs(state: TerrariumState, now = Date.now()): number {
  if (!state.focus) return 0;
  return Math.max(0, state.focus.endsAt - now);
}

/** A cutting is a portable snapshot of one plant's genome and age. */
export function cuttingFromPlant(
  plant: Plant,
  now = Date.now(),
): { cutting?: CuttingFile; error?: string } {
  if (plant.growth < CUTTING_MIN_GROWTH) {
    return { error: 'let it grow a little more before taking a cutting' };
  }
  const parent = plant.parent ?? {
    species: plant.species,
    plantedAt: plant.plantedAt,
  };
  return {
    cutting: {
      kind: 'mosslight-cutting',
      version: 1,
      species: plant.species,
      growth: clamp(plant.growth, 0, 1),
      seed: Math.floor(plant.seed),
      plantedAt: plant.plantedAt,
      takenAt: now,
      parent,
    },
  };
}

export function cuttingToJson(cutting: CuttingFile): string {
  return JSON.stringify(cutting, null, 2);
}

export function parseCutting(text: string): { cutting?: CuttingFile; error?: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: 'that file is not a Mosslight cutting' };
  }
  if (!raw || typeof raw !== 'object') {
    return { error: 'that file is not a Mosslight cutting' };
  }
  const value = raw as Partial<CuttingFile>;
  if (value.kind !== 'mosslight-cutting' || value.version !== 1) {
    return { error: 'that file is not a Mosslight cutting' };
  }
  if (!isSpecies(value.species)) {
    return { error: 'this cutting has no known species' };
  }
  const growth = finite(value.growth, 0);
  if (growth < 0.3) {
    return { error: 'this cutting is too small to plant' };
  }
  const parent = sanitizeParent(value.parent);
  return {
    cutting: {
      kind: 'mosslight-cutting',
      version: 1,
      species: value.species,
      growth: clamp(growth, 0, 1),
      seed: Math.floor(finite(value.seed, randomSeed())),
      plantedAt: finite(value.plantedAt, Date.now()),
      takenAt: finite(value.takenAt, Date.now()),
      ...(parent ? { parent } : {}),
    },
  };
}

export function plantCutting(
  state: TerrariumState,
  cutting: CuttingFile,
  now = Date.now(),
): { state: TerrariumState; error?: string; planted?: boolean } {
  if (!isSpecies(cutting.species)) return { state, error: 'unknown cutting' };
  if (state.plants.length >= MAX_PLANTS) return { state, error: 'the jar is full' };
  const used = new Set(state.plants.map((plant) => plant.slot));
  const slot = PLANT_SLOTS.findIndex((_, index) => !used.has(index));
  if (slot < 0) return { state, error: 'the jar is full' };

  const parent: PlantParent = cutting.parent ?? {
    species: cutting.species,
    plantedAt: cutting.plantedAt,
  };
  const plant: Plant = {
    id: makeId('pl'),
    species: cutting.species,
    slot,
    growth: clamp(cutting.growth - CUTTING_TRIM, 0.24, 0.98),
    plantedAt: now,
    seed: Math.floor(cutting.seed),
    parent,
  };
  return {
    state: {
      ...state,
      plants: [...state.plants, plant],
      updatedAt: now,
    },
    planted: true,
  };
}

/**
 * Presence is sunlight. Growth is capped at six hours per day so the jar
 * rewards a normal day rather than an endless one.
 */
export function applyPresence(
  state: TerrariumState,
  activeMs: number,
  now = Date.now(),
): { state: TerrariumState; matured: SpeciesId[] } {
  let next = normalizeDay(state, now);
  if (next.settings.paused || activeMs <= 0) {
    return { state: { ...next, lastSeenAt: now }, matured: [] };
  }

  const sunMs = Math.min(activeMs, Math.max(0, SUN_CAP_MS - next.sunMsToday));
  const grew = sunMs > 0 && next.plants.length > 0;
  const matured: SpeciesId[] = [];

  let plants = next.plants;
  if (grew) {
    const minutes = sunMs / 60_000;
    plants = next.plants.map((plant) => {
      if (plant.growth >= 1) return plant;
      const rate = minutes / SPECIES[plant.species].minutesToMature;
      const growth = clamp(plant.growth + rate, 0, 1);
      if (growth >= 1) matured.push(plant.species);
      return { ...plant, growth };
    });
  }

  next = {
    ...next,
    focusMsToday: next.focusMsToday + activeMs,
    focusMsTotal: next.focusMsTotal + activeMs,
    sunMsToday: next.sunMsToday + sunMs,
    plants,
    // Quiet moss only grows while away; being present slowly wears it back.
    restMs: Math.max(0, next.restMs - activeMs),
    lastSeenAt: now,
    updatedAt: now,
  };

  return { state: next, matured };
}

/** Adds any creatures whose harmony threshold has been reached. */
export function syncCreatures(state: TerrariumState, now = Date.now()): {
  state: TerrariumState;
  arrived: CreatureId[];
} {
  const existing = new Set(state.creatures.map((creature) => creature.species));
  const arrived: CreatureId[] = [];
  for (const id of CREATURE_ORDER) {
    const def = CREATURES[id];
    if (!existing.has(id) && creatureIsUnlocked(state, def)) {
      arrived.push(id);
    }
  }
  if (arrived.length === 0) return { state, arrived };
  const creatures: Creature[] = arrived.map((species) => ({
    id: makeId('cr'),
    species,
    seed: randomSeed(),
    arrivedAt: now,
  }));
  return {
    state: {
      ...state,
      creatures: [...state.creatures, ...creatures],
      updatedAt: now,
    },
    arrived,
  };
}

export function newSpeciesUnlocks(state: TerrariumState): SpeciesId[] {
  const seen = new Set(state.seenUnlocks);
  return SPECIES_ORDER.filter((id) => !seen.has(id) && isSpeciesUnlocked(state, SPECIES[id]));
}

export function markUnlocksSeen(state: TerrariumState, ids: SpeciesId[]): TerrariumState {
  if (ids.length === 0) return state;
  return {
    ...state,
    seenUnlocks: Array.from(new Set([...state.seenUnlocks, ...ids])),
  };
}

export function patchSettings(
  state: TerrariumState,
  patch: Partial<Settings>,
): TerrariumState {
  return {
    ...state,
    settings: { ...state.settings, ...patch },
    updatedAt: Date.now(),
  };
}

export function markOnboardingDone(state: TerrariumState): TerrariumState {
  return { ...state, onboardingDone: true, updatedAt: Date.now() };
}

export function currentHarmony(state: TerrariumState): number {
  return harmony(state);
}

export function formatMinutes(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
