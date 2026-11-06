import type {
  CreatureDef,
  CreatureId,
  SpeciesDef,
  SpeciesId,
  TerrariumState,
  UnlockRule,
} from './types';

export const SPECIES: Record<SpeciesId, SpeciesDef> = {
  fern: {
    id: 'fern',
    name: 'fern',
    cost: 1,
    minutesToMature: 300,
    blurb: 'unfurls one slow frond at a time',
    unlock: { kind: 'always' },
  },
  mushroom: {
    id: 'mushroom',
    name: 'mushroom',
    cost: 1,
    minutesToMature: 170,
    blurb: 'appears after a quiet rain',
    unlock: { kind: 'always' },
  },
  flower: {
    id: 'flower',
    name: 'flower',
    cost: 2,
    minutesToMature: 420,
    blurb: 'opens in the afternoon light',
    unlock: { kind: 'tasks', value: 3 },
  },
  succulent: {
    id: 'succulent',
    name: 'succulent',
    cost: 2,
    minutesToMature: 600,
    blurb: 'holds a whole week of water',
    unlock: { kind: 'tasks', value: 10 },
  },
  vine: {
    id: 'vine',
    name: 'vine',
    cost: 3,
    minutesToMature: 720,
    blurb: 'climbs the driftwood when you keep a streak',
    unlock: { kind: 'streak', value: 3 },
  },
  crystal: {
    id: 'crystal',
    name: 'crystal',
    cost: 4,
    minutesToMature: 1200,
    blurb: 'stores ten hours of sunlight, then glows',
    unlock: { kind: 'focusHours', value: 10 },
  },
};

export const SPECIES_ORDER: SpeciesId[] = [
  'fern',
  'mushroom',
  'flower',
  'succulent',
  'vine',
  'crystal',
];

export const CREATURES: Record<CreatureId, CreatureDef> = {
  snail: {
    id: 'snail',
    name: 'snail',
    harmony: 3,
    blurb: 'moves a few pixels an hour',
  },
  ladybug: {
    id: 'ladybug',
    name: 'ladybug',
    harmony: 10,
    blurb: 'arrives when the leaves are clean',
  },
  firefly: {
    id: 'firefly',
    name: 'firefly',
    harmony: 18,
    blurb: 'only comes out after dusk',
  },
  frog: {
    id: 'frog',
    name: 'frog',
    harmony: 30,
    blurb: 'moves in once the moss is deep',
  },
};

export const CREATURE_ORDER: CreatureId[] = ['snail', 'ladybug', 'firefly', 'frog'];

export function unlockText(rule: UnlockRule): string {
  switch (rule.kind) {
    case 'always':
      return 'always available';
    case 'tasks':
      return `finish ${rule.value} tasks`;
    case 'streak':
      return `keep a ${rule.value}-day streak`;
    case 'focusHours':
      return `spend ${rule.value} focused hours`;
    default:
      return 'locked';
  }
}

export function isSpeciesUnlocked(state: TerrariumState, species: SpeciesDef): boolean {
  const rule = species.unlock;
  switch (rule.kind) {
    case 'always':
      return true;
    case 'tasks':
      return state.tasksDoneTotal >= rule.value;
    case 'streak':
      return state.bestStreak >= rule.value;
    case 'focusHours':
      return state.focusMsTotal >= rule.value * 3_600_000;
    default:
      return false;
  }
}

export function harmony(state: TerrariumState): number {
  const mature = state.plants.filter((plant) => plant.growth >= 0.82).length;
  const species = new Set(state.plants.map((plant) => plant.species)).size;
  return (
    state.tasksDoneTotal +
    mature * 3 +
    species * 2 +
    Math.min(state.streak, 10) * 2
  );
}

export function creatureIsUnlocked(state: TerrariumState, creature: CreatureDef): boolean {
  return harmony(state) >= creature.harmony;
}
