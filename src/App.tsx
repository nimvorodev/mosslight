import { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Leaf,
  ListTodo,
  Minus,
  Moon,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import { bridge } from './lib/bridge';
import { focusRemainingMs, formatMinutes } from './lib/state';
import { sceneTheme } from './lib/scene';
import { useTerrarium } from './lib/useTerrarium';
import { Drawer, type DrawerTab } from './components/Drawer';
import { IconButton } from './components/IconButton';
import { TerrariumCanvas } from './components/TerrariumCanvas';
import { Toasts } from './components/Toasts';

function focusClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function App() {
  const { state, now, awake, effects, toasts, actions } = useTerrarium();
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<DrawerTab>('today');
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);
  const [selectedStarId, setSelectedStarId] = useState<string | null>(null);
  const welcomeOpened = useRef(false);
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  const shelf = state?.settings.display === 'shelf';

  useEffect(() => {
    void bridge.setExpanded(expanded);
  }, [expanded]);

  useEffect(() => {
    if (state && !state.onboardingDone && !welcomeOpened.current) {
      welcomeOpened.current = true;
      setTab('today');
      setExpanded(true);
    }
  }, [state]);

  // In shelf mode the window spans the screen, so the empty space above the
  // garden must not swallow clicks. Only the controls and the open field notes
  // become interactive; everything else passes through to the desktop.
  useEffect(() => {
    if (!bridge.isDesktop || !shelf) {
      void bridge.setPassthrough(false);
      return;
    }

    let ignored: boolean | null = null;
    const update = (value: boolean) => {
      if (ignored === value) return;
      ignored = value;
      void bridge.setPassthrough(value);
    };
    const onMove = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      update(!target?.closest?.('[data-shelf-interactive]'));
    };
    const onLeave = () => update(true);

    document.addEventListener('mousemove', onMove);
    document.documentElement.addEventListener('mouseleave', onLeave);
    const hovering = Boolean(document.querySelector('[data-shelf-interactive]:hover'));
    update(!hovering);

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      void bridge.setPassthrough(false);
    };
  }, [shelf, expanded]);

  useEffect(() => {
    return bridge.onCommand((command) => {
      switch (command) {
        case 'open-tasks':
          void bridge.showWindow();
          setExpanded(true);
          break;
        case 'toggle-tasks':
          setExpanded((value) => !value);
          break;
        case 'mist':
          actionsRef.current.mist();
          break;
        case 'display-jar':
          actionsRef.current.updateSettings({ display: 'jar' });
          break;
        case 'display-shelf':
          actionsRef.current.updateSettings({ display: 'shelf' });
          break;
        case 'toggle-pause':
          actionsRef.current.togglePause();
          break;
        case 'welcome':
          void bridge.showWindow();
          setTab('today');
          setExpanded(true);
          break;
        case 'focus-window':
          void bridge.showWindow();
          break;
        default:
          break;
      }
    });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!state) {
    return (
      <div className="boot" role="status">
        <span className="boot-jar" aria-hidden="true" />
        <span>waking the jar…</span>
      </div>
    );
  }

  const night = sceneTheme(now).night;
  const resting = !awake || state.settings.paused;
  const openTasks = state.tasks.filter((task) => !task.done).length;
  const focusActive = Boolean(state.focus && now < state.focus.endsAt);
  const focusLeft = focusActive ? focusRemainingMs(state, now) : 0;

  const pickPlant = (id: string) => {
    setSelectedPlantId((current) => (current === id ? null : id));
    setSelectedStarId(null);
    setTab('garden');
  };

  const pickStar = (id: string) => {
    setSelectedStarId((current) => (current === id ? null : id));
    setSelectedPlantId(null);
    setTab('today');
  };

  return (
    <div
      className={`shell ${expanded ? 'is-expanded' : ''} ${shelf ? 'is-shelf' : ''} ${
        night ? 'is-night' : ''
      } ${focusActive ? 'is-focusing' : ''}`}
    >
      <section className="scene">
        <div className="atmosphere" aria-hidden="true" />

        <header className="scene-head">
          <span className="brand">
            <Leaf size={11} /> mosslight
          </span>
          <div className="scene-actions" data-shelf-interactive>
            <IconButton
              label="open settings"
              onClick={() => {
                setTab('settings');
                setExpanded(true);
              }}
            >
              <Settings size={13} />
            </IconButton>
            <IconButton label="hide to tray" onClick={actions.hide}>
              <Minus size={14} />
            </IconButton>
            <IconButton
              label={expanded ? 'close the field notes' : 'open the field notes'}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? <X size={13} /> : <ListTodo size={13} />}
            </IconButton>
          </div>
        </header>

        <TerrariumCanvas
          state={state}
          effects={effects}
          reducedMotion={state.settings.reducedMotion}
          idle={resting}
          atmosphere={state.settings.atmosphere}
          variant={shelf ? 'shelf' : 'jar'}
          interactive={expanded}
          night={night}
          onPickPlant={pickPlant}
          onPickStar={pickStar}
          onStartle={actions.startle}
        />

        <button
          type="button"
          className={`status-pill ${resting ? 'is-resting' : ''}`}
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Close the field notes' : 'Open tasks and field notes'}
          data-shelf-interactive
        >
          <span className="pill-item">
            {resting ? <Moon size={12} /> : <Sun size={12} />}
            {resting ? 'resting' : `${formatMinutes(state.focusMsToday)} sun`}
          </span>
          {focusActive ? (
            <>
              <span className="pill-divider" aria-hidden="true" />
              <span className="pill-item is-focus">
                <Moon size={12} /> {focusClock(focusLeft)}
              </span>
            </>
          ) : null}
          <span className="pill-divider" aria-hidden="true" />
          <span className="pill-item">
            <Droplets size={12} /> {state.dew}
          </span>
          <span className="pill-divider" aria-hidden="true" />
          <span className="pill-item">
            <Check size={12} /> {state.tasksDoneToday}
          </span>
          {openTasks > 0 ? <span className="pill-open">{openTasks} open</span> : null}
          <span className="pill-cta">
            {expanded ? 'close' : 'tend'}
            {expanded ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
          </span>
        </button>

        <Toasts toasts={toasts} />
      </section>

      {expanded ? (
        <Drawer
          state={state}
          now={now}
          awake={awake}
          actions={actions}
          tab={tab}
          onTab={setTab}
          onClose={() => setExpanded(false)}
          selectedPlantId={selectedPlantId}
          selectedStarId={selectedStarId}
          onSelectPlant={setSelectedPlantId}
          onSelectStar={setSelectedStarId}
        />
      ) : null}
    </div>
  );
}
