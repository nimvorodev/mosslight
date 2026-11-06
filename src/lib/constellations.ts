import type { TaskStar } from './types';

/** How far ahead of the clock a star may be before it is treated as bad data. */
export const STAR_FUTURE_GRACE_MS = 60_000;

export interface SkyRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

function hashText(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** A finished task becomes a fixed point of light, not a random flicker. */
export function makeStar(
  taskId: string,
  text: string,
  at: number,
  salt = 0,
): TaskStar {
  let hash = hashText(`${taskId}:${text}:${salt}`);
  const next = () => {
    hash = Math.imul(hash ^ (hash >>> 15), 2246822519) >>> 0;
    hash = Math.imul(hash ^ (hash >>> 13), 3266489917) >>> 0;
    return (hash ^ (hash >>> 16)) >>> 0;
  };
  return {
    id: `st_${taskId}`,
    taskId,
    text,
    at,
    x: 0.1 + (next() / 4294967296) * 0.8,
    y: 0.08 + (next() / 4294967296) * 0.48,
    size: next() / 4294967296 > 0.72 ? 2 : 1,
    color: next() % 4,
  };
}

export function starPoint(star: TaskStar, sky: SkyRect): Point {
  return {
    x: sky.x + star.x * sky.w,
    y: sky.y + star.y * sky.h,
  };
}

/**
 * Draw a few faint links between close stars, so a run of finished things reads
 * as a constellation rather than a scatter of dots.
 */
export function constellationPairs(stars: TaskStar[]): Array<[number, number]> {
  const pairs: Array<[number, number]> = [];
  const seen = new Set<string>();
  for (let index = 0; index < stars.length; index += 1) {
    const from = stars[index];
    const distances: Array<{ index: number; distance: number }> = [];
    for (let other = 0; other < stars.length; other += 1) {
      if (other === index) continue;
      const to = stars[other];
      const dx = to.x - from.x;
      const dy = (to.y - from.y) * 1.5;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < 0.24) distances.push({ index: other, distance });
    }
    distances.sort((a, b) => a.distance - b.distance);
    for (const nearest of distances.slice(0, 2)) {
      const low = Math.min(index, nearest.index);
      const high = Math.max(index, nearest.index);
      const key = `${low}:${high}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push([low, high]);
    }
  }
  return pairs;
}

/**
 * Stars fade out after a month and a half of nights. A minute of future grace
 * keeps a star from blinking out if the system clock is nudged backwards.
 */
export function visibleStars(stars: TaskStar[], now: number, retentionMs: number): TaskStar[] {
  return stars.filter((star) => {
    const age = now - star.at;
    return age >= -STAR_FUTURE_GRACE_MS && age <= retentionMs;
  });
}
