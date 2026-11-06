import type { TerrariumState, TaskStar } from './types';
import { JAR, PLANT_SLOTS, SCENE_H, SCENE_W } from './layout';
import type { PlantSlot } from './layout';
import { P, SKY_KEYS } from './palette';
import {
  bandedGradient,
  clamp,
  hash2,
  hline,
  jarPath,
  mixHex,
  pixelCircle,
  pixelEllipse,
  pixelLine,
  pixelText,
  pixelTextWidth,
  px,
  rect,
  vline,
  withAlpha,
} from './pixel';
import {
  focusDuskActive,
  rareWeatherFor,
  seasonAt,
  weatherFor,
  type RareWeather,
  type SeasonState,
  type WeatherState,
} from './atmosphere';
import { constellationPairs, starPoint, visibleStars } from './constellations';
import { REST_MOSS_FULL_MS, STAR_RETENTION_MS } from './state';
import { drawPlant } from './plants';
import { drawCreature } from './creatures';

export interface PointerState {
  x: number;
  y: number;
  active: boolean;
}

export interface SceneEffects {
  mistAt: number;
  taskAt: number;
  unlockAt: number;
  startleAt: number;
  startleX: number;
  startleY: number;
  focusDoneAt: number;
}

export interface SceneOptions {
  motion: boolean;
  idle: boolean;
  atmosphere: boolean;
  effects: SceneEffects;
  pointer?: PointerState | null;
}

export const EMPTY_EFFECTS: SceneEffects = {
  mistAt: 0,
  taskAt: 0,
  unlockAt: 0,
  startleAt: 0,
  startleX: 0,
  startleY: 0,
  focusDoneAt: 0,
};

export interface SkyState {
  top: string;
  bottom: string;
  light: number;
  hour: number;
  night: boolean;
}

const SKY = SKY_KEYS as readonly {
  hour: number;
  top: string;
  bottom: string;
  light: number;
}[];

export function skyAt(now: number): SkyState {
  const date = new Date(now);
  const hour = date.getHours() + date.getMinutes() / 60;
  let first = SKY[0];
  let second = SKY[SKY.length - 1];
  for (let index = 0; index < SKY.length - 1; index += 1) {
    if (hour >= SKY[index].hour && hour <= SKY[index + 1].hour) {
      first = SKY[index];
      second = SKY[index + 1];
      break;
    }
  }
  const span = Math.max(0.001, second.hour - first.hour);
  const t = clamp((hour - first.hour) / span, 0, 1);
  const light = first.light + (second.light - first.light) * t;
  return {
    top: mixHex(first.top, second.top, t),
    bottom: mixHex(first.bottom, second.bottom, t),
    light,
    hour,
    night: light < 0.3,
  };
}

function drawStars(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  now: number,
  opacity: number,
): void {
  if (opacity <= 0.02) return;
  for (let index = 0; index < 22; index += 1) {
    const sx = x + Math.round(hash2(index, 4, 81) * w);
    const sy = y + Math.round(hash2(index, 9, 81) * h * 0.58);
    const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(now * 0.0013 + index * 1.7));
    px(ctx, sx, sy, withAlpha(index % 5 === 0 ? '#ffe9b8' : '#e8f4ef', opacity * twinkle));
    if (index % 7 === 0) {
      px(ctx, sx + 1, sy, withAlpha('#e8f4ef', opacity * twinkle * 0.4));
    }
  }
}

function drawSunAndMoon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  sky: SkyState,
  detail: number,
): void {
  const radius = Math.max(3, Math.round(4 * detail));
  if (sky.hour >= 5.4 && sky.hour <= 20.6 && sky.light > 0.12) {
    const t = clamp((sky.hour - 6) / 12, 0, 1);
    const sunX = Math.round(x + w * (0.15 + 0.7 * t));
    const sunY = Math.round(y + h * (0.47 - 0.23 * Math.sin(Math.PI * t)));
    const reach = radius * 3.4;
    const halo = ctx.createRadialGradient(sunX, sunY, radius * 0.5, sunX, sunY, reach);
    halo.addColorStop(0, 'rgba(255, 236, 184, 0.4)');
    halo.addColorStop(0.45, 'rgba(255, 230, 170, 0.12)');
    halo.addColorStop(1, 'rgba(255, 230, 170, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(sunX - reach, sunY - reach, reach * 2, reach * 2);
    pixelCircle(ctx, sunX, sunY, radius, mixHex('#ffe9b0', sky.bottom, 0.25));
    pixelCircle(ctx, sunX, sunY, Math.max(1, radius - 2), '#fff4c8');
    return;
  }
  if (sky.light < 0.42) {
    const nightT =
      sky.hour >= 18 ? (sky.hour - 18) / 12 : sky.hour < 6 ? (sky.hour + 6) / 12 : 0.5;
    const moonX = Math.round(x + w * (0.18 + 0.62 * clamp(nightT, 0, 1)));
    const moonY = Math.round(y + h * (0.3 - 0.08 * Math.sin(Math.PI * clamp(nightT, 0, 1))));
    pixelCircle(ctx, moonX, moonY, radius, '#dfe9e6');
    pixelCircle(ctx, moonX + Math.max(1, radius - 1), moonY - 1, Math.max(1, radius - 2), sky.top);
    px(ctx, moonX - radius + 2, moonY - 1, '#f6fbf4');
  }
}

function drawCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  color: string,
): void {
  const s = Math.max(1, Math.round(scale));
  rect(ctx, x, y, 9 * s, 2 * s, color);
  rect(ctx, x + 2 * s, y - s, 5 * s, s, color);
  rect(ctx, x + 6 * s, y - s, 2 * s, s, color);
}

const STAR_TINTS = ['#ffe9b8', '#e8f4ef', '#d7e6ff', '#f7d9e0'];

function drawTaskStars(
  ctx: CanvasRenderingContext2D,
  stars: TaskStar[],
  now: number,
  x: number,
  y: number,
  w: number,
  h: number,
  opacity: number,
): void {
  if (opacity <= 0.02 || stars.length === 0) return;
  const sky = { x, y, w, h };
  const points = stars.map((star) => starPoint(star, sky));
  for (const [a, b] of constellationPairs(stars)) {
    const first = points[a];
    const second = points[b];
    if (!first || !second) continue;
    pixelLine(ctx, first.x, first.y, second.x, second.y, withAlpha('#cfe3ef', opacity * 0.16));
  }
  stars.forEach((star, index) => {
    const point = points[index];
    if (!point) return;
    const twinkle = 0.62 + 0.38 * Math.sin(now * 0.0011 + index * 1.7);
    const tint = STAR_TINTS[star.color % STAR_TINTS.length];
    const alpha = opacity * twinkle;
    px(ctx, point.x, point.y, withAlpha(tint, alpha));
    if (star.size > 1) {
      px(ctx, point.x - 1, point.y, withAlpha(tint, alpha * 0.55));
      px(ctx, point.x + 1, point.y, withAlpha(tint, alpha * 0.55));
      px(ctx, point.x, point.y - 1, withAlpha(tint, alpha * 0.7));
      px(ctx, point.x, point.y + 1, withAlpha(tint, alpha * 0.45));
    }
  });
}

