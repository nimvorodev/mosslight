import { useCallback, useEffect, useRef, useState } from 'react';
import { bridge } from './bridge';
import {
  MIST_COST,
  TASK_DEW,
  TASK_SPORES,
  addTask,
  applyPresence,
  completeTask as completeTaskState,
  deleteTask as deleteTaskState,
  formatMinutes,
  grantBreak,
  makeInitialState,
  markOnboardingDone,
  mistPlants,
  newSpeciesUnlocks,
  normalizeDay,
  normalizeState,
  patchSettings,
  plantSpecies,
  syncCreatures,
  markUnlocksSeen,
} from './state';
import { CREATURES, SPECIES } from './species';
import { EMPTY_EFFECTS, type SceneEffects } from './scene';
import type { Plant, Settings, SpeciesId, Task, TerrariumState } from './types';

export type ToastTone = 'good' | 'warn' | 'info';

export interface Toast {
  id: number;
  text: string;
  tone: ToastTone;
}

interface ToastSpec {
  text: string;
  tone?: ToastTone;
  duration?: number;
}

export interface TerrariumActions {
  addTask: (text: string) => void;
  completeTask: (id: string) => void;
  deleteTask: (id: string) => void;
  plant: (species: SpeciesId) => void;
  mist: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
  togglePause: () => void;
  toggleGhost: () => void;
  dismissOnboarding: () => void;
  hide: () => void;
  quit: () => void;
  openDataFolder: () => void;
  saveNow: () => void;
}

function uniqueMatured(before: TerrariumState, after: TerrariumState): SpeciesId[] {
  const previous = new Map(before.plants.map((plant) => [plant.id, plant.growth]));
  const names = new Set<SpeciesId>();
  for (const plant of after.plants) {
    if (plant.growth >= 1 && (previous.get(plant.id) ?? 0) < 1) {
      names.add(plant.species);
    }
  }
  return Array.from(names);
}

function maturedToasts(ids: SpeciesId[]): ToastSpec[] {
  return ids.map((id) => ({ text: `${SPECIES[id].name} is fully grown`, tone: 'good' as const }));
}

