import type { Plant } from './types';
import { traitsFor } from './genetics';
import { P } from './palette';
import { hash2, px, rect, withAlpha } from './pixel';

export interface PlantDrawOptions {
  now: number;
  motion: boolean;
  night: boolean;
  detail: number;
  /** Clamp the drawn height so a scaled-up plant never pokes through the glass. */
  maxHeight?: number;
}

function sizeOf(scale: number) {
  return (value: number) => Math.max(1, Math.round(value * scale));
}

function shadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height = 1,
): void {
  rect(ctx, x - Math.round(width / 2), y, width, height, 'rgba(19, 38, 27, 0.34)');
}

/** Conservative height of the tallest drawn pixel at scale 1, including heads. */
export function plantHeightUnits(plant: Plant): number {
  const g = plant.growth;
  switch (plant.species) {
    case 'fern':
      return 6 + 42 * Math.pow(g, 0.85);
    case 'mushroom':
      return 5 + 19.2 * g;
    case 'flower':
      return 6 + 33.1 * g;
    case 'succulent':
      return 3 + 12 * g;
    case 'vine':
      return 8 + 48 * g;
    case 'crystal':
      // Tallest shard plus the glow that blooms above it at night.
      return 7 + 27 * g;
    default:
      return 4;
  }
}

function drawFern(
  ctx: CanvasRenderingContext2D,
  plant: Plant,
  x: number,
  baseY: number,
  scale: number,
  _opts: PlantDrawOptions,
  sway: number,
): void {
  const g = plant.growth;
  const traits = traitsFor(plant.species, plant.seed);
  const colors = traits.colors;
  const height = Math.max(3, Math.round((2 + 42 * Math.pow(g, 0.85)) * scale));
  const stemX = x;

  for (let i = 0; i <= height; i += 1) {
    const t = i / height;
    const offset =
      Math.round(Math.sin(t * 2.4 + (plant.seed % 40) * 0.05) * (0.7 + scale * 0.5) * t) +
      Math.round(sway * t);
    const col = i % 5 === 0 ? colors.light : colors.stem;
    px(ctx, stemX + offset, baseY - i, col);
    if (i % 7 === 0 && scale > 1.1) {
      px(ctx, stemX + offset + 1, baseY - i, colors.dark);
    }
  }

  const fronds = Math.max(1, Math.round(1 + g * 6));
  for (let index = 0; index < fronds; index += 1) {
    const t = 0.18 + (0.74 * index) / Math.max(1, fronds - 1);
    const y = baseY - Math.round(height * t);
    const tSway = Math.round(sway * t);
    const xAt =
      stemX +
      Math.round(Math.sin(t * 2.4 + (plant.seed % 40) * 0.05) * (0.7 + scale * 0.5) * t) +
      tSway;
    const side = index % 2 === 0 ? 1 : -1;
    const length = Math.max(2, Math.round((2.4 + 7.2 * g) * scale * (0.94 + traits.vigor * 0.08)));
    for (let k = 0; k < length; k += 1) {
      const leafX = xAt + side * k;
      const leafY = y - Math.round(k * 0.55);
      const color = k === length - 1 ? colors.light : colors.leaf;
      px(ctx, leafX, leafY, color);
      if (k % 2 === 0) px(ctx, leafX, leafY + 1, colors.dark);
    }
    px(ctx, xAt + side, y + 1, colors.dark);
  }

  if (g > 0.55) {
    const tipY = baseY - height;
    const tipX = stemX + Math.round(sway);
    px(ctx, tipX, tipY, colors.light);
    px(ctx, tipX + 1, tipY + 1, colors.leaf);
    px(ctx, tipX - 1, tipY + 1, colors.leaf);
    if (traits.marking > 0.6) {
      px(ctx, tipX + 2, tipY + 2, withAlpha(colors.light, 0.7));
    }
  }
}