function drawSky(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  now: number,
  detail: number,
  horizon: number,
  season: SeasonState,
  stars: TaskStar[],
): SkyState {
  const sky = skyAt(now);
  const top = mixHex(sky.top, season.tint, 0.13);
  const bottom = mixHex(sky.bottom, season.mossTint, 0.1);
  bandedGradient(ctx, x, y, w, h, top, bottom, 20);
  const starOpacity = clamp(0.75 - sky.light * 1.6, 0, 0.85);
  drawStars(ctx, x, y, w, h * horizon + 2, now, starOpacity);
  drawTaskStars(ctx, stars, now, x, y, w, h * horizon, starOpacity * 0.95);
  drawSunAndMoon(ctx, x, y, w, h, sky, detail);

  if (sky.light > 0.3) {
    const drift = w + 30 * detail;
    const cloudX = x + ((now * 0.0035 + 14) % drift) - 20 * detail;
    drawCloud(
      ctx,
      cloudX,
      y + h * 0.16,
      Math.max(1, detail * 0.7),
      withAlpha('#fff6dd', 0.28 * sky.light),
    );
    const cloudX2 = x + ((now * 0.0021 + 52) % drift) - 20 * detail;
    drawCloud(
      ctx,
      cloudX2,
      y + h * 0.27,
      Math.max(1, detail * 0.48),
      withAlpha('#fff6dd', 0.2 * sky.light),
    );
  }

  const backSoil = y + h * horizon;
  const hillBack = mixHex(sky.bottom, '#4c7263', 0.58);
  const hillFront = mixHex(sky.bottom, '#2f4c40', 0.76);
  const step = detail > 1.5 ? 2 : 1;
  for (let column = 0; column < w; column += step) {
    const rx = column / Math.max(1, w);
    const heightBack =
      4 * detail +
      Math.sin(rx * 17 + 1.3) * 1.6 * detail +
      Math.sin(rx * 6.4 + 2.1) * 3.2 * detail;
    const topBack = Math.round(backSoil - heightBack);
    rect(ctx, x + column, topBack, step, Math.ceil(backSoil - topBack), hillBack);
    const heightFront =
      2 * detail +
      Math.sin(rx * 21 + 4.4) * 1.1 * detail +
      Math.sin(rx * 8.7 + 0.6) * 2.1 * detail;
    const topFront = Math.round(backSoil - heightFront);
    rect(ctx, x + column, topFront, step, Math.ceil(backSoil - topFront), hillFront);
  }

  if (detail > 1.1) {
    for (let index = 0; index < 6; index += 1) {
      const treeX = Math.round(x + w * (0.08 + index * 0.15 + hash2(index, 2, 7) * 0.03));
      const treeBase = Math.round(backSoil - 2 * detail);
      const treeH = Math.round((3 + hash2(index, 8, 7) * 3) * detail);
      vline(ctx, treeX, treeBase - treeH, treeH, hillFront);
      for (let row = 0; row < treeH; row += 1) {
        const span = Math.round(((row + 1) / treeH) * 2 * detail);
        rect(ctx, treeX - span, treeBase - treeH + row, span * 2 + 1, 1, hillBack);
      }
    }
  }

  return sky;
}

function drawSoil(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  detail: number,
  horizon: number,
): { backSoil: number; frontSoil: number } {
  const backSoil = y + h * horizon;
  // Keep the visible soil face proportional on both the jar and the wide shelf.
  const frontSoil = y + h * (horizon + (1 - horizon) * 0.56);
  const bottom = y + h;
  const cell = 1;

  rect(ctx, x, backSoil, w, bottom - backSoil, P.soil.dark);

  for (let row = backSoil; row < frontSoil; row += cell) {
    const depth = (row - backSoil) / Math.max(1, frontSoil - backSoil);
    for (let column = 0; column < w; column += cell) {
      const noise = hash2(column, row, 31);
      let color: string = P.moss.mid;
      if (noise < 0.07) color = P.moss.deep;
      else if (noise < 0.28) color = P.moss.dark;
      else if (noise < 0.8) color = P.moss.mid;
      else if (noise < 0.95) color = P.moss.light;
      else color = P.moss.bright;
      if (depth < 0.16 && noise > 0.35) color = mixHex(color, P.moss.deep, 0.3);
      rect(ctx, x + column, row, cell, cell, color);
    }
  }

  hline(ctx, x, Math.round(backSoil), w, P.soil.back);
  hline(ctx, x, Math.round(backSoil) + 1, w, withAlpha(P.moss.deep, 0.65));

  for (let index = 0; index < Math.round(18 * detail); index += 1) {
    const tx = x + hash2(index, 3, 5) * w;
    const ty = backSoil + 2 + hash2(index, 8, 5) * (frontSoil - backSoil - 4);
    const tuft = 1 + Math.round(hash2(index, 9, 5) * 2 * detail);
    vline(ctx, Math.round(tx), Math.round(ty - tuft), tuft, P.moss.bright);
    px(ctx, Math.round(tx) + 1, Math.round(ty - tuft + 1), P.moss.light);
  }

  for (let index = 0; index < 7; index += 1) {
    const sx = x + hash2(index, 12, 17) * w;
    const sy = backSoil + 3 + hash2(index, 18, 17) * (frontSoil - backSoil - 5);
    rect(ctx, Math.round(sx), Math.round(sy), Math.max(1, Math.round(detail)), 1, P.soil.pebble);
  }

  rect(ctx, x, Math.round(frontSoil) - 1, w, Math.max(1, Math.round(detail)), P.moss.deep);
  hline(ctx, x, Math.round(frontSoil) + 1, w, P.moss.dark);

  const faceTop = Math.round(frontSoil) + 2;
  rect(ctx, x, faceTop, w, bottom - faceTop, P.soil.dark);
  hline(ctx, x, faceTop, w, P.soil.mid);
  hline(ctx, x, faceTop + 1, w, P.soil.dark);
  hline(ctx, x, Math.round(faceTop + (bottom - faceTop) * 0.45), w, P.soil.mid);
  hline(ctx, x, Math.round(faceTop + (bottom - faceTop) * 0.7), w, P.soil.light);

  for (let index = 0; index < Math.round(22 * detail); index += 1) {
    const pxX = x + hash2(index, 22, 9) * w;
    const pyY = faceTop + (bottom - faceTop) * (0.45 + hash2(index, 27, 9) * 0.52);
    const pebble = Math.max(1, Math.round(detail * (0.7 + hash2(index, 31, 9))));
    rect(ctx, Math.round(pxX), Math.round(pyY), pebble, pebble > 1 ? 2 : 1, index % 4 === 0 ? P.soil.pebbleLight : P.soil.pebble);
  }

  for (let index = 0; index < 4; index += 1) {
    const rootX = x + hash2(index, 33, 11) * w;
    pixelLine(
      ctx,
      rootX,
      frontSoil,
      rootX + (hash2(index, 37, 11) - 0.5) * 8 * detail,
      frontSoil + (4 + hash2(index, 41, 11) * 10) * detail,
      withAlpha(P.soil.root, 0.55),
    );
  }

  return { backSoil, frontSoil };
}

