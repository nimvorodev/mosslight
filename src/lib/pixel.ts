export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 69069);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((char) => char + char)
          .join('')
      : clean;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

export function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = parseHex(a);
  const [r2, g2, b2] = parseHex(b);
  const amount = clamp(t, 0, 1);
  const to = (one: number, two: number) =>
    Math.round(one + (two - one) * amount)
      .toString(16)
      .padStart(2, '0');
  return `#${to(r1, r2)}${to(g1, g2)}${to(b1, b2)}`;
}

export function shade(hex: string, amount: number): string {
  return amount < 0 ? mixHex(hex, '#000000', -amount) : mixHex(hex, '#ffffff', amount);
}

export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
}

export function rect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function px(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
}

export function hline(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  color: string,
): void {
  rect(ctx, x, y, w, 1, color);
}

export function vline(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  color: string,
): void {
  rect(ctx, x, y, 1, h, color);
}

export function pixelLine(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
): void {
  let x = Math.round(x0);
  let y = Math.round(y0);
  const endX = Math.round(x1);
  const endY = Math.round(y1);
  const dx = Math.abs(endX - x);
  const dy = -Math.abs(endY - y);
  const sx = x < endX ? 1 : -1;
  const sy = y < endY ? 1 : -1;
  let error = dx + dy;
  for (let guard = 0; guard < 600; guard += 1) {
    px(ctx, x, y, color);
    if (x === endX && y === endY) break;
    const doubled = error * 2;
    if (doubled >= dy) {
      error += dy;
      x += sx;
    }
    if (doubled <= dx) {
      error += dx;
      y += sy;
    }
  }
}

export function bandedGradient(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  top: string,
  bottom: string,
  bands = 18,
): void {
  const height = Math.max(1, Math.round(h));
  const width = Math.round(w);
  for (let index = 0; index < bands; index += 1) {
    const t = index / Math.max(1, bands - 1);
    const color = mixHex(top, bottom, t);
    const y0 = Math.round(y + (height * index) / bands);
    const y1 = Math.round(y + (height * (index + 1)) / bands);
    rect(ctx, x, y0, width, Math.max(1, y1 - y0), color);
  }
}

export function jarPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radiusTop: number,
  radiusBottom: number,
): void {
  const rt = Math.min(radiusTop, w / 2, h / 2);
  const rb = Math.min(radiusBottom, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rt, y);
  ctx.lineTo(x + w - rt, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rt);
  ctx.lineTo(x + w, y + h - rb);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rb, y + h);
  ctx.lineTo(x + rb, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rb);
  ctx.lineTo(x, y + rt);
  ctx.quadraticCurveTo(x, y, x + rt, y);
  ctx.closePath();
}

export function pixelCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
): void {
  const r = Math.max(1, Math.round(radius));
  for (let y = -r; y <= r; y += 1) {
    const span = Math.floor(Math.sqrt(Math.max(0, r * r - y * y)));
    rect(ctx, cx - span, cy + y, span * 2 + 1, 1, color);
  }
}

export function pixelEllipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string,
): void {
  const radiusX = Math.max(1, Math.round(rx));
  const radiusY = Math.max(1, Math.round(ry));
  for (let y = -radiusY; y <= radiusY; y += 1) {
    const ratio = y / radiusY;
    const span = Math.floor(radiusX * Math.sqrt(Math.max(0, 1 - ratio * ratio)));
    rect(ctx, cx - span, cy + y, span * 2 + 1, 1, color);
  }
}

/** 3x5 pixel letters, enough for a tiny engraved plaque. */
const FONT_3X5: Record<string, string[]> = {
  A: ['010', '101', '111', '101', '101'],
  B: ['110', '101', '110', '101', '110'],
  C: ['011', '100', '100', '100', '011'],
  D: ['110', '101', '101', '101', '110'],
  E: ['111', '100', '110', '100', '111'],
  F: ['111', '100', '110', '100', '100'],
  G: ['011', '100', '101', '101', '011'],
  H: ['101', '101', '111', '101', '101'],
  I: ['111', '010', '010', '010', '111'],
  J: ['001', '001', '001', '101', '010'],
  K: ['101', '101', '110', '101', '101'],
  L: ['100', '100', '100', '100', '111'],
  M: ['101', '111', '111', '101', '101'],
  N: ['101', '111', '111', '111', '101'],
  O: ['111', '101', '101', '101', '111'],
  P: ['110', '101', '110', '100', '100'],
  Q: ['111', '101', '101', '111', '001'],
  R: ['110', '101', '110', '101', '101'],
  S: ['011', '100', '010', '001', '110'],
  T: ['111', '010', '010', '010', '010'],
  U: ['101', '101', '101', '101', '111'],
  V: ['101', '101', '101', '101', '010'],
  W: ['101', '101', '111', '111', '101'],
  X: ['101', '101', '010', '101', '101'],
  Y: ['101', '101', '010', '010', '010'],
  Z: ['111', '001', '010', '100', '111'],
  ' ': ['000', '000', '000', '000', '000'],
};

export function pixelTextWidth(text: string): number {
  return Math.max(0, text.length * 4 - 1);
}

export function pixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
): void {
  ctx.fillStyle = color;
  let cursor = Math.round(x);
  for (const char of text.toUpperCase()) {
    const glyph = FONT_3X5[char] ?? FONT_3X5[' '];
    for (let row = 0; row < glyph.length; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        if (glyph[row][col] === '1') {
          ctx.fillRect(cursor + col, Math.round(y) + row, 1, 1);
        }
      }
    }
    cursor += 4;
  }
}
