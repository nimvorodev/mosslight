import { useEffect, useRef } from 'react';
import { P } from '../lib/palette';
import { rect } from '../lib/pixel';
import { drawPlant } from '../lib/plants';
import type { Plant, SpeciesId } from '../lib/types';

const SEEDS: Record<SpeciesId, number> = {
  fern: 17_311,
  mushroom: 58_927,
  flower: 8_821,
  succulent: 44_412,
  vine: 9_911,
  crystal: 3_311,
};

interface Props {
  species: SpeciesId;
  size?: number;
  /** Use a real plant's genome instead of the species sample. */
  seed?: number;
  /** 0..1; defaults to a fully grown sample. */
  growth?: number;
  night?: boolean;
}

export function PlantThumb({ species, size = 58, seed, growth = 1, night = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, size, size);
    rect(context, 0, size - 6, size, 6, P.soil.dark);
    rect(context, 0, size - 6, size, 1, P.moss.dark);
    rect(context, 1, size - 5, size - 2, 1, P.moss.mid);
    const plant: Plant = {
      id: `thumb_${species}_${seed ?? SEEDS[species]}`,
      species,
      slot: 0,
      growth: Math.max(0.06, Math.min(1, growth)),
      plantedAt: 0,
      seed: seed ?? SEEDS[species],
    };
    drawPlant(context, plant, Math.round(size / 2), size - 5, 1.02, {
      now: 0,
      motion: false,
      night,
      detail: 1,
      maxHeight: size - 5,
    });
  }, [species, size, seed, growth, night]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="plant-thumb"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}