function drawStaticDecor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  detail: number,
  horizon: number,
): void {
  const s = Math.max(1, Math.round(detail * 0.9));

  const rockX = Math.round(x + w * 0.13);
  const rockY = Math.round(y + h * (horizon + 0.11));
  pixelEllipse(ctx, rockX, rockY, 4 * s, 2 * s, P.soil.pebble);
  pixelEllipse(ctx, rockX, rockY - 1, 4 * s, s, P.soil.pebbleLight);
  rect(ctx, rockX - 3 * s, rockY - 2 * s, 5 * s, s, P.moss.dark);
  px(ctx, rockX - 1 * s, rockY - 2 * s, P.moss.bright);

  const woodX = Math.round(x + w * 0.73);
  const woodY = Math.round(y + h * (horizon + 0.065));
  pixelLine(ctx, woodX - 5 * s, woodY, woodX + 6 * s, woodY - 2 * s, P.wood.mid);
  pixelLine(ctx, woodX - 5 * s, woodY + 1, woodX + 6 * s, woodY - 1, P.wood.dark);
  pixelLine(ctx, woodX + 2 * s, woodY - 1, woodX + 5 * s, woodY - 4 * s, P.wood.mid);
  px(ctx, woodX - 4 * s, woodY, P.wood.light);
  px(ctx, woodX + 5 * s, woodY - 2 * s, P.wood.light);

  for (let index = 0; index < 3; index += 1) {
    const mx = Math.round(x + w * (0.07 + index * 0.8 + hash2(index, 6, 13) * 0.03));
    const my = Math.round(y + h * (horizon + 0.135 + hash2(index, 5, 13) * 0.02));
    const cap = index % 2 === 0 ? P.mushroom.cap : P.mushroom.amber;
    rect(ctx, mx, my - 2, 1, 2, P.mushroom.stem);
    rect(ctx, mx - 1, my - 3, 3, 1, cap);
    px(ctx, mx - 1, my - 3, P.mushroom.dot);
  }

  for (let index = 0; index < Math.round(7 * detail); index += 1) {
    const gx = Math.round(x + hash2(index, 16, 23) * w);
    const gy = Math.round(y + h * (horizon + 0.165 + hash2(index, 21, 23) * 0.035));
    vline(ctx, gx, gy - Math.max(1, s), Math.max(1, s), P.moss.dark);
  }

  if (detail > 0.9) {
    const stoneX = Math.round(x + w * 0.045);
    const stoneY = Math.round(y + h * (horizon + 0.165));
    pixelEllipse(ctx, stoneX, stoneY, 2 * s, s, P.soil.pebble);
    px(ctx, stoneX, stoneY - s, P.soil.pebbleLight);
  }
}

/** A quiet mound that only widens while you are away from the jar. */
function drawRestMoss(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  detail: number,
  horizon: number,
  restMs: number,
  now: number,
  opts: SceneOptions,
): void {
  const level = clamp(restMs / REST_MOSS_FULL_MS, 0, 1);
  if (level < 0.012) return;

  const s = Math.max(1, Math.round(detail));
  const centerX = Math.round(x + w * 0.895);
  const baseY = Math.round(y + h * (horizon + 0.125));
  const width = Math.round((4 + 20 * level) * s);
  const height = Math.round((2 + 6 * level) * s);
  const sway = opts.motion ? Math.round(Math.sin(now * 0.0012) * level) : 0;

  pixelEllipse(ctx, centerX, baseY, Math.round(width / 2), Math.max(1, Math.round(height / 2)), P.moss.deep);
  for (let row = 0; row < height; row += 1) {
    const t = row / Math.max(1, height - 1);
    const span = Math.round((width / 2) * Math.sqrt(Math.max(0, 1 - t * t)));
    for (let column = -span; column <= span; column += 1) {
      const noise = hash2(column + centerX, row + baseY, 173);
      const color =
        t < 0.25
          ? P.moss.sun
          : noise > 0.72
            ? P.moss.bright
            : noise > 0.4
              ? P.moss.light
              : P.moss.mid;
      px(ctx, centerX + column + sway, baseY - row, color);
    }
  }

  if (level > 0.45) {
    const stalks = 2 + Math.round(level * 3);
    for (let index = 0; index < stalks; index += 1) {
      const sx = centerX + Math.round((hash2(index, 4, 179) - 0.5) * width * 0.75);
      const sh = Math.max(1, Math.round((1 + hash2(index, 7, 179) * 3 * level) * s));
      vline(ctx, sx, baseY - height - sh + 1, sh, P.moss.dark);
      px(ctx, sx, baseY - height - sh, P.moss.bright);
      if (level > 0.75 && index % 2 === 0) {
        px(ctx, sx + 1, baseY - height - sh + 1, P.moss.sun);
      }
    }
  }
}

function drawWeather(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  now: number,
  detail: number,
  weather: WeatherState,
  season: SeasonState,
  rare: RareWeather,
  opts: SceneOptions,
): void {
  const motion = opts.motion ? 1 : 0.25;
  const strength = opts.atmosphere ? 1 : 0.55;

  if (weather.kind === 'rain') {
    const count = Math.max(12, Math.round(w / 12));
    for (let index = 0; index < count; index += 1) {
      const dropX = x + hash2(index, 3, 211) * w;
      const speed = (0.05 + hash2(index, 7, 211) * 0.08) * motion;
      const dropY = y + ((hash2(index, 11, 211) * h + now * speed * detail) % (h * 0.92));
      vline(ctx, dropX, dropY, Math.max(1, Math.round(detail * (1 + hash2(index, 13, 211)))), withAlpha('#c5dde2', 0.26 * strength));
      px(ctx, dropX, dropY + 1, withAlpha('#e8f5f2', 0.22 * strength));
    }
  } else if (weather.kind === 'fog') {
    for (let index = 0; index < 4; index += 1) {
      const bandY =
        y +
        h * (0.34 + index * 0.1) +
        Math.sin(now * 0.00018 + index) * 2 * detail * motion;
      const bandW = w * (0.55 + hash2(index, 4, 223) * 0.35);
      const bandX = x + (w - bandW) * hash2(index, 9, 223) + Math.sin(now * 0.00012 + index) * 5 * motion;
      ctx.fillStyle = withAlpha('#d7e6e2', 0.045 * strength);
      ctx.fillRect(Math.round(bandX), Math.round(bandY), Math.round(bandW), Math.max(2, Math.round(4 * detail)));
    }
  } else if (weather.kind === 'golden') {
    ctx.fillStyle = withAlpha('#f0bf78', 0.055 * strength);
    ctx.fillRect(x, y, w, h);
    for (let index = 0; index < 12; index += 1) {
      const gx = x + hash2(index, 5, 227) * w;
      const gy = y + h * (0.2 + hash2(index, 8, 227) * 0.45);
      const pulse = 0.45 + 0.55 * Math.sin(now * 0.0009 + index * 1.4);
      px(ctx, gx, gy, withAlpha('#ffe3a4', 0.35 * pulse * strength));
    }
  }

  if (!rare) return;
  const count = opts.motion ? 30 : 16;
  for (let index = 0; index < count; index += 1) {
    const speed = 0.012 + hash2(index, 5, 233) * 0.02;
    const drift = Math.sin(now * 0.00025 + index * 1.7) * 5 * motion;
    const pxX = x + ((hash2(index, 3, 233) * w + now * 0.004 * motion + drift) % w);
    const pxY =
      y + ((hash2(index, 9, 233) * h * 0.82 + now * speed * detail * motion) % (h * 0.86));
    if (rare === 'snow') {
      px(ctx, pxX, pxY, withAlpha('#f2fbff', 0.62 * strength));
      if (index % 4 === 0) px(ctx, pxX + 1, pxY, withAlpha('#d8edf7', 0.45 * strength));
    } else if (rare === 'leaves') {
      const color = index % 3 === 0 ? season.tint : index % 3 === 1 ? '#c9904d' : '#b86f45';
      px(ctx, pxX, pxY, withAlpha(color, 0.62 * strength));
      px(ctx, pxX + 1, pxY, withAlpha(color, 0.42 * strength));
      if (index % 2 === 0) px(ctx, pxX, pxY + 1, withAlpha(color, 0.3 * strength));
    } else {
      const color = index % 2 === 0 ? '#f8c7d3' : '#f3ecd2';
      px(ctx, pxX, pxY, withAlpha(color, 0.6 * strength));
      px(ctx, pxX - 1, pxY, withAlpha(color, 0.35 * strength));
      px(ctx, pxX + 1, pxY, withAlpha(color, 0.35 * strength));
      if (index % 3 === 0) px(ctx, pxX, pxY - 1, withAlpha(color, 0.35 * strength));
    }
  }
}

