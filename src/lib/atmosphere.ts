import { hash2 } from './pixel';
import type { TerrariumState } from './types';

export type WeatherKind = 'clear' | 'rain' | 'fog' | 'golden';
export type SeasonId = 'winter' | 'spring' | 'summer' | 'autumn';
export type RareWeather = 'snow' | 'leaves' | 'petals' | null;

export interface WeatherState {
  kind: WeatherKind;
  label: string;
  detail: string;
}

export interface SeasonState {
  id: SeasonId;
  name: string;
  /** A soft wash mixed into the sky. */
  tint: string;
  /** A second wash for moss and ground cover. */
  mossTint: string;
  /** Rough progress through the season, for slow monthly drift. */
  progress: number;
  note: string;
}

const DAY = 86_400_000;

const SEASONS: Record<SeasonId, Omit<SeasonState, 'progress'>> = {
  winter: {
    id: 'winter',
    name: 'winter drift',
    tint: '#cfe4ea',
    mossTint: '#a8c7b8',
    note: 'the light stays low and blue',
  },
  spring: {
    id: 'spring',
    name: 'spring drift',
    tint: '#f4d4d9',
    mossTint: '#b9d98f',
    note: 'new green keeps arriving',
  },
  summer: {
    id: 'summer',
    name: 'summer drift',
    tint: '#f7e6b0',
    mossTint: '#9fcf83',
    note: 'the afternoons are long and bright',
  },
  autumn: {
    id: 'autumn',
    name: 'autumn drift',
    tint: '#e7b47a',
    mossTint: '#c7a76a',
    note: 'the moss keeps a little of the sunset',
  },
};

export function seasonAt(now: number): SeasonState {
  const date = new Date(now);
  const month = date.getMonth();
  const id: SeasonId =
    month <= 1 || month === 11
      ? 'winter'
      : month <= 4
        ? 'spring'
        : month <= 7
          ? 'summer'
          : 'autumn';
  const daysInMonth = new Date(date.getFullYear(), month + 1, 0).getDate();
  const progress = Math.min(1, Math.max(0, (date.getDate() - 1) / daysInMonth));
  return { ...SEASONS[id], progress };
}

/**
 * Weather is a readout of how the day has gone, never a punishment. Focus makes
 * a golden dusk; a run of finished tasks waters the moss; long quiet makes fog.
 */
export function weatherFor(
  state: TerrariumState,
  now: number,
  awake = true,
): WeatherState {
  if (state.settings.paused) {
    return {
      kind: 'fog',
      label: 'resting fog',
      detail: 'the jar is paused and the moss is keeping still',
    };
  }
  if (state.focus && now < state.focus.endsAt) {
    return {
      kind: 'golden',
      label: 'golden dusk',
      detail: 'a focus session is keeping the light low',
    };
  }
  if (state.focusMsToday >= 90 * 60_000) {
    return {
      kind: 'golden',
      label: 'golden hour',
      detail: 'a long stretch of sunlight has warmed the glass',
    };
  }
  const recentDone = state.stars.filter((star) => now - star.at < 2 * 60 * 60_000).length;
  if (recentDone >= 2) {
    return {
      kind: 'rain',
      label: 'soft rain',
      detail: 'finished things are watering the moss',
    };
  }
  if (
    !awake ||
    (state.restMs >= 4 * 60 * 60_000 && state.focusMsToday < 5 * 60_000)
  ) {
    return {
      kind: 'fog',
      label: 'quiet fog',
      detail: 'the jar has been keeping its own company',
    };
  }
  return {
    kind: 'clear',
    label: 'clear',
    detail: 'the moss is breathing slowly',
  };
}

/**
 * A rare, whole-day visitor. It is stable for the day so the scene does not
 * flicker between weathers while you work.
 */
export function rareWeatherFor(now: number): RareWeather {
  const season = seasonAt(now).id;
  if (season === 'summer') return null;
  const day = Math.floor(now / DAY);
  const chance = hash2(day, 13, 907);
  const threshold = season === 'winter' ? 0.2 : 0.18;
  if (chance >= threshold) return null;
  if (season === 'winter') return 'snow';
  if (season === 'autumn') return 'leaves';
  return 'petals';
}

export function rareWeatherLabel(kind: RareWeather): string {
  switch (kind) {
    case 'snow':
      return 'a little snow is passing through';
    case 'leaves':
      return 'a few leaves are drifting in';
    case 'petals':
      return 'petals are blowing through the glass';
    default:
      return '';
  }
}

/** True when the scene should draw a warm dusk veil. */
export function focusDuskActive(state: TerrariumState, now: number): boolean {
  return Boolean(state.focus && now < state.focus.endsAt);
}
