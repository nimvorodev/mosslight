/** Scene is authored at this fixed pixel resolution and scaled up. */
export const SCENE_W = 192;
export const SCENE_H = 160;

export interface PlantSlot {
  /** 0..1 across the inside of the glass. */
  x: number;
  /** 0..1 down the inside of the glass; this is the base of the plant. */
  y: number;
  scale: number;
  z: number;
}

/**
 * Hand-placed planting spots. Stored by index so a plant keeps its home
 * across sessions. Back row is drawn first, front row last.
 */
export const PLANT_SLOTS: PlantSlot[] = [
  { x: 0.24, y: 0.735, scale: 0.78, z: 0 },
  { x: 0.53, y: 0.72, scale: 0.82, z: 0 },
  { x: 0.79, y: 0.737, scale: 0.78, z: 0 },
  { x: 0.19, y: 0.795, scale: 0.9, z: 1 },
  { x: 0.44, y: 0.783, scale: 0.95, z: 1 },
  { x: 0.69, y: 0.797, scale: 0.9, z: 1 },
  { x: 0.33, y: 0.852, scale: 1.04, z: 2 },
  { x: 0.62, y: 0.857, scale: 1.04, z: 2 },
];

export const JAR = {
  x: 18,
  y: 12,
  w: 156,
  h: 140,
  radiusTop: 30,
  radiusBottom: 6,
  baseY: 148,
  innerInset: 4,
};

export const SOIL_Y = 108;