function drawFocus(
  ctx: CanvasRenderingContext2D,
  state: TerrariumState,
  now: number,
  x: number,
  y: number,
  w: number,
  h: number,
  detail: number,
  horizon: number,
  opts: SceneOptions,
): void {
  const active = focusDuskActive(state, now);
  const doneElapsed = now - opts.effects.focusDoneAt;
  const afterglow =
    opts.effects.focusDoneAt > 0 && doneElapsed >= 0 && doneElapsed < 4200
      ? 1 - doneElapsed / 4200
      : 0;

  if (!active && afterglow <= 0) return;

  if (active) {
    const progress = clamp(
      (now - state.focus!.startedAt) / Math.max(1, state.focus!.endsAt - state.focus!.startedAt),
      0,
      1,
    );
    ctx.fillStyle = withAlpha('#241d32', 0.2);
    ctx.fillRect(x, y, w, h);
    for (let band = 0; band < 7; band += 1) {
      const bandY = y + h * (0.5 + band * 0.07);
      ctx.fillStyle = withAlpha('#e8a76a', 0.014 * (band + 1) * (0.6 + progress * 0.4));
      ctx.fillRect(x, Math.round(bandY), w, Math.max(1, Math.round(h * 0.07)));
    }

    const vineHeight = Math.round(Math.min(h * 0.62, (9 + 42 * progress) * detail));
    const baseX = Math.round(x + w * 0.86);
    const baseY = Math.round(y + h * (horizon + 0.13));
    let previousX = baseX;
    let previousY = baseY;
    for (let step = 0; step <= vineHeight; step += 1) {
      const t = step / Math.max(1, vineHeight);
      const vx =
        baseX -
        Math.sin(t * 3.1 + now * 0.0004) * 4 * detail * t -
        Math.round(t * 5 * detail);
      const vy = baseY - step;
      pixelLine(ctx, previousX, previousY, vx, vy, step % 7 === 0 ? P.vine.light : P.vine.stem);
      previousX = vx;
      previousY = vy;
      if (step > 2 && step % 6 === 0) {
        const side = step % 12 === 0 ? 1 : -1;
        px(ctx, vx + side * Math.max(1, Math.round(detail)), vy, P.vine.leaf);
        px(ctx, vx + side * Math.max(1, Math.round(detail * 2)), vy, P.vine.light);
      }
    }
    if (progress > 0.42) {
      const bloomX = Math.round(previousX);
      const bloomY = Math.round(previousY);
      px(ctx, bloomX, bloomY, P.vine.bloom);
      px(ctx, bloomX - 1, bloomY, P.crystal.glow);
      px(ctx, bloomX + 1, bloomY, P.vine.light);
      px(ctx, bloomX, bloomY - 1, P.crystal.light);
    }
  }

  if (afterglow > 0) {
    for (let index = 0; index < 18; index += 1) {
      const angle = hash2(index, 2, 241) * Math.PI * 2;
      const radius = (4 + hash2(index, 6, 241) * 20) * detail * (1 - afterglow);
      px(
        ctx,
        x + w * 0.5 + Math.cos(angle) * radius,
        y + h * 0.44 + Math.sin(angle) * radius * 0.6,
        withAlpha(index % 2 === 0 ? '#ffe3a4' : '#f8c7d3', afterglow * 0.8),
      );
    }
  }
}



function creatureScale(detail: number): number {
  return 0.9 * detail;
}

function startleAmount(effects: SceneEffects, now: number): number {
  if (effects.startleAt <= 0) return 0;
  const elapsed = now - effects.startleAt;
  if (elapsed < 0 || elapsed >= 900) return 0;
  return 1 - elapsed / 900;
}

function scatterX(
  baseX: number,
  effects: SceneEffects,
  now: number,
  detail: number,
): number {
  const amount = startleAmount(effects, now);
  if (amount <= 0) return 0;
  const away = baseX >= effects.startleX ? 1 : -1;
  return Math.round(away * amount * 8 * detail);
}

function nearPointer(
  pointer: PointerState | null | undefined,
  x: number,
  y: number,
  radius: number,
): boolean {
  if (!pointer?.active) return false;
  return Math.hypot(pointer.x - x, pointer.y - y) <= radius;
}

function drawGroundCreatures(
  ctx: CanvasRenderingContext2D,
  state: TerrariumState,
  now: number,
  x: number,
  y: number,
  w: number,
  h: number,
  detail: number,
  opts: SceneOptions,
  sky: SkyState,
  horizon: number,
): void {
  const slow = opts.idle ? 0.35 : 1;
  const t = now * slow;
  const baseScale = creatureScale(detail);

  for (const creature of state.creatures) {
    if (creature.species === 'snail') {
      const phase = t * 0.000045 + creature.seed * 0.001;
      const nx = 0.1 + 0.8 * (0.5 + 0.5 * Math.sin(phase));
      const ny = horizon + 0.127 + 0.012 * Math.sin(t * 0.00021 + creature.seed);
      const baseX = Math.round(x + nx * w);
      const baseY = Math.round(y + ny * h) + 1;
      const startle = startleAmount(opts.effects, now);
      drawCreature(
        ctx,
        'snail',
        baseX + scatterX(baseX, opts.effects, now, detail),
        baseY,
        Math.cos(phase) >= 0 ? 1 : -1,
        baseScale,
        creature.seed,
        {
          now,
          motion: opts.motion,
          night: sky.night,
          idle: opts.idle,
          reaction: {
            near: nearPointer(opts.pointer, baseX, baseY - 3 * detail, 13 * detail),
            startle,
          },
        },
      );
    } else if (creature.species === 'ladybug') {
      const phase = t * 0.00013 + creature.seed * 0.01;
      const nx = 0.08 + 0.84 * (0.5 + 0.5 * Math.sin(phase));
      const baseX = Math.round(x + nx * w);
      const baseY = Math.round(y + (horizon + 0.092) * h);
      const startle = startleAmount(opts.effects, now);
      drawCreature(
        ctx,
        'ladybug',
        baseX + scatterX(baseX, opts.effects, now, detail),
        baseY,
        Math.cos(phase) >= 0 ? 1 : -1,
        baseScale,
        creature.seed,
        {
          now,
          motion: opts.motion,
          night: sky.night,
          idle: opts.idle,
          reaction: {
            near: nearPointer(opts.pointer, baseX, baseY - 2 * detail, 11 * detail),
            startle,
          },
        },
      );
    }
  }
}