function drawMushroom(
  ctx: CanvasRenderingContext2D,
  plant: Plant,
  x: number,
  baseY: number,
  scale: number,
  _opts: PlantDrawOptions,
  sway: number,
): void {
  const s = sizeOf(scale);
  const g = plant.growth;
  const traits = traitsFor(plant.species, plant.seed);
  const colors = traits.colors;
  const cap = colors.cap;
  const capLight = colors.capLight;
  const capDark = colors.capDark;

  const height = Math.max(2, Math.round((3 + 15 * g) * scale));
  const capWidth = Math.max(3, Math.round((3 + 15 * g) * scale * (0.94 + traits.vigor * 0.07)));
  const capHeight = Math.max(1, Math.round((1 + 4.2 * g) * scale));
  const stemWidth = Math.max(1, Math.round((1 + g * 0.9) * scale));
  const stemX = x + Math.round(sway * 0.4);
  const capY = baseY - height;

  for (let i = 0; i < height; i += 1) {
    rect(ctx, stemX - Math.floor(stemWidth / 2), baseY - i, stemWidth, 1, P.mushroom.stem);
  }
  rect(ctx, stemX - Math.floor(stemWidth / 2), baseY - 1, stemWidth, 1, P.mushroom.stemShade);

  for (let dy = -capHeight; dy <= 0; dy += 1) {
    const t = (dy + capHeight) / Math.max(1, capHeight);
    const span = Math.round((capWidth / 2) * Math.sin((Math.PI / 2) * t));
    rect(ctx, stemX - span, capY + dy, span * 2 + 1, 1, dy === 0 ? capDark : cap);
  }
  rect(ctx, stemX - Math.round(capWidth / 2), capY - capHeight, 2, 1, capLight);
  rect(ctx, stemX + Math.round(capWidth / 2) - 1, capY - capHeight + 1, 1, 1, capLight);

  if (g > 0.55) {
    const dots = 2 + Math.floor(g * 2);
    for (let index = 0; index < dots; index += 1) {
      const dx = Math.round((hash2(index, 3, plant.seed) - 0.5) * capWidth * 0.7);
      const dy = -Math.round((0.35 + hash2(index, 9, plant.seed) * 0.5) * capHeight);
      if (Math.abs(dx) < capWidth / 2) px(ctx, stemX + dx, capY + dy, colors.dot);
    }
  }

  if (g > 0.82) {
    const smallX = stemX + s(3);
    const smallH = Math.max(2, Math.round(height * 0.45));
    const smallW = Math.max(2, Math.round(capWidth * 0.5));
    rect(ctx, smallX, baseY - smallH, 1, smallH, P.mushroom.stem);
    for (let dy = -Math.round(smallH * 0.3); dy <= 0; dy += 1) {
      const span = Math.round((smallW / 2) * (1 + dy / Math.max(1, smallH * 0.3)));
      rect(ctx, smallX - span, baseY - smallH + dy, span * 2 + 1, 1, cap);
    }
    px(ctx, smallX, baseY - smallH - 1, capLight);
  }
}

function drawFlower(
  ctx: CanvasRenderingContext2D,
  plant: Plant,
  x: number,
  baseY: number,
  scale: number,
  _opts: PlantDrawOptions,
  sway: number,
): void {
  const g = plant.growth;
  const traits = traitsFor(plant.species, plant.seed);
  const palette = { petal: traits.colors.petal, light: traits.colors.petalLight };
  const height = Math.max(2, Math.round((3 + 31 * g) * scale * (0.96 + traits.vigor * 0.05)));
  let topX = x;
  let topY = baseY;

  for (let i = 0; i <= height; i += 1) {
    const t = i / height;
    const offset =
      Math.round(Math.sin(t * 1.7 + (plant.seed % 30) * 0.1) * (0.8 + scale * 0.35) * t) +
      Math.round(sway * t);
    px(ctx, x + offset, baseY - i, i % 4 === 0 ? P.flower.stem : P.flower.stem);
    if (i === height) {
      topX = x + offset;
      topY = baseY - i;
    }
  }

  if (g > 0.3) {
    for (const leafAt of [0.32, 0.58]) {
      if (g < leafAt + 0.12) continue;
      const t = leafAt;
      const y = baseY - Math.round(height * t);
      const offset = Math.round(
        Math.sin(t * 1.7 + (plant.seed % 30) * 0.1) * (0.8 + scale * 0.35) * t,
      );
      const side = leafAt === 0.32 ? -1 : 1;
      const len = Math.max(1, Math.round((1.6 + g * 1.4) * scale));
      for (let k = 1; k <= len; k += 1) {
        px(ctx, x + offset + side * k, y - Math.round(k * 0.7), k === len ? P.flower.leaf : P.flower.leafDark);
      }
    }
  }

  if (g < 0.32) {
    px(ctx, topX, topY, palette.petal);
    px(ctx, topX, topY - 1, palette.light);
    return;
  }

  const radius = Math.max(1.5, (1.3 + g * 2.1) * scale);
  const petalRadius = Math.round(radius);
  const directions = [
    [0, -1],
    [1, -1],
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
  ];
  for (const [dx, dy] of directions) {
    const length = Math.max(1, Math.round(petalRadius * (dx !== 0 && dy !== 0 ? 0.82 : 1)));
    px(ctx, topX + dx * length, topY + dy * length, palette.petal);
    if (length > 2) {
      px(ctx, topX + dx * (length - 1), topY + dy * (length - 1), palette.light);
    }
  }
  const center = Math.max(1, Math.round(scale));
  rect(ctx, topX - (center - 1), topY - (center - 1), center * 2 - 1, center * 2 - 1, P.flower.center);
  px(ctx, topX, topY, P.flower.centerDark);
}

