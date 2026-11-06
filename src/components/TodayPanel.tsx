import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  Check,
  Droplets,
  Flame,
  Pause,
  Play,
  Plus,
  Sun,
  X,
} from 'lucide-react';
import { MIST_COST, SUN_CAP_MS, TASK_DEW, formatMinutes } from '../lib/state';
import type { TerrariumState } from '../lib/types';
import type { TerrariumActions } from '../lib/useTerrarium';
import { PlantThumb } from './PlantThumb';

interface Props {
  state: TerrariumState;
  actions: TerrariumActions;
}

export function TodayPanel({ state, actions }: Props) {
  const [draft, setDraft] = useState('');
  const openTasks = state.tasks.filter((task) => !task.done);
  const doneTasks = state.tasks.filter((task) => task.done);
  const ordered = [...openTasks, ...doneTasks];
  const sunPercent = Math.min(100, (state.sunMsToday / SUN_CAP_MS) * 100);
  const sunFull = state.sunMsToday >= SUN_CAP_MS;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    actions.addTask(text);
    setDraft('');
  };

  return (
    <div className="panel today-panel">
      {!state.onboardingDone ? (
        <section className="welcome-card">
          <div className="welcome-thumb">
            <PlantThumb species="fern" size={54} />
          </div>
          <div>
            <p className="eyebrow">a small welcome</p>
            <h3>hello. i&apos;m your jar.</h3>
            <p className="welcome-copy">
              Time at this PC is sunlight. Finished tasks become dew and spores.
              Mist the plants, plant what you unlock, and keep a little streak.
            </p>
            <button type="button" className="primary compact" onClick={actions.dismissOnboarding}>
              say hello
            </button>
          </div>
        </section>
      ) : null}

      {state.settings.paused ? (
        <section className="pause-banner">
          <Pause size={14} />
          <span>growth is paused. the jar is resting.</span>
          <button type="button" className="text-button" onClick={() => actions.updateSettings({ paused: false })}>
            <Play size={12} /> resume
          </button>
        </section>
      ) : null}

      <section className="stat-grid" aria-label="Today">
        <div className="stat-card">
          <div className="stat-label">
            <Sun size={12} /> sun
          </div>
          <div className="stat-value">{formatMinutes(state.focusMsToday)}</div>
          <div className="stat-foot">{sunFull ? 'full for today' : `of ${formatMinutes(SUN_CAP_MS)}`}</div>
          <div className="meter" aria-hidden="true">
            <span style={{ width: `${sunPercent}%` }} />
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">
            <Check size={12} /> done
          </div>
          <div className="stat-value">{state.tasksDoneToday}</div>
          <div className="stat-foot">{openTasks.length} open</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">
            <Flame size={12} /> streak
          </div>
          <div className="stat-value">{state.streak > 0 ? `${state.streak}d` : '—'}</div>
          <div className="stat-foot">best {state.bestStreak}d</div>
        </div>
      </section>

      <section className="tasks-section">
        <div className="section-head">
          <h3>the little things</h3>
          <span className="counter">{openTasks.length}</span>
        </div>

        <form className="task-form" onSubmit={submit}>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="one small thing…"
            maxLength={140}
            aria-label="New task"
          />
          <button type="submit" className="add-button" aria-label="Add task" disabled={!draft.trim()}>
            <Plus size={15} />
          </button>
        </form>

        {ordered.length === 0 ? (
          <div className="empty-tasks">
            <span className="empty-leaf">✦</span>
            <p>the day is blank. add one small thing.</p>
          </div>
        ) : (
          <ul className="task-list">
            {ordered.map((task) => (
              <li key={task.id} className={`task-row ${task.done ? 'is-done' : ''}`}>
                <button
                  type="button"
                  className={`task-check ${task.done ? 'is-checked' : ''}`}
                  aria-label={task.done ? `${task.text} completed` : `Complete ${task.text}`}
                  aria-pressed={task.done}
                  disabled={task.done}
                  onClick={() => actions.completeTask(task.id)}
                >
                  {task.done ? <Check size={11} strokeWidth={3} /> : null}
                </button>
                <span className="task-text">{task.text}</span>
                {!task.done ? (
                  <button
                    type="button"
                    className="task-delete"
                    aria-label={`Delete ${task.text}`}
                    onClick={() => actions.deleteTask(task.id)}
                  >
                    <X size={12} />
                  </button>
                ) : (
                  <span className="task-done-mark">done</span>
                )}
              </li>
            ))}
          </ul>
        )}

        {ordered.length > 0 && openTasks.length === 0 ? (
          <p className="all-clear">all clear. the moss is grateful.</p>
        ) : null}
      </section>

      <section className="mist-section">
        <button
          type="button"
          className="mist-button"
          onClick={actions.mist}
          disabled={state.dew < MIST_COST || state.plants.length === 0 || state.settings.paused}
        >
          <Droplets size={15} />
          <span>mist the jar</span>
          <span className="cost-chip">{MIST_COST} dew</span>
        </button>
        <p className="hint">
          {state.dew} dew in the leaves. every finished task drops {TASK_DEW} dew and a spore.
        </p>
      </section>
    </div>
  );
}