function drawFrog(
  ctx: CanvasRenderingContext2D,
  state: TerrariumState,
  now: number,
  x: number,
  y: number,
  w: number,
  h: number,
  detail: number,
  opts: SceneOptions,
  sky: SkyState,
  horizon: number,
): void {
  const frog = state.creatures.find((creature) => creature.species === 'frog');
  if (!frog) return;
  const slow = opts.idle ? 0.35 : 1;
  const nx = 0.78 + 0.12 * Math.sin(now * slow * 0.00003 + frog.seed);
  const baseX = Math.round(x + nx * w);
  const baseY = Math.round(y + (horizon + 0.155) * h) + 1;
  const startle = startleAmount(opts.effects, now);
  drawCreature(
    ctx,
    'frog',
    baseX + scatterX(baseX, opts.effects, now, detail) * 1.4,
    baseY,
    1,
    1.02 * detail,
    frog.seed,
    {
      now,
      motion: opts.motion,
      night: sky.night,
      idle: opts.idle,
      reaction: {
        near: nearPointer(opts.pointer, baseX, baseY - 4 * detail, 15 * detail),
        startle,
      },
    },
  );
}

function drawFireflies(
  ctx: CanvasRenderingContext2D,
  state: TerrariumState,
  now: number,
  x: number,
  y: number,
  w: number,
  h: number,
  detail: number,
  opts: SceneOptions,
  sky: SkyState,
): void {
  if (!sky.night) return;
  const firefly = state.creatures.find((creature) => creature.species === 'firefly');
  if (!firefly) return;
  const slow = opts.idle ? 0.4 : 1;
  const t = now * slow;
  const nx = 0.12 + 0.76 * (0.5 + 0.5 * Math.sin(t * 0.00007 + firefly.seed * 0.001));
  const ny = 0.24 + 0.3 * (0.5 + 0.5 * Math.sin(t * 0.00011 + firefly.seed * 0.002));
  const baseX = Math.round(x + nx * w);
  const baseY = Math.round(y + ny * h);
  const startle = startleAmount(opts.effects, now);
  drawCreature(
    ctx,
    'firefly',
    baseX + scatterX(baseX, opts.effects, now, detail) * 2.2,
    baseY - Math.round(startle * 7 * detail),
    1,
    detail,
    firefly.seed,
    {
      now,
      motion: opts.motion,
      night: sky.night,
      idle: opts.idle,
      reaction: {
        near: nearPointer(opts.pointer, baseX, baseY, 18 * detail),
        startle,
      },
    },
  );
}

function drawSleep(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  now: number,
  detail: number,
): void {
  const unit = Math.max(1, Math.round(detail * 1.2));
  const letters = [
    { dx: 0, dy: 0, alpha: 0.55 },
    { dx: 4 * unit, dy: -5 * unit, alpha: 0.38 },
    { dx: 8 * unit, dy: -10 * unit, alpha: 0.22 },
  ];
  const drift = Math.sin(now * 0.0008) * unit;
  for (const letter of letters) {
    const lx = Math.round(x + letter.dx + drift);
    const ly = Math.round(y + letter.dy + Math.sin(now * 0.001 + letter.dx) * unit);
    const color = withAlpha(P.ui.ink, letter.alpha);
    rect(ctx, lx, ly, 3 * unit, unit, color);
    for (let step = 0; step < 3; step += 1) {
      rect(
        ctx,
        lx + Math.round((2 - step) * unit),
        ly + (step + 1) * unit,
        unit,
        unit,
        color,
      );
    }
    rect(ctx, lx, ly + 4 * unit, 3 * unit, unit, color);
  }
}

function drawEffects(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  now: number,
  detail: number,
  effects: SceneEffects,
): void {
  const mistElapsed = now - effects.mistAt;
  if (effects.mistAt > 0 && mistElapsed >= 0 && mistElapsed < 3200) {
    const fade = 1 - mistElapsed / 3200;
    ctx.fillStyle = withAlpha('#bfe4d4', 0.05 * fade);
    ctx.fillRect(x, y, w, h);
    for (let index = 0; index < 30; index += 1) {
      const dropX = x + hash2(index, 2, 19) * w;
      const speed = 0.04 + hash2(index, 4, 19) * 0.06;
      const dropY =
        y + ((hash2(index, 7, 19) * h + mistElapsed * speed * detail) % h);
      px(ctx, dropX, dropY, withAlpha('#d9f4ee', fade * 0.55));
      if (index % 6 === 0) {
        vline(ctx, dropX, dropY, Math.max(1, Math.round(detail * 1.5)), withAlpha('#d9f4ee', fade * 0.25));
      }
    }
  }

  const taskElapsed = now - effects.taskAt;
  if (effects.taskAt > 0 && taskElapsed >= 0 && taskElapsed < 2400) {
    const fade = 1 - taskElapsed / 2400;
    for (let index = 0; index < 16; index += 1) {
      const sparkleX = x + hash2(index, 5, 43) * w;
      const sparkleY =
        y + h * (0.5 + hash2(index, 8, 43) * 0.32) - taskElapsed * 0.02 * detail;
      const color = index % 3 === 0 ? '#fff4c8' : '#f2d77e';
      px(ctx, sparkleX, sparkleY, withAlpha(color, fade));
      if (index % 4 === 0) {
        px(ctx, sparkleX - 1, sparkleY, withAlpha(color, fade * 0.6));
        px(ctx, sparkleX + 1, sparkleY, withAlpha(color, fade * 0.6));
        px(ctx, sparkleX, sparkleY - 1, withAlpha(color, fade * 0.6));
        px(ctx, sparkleX, sparkleY + 1, withAlpha(color, fade * 0.6));
      }
    }
  }

  const unlockElapsed = now - effects.unlockAt;
  if (effects.unlockAt > 0 && unlockElapsed >= 0 && unlockElapsed < 3000) {
    const fade = 1 - unlockElapsed / 3000;
    for (let index = 0; index < 26; index += 1) {
      const angle = hash2(index, 1, 77) * Math.PI * 2;
      const radius = (4 + hash2(index, 2, 77) * 18) * detail * (unlockElapsed / 3000);
      const cx = x + w * 0.5 + Math.cos(angle) * radius;
      const cy = y + h * 0.48 + Math.sin(angle) * radius * 0.55;
      const color = index % 3 === 0 ? '#ffe9a0' : index % 3 === 1 ? '#f7b8c9' : '#d8f0d4';
      px(ctx, cx, cy, withAlpha(color, fade));
    }
  }

  const startleElapsed = now - effects.startleAt;
  if (effects.startleAt > 0 && startleElapsed >= 0 && startleElapsed < 700) {
    const fade = 1 - startleElapsed / 700;
    const radius = (3 + (startleElapsed / 700) * 18) * detail;
    for (let index = 0; index < 18; index += 1) {
      const angle = (index / 18) * Math.PI * 2;
      px(
        ctx,
        effects.startleX + Math.cos(angle) * radius,
        effects.startleY + Math.sin(angle) * radius * 0.5,
        withAlpha('#e8dcc0', fade * 0.5),
      );
    }
  }
}

function drawDust(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  now: number,
  detail: number,
  light: number,
): void {
  if (light < 0.25) return;
  for (let index = 0; index < 14; index += 1) {
    const drift = now * 0.00002 * (1 + hash2(index, 3, 29));
    const mx =
      x + ((hash2(index, 6, 29) * w + drift * w) % w);
    const my =
      y +
      h * 0.1 +
      ((hash2(index, 9, 29) * h * 0.55 + Math.sin(now * 0.0004 + index) * 2 * detail) % (h * 0.6));
    const alpha = (0.08 + hash2(index, 12, 29) * 0.18) * light;
    px(ctx, mx, my, withAlpha('#fff4cf', alpha));
  }
}

