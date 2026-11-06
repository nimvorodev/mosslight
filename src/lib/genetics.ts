import { P } from './palette';
import { hash2 } from './pixel';
import type { SpeciesId } from './types';

/**
 * Every plant carries its own small, deterministic genome. The stored seed is
 * the whole genotype: the same seed always grows the same colours and markings,
 * so a cutting and its parent visibly belong together.
 */
export interface PlantColors {
  stem: string;
  leaf: string;
  light: string;
  dark: string;
  cap: string;
  capLight: string;
  capDark: string;
  dot: string;
  petal: string;
  petalLight: string;
  mid: string;
  edge: string;
  bloom: string;
  glow: string;
}

export interface PlantTraits {
  species: SpeciesId;
  variant: number;
  /** A short, human name for the herbarium. */
  name: string;
  note: string;
  /** Slightly changes silhouette size without making plants unpredictable. */
  vigor: number;
  /** Deterministic marking pattern, 0..1. */
  marking: number;
  colors: PlantColors;
}

const FERN_VARIANTS = [
  { name: 'deep-veined', note: 'holds the dark green of the understory' },
  { name: 'sun-brushed', note: 'the fronds lean toward morning light' },
  { name: 'silver-tipped', note: 'pale at the edges, quiet in the middle' },
];

const MUSHROOM_VARIANTS = [
  { name: 'coral-cap', note: 'a warm cap that catches the last light' },
  { name: 'amber-cap', note: 'glows faintly when the jar is dim' },
  { name: 'violet-cap', note: 'grows best in the shade of the fern' },
  { name: 'bone-cap', note: 'almost the colour of old paper' },
];

const FLOWER_VARIANTS = [
  { name: 'pink', note: 'opens a little wider each afternoon' },
  { name: 'peach', note: 'soft as the inside of a shell' },
  { name: 'cream', note: 'keeps its petals folded until late' },
  { name: 'lilac', note: 'a cool bloom for the edge of the garden' },
];

const SUCCULENT_VARIANTS = [
  { name: 'jade rosette', note: 'stores a whole week of water' },
  { name: 'dusty rose', note: 'blushes when the sun is strong' },
  { name: 'sea-glass', note: 'blue-green and cooler than the moss' },
];

const VINE_VARIANTS = [
  { name: 'meadow vine', note: 'climbs toward whatever is warmest' },
  { name: 'gold vine', note: 'turns a little brass-coloured in autumn' },
  { name: 'silver vine', note: 'pale leaves that move in small breezes' },
];

const CRYSTAL_VARIANTS = [
  { name: 'aquamarine', note: 'keeps a cool light until dusk' },
  { name: 'rose quartz', note: 'warms the glass from the inside' },
  { name: 'amber shard', note: 'holds the colour of late sun' },
];

function variantsFor(species: SpeciesId) {
  switch (species) {
    case 'fern':
      return FERN_VARIANTS;
    case 'mushroom':
      return MUSHROOM_VARIANTS;
    case 'flower':
      return FLOWER_VARIANTS;
    case 'succulent':
      return SUCCULENT_VARIANTS;
    case 'vine':
      return VINE_VARIANTS;
    case 'crystal':
      return CRYSTAL_VARIANTS;
    default:
      return FERN_VARIANTS;
  }
}