export function useTerrarium(): {
  state: TerrariumState | null;
  now: number;
  awake: boolean;
  effects: SceneEffects;
  toasts: Toast[];
  actions: TerrariumActions;
} {
  const [state, setState] = useState<TerrariumState | null>(null);
  const stateRef = useRef<TerrariumState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [awake, setAwake] = useState(true);
  const awakeRef = useRef(true);
  const [effects, setEffects] = useState<SceneEffects>(EMPTY_EFFECTS);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const saveTimer = useRef<number | null>(null);
  const toastSeq = useRef(0);
  const activeStretch = useRef(0);
  const breakAwarded = useRef(false);
  const loadedRef = useRef(false);

  const pushToast = useCallback(
    (text: string, tone: ToastTone = 'good', duration = 3400) => {
      const id = (toastSeq.current += 1);
      setToasts((current) => [...current.slice(-2), { id, text, tone }]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, duration);
    },
    [],
  );

  const persist = useCallback((next: TerrariumState) => {
    void bridge.saveState(JSON.stringify(next)).catch(() => {
      // A failed write must not break the running garden. The next tick retries.
    });
  }, []);

  const flushSave = useCallback(
    (next: TerrariumState) => {
      if (!loadedRef.current) return;
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      persist(next);
    },
    [persist],
  );

  const scheduleSave = useCallback(
    (next: TerrariumState) => {
      if (!loadedRef.current) return;
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        saveTimer.current = null;
        persist(next);
      }, 4000);
    },
    [persist],
  );

  const commitNext = useCallback(
    (
      next: TerrariumState,
      options: { announce?: boolean; toasts?: ToastSpec[]; flush?: boolean } = {},
    ) => {
      const at = Date.now();
      let value = normalizeDay(next, at);
      const synced = syncCreatures(value, at);
      value = synced.state;
      const unlocks = newSpeciesUnlocks(value);
      value = markUnlocksSeen(value, unlocks);
      value = { ...value, updatedAt: at };

      stateRef.current = value;
      setState(value);
      if (options.flush) flushSave(value);
      else scheduleSave(value);

      if (options.announce !== false) {
        for (const id of unlocks) {
          pushToast(`${SPECIES[id].name} unlocked`, 'good');
        }
        for (const id of synced.arrived) {
          pushToast(`${CREATURES[id].name} moved in`, 'good');
        }
      }
      for (const toast of options.toasts ?? []) {
        pushToast(toast.text, toast.tone ?? 'good', toast.duration);
      }
    },
    [pushToast, scheduleSave, flushSave],
  );

  // Load once, then let presence ticks feed the jar.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      let next: TerrariumState;
      let raw: string | null = null;
      try {
        raw = await bridge.loadState();
      } catch {
        pushToast('the saved jar could not be opened; a fresh one is growing', 'warn', 6000);
      }
      if (raw) {
        try {
          next = normalizeState(JSON.parse(raw), Date.now());
        } catch {
          next = makeInitialState();
          pushToast('the saved jar could not be read; a fresh one is growing', 'warn', 6000);
        }
      } else {
        next = makeInitialState();
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
          next = patchSettings(next, { reducedMotion: true });
        }
      }

      if (cancelled) return;
      const synced = syncCreatures(next, Date.now());
      next = markUnlocksSeen(synced.state, newSpeciesUnlocks(synced.state));
      stateRef.current = next;
      setState(next);
      loadedRef.current = true;
      void bridge.setDisplayMode(next.settings.display);
      void bridge.setAlwaysOnTop(next.settings.alwaysOnTop);
      void bridge.setLaunchAtLogin(next.settings.launchAtLogin);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [pushToast]);

  useEffect(() => {
    const unsubscribe = bridge.onPresence((tick) => {
      const current = stateRef.current;
      if (!current) return;
      const at = tick.at || Date.now();

      if (tick.idleSeconds > 90) {
        if (awakeRef.current) {
          awakeRef.current = false;
          setAwake(false);
        }
      } else if (tick.activeSeconds > 0 && !awakeRef.current) {
        awakeRef.current = true;
        setAwake(true);
      }

      if (tick.activeSeconds > 0) {
        activeStretch.current += tick.activeSeconds * 1000;
        breakAwarded.current = false;
        const result = applyPresence(current, tick.activeSeconds * 1000, at);
        const matured = uniqueMatured(current, result.state);
        commitNext(result.state, { toasts: maturedToasts(matured) });
        return;
      }

      if (
        tick.idleSeconds > 240 &&
        activeStretch.current >= 45 * 60 * 1000 &&
        !breakAwarded.current
      ) {
        breakAwarded.current = true;
        activeStretch.current = 0;
        const rested = applyPresence(current, 0, at).state;
        commitNext(grantBreak(rested, at), {
          toasts: [{ text: 'break bonus · +2 dew', tone: 'good' }],
        });
        return;
      }

      if (at - current.lastSeenAt > 60_000) {
        commitNext(applyPresence(current, 0, at).state, { announce: false });
      }
    });
    return unsubscribe;
  }, [commitNext]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = stateRef.current;
      const clock = Date.now();
      setNow(clock);
      if (!current) return;
      const normalized = normalizeDay(current, clock);
      if (normalized !== current) commitNext(normalized, { announce: false });
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [commitNext]);

  useEffect(() => {
    const save = () => {
      if (!stateRef.current || !loadedRef.current) return;
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      persist(stateRef.current);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') save();
    };
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', save);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [persist]);

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      const current = stateRef.current;
      if (!current) return;
      commitNext(patchSettings(current, patch), { announce: false, flush: true });
      if (patch.alwaysOnTop !== undefined) {
        void bridge.setAlwaysOnTop(patch.alwaysOnTop);
      }
      if (patch.display !== undefined) {
        void bridge.setDisplayMode(patch.display);
        pushToast(
          patch.display === 'shelf'
            ? 'the shelf is living across the bottom of the screen'
            : 'the jar is floating again',
          'info',
        );
      }
      if (patch.launchAtLogin !== undefined) {
        void bridge.setLaunchAtLogin(patch.launchAtLogin);
      }
      if (patch.paused !== undefined) {
        pushToast(patch.paused ? 'the jar is resting' : 'the jar is waking up', 'info');
      }
    },
    [commitNext, pushToast],
  );

  const addTaskAction = useCallback(
    (text: string) => {
      const current = stateRef.current;
      if (!current) return;
      const base = normalizeDay(current, Date.now());
      const result = addTask(base, text, Date.now());
      if (result.error) {
        pushToast(result.error, 'warn');
        return;
      }
      commitNext(result.state, { announce: false, flush: true });
    },
    [commitNext, pushToast],
  );

  const completeTaskAction = useCallback(
    (id: string) => {
      const current = stateRef.current;
      if (!current) return;
      const base = normalizeDay(current, Date.now());
      const result = completeTaskState(base, id, Date.now());
      if (!result.completed) return;
      const matured = uniqueMatured(base, result.state);
      const toasts: ToastSpec[] = [
        { text: `+${TASK_DEW} dew · +${TASK_SPORES} spore`, tone: 'good' },
      ];
      if (result.newStreak && result.state.streak > 1) {
        toasts.push({ text: `${result.state.streak}-day streak`, tone: 'good' });
      }
      toasts.push(...maturedToasts(matured));
      setEffects((currentEffects) => ({
        ...currentEffects,
        taskAt: Date.now(),
        unlockAt: matured.length > 0 ? Date.now() : currentEffects.unlockAt,
      }));
      commitNext(result.state, { toasts, flush: true });
    },
    [commitNext],
  );

  const deleteTaskAction = useCallback(
    (id: string) => {
      const current = stateRef.current;
      if (!current) return;
      commitNext(deleteTaskState(current, id, Date.now()), { announce: false, flush: true });
    },
    [commitNext],
  );

  const plantAction = useCallback(
    (species: SpeciesId) => {
      const current = stateRef.current;
      if (!current) return;
      const base = normalizeDay(current, Date.now());
      const result = plantSpecies(base, species, Date.now());
      if (result.error) {
        pushToast(result.error, 'warn');
        return;
      }
      pushToast(`${SPECIES[species].name} planted`, 'good');
      commitNext(result.state, { announce: false, flush: true });
    },
    [commitNext, pushToast],
  );

  const mistAction = useCallback(() => {
    const current = stateRef.current;
    if (!current) return;
    const base = normalizeDay(current, Date.now());
    const result = mistPlants(base, Date.now());
    if (result.error) {
      pushToast(result.error, 'warn');
      return;
    }
    setEffects((currentEffects) => ({ ...currentEffects, mistAt: Date.now() }));
    pushToast(`misted · -${MIST_COST} dew`, 'good');
    commitNext(result.state, { toasts: maturedToasts(result.matured), flush: true });
  }, [commitNext, pushToast]);

  const togglePause = useCallback(() => {
    const current = stateRef.current;
    if (!current) return;
    updateSettings({ paused: !current.settings.paused });
  }, [updateSettings]);

  const toggleGhost = useCallback(() => {
    void bridge.setGhostMode(true);
    pushToast('ghost mode on · Ctrl+Alt+T to return', 'info', 6500);
  }, [pushToast]);

  const dismissOnboarding = useCallback(() => {
    const current = stateRef.current;
    if (!current) return;
    commitNext(markOnboardingDone(current), { announce: false, flush: true });
  }, [commitNext]);

  const saveNow = useCallback(() => {
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (stateRef.current && loadedRef.current) {
      persist(stateRef.current);
    }
  }, [persist]);

  return {
    state,
    now,
    awake,
    effects,
    toasts,
    actions: {
      addTask: addTaskAction,
      completeTask: completeTaskAction,
      deleteTask: deleteTaskAction,
      plant: plantAction,
      mist: mistAction,
      updateSettings,
      togglePause,
      toggleGhost,
      dismissOnboarding,
      hide: () => void bridge.hideWindow(),
      quit: () => void bridge.quit(),
      openDataFolder: () => void bridge.openDataFolder(),
      saveNow,
    },
  };
}

export function taskProgress(tasks: Task[]): { done: number; total: number } {
  return {
    done: tasks.filter((task) => task.done).length,
    total: tasks.length,
  };
}

export function plantSummary(plants: Plant[]): string {
  const mature = plants.filter((plant) => plant.growth >= 0.82).length;
  return `${plants.length} planted · ${mature} mature`;
}

export function focusLabel(ms: number): string {
  return formatMinutes(ms);
}
