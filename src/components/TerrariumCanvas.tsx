import { useEffect, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { SCENE_H, SCENE_W } from '../lib/layout';
import { drawJar, drawShelf, type SceneEffects } from '../lib/scene';
import { pickAt, sceneGeometry } from '../lib/interact';
import type { TerrariumState } from '../lib/types';

interface Props {
  state: TerrariumState;
  effects: SceneEffects;
  reducedMotion: boolean;
  idle: boolean;
  atmosphere: boolean;
  variant: 'jar' | 'shelf';
  interactive: boolean;
  night: boolean;
  onPickPlant?: (id: string) => void;
  onPickStar?: (id: string) => void;
  onStartle?: (x: number, y: number) => void;
}

export function TerrariumCanvas({
  state,
  effects,
  reducedMotion,
  idle,
  atmosphere,
  variant,
  interactive,
  night,
  onPickPlant,
  onPickStar,
  onStartle,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  const effectsRef = useRef(effects);
  const motionRef = useRef(!reducedMotion);
  const idleRef = useRef(idle);
  const atmosphereRef = useRef(atmosphere);
  const variantRef = useRef(variant);
  const interactiveRef = useRef(interactive);
  const nightRef = useRef(night);
  const pointerRef = useRef({ x: 0, y: 0, active: false });
  const pickPlantRef = useRef(onPickPlant);
  const pickStarRef = useRef(onPickStar);
  const startleRef = useRef(onStartle);

  stateRef.current = state;
  effectsRef.current = effects;
  motionRef.current = !reducedMotion;
  idleRef.current = idle;
  atmosphereRef.current = atmosphere;
  variantRef.current = variant;
  interactiveRef.current = interactive;
  nightRef.current = night;
  pickPlantRef.current = onPickPlant;
  pickStarRef.current = onPickStar;
  startleRef.current = onStartle;

  useEffect(() => {
    // A pointer left hovering when the drawer closes (or the scene changes
    // shape) must not keep the residents reacting to a stale position.
    pointerRef.current = { ...pointerRef.current, active: false };
  }, [interactive, variant]);

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
          pointer: pointerRef.current,
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

  const toArt = (event: ReactMouseEvent | ReactPointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width,
      y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height,
    };
  };

  const handleMove = (event: ReactPointerEvent) => {
    const point = toArt(event);
    pointerRef.current = { x: point.x, y: point.y, active: interactiveRef.current };
  };

  const handleLeave = () => {
    pointerRef.current = { ...pointerRef.current, active: false };
  };

  const handleClick = (event: ReactMouseEvent) => {
    if (!interactiveRef.current) return;
    // The browser fires a click for each half of a double-click. Only the
    // first one should toggle a selection; the second is the startle gesture.
    if (event.detail > 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const point = toArt(event);
    const geometry = sceneGeometry(
      stateRef.current,
      variantRef.current,
      canvas.width,
      canvas.height,
    );
    const result = pickAt(
      stateRef.current,
      geometry,
      point.x,
      point.y,
      nightRef.current,
      Date.now(),
    );
    if (result.plantId) pickPlantRef.current?.(result.plantId);
    else if (result.star) pickStarRef.current?.(result.star.id);
  };

  const handleDoubleClick = (event: ReactMouseEvent) => {
    if (!interactiveRef.current) return;
    const point = toArt(event);
    startleRef.current?.(point.x, point.y);
  };

  const description = `A pixel terrarium with ${state.plants.length} plants and ${
    state.creatures.length
  } creatures. ${Math.floor(state.focusMsToday / 60_000)} minutes of sunlight today.`;

  return (
    <>
      <canvas
        ref={canvasRef}
        className={`terrarium-canvas ${variant === 'shelf' ? 'is-shelf-canvas' : ''} ${
          interactive ? 'is-interactive' : ''
        }`}
        width={SCENE_W}
        height={SCENE_H}
        role="img"
        aria-label={description}
        title={
          variant === 'shelf'
            ? 'a living shelf above the taskbar'
            : interactive
              ? 'click a plant or star; double-click to startle the residents'
              : 'drag the jar to move it'
        }
        onPointerMove={handleMove}
        onPointerLeave={handleLeave}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      />
      {variant === 'shelf' && interactive ? (
        <div
          className="terrarium-life-zone"
          data-shelf-interactive
          aria-hidden="true"
          onPointerMove={handleMove}
          onPointerLeave={handleLeave}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
        />
      ) : null}
    </>
  );
}