function colorsFor(species: SpeciesId, variant: number): PlantColors {
  const base: PlantColors = {
    stem: P.fern.stem,
    leaf: P.fern.leaf,
    light: P.fern.light,
    dark: P.fern.dark,
    cap: P.mushroom.cap,
    capLight: P.mushroom.capLight,
    capDark: P.mushroom.capDark,
    dot: P.mushroom.dot,
    petal: P.flower.pink,
    petalLight: P.flower.pinkLight,
    mid: P.succulent.mid,
    edge: P.succulent.edge,
    bloom: P.vine.bloom,
    glow: P.crystal.glow,
  };

  if (species === 'fern') {
    if (variant === 1) {
      return {
        ...base,
        stem: '#5d8757',
        leaf: '#88b46a',
        light: '#b7d98b',
        dark: '#426b45',
      };
    }
    if (variant === 2) {
      return {
        ...base,
        stem: '#527c6d',
        leaf: '#7fa996',
        light: '#c3ded1',
        dark: '#3d5f57',
      };
    }
    return base;
  }

  if (species === 'mushroom') {
    if (variant === 1) {
      return {
        ...base,
        cap: P.mushroom.amber,
        capLight: P.mushroom.amberLight,
        capDark: '#96651f',
      };
    }
    if (variant === 2) {
      return {
        ...base,
        cap: P.mushroom.violet,
        capLight: P.mushroom.violetLight,
        capDark: '#6d5188',
      };
    }
    if (variant === 3) {
      return {
        ...base,
        cap: '#d9cfb6',
        capLight: '#f0e8d2',
        capDark: '#94866f',
      };
    }
    return base;
  }

  if (species === 'flower') {
    const petals = [
      { petal: P.flower.pink, petalLight: P.flower.pinkLight },
      { petal: P.flower.peach, petalLight: P.flower.peachLight },
      { petal: P.flower.cream, petalLight: P.flower.creamLight },
      { petal: P.flower.lilac, petalLight: P.flower.lilacLight },
    ][variant % 4];
    return { ...base, ...petals };
  }

  if (species === 'succulent') {
    const succulent: PlantColors = {
      ...base,
      dark: P.succulent.dark,
      mid: P.succulent.mid,
      light: P.succulent.light,
      edge: P.succulent.edge,
    };
    if (variant === 1) {
      return {
        ...succulent,
        mid: '#a0818c',
        light: '#c4a9af',
        edge: '#e5d0d2',
        dark: '#6d5762',
      };
    }
    if (variant === 2) {
      return {
        ...succulent,
        mid: '#6f93a3',
        light: '#a8c5cc',
        edge: '#d3e3e4',
        dark: '#4f6c7a',
      };
    }
    return succulent;
  }

  if (species === 'vine') {
    const vine: PlantColors = {
      ...base,
      stem: P.vine.stem,
      leaf: P.vine.leaf,
      light: P.vine.light,
      dark: P.vine.dark,
      bloom: P.vine.bloom,
    };
    if (variant === 1) {
      return {
        ...vine,
        stem: '#8b8c4e',
        leaf: '#b6b35f',
        light: '#d8d18a',
        dark: '#65663c',
        bloom: '#f0d59a',
      };
    }
    if (variant === 2) {
      return {
        ...vine,
        stem: '#6d8a78',
        leaf: '#94b39c',
        light: '#c4dbc6',
        dark: '#4e6b5c',
        bloom: '#dcead2',
      };
    }
    return vine;
  }

  if (species === 'crystal') {
    const crystal: PlantColors = {
      ...base,
      dark: P.crystal.dark,
      mid: P.crystal.mid,
      light: P.crystal.light,
      glow: P.crystal.glow,
      edge: P.crystal.edge,
    };
    if (variant === 1) {
      return {
        ...crystal,
        dark: '#7f4d5f',
        mid: '#b77c8e',
        light: '#ecc7d2',
        glow: '#f0b8c8',
        edge: '#5f3747',
      };
    }
    if (variant === 2) {
      return {
        ...crystal,
        dark: '#8a642e',
        mid: '#c69a55',
        light: '#f0d69a',
        glow: '#f5d78d',
        edge: '#65471f',
      };
    }
    return crystal;
  }

  return base;
}

export function traitsFor(species: SpeciesId, seed: number): PlantTraits {
  const variants = variantsFor(species);
  const variant = Math.abs(Math.floor(seed)) % variants.length;
  const chosen = variants[variant] ?? variants[0];
  return {
    species,
    variant,
    name: chosen.name,
    note: chosen.note,
    vigor: 0.94 + hash2(seed, variant, 71) * 0.12,
    marking: hash2(seed, variant, 97),
    colors: colorsFor(species, variant),
  };
}

/** Deterministic, readable trait line for the herbarium card. */
export function traitLabel(traits: PlantTraits): string {
  return `${traits.name} · ${traits.note}`;
}

/** "3 days", "1 day", "today" from the planting timestamp. */
export function ageLabel(plantedAt: number, now = Date.now()): string {
  const days = Math.floor(Math.max(0, now - plantedAt) / 86_400_000);
  if (days <= 0) return 'planted today';
  if (days === 1) return '1 day old';
  return `${days} days old`;
}
