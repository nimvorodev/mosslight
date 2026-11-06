import type { CreatureId } from './types';
import { P } from './palette';
import { clamp, pixelCircle, pixelEllipse, px, rect, withAlpha } from './pixel';

export interface CreatureReaction {
  near: boolean;
  /** 0..1, decays after a double-click startle. */
  startle: number;
}

export interface CreatureDrawOptions {
  now: number;
  motion: boolean;
  night: boolean;
  idle: boolean;
  reaction?: CreatureReaction;
}

function scaleFn(scale: number) {
  return (value: number) => Math.max(1, Math.round(value * scale));
}

function groundShadow(ctx: CanvasRenderingContext2D, x: number, y: number, width: number): void {
  rect(ctx, x - Math.round(width / 2), y, width, 1, 'rgba(18, 36, 26, 0.3)');
}

export function drawCreature(
  ctx: CanvasRenderingContext2D,
  species: CreatureId,
  x: number,
  baseY: number,
  dir: number,
  scale: number,
  seed: number,
  opts: CreatureDrawOptions,
): void {
  const s = scaleFn(scale);
  const bob = opts.motion ? Math.round(Math.sin(opts.now * 0.003 + seed) * 0.5 + 0.5) : 0;

  if (species === 'snail') {
    groundShadow(ctx, Math.round(x), baseY, s(7));
    const near = opts.reaction?.near ?? false;
    const startle = opts.reaction?.startle ?? 0;
    const shy = near || startle > 0.15;
    const y = baseY - 1 - bob + (shy ? s(1) : 0);
    rect(ctx, x - s(3), y - s(2), s(6), s(2), P.creature.snailBody);
    rect(ctx, x - s(3), y - s(2), s(2), 1, P.creature.snailBodyLight);
    if (!shy) {
      const headX = x + dir * s(3);
      px(ctx, headX, y - s(2), P.creature.snailBody);
      px(ctx, headX + dir, y - s(3), P.creature.snailBody);
      px(ctx, headX + dir, y - s(4), P.creature.snailBodyLight);
    } else {
      px(ctx, x + dir * s(3), y - s(2), withAlpha(P.creature.snailBody, 0.5));
    }
    pixelCircle(ctx, x - s(1), y - s(4), Math.max(2, s(2.4)), P.creature.snailShell);
    px(ctx, x - s(2), y - s(5), P.creature.snailShellLight);
    px(ctx, x - s(1), y - s(4), P.creature.snailShellDark);
    px(ctx, x, y - s(3), P.creature.snailShellDark);
    px(ctx, x - s(1), y - s(2), P.creature.snailShellDark);
    px(ctx, x - s(2), y - s(3), P.creature.snailShellLight);
    if (startle > 0.2) {
      px(ctx, x + s(4), y - s(1), withAlpha('#e8dcc0', startle * 0.6));
      px(ctx, x + s(5), y - s(2), withAlpha('#e8dcc0', startle * 0.35));
    }
    return;
  }

  if (species === 'ladybug') {
    groundShadow(ctx, Math.round(x), baseY, s(5));
    const near = opts.reaction?.near ?? false;
    const startle = opts.reaction?.startle ?? 0;
    const lift = Math.round(startle * s(2)) + (near ? 1 : 0);
    const y = baseY - 1 - bob - lift;
    const head = x + dir * s(2);
    if (near || startle > 0.12) {
      const wing = Math.max(1, s(2));
      rect(ctx, x - s(3), y - s(4), wing, s(2), withAlpha(P.creature.ladybugLight, 0.68));
      rect(ctx, x + s(2), y - s(4), wing, s(2), withAlpha(P.creature.ladybugLight, 0.68));
      px(ctx, x - s(4), y - s(5), withAlpha('#f4efdf', 0.4));
      px(ctx, x + s(3), y - s(5), withAlpha('#f4efdf', 0.4));
    }
    rect(ctx, x - s(2), y - s(3), s(4), s(3), P.creature.ladybug);
    rect(ctx, x - s(2), y - s(3), s(4), 1, P.creature.ladybugLight);
    px(ctx, x, y - s(3), P.creature.black);
    px(ctx, x, y - s(2), P.creature.black);
    px(ctx, x - s(1), y - s(2), P.creature.black);
    px(ctx, x + s(1), y - s(2), P.creature.black);
    rect(ctx, head, y - s(3), s(2), s(2), P.creature.black);
    px(ctx, head + dir, y - s(4), P.creature.black);
    px(ctx, head, y - s(4), P.creature.black);
    px(ctx, x - s(1), y, P.creature.black);
    px(ctx, x + s(1), y, P.creature.black);
    return;
  }

  if (species === 'frog') {
    groundShadow(ctx, Math.round(x), baseY, s(7));
    const near = opts.reaction?.near ?? false;
    const startle = opts.reaction?.startle ?? 0;
    const y = baseY - 1;
    const hop = opts.motion && !near ? Math.max(0, Math.sin(opts.now * 0.0011 + seed * 0.7)) : 0;
    const lift = Math.round(hop * hop * s(3) + startle * s(4));
    const bodyY = y - lift;
    pixelEllipse(ctx, x, bodyY - s(2), s(3.4), s(1.6), P.creature.frog);
    rect(ctx, x - s(2), bodyY - s(2), s(4), 1, P.creature.frogLight);
    const eyeY = bodyY - s(4);
    px(ctx, x - s(1), eyeY, P.creature.eye);
    px(ctx, x + s(1), eyeY, P.creature.eye);
    const blink = opts.motion && !near && Math.sin(opts.now * 0.0007 + seed) > 0.985;
    px(ctx, x - s(1), eyeY, blink ? P.creature.frogDark : P.creature.black);
    px(ctx, x + s(1), eyeY, blink ? P.creature.frogDark : P.creature.black);
    px(ctx, x, bodyY - s(1), P.creature.frogDark);
    px(ctx, x - s(2), bodyY, P.creature.frogDark);
    px(ctx, x + s(2), bodyY, P.creature.frogDark);
    px(ctx, x - s(3), bodyY, P.creature.frog);
    px(ctx, x + s(3), bodyY, P.creature.frog);
    if (hop > 0.2 || startle > 0.2) {
      px(ctx, x - s(2), y, P.creature.frogDark);
      px(ctx, x + s(2), y, P.creature.frogDark);
      if (startle > 0.35) {
        px(ctx, x - s(4), y - s(1), withAlpha(P.moss.bright, startle * 0.7));
        px(ctx, x + s(4), y - s(1), withAlpha(P.moss.bright, startle * 0.7));
      }
    }
    return;
  }

  // firefly
  if (!opts.night) return;
  const near = opts.reaction?.near ?? false;
  const startle = opts.reaction?.startle ?? 0;
  const pulse = clamp(
    0.55 + 0.45 * Math.sin(opts.now * 0.004 + seed) + (near ? 0.28 : 0) + startle * 0.6,
    0,
    1.5,
  );
  const cx = Math.round(x);
  const cy = Math.round(baseY);
  ctx.fillStyle = withAlpha(P.creature.firefly, 0.08 * pulse);
  ctx.fillRect(cx - s(4), cy - s(4), s(8), s(8));
  ctx.fillStyle = withAlpha(P.creature.firefly, 0.2 * pulse);
  ctx.fillRect(cx - s(2), cy - s(2), s(4), s(4));
  px(ctx, cx, cy, P.creature.firefly);
  px(ctx, cx - 1, cy, withAlpha(P.creature.firefly, 0.8));
  px(ctx, cx + 1, cy, withAlpha(P.creature.firefly, 0.8));
  if (opts.motion) {
    px(ctx, cx, cy - 1, withAlpha('#ffffff', 0.25 + pulse * 0.25));
  }
  if (near || startle > 0.2) {
    px(ctx, cx - s(2), cy + s(2), withAlpha(P.creature.firefly, 0.45 * pulse));
    px(ctx, cx + s(2), cy - s(2), withAlpha(P.creature.firefly, 0.35 * pulse));
  }
}