function drawVignette(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  sky: SkyState,
): void {
  const tint = sky.night
    ? withAlpha('#081827', 0.28)
    : sky.light < 0.5
      ? withAlpha('#4a2b36', 0.07)
      : null;
  if (tint) {
    ctx.fillStyle = tint;
    ctx.fillRect(x, y, w, h);
  }
  const gradient = ctx.createRadialGradient(
    x + w / 2,
    y + h * 0.45,
    Math.min(w, h) * 0.25,
    x + w / 2,
    y + h * 0.45,
    Math.max(w, h) * 0.72,
  );
  gradient.addColorStop(0, 'rgba(6, 15, 12, 0)');
  gradient.addColorStop(1, sky.night ? 'rgba(4, 12, 18, 0.34)' : 'rgba(20, 32, 24, 0.2)');
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, w, h);
}

interface WorldLayout {
  slots?: PlantSlot[];
  /** Multiplies the drawn size of plants without moving their roots. */
  plantScale?: number;
  /** Multiplies the drawn size of residents. */
  creatureScale?: number;
  /** Tints the moss band so silhouettes separate from the bright ground. */
  soilShade?: string;
  /** Extra ground cover drawn on the soil, behind the plants. */
  decor?: (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => void;
}

function drawWorld(
  ctx: CanvasRenderingContext2D,
  state: TerrariumState,
  now: number,
  x: number,
  y: number,
  w: number,
  h: number,
  detail: number,
  opts: SceneOptions,
  horizon: number,
  layout: WorldLayout = {},
): void {
  const slots = layout.slots ?? PLANT_SLOTS;
  const season = seasonAt(now);
  const weather = weatherFor(state, now, !opts.idle);
  const rare = rareWeatherFor(now);
  const stars = visibleStars(state.stars, now, STAR_RETENTION_MS);
  const sky = drawSky(ctx, x, y, w, h, now, detail, horizon, season, stars);
  drawSoil(ctx, x, y, w, h, detail, horizon);
  ctx.fillStyle = withAlpha(season.mossTint, 0.05);
  ctx.fillRect(x, y + h * horizon, w, h * (1 - horizon) + 1);
  if (layout.soilShade) {
    ctx.fillStyle = layout.soilShade;
    ctx.fillRect(x, y + h * horizon, w, h * (1 - horizon) + 1);
  }
  drawStaticDecor(ctx, x, y, w, h, detail, horizon);
  drawRestMoss(ctx, x, y, w, h, detail, horizon, state.restMs, now, opts);
  layout.decor?.(ctx, x, y, w, h);

  const scaleBase = detail * (layout.plantScale ?? 1);
  const plants = state.plants
    .map((plant) => ({ plant, slot: slots[plant.slot] }))
    .filter((entry) => Boolean(entry.slot))
    .sort((a, b) => a.slot.z - b.slot.z || a.slot.y - b.slot.y);

  const drawOne = (plant: TerrariumState['plants'][number], slot: PlantSlot) => {
    const baseY = Math.round(y + (horizon + slot.y - 0.68) * h);
    drawPlant(
      ctx,
      plant,
      Math.round(x + slot.x * w),
      baseY,
      slot.scale * scaleBase,
      {
        now,
        motion: opts.motion,
        night: sky.night,
        detail,
        maxHeight: Math.max(4, baseY - y - 3),
      },
    );
  };

  for (const { plant, slot } of plants) {
    if (slot.z >= 2) continue;
    drawOne(plant, slot);
  }

  const creatureDetail = detail * (layout.creatureScale ?? 1);
  drawGroundCreatures(ctx, state, now, x, y, w, h, creatureDetail, opts, sky, horizon);

  for (const { plant, slot } of plants) {
    if (slot.z < 2) continue;
    drawOne(plant, slot);
  }

  drawFrog(ctx, state, now, x, y, w, h, creatureDetail, opts, sky, horizon);
  drawFireflies(ctx, state, now, x, y, w, h, creatureDetail, opts, sky);

  if (opts.atmosphere) {
    drawDust(ctx, x, y, w, h, now, detail, sky.light);
  }
  drawWeather(ctx, x, y, w, h, now, detail, weather, season, rare, opts);
  drawEffects(ctx, x, y, w, h, now, detail, opts.effects);
  drawVignette(ctx, x, y, w, h, sky);
  drawFocus(ctx, state, now, x, y, w, h, detail, horizon, opts);

  if (opts.idle) {
    drawSleep(
      ctx,
      x + w * 0.74,
      y + h * 0.16,
      now,
      detail,
    );
  }
}

function drawGlass(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radiusTop: number,
  radiusBottom: number,
  detail: number,
): void {
  ctx.save();
  jarPath(ctx, x, y, w, h, radiusTop, radiusBottom);
  ctx.clip();

  ctx.save();
  ctx.globalAlpha = 0.05;
  rect(ctx, x + w * 0.12, y, 5 * detail, h, P.glass.shine);
  rect(ctx, x + w * 0.2, y, 2 * detail, h, P.glass.shine);
  rect(ctx, x + w * 0.72, y, 1 * detail, h, P.glass.shine);
  ctx.restore();

  vline(ctx, x + 5 * detail, y + h * 0.25, h * 0.5, withAlpha(P.glass.shine, 0.2));
  vline(ctx, x + 6 * detail, y + h * 0.3, h * 0.28, withAlpha(P.glass.shine, 0.1));

  for (let index = 0; index < 8; index += 1) {
    const dx = x + w * (0.12 + hash2(index, 4, 61) * 0.76);
    const dy = y + h * (0.03 + hash2(index, 8, 61) * 0.22);
    const size = hash2(index, 12, 61) > 0.7 ? 2 : 1;
    rect(ctx, dx, dy, size, size, withAlpha(P.glass.shine, 0.14));
  }

  ctx.restore();

  ctx.save();
  jarPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, radiusTop, radiusBottom);
  ctx.strokeStyle = P.glass.edge;
  ctx.lineWidth = 2;
  ctx.stroke();
  jarPath(ctx, x + 2.5, y + 2.5, w - 5, h - 5, Math.max(2, radiusTop - 2), Math.max(2, radiusBottom - 2));
  ctx.strokeStyle = withAlpha(P.glass.rim, 0.28);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawWoodBase(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  detail: number,
): void {
  const radius = Math.max(2, Math.round(3 * detail));
  ctx.save();
  jarPath(ctx, x, y, w, h, radius, radius);
  ctx.fillStyle = P.wood.dark;
  ctx.fill();
  ctx.restore();
  rect(ctx, x + 2 * detail, y + 1, w - 4 * detail, 1, P.wood.mid);
  rect(ctx, x + 4 * detail, y + 2, w - 8 * detail, 1, P.wood.light);
  rect(ctx, x + 1 * detail, y + h - 2, w - 2 * detail, 1, P.wood.dark);
  for (let index = 0; index < 8; index += 1) {
    const grainX = x + 4 * detail + hash2(index, 2, 71) * (w - 8 * detail);
    px(ctx, grainX, y + 2 + Math.round(hash2(index, 3, 71) * (h - 4)), withAlpha(P.wood.highlight, 0.35));
  }
  rect(ctx, x + 8 * detail, y + h, 3 * detail, 2, P.wood.dark);
  rect(ctx, x + w - 11 * detail, y + h, 3 * detail, 2, P.wood.dark);
}

export function drawJar(
  ctx: CanvasRenderingContext2D,
  state: TerrariumState,
  now: number,
  opts: SceneOptions,
): void {
  ctx.clearRect(0, 0, SCENE_W, SCENE_H);
  ctx.imageSmoothingEnabled = false;

  const jar = JAR;
  const cx = jar.x + jar.w / 2;
  ctx.fillStyle = 'rgba(8, 18, 13, 0.22)';
  ctx.beginPath();
  ctx.ellipse(cx, jar.baseY + 8, jar.w * 0.47, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  const inner = {
    x: jar.x + jar.innerInset,
    y: jar.y + jar.innerInset,
    w: jar.w - jar.innerInset * 2,
    h: jar.h - jar.innerInset * 2,
  };

  ctx.save();
  jarPath(ctx, inner.x, inner.y, inner.w, inner.h, 26, 4);
  ctx.clip();
  drawWorld(ctx, state, now, inner.x, inner.y, inner.w, inner.h, 1, opts, 0.68, {
    plantScale: 1.2,
    creatureScale: 1.5,
    soilShade: 'rgba(7, 20, 14, 0.07)',
  });
  drawGlass(ctx, inner.x, inner.y, inner.w, inner.h, 26, 4, 1);
  ctx.restore();

  const knobX = jar.x + jar.w / 2;
  rect(ctx, knobX - 2, jar.y - 5, 4, 5, P.wood.mid);
  rect(ctx, knobX - 4, jar.y - 8, 8, 3, P.wood.light);
  hline(ctx, knobX - 4, jar.y - 8, 8, P.wood.highlight);
  px(ctx, knobX - 3, jar.y - 6, P.wood.dark);

  ctx.save();
  jarPath(ctx, jar.x, jar.y, jar.w, jar.h, jar.radiusTop, jar.radiusBottom);
  ctx.strokeStyle = P.glass.edge;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  drawWoodBase(ctx, jar.x - 6, jar.baseY, jar.w + 12, 7, 1);
}

/**
 * The plants keep their slot identity but spread across the shelf, so a garden
 * started in the jar simply moves into the long windowsill.
 */
export const SHELF_SLOTS: PlantSlot[] = [
  { x: 0.075, y: 0.8, scale: 0.9, z: 0 },
  { x: 0.195, y: 0.81, scale: 0.84, z: 0 },
  { x: 0.325, y: 0.796, scale: 0.93, z: 1 },
  { x: 0.445, y: 0.814, scale: 0.86, z: 1 },
  { x: 0.565, y: 0.798, scale: 0.95, z: 1 },
  { x: 0.685, y: 0.812, scale: 0.85, z: 0 },
  { x: 0.805, y: 0.796, scale: 0.92, z: 0 },
  { x: 0.925, y: 0.808, scale: 0.84, z: 0 },
];

/**
 * A young garden starts as a compact bed in the middle of the shelf. Each new
 * plant widens the bed outward, so the garden visibly grows along the windowsill
 * instead of jumping to the far edges on day one.
 */
export function spreadShelfSlots(plants: TerrariumState['plants']): PlantSlot[] {
  const used = plants
    .map((plant) => plant.slot)
    .filter(
      (slot, index, all) =>
        slot >= 0 && slot < SHELF_SLOTS.length && all.indexOf(slot) === index,
    )
    .sort((a, b) => a - b);
  if (used.length === 0) return SHELF_SLOTS;

  const slots = SHELF_SLOTS.map((slot) => ({ ...slot }));
  if (used.length === 1) {
    slots[used[0]] = { ...slots[used[0]], x: 0.5 };
    return slots;
  }

  const half = 0.425 * ((used.length - 1) / (SHELF_SLOTS.length - 1));
  const left = 0.5 - half;
  const right = 0.5 + half;
  used.forEach((slotIndex, rank) => {
    const t = rank / (used.length - 1);
    slots[slotIndex] = { ...slots[slotIndex], x: left + t * (right - left) };
  });
  return slots;
}

/** Small foreground life so a wide shelf never reads as an empty lawn. */
function drawShelfDetails(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  detail: number,
  horizon: number,
  now: number,
  opts: SceneOptions,
): void {
  const s = Math.max(2, Math.round(detail * 1.4));
  const sway = opts.motion ? Math.sin(now * 0.0011) : 0;
  const count = Math.max(36, Math.round(w / 18));

  for (let index = 0; index < count; index += 1) {
    const dx = Math.round(x + hash2(index, 2, 131) * w);
    const depth = hash2(index, 7, 131);
    const dy = Math.round(y + h * (horizon + 0.014 + depth * 0.16));
    const kind = hash2(index, 11, 131);
    const drift = Math.round(sway * (1 + depth * 2));
    const shadowW = (2 + Math.round(hash2(index, 17, 131) * 3)) * s;
    rect(
      ctx,
      dx - Math.round(shadowW / 2),
      dy,
      shadowW,
      1,
      'rgba(8, 24, 16, 0.32)',
    );

    if (kind < 0.3) {
      // A grass tuft: the missing mid-scale between moss and plants.
      const blades = 3 + Math.floor(hash2(index, 13, 131) * 4);
      for (let blade = 0; blade < blades; blade += 1) {
        const bx = dx + Math.round((blade - blades / 2) * s * 0.8);
        const bh = (4 + Math.round(hash2(index, blade + 3, 17) * 5)) * s;
        for (let step = 0; step < bh; step += 1) {
          const color =
            step >= bh - 1
              ? P.moss.sun
              : step < s
                ? P.moss.deep
                : step % 3 === 0
                  ? P.moss.light
                  : P.moss.dark;
          px(
            ctx,
            bx + Math.round((drift * step) / Math.max(1, bh)),
            dy - 1 - step,
            color,
          );
        }
      }
    } else if (kind < 0.46) {
      // Clover.
      const leaves = 4 + Math.floor(hash2(index, 3, 139) * 4);
      for (let leaf = 0; leaf < leaves; leaf += 1) {
        const lx = dx + Math.round((hash2(index, leaf + 5, 139) - 0.5) * 9 * s);
        const ly = dy - 1 - Math.round(hash2(index, leaf + 9, 139) * 3 * s);
        px(ctx, lx, ly, P.moss.bright);
        px(ctx, lx + 1, ly, P.moss.sun);
        px(ctx, lx, ly - 1, P.moss.light);
        if (leaf % 2 === 0) px(ctx, lx - 1, ly, P.moss.dark);
      }
    } else if (kind < 0.58) {
      // Pebble.
      const pw = (2 + Math.round(hash2(index, 4, 149) * 3)) * s;
      pixelEllipse(ctx, dx, dy - 1, pw, Math.max(1, Math.round(pw * 0.55)), P.soil.pebble);
      px(ctx, dx - Math.round(pw / 2), dy - 1, P.soil.pebbleLight);
      px(ctx, dx + Math.round(pw / 2) - 1, dy - 1, P.soil.pebbleLight);
    } else if (kind < 0.74) {
      // Button mushrooms.
      const pair = hash2(index, 6, 151) > 0.75 ? 2 : 1;
      for (let m = 0; m < pair; m += 1) {
        const mx = dx + m * 5 * s;
        const mh = (3 + Math.round(hash2(index, m + 2, 151) * 3)) * s;
        const stemW = Math.max(1, s - 1);
        rect(ctx, mx, dy - 1 - mh, stemW, mh, P.mushroom.stem);
        rect(ctx, mx, dy - 2, stemW, 1, P.mushroom.stemShade);
        const capW = (4 + Math.round(hash2(index, m + 7, 151) * 4)) * s;
        const capH = Math.max(2, s);
        for (let row = 0; row < capH; row += 1) {
          const rowW = Math.max(
            1,
            capW - (capH - 1 - row) * Math.max(1, Math.round(s * 0.6)),
          );
          rect(
            ctx,
            mx - Math.floor(rowW / 2),
            dy - 1 - mh - capH + row,
            rowW,
            1,
            row === 0 ? P.mushroom.capLight : row === capH - 1 ? P.mushroom.capDark : P.mushroom.cap,
          );
        }
      }
    } else if (kind < 0.88) {
      // Tiny flower.
      const fh = (3 + Math.round(hash2(index, 8, 157) * 3)) * s;
      for (let step = 0; step < fh; step += 1) {
        px(ctx, dx, dy - 1 - step, P.flower.leafDark);
      }
      const py = dy - 1 - fh;
      const color = hash2(index, 2, 157) > 0.5 ? P.flower.cream : P.flower.pinkLight;
      const petal = Math.max(1, s - 1);
      px(ctx, dx, py, P.flower.center);
      px(ctx, dx - petal, py, color);
      px(ctx, dx + petal, py, color);
      px(ctx, dx, py - petal, color);
      px(ctx, dx, py + 1, color);
      if (petal > 1) {
        px(ctx, dx - 1, py - 1, color);
        px(ctx, dx + 1, py - 1, color);
      }
    } else {
      // Fallen twig or leaf.
      const lw = (2 + Math.round(hash2(index, 5, 163) * 3)) * s;
      pixelLine(ctx, dx - lw, dy - 1, dx + lw, dy - 2 - Math.max(1, s - 1), P.wood.mid);
      px(ctx, dx + lw, dy - 2 - Math.max(1, s - 1), P.wood.light);
      px(ctx, dx - lw, dy - 1, P.wood.dark);
    }
  }
}

/** Ivy spilling from the top edge of the glass. */
function drawShelfVines(
  ctx: CanvasRenderingContext2D,
  w: number,
  glassH: number,
  detail: number,
  now: number,
  opts: SceneOptions,
): void {
  const count = Math.max(6, Math.round(w / 120));
  const sway = opts.motion ? Math.sin(now * 0.0007) * 0.7 : 0;
  const vineScale = 1.3;
  const time = opts.motion ? now * 0.00025 : 0;
  const thick = detail > 1 ? 2 : 1;
  const leaf = Math.max(1, Math.round(detail * 1.3));

  for (let index = 0; index < count; index += 1) {
    const baseX =
      ((index + 0.4) / count) * w + (hash2(index, 3, 171) - 0.5) * 26 * detail;
    const length = Math.min(
      glassH - 2,
      Math.round((7 + hash2(index, 7, 171) * 21) * detail * vineScale),
    );

    for (let step = 0; step < length; step += 1) {
      const vx =
        baseX +
        Math.sin(step * 0.17 + index * 1.7 + time) * 1.6 * detail * vineScale +
        (sway * step) / Math.max(1, length);
      rect(ctx, Math.round(vx), step, thick, 1, step % 6 === 0 ? P.vine.light : P.vine.stem);
      if (step > 2 && step % 5 === 0) {
        const side = step % 10 === 0 ? 1 : -1;
        px(ctx, Math.round(vx) + side * leaf, step, P.vine.leaf);
        px(ctx, Math.round(vx) + side * leaf * 2, step, P.vine.light);
      }
    }
  }
}

function drawShelfBase(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  glassH: number,
  detail: number,
): void {
  const baseH = Math.max(4, h - glassH);
  rect(ctx, 0, glassH, w, baseH, P.wood.dark);
  hline(ctx, 0, glassH, w, P.wood.highlight);
  rect(ctx, 0, glassH + 1, w, Math.max(1, Math.round(2 * detail)), P.wood.mid);
  hline(ctx, 0, glassH + 1, w, P.wood.light);

  const grains = Math.max(6, Math.round(w / (17 * detail)));
  for (let index = 0; index < grains; index += 1) {
    const gx = hash2(index, 5, 181) * w;
    const gy = glassH + (0.32 + hash2(index, 9, 181) * 0.52) * baseH;
    const gw = (3 + hash2(index, 11, 181) * 9) * detail;
    rect(ctx, gx, gy, gw, 1, withAlpha(P.wood.highlight, 0.22));
  }

  hline(ctx, 0, h - 1, w, '#1c130d');

  const text = 'MOSSLIGHT';
  const plaqueW = pixelTextWidth(text) + Math.round(9 * detail);
  if (w > plaqueW * 3 && baseH > 10 * detail) {
    const plaqueX = Math.round((w - plaqueW) / 2);
    const plaqueY = Math.round(glassH + baseH * 0.3);
    rect(ctx, plaqueX, plaqueY, plaqueW, 9, P.wood.brassDark);
    rect(ctx, plaqueX + 1, plaqueY + 1, plaqueW - 2, 7, P.wood.brass);
    hline(ctx, plaqueX + 2, plaqueY + 2, plaqueW - 4, P.wood.brassLight);
    pixelText(
      ctx,
      text,
      Math.round(plaqueX + (plaqueW - pixelTextWidth(text)) / 2),
      plaqueY + 2,
      P.wood.brassDark,
    );
  }
}

/**
 * The shelf: a long, low vivarium that sits flush above the taskbar. It is the
 * same living world as the jar, just widened, so the plants and residents keep
 * moving instead of becoming a wallpaper.
 */
export function drawShelf(
  ctx: CanvasRenderingContext2D,
  state: TerrariumState,
  now: number,
  opts: SceneOptions,
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  if (w <= 0 || h <= 0) return;

  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = false;

  const detail = clamp(h / 105, 1, 1.8);
  const radiusTop = Math.round(10 * detail);
  const glassH = Math.round(h * 0.86);
  const horizon = 0.66;

  ctx.save();
  jarPath(ctx, 0, 0, w, glassH, radiusTop, 0);
  ctx.clip();
  drawWorld(ctx, state, now, 0, 0, w, glassH, detail, opts, horizon, {
    slots: spreadShelfSlots(state.plants),
    plantScale: 1.6,
    creatureScale: 2.1,
    soilShade: 'rgba(7, 20, 14, 0.12)',
    decor: (decorCtx, decorX, decorY, decorW, decorH) =>
      drawShelfDetails(
        decorCtx,
        decorX,
        decorY,
        decorW,
        decorH,
        detail,
        horizon,
        now,
        opts,
      ),
  });
  drawShelfVines(ctx, w, glassH, detail, now, opts);
  drawGlass(ctx, 0, 0, w, glassH, radiusTop, 0, detail);
  ctx.restore();

  drawShelfBase(ctx, w, h, glassH, detail);
}

export function sceneTheme(now: number): { night: boolean; light: number } {
  const sky = skyAt(now);
  return { night: sky.night, light: sky.light };
}