function drawSucculent(
  ctx: CanvasRenderingContext2D,
  plant: Plant,
  x: number,
  baseY: number,
  scale: number,
  _opts: PlantDrawOptions,
  _sway: number,
): void {
  const g = plant.growth;
  const traits = traitsFor(plant.species, plant.seed);
  const colors = traits.colors;
  const height = Math.max(2, Math.round((2 + 12 * g) * scale));
  const centerY = baseY - Math.round(height * 0.45);
  const leaves = 4 + Math.round(g * 7);
  const spread = 0.95 + g * 0.2;

  for (let index = 0; index < leaves; index += 1) {
    const angle = -Math.PI + (Math.PI * 2 * index) / leaves + (plant.seed % 10) * 0.04;
    const ring = index % 3;
    const length = Math.max(1, Math.round((1.8 + g * 3.4 + ring * 0.9) * scale * spread));
    const tipX = x + Math.round(Math.cos(angle) * length);
    const tipY = centerY + Math.round(Math.sin(angle) * length * 0.72);
    const color =
      ring === 0 ? colors.mid : ring === 1 ? colors.light : colors.edge;
    const steps = Math.max(1, length);
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      px(
        ctx,
        x + Math.round((tipX - x) * t),
        centerY + Math.round((tipY - centerY) * t),
        t > 0.7 ? color : colors.dark,
      );
    }
    px(ctx, tipX, tipY, colors.edge);
  }

  px(ctx, x, centerY - 1, colors.edge);
  px(ctx, x + 1, centerY - 1, colors.light);
  if (g > 0.8) {
    px(ctx, x - 1, centerY - 2, colors.edge);
  }
}

function drawVine(
  ctx: CanvasRenderingContext2D,
  plant: Plant,
  x: number,
  baseY: number,
  scale: number,
  _opts: PlantDrawOptions,
  sway: number,
): void {
  const s = sizeOf(scale);
  const g = plant.growth;
  const traits = traitsFor(plant.species, plant.seed);
  const colors = traits.colors;
  const height = Math.max(3, Math.round((4 + 48 * g) * scale));
  const stakeTop = baseY - height - s(2);

  rect(ctx, x + s(1), stakeTop, 1, height + s(2), P.soil.root);
  rect(ctx, x + s(1), stakeTop, 2, 1, P.wood.light);

  for (let i = 0; i <= height; i += 1) {
    const t = i / height;
    const offset =
      Math.round(Math.sin(t * 4.1 + (plant.seed % 50) * 0.04) * (1.6 + scale * 0.8)) +
      Math.round(sway * t * 0.6);
    px(ctx, x + offset, baseY - i, i % 6 === 0 ? colors.light : colors.stem);
  }

  const leafEvery = Math.max(4, Math.round(6 * scale));
  for (let i = leafEvery; i < height; i += leafEvery) {
    const t = i / height;
    const offset =
      Math.round(Math.sin(t * 4.1 + (plant.seed % 50) * 0.04) * (1.6 + scale * 0.8)) +
      Math.round(sway * t * 0.6);
    const side = i / leafEvery % 2 === 0 ? 1 : -1;
    const y = baseY - i;
    const len = Math.max(1, Math.round((1.5 + g * 1.2) * scale));
    for (let k = 1; k <= len; k += 1) {
      px(ctx, x + offset + side * k, y - Math.round(k * 0.6), colors.leaf);
    }
    px(ctx, x + offset + side * (len + 1), y - Math.round((len + 1) * 0.6), colors.light);
  }

  if (g > 0.72) {
    const topX = x + Math.round(sway * 0.6);
    const topY = baseY - height;
    px(ctx, topX + 1, topY - 1, colors.bloom);
    px(ctx, topX + 2, topY - 1, colors.light);
    px(ctx, topX + 3, topY - 2, colors.stem);
    px(ctx, topX + 4, topY - 2, colors.light);
  }
}

