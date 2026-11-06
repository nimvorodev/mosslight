import { useEffect, useRef } from 'react';
import { SCENE_H, SCENE_W } from '../lib/layout';
import { drawJar, drawShelf, type SceneEffects } from '../lib/scene';
import type { TerrariumState } from '../lib/types';

interface Props {
  state: TerrariumState;
  effects: SceneEffects;
  reducedMotion: boolean;
  idle: boolean;
  atmosphere: boolean;
  variant: 'jar' | 'shelf';
}

export function TerrariumCanvas({
  state,
  effects,
  reducedMotion,
  idle,
  atmosphere,
  variant,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  const effectsRef = useRef(effects);
  const motionRef = useRef(!reducedMotion);
  const idleRef = useRef(idle);
  const atmosphereRef = useRef(atmosphere);
  const variantRef = useRef(variant);

  stateRef.current = state;
  effectsRef.current = effects;
  motionRef.current = !reducedMotion;
  idleRef.current = idle;
  atmosphereRef.current = atmosphere;
  variantRef.current = variant;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const fit = () => {
      if (variantRef.current === 'shelf') {
        // Keep the shelf's pixels chunky: the backing store is a few screen
        // pixels per art pixel, not one canvas pixel per screen pixel.
        const rect = canvas.getBoundingClientRect();
        const scale = Math.max(2, Math.round(rect.height / 125));
        const width = Math.max(320, Math.round(rect.width / scale));
        const height = Math.max(90, Math.round(rect.height / scale));
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;
      } else if (canvas.width !== SCENE_W || canvas.height !== SCENE_H) {
        canvas.width = SCENE_W;
        canvas.height = SCENE_H;
      }
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [variant]);

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
        const scene = {
          motion: motionRef.current,
          idle: idleRef.current,
          atmosphere: atmosphereRef.current,
          effects: effectsRef.current,
        };
        if (variantRef.current === 'shelf') {
          drawShelf(context, stateRef.current, Date.now(), scene);
        } else {
          drawJar(context, stateRef.current, Date.now(), scene);
        }
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
      className={`terrarium-canvas ${variant === 'shelf' ? 'is-shelf-canvas' : ''}`}
      width={SCENE_W}
      height={SCENE_H}
      role="img"
      aria-label={description}
      title={
        variant === 'shelf'
          ? 'a living shelf above the taskbar'
          : 'drag the jar to move it'
      }
    />
  );
}
