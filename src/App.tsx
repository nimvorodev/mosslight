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
import { formatMinutes } from './lib/state';
import { EMPTY_EFFECTS, renderPortrait, sceneTheme } from './lib/scene';
import { useTerrarium } from './lib/useTerrarium';
import { Drawer, type DrawerTab } from './components/Drawer';
import { IconButton } from './components/IconButton';
import { TerrariumCanvas } from './components/TerrariumCanvas';
import { Toasts } from './components/Toasts';

export default function App() {
  const { state, now, awake, effects, toasts, snapshotBusy, actions } = useTerrarium();
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<DrawerTab>('today');
  const welcomeOpened = useRef(false);
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

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
        case 'snapshot-desktop':
          void actionsRef.current.takeSnapshot('desktop');
          break;
        case 'snapshot-lock':
          void actionsRef.current.takeSnapshot('lock');
          break;
        case 'snapshot-both':
          void actionsRef.current.takeSnapshot('both');
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

  // A small debugging affordance: render the wallpaper portrait on demand.
  // The screenshot script and the field-notes exports both use it.
  useEffect(() => {
    if (!state) return;
    window.__mosslightPortrait = (width: number, height: number) =>
      renderPortrait(state, Date.now(), width, height, {
        motion: false,
        idle: false,
        atmosphere: state.settings.atmosphere,
        effects: EMPTY_EFFECTS,
      });
    return () => {
      delete window.__mosslightPortrait;
    };
  }, [state]);

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

  return (
    <div className={`shell ${expanded ? 'is-expanded' : ''} ${night ? 'is-night' : ''}`}>
      <section className="scene">
        <div className="atmosphere" aria-hidden="true" />

        <header className="scene-head">
          <span className="brand">
            <Leaf size={11} /> mosslight
          </span>
          <div className="scene-actions">
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
        />

        <button
          type="button"
          className={`status-pill ${resting ? 'is-resting' : ''}`}
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Close the field notes' : 'Open tasks and field notes'}
        >
          <span className="pill-item">
            {resting ? <Moon size={12} /> : <Sun size={12} />}
            {resting ? 'resting' : `${formatMinutes(state.focusMsToday)} sun`}
          </span>
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
          actions={actions}
          tab={tab}
          onTab={setTab}
          onClose={() => setExpanded(false)}
          snapshotBusy={snapshotBusy}
        />
      ) : null}
    </div>
  );
}