function drawCrystal(
  ctx: CanvasRenderingContext2D,
  plant: Plant,
  x: number,
  baseY: number,
  scale: number,
  opts: PlantDrawOptions,
  _sway: number,
): void {
  const s = sizeOf(scale);
  const g = plant.growth;
  const traits = traitsFor(plant.species, plant.seed);
  const colors = traits.colors;
  const height = Math.max(2, Math.round((3 + 27 * g) * scale));
  const shards = [
    { dx: -s(3), height: Math.round(height * 0.52), width: Math.max(1, Math.round(scale)) },
    { dx: 0, height, width: Math.max(1, Math.round(scale * 1.4)) },
    { dx: s(4), height: Math.round(height * 0.66), width: Math.max(1, Math.round(scale)) },
  ];
  if (traits.variant > 0 && g > 0.55) {
    shards.push({
      dx: -s(6),
      height: Math.round(height * 0.38),
      width: Math.max(1, Math.round(scale * 0.8)),
    });
  }

  if (opts.night) {
    for (const shard of shards) {
      const cx = x + shard.dx;
      const top = baseY - shard.height;
      ctx.fillStyle = withAlpha(colors.glow, 0.1);
      ctx.fillRect(cx - s(3), top - s(3), s(6), shard.height + s(3));
    }
  }

  for (const shard of shards) {
    const cx = x + shard.dx;
    const top = baseY - shard.height;
    for (let i = 0; i < shard.height; i += 1) {
      const t = i / Math.max(1, shard.height);
      const width = t > 0.82 ? 1 : shard.width;
      const color = t > 0.9 ? colors.edge : t > 0.45 ? colors.mid : colors.dark;
      rect(ctx, cx - Math.floor(width / 2), baseY - i, width, 1, color);
      if (width > 1 && t < 0.75) {
        px(ctx, cx, baseY - i, colors.light);
      }
    }
    px(ctx, cx, top - 1, colors.light);
  }
  if (g > 0.6) {
    px(ctx, x - s(1), baseY - Math.round(height * 0.8), colors.light);
  }
}

export function drawPlant(
  ctx: CanvasRenderingContext2D,
  plant: Plant,
  x: number,
  baseY: number,
  scale: number,
  opts: PlantDrawOptions,
): void {
  const g = plant.growth;
  let drawScale = scale;
  if (opts.maxHeight && opts.maxHeight > 0) {
    const units = plantHeightUnits(plant);
    if (units * drawScale > opts.maxHeight) drawScale = opts.maxHeight / units;
  }
  const sway = opts.motion
    ? Math.round(Math.sin(opts.now * 0.0011 + (plant.seed % 100) * 0.13) * (0.8 + drawScale * 0.25))
    : 0;
  const s = sizeOf(drawScale);

  shadow(
    ctx,
    Math.round(x),
    baseY,
    Math.max(3, Math.round(7 * drawScale * (0.6 + g * 0.6))),
    drawScale >= 1.3 ? 2 : 1,
  );
  if (g < 0.12) {
    px(ctx, Math.round(x), baseY - 1, P.moss.bright);
    px(ctx, Math.round(x) - 1, baseY - 2, P.moss.light);
    px(ctx, Math.round(x) + 1, baseY - 2, P.moss.light);
  }

  switch (plant.species) {
    case 'fern':
      drawFern(ctx, plant, x, baseY, drawScale, opts, sway);
      break;
    case 'mushroom':
      drawMushroom(ctx, plant, x, baseY, drawScale, opts, sway);
      break;
    case 'flower':
      drawFlower(ctx, plant, x, baseY, drawScale, opts, sway);
      break;
    case 'succulent':
      drawSucculent(ctx, plant, x, baseY, drawScale, opts, sway);
      break;
    case 'vine':
      drawVine(ctx, plant, x, baseY, drawScale, opts, sway);
      break;
    case 'crystal':
      drawCrystal(ctx, plant, x, baseY, drawScale, opts, sway);
      break;
    default:
      break;
  }

  if (g < 0.04) {
    px(ctx, Math.round(x), baseY - 1, P.moss.bright);
    px(ctx, Math.round(x) - 1, baseY - 2, P.moss.light);
    px(ctx, Math.round(x) + 1, baseY - 2, P.moss.light);
  }

  // A tiny ring of disturbed moss at the base makes the plant feel planted.
  if (drawScale > 0.8) {
    px(ctx, Math.round(x) - s(2), baseY, P.moss.dark);
    px(ctx, Math.round(x) + s(2), baseY, P.moss.dark);
  }
}
