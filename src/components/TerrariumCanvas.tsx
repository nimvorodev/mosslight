import { useEffect, useRef } from 'react';
import { SCENE_H, SCENE_W } from '../lib/layout';
import { drawJar, type SceneEffects } from '../lib/scene';
import type { TerrariumState } from '../lib/types';

interface Props {
  state: TerrariumState;
  effects: SceneEffects;
  reducedMotion: boolean;
  idle: boolean;
  atmosphere: boolean;
}

export function TerrariumCanvas({ state, effects, reducedMotion, idle, atmosphere }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  const effectsRef = useRef(effects);
  const motionRef = useRef(!reducedMotion);
  const idleRef = useRef(idle);
  const atmosphereRef = useRef(atmosphere);

  stateRef.current = state;
  effectsRef.current = effects;
  motionRef.current = !reducedMotion;
  idleRef.current = idle;
  atmosphereRef.current = atmosphere;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    let frame = 0;
    let lastDraw = 0;

    const draw = (time: number) => {
      const interval = motionRef.current ? 33 : 200;
      if (time - lastDraw >= interval) {
        lastDraw = time;
        drawJar(context, stateRef.current, Date.now(), {
          motion: motionRef.current,
          idle: idleRef.current,
          atmosphere: atmosphereRef.current,
          effects: effectsRef.current,
        });
      }
      frame = window.requestAnimationFrame(draw);
    };
    frame = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const description = `A pixel terrarium with ${state.plants.length} plants and ${
    state.creatures.length
  } creatures. ${Math.floor(state.focusMsToday / 60_000)} minutes of sunlight today.`;

  return (
    <canvas
      ref={canvasRef}
      className="terrarium-canvas"
      width={SCENE_W}
      height={SCENE_H}
      role="img"
      aria-label={description}
      title="drag the jar to move it"
    />
  );
}
