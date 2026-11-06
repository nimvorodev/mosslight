import { useEffect, useRef } from 'react';
import { Check, Droplets, Flame, ListTodo, SlidersHorizontal, Sparkles, Sprout, Sun, X } from 'lucide-react';
import { formatMinutes } from '../lib/state';
import type { TerrariumState } from '../lib/types';
import type { TerrariumActions } from '../lib/useTerrarium';
import { IconButton } from './IconButton';
import { GardenPanel } from './GardenPanel';
import { SettingsPanel } from './SettingsPanel';
import { TodayPanel } from './TodayPanel';

export type DrawerTab = 'today' | 'garden' | 'settings';

interface Props {
  state: TerrariumState;
  now: number;
  actions: TerrariumActions;
  tab: DrawerTab;
  onTab: (tab: DrawerTab) => void;
  onClose: () => void;
  selectedPlantId: string | null;
  selectedStarId: string | null;
  onSelectPlant: (id: string | null) => void;
  onSelectStar: (id: string | null) => void;
}

const TABS: { id: DrawerTab; label: string; icon: typeof ListTodo }[] = [
  { id: 'today', label: 'today', icon: ListTodo },
  { id: 'garden', label: 'garden', icon: Sprout },
  { id: 'settings', label: 'settings', icon: SlidersHorizontal },
];

export function Drawer({
  state,
  now,
  actions,
  tab,
  onTab,
  onClose,
  selectedPlantId,
  selectedStarId,
  onSelectPlant,
  onSelectStar,
}: Props) {
  const openTasks = state.tasks.filter((task) => !task.done).length;
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [tab]);

  return (
    <aside className="drawer" aria-label="Mosslight field notes" data-shelf-interactive>
      <header className="drawer-head">
        <div className="drawer-title-row">
          <span className="drawer-brand">
            <span className="drawer-brand-dot" /> mosslight
          </span>
          <span className="drawer-sub">field notes</span>
          <IconButton label="close the field notes" className="close-button" onClick={onClose}>
            <X size={14} />
          </IconButton>
        </div>

        <div className="currency-row">
          <span className="currency">
            <Sun size={11} /> {formatMinutes(state.focusMsToday)}
          </span>
          <span className="currency">
            <Droplets size={11} /> {state.dew} dew
          </span>
          <span className="currency">
            <Sparkles size={11} /> {state.spores} spores
          </span>
          <span className="currency">
            <Flame size={11} /> {state.streak}d
          </span>
          {state.settings.paused ? <span className="currency is-warn">resting</span> : null}
        </div>

        <nav className="tabs" aria-label="Mosslight sections">
          {TABS.map((entry) => {
            const Icon = entry.icon;
            return (
              <button
                key={entry.id}
                type="button"
                className={tab === entry.id ? 'is-active' : ''}
                aria-current={tab === entry.id ? 'page' : undefined}
                onClick={() => onTab(entry.id)}
              >
                <Icon size={12} />
                <span>{entry.label}</span>
                {entry.id === 'today' && openTasks > 0 ? (
                  <span className="tab-badge">{openTasks}</span>
                ) : null}
                {entry.id === 'today' && openTasks === 0 ? (
                  <Check size={10} className="tab-check" />
                ) : null}
              </button>
            );
          })}
        </nav>
      </header>

      <div className="drawer-body" ref={bodyRef}>
        {tab === 'today' ? (
          <TodayPanel
            state={state}
            now={now}
            actions={actions}
            selectedStarId={selectedStarId}
            onSelectStar={onSelectStar}
          />
        ) : null}
        {tab === 'garden' ? (
          <GardenPanel
            state={state}
            now={now}
            actions={actions}
            selectedPlantId={selectedPlantId}
            onSelectPlant={onSelectPlant}
          />
        ) : null}
        {tab === 'settings' ? (
          <SettingsPanel state={state} actions={actions} />
        ) : null}
      </div>
    </aside>
  );
}
