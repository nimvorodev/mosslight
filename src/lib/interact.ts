import { JAR, PLANT_SLOTS, type PlantSlot } from './layout';
import { starPoint, type SkyRect } from './constellations';
import { spreadShelfSlots } from './scene';
import { plantHeightUnits } from './plants';
import type { TaskStar, TerrariumState } from './types';

export interface SceneGeometry {
  variant: 'jar' | 'shelf';
  x: number;
  y: number;
  w: number;
  h: number;
  horizon: number;
  detail: number;
  plantScale: number;
  slots: PlantSlot[];
  sky: SkyRect;
}

export function sceneGeometry(
  state: TerrariumState,
  variant: 'jar' | 'shelf',
  width: number,
  height: number,
): SceneGeometry {
  if (variant === 'shelf') {
    const h = Math.round(height * 0.86);
    const detail = Math.min(1.8, Math.max(1, height / 105));
    return {
      variant,
      x: 0,
      y: 0,
      w: width,
      h,
      horizon: 0.66,
      detail,
      plantScale: 1.6,
      slots: spreadShelfSlots(state.plants),
      sky: { x: 0, y: 0, w: width, h: h * 0.66 },
    };
  }

  const x = JAR.x + JAR.innerInset;
  const y = JAR.y + JAR.innerInset;
  const w = JAR.w - JAR.innerInset * 2;
  const h = JAR.h - JAR.innerInset * 2;
  return {
    variant,
    x,
    y,
    w,
    h,
    horizon: 0.68,
    detail: 1,
    plantScale: 1.2,
    slots: PLANT_SLOTS,
    sky: { x, y, w, h: h * 0.68 },
  };
}

export interface PickResult {
  plantId: string | null;
  star: TaskStar | null;
}

/**
 * Pick the nearest living thing under the pointer. Plants win over stars when
 * both are close, because a plant is the more deliberate click.
 */
export function pickAt(
  state: TerrariumState,
  geometry: SceneGeometry,
  x: number,
  y: number,
  night: boolean,
  _now = Date.now(),
): PickResult {
  let plantId: string | null = null;
  let bestPlant = Infinity;

  for (const plant of state.plants) {
    const slot = geometry.slots[plant.slot];
    if (!slot) continue;
    const baseY = Math.round(geometry.y + (geometry.horizon + slot.y - 0.68) * geometry.h);
    const scale = slot.scale * geometry.detail * geometry.plantScale;
    const halfWidth = Math.max(4, 6.5 * scale);
    const maxHeight = Math.max(4, baseY - geometry.y - 3);
    const height = Math.min(plantHeightUnits(plant) * scale, maxHeight);
    const baseX = geometry.x + slot.x * geometry.w;
    if (Math.abs(x - baseX) > halfWidth) continue;
    if (y > baseY + 3 || y < baseY - height - 2) continue;
    const distance = Math.abs(x - baseX) + Math.abs(y - (baseY - height * 0.45)) * 0.2;
    if (distance < bestPlant) {
      bestPlant = distance;
      plantId = plant.id;
    }
  }

  if (plantId) return { plantId, star: null };
  if (!night) return { plantId: null, star: null };

  let star: TaskStar | null = null;
  let bestStar = Infinity;
  for (const candidate of state.stars) {
    const point = starPoint(candidate, geometry.sky);
    const distance = Math.hypot(point.x - x, point.y - y);
    if (distance < 5 && distance < bestStar) {
      bestStar = distance;
      star = candidate;
    }
  }
  return { plantId: null, star };
}
