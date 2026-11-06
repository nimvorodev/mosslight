import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  Check,
  CloudFog,
  CloudRain,
  Droplets,
  Flame,
  Moon,
  Pause,
  Play,
  Plus,
  Sparkles,
  Sun,
  Timer,
  X,
} from 'lucide-react';
import {
  MIST_COST,
  STAR_RETENTION_MS,
  SUN_CAP_MS,
  TASK_DEW,
  focusRemainingMs,
  formatMinutes,
} from '../lib/state';
import {
  focusDuskActive,
  rareWeatherFor,
  rareWeatherLabel,
  seasonAt,
  weatherFor,
  type WeatherKind,
} from '../lib/atmosphere';
import { visibleStars } from '../lib/constellations';
import type { TerrariumState } from '../lib/types';
import type { TerrariumActions } from '../lib/useTerrarium';
import { PlantThumb } from './PlantThumb';

interface Props {
  state: TerrariumState;
  now: number;
  actions: TerrariumActions;
  selectedStarId: string | null;
  onSelectStar: (id: string | null) => void;
}

const FOCUS_CHOICES = [25, 50];

function clockLabel(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function starAge(at: number, now: number): string {
  const gap = Math.max(0, now - at);
  const minutes = Math.floor(gap / 60_000);
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

function WeatherIcon({ kind }: { kind: WeatherKind }) {
  if (kind === 'rain') return <CloudRain size={16} />;
  if (kind === 'fog') return <CloudFog size={16} />;
  if (kind === 'golden') return <Sparkles size={16} />;
  return <Sun size={16} />;
}

export function TodayPanel({ state, now, actions, selectedStarId, onSelectStar }: Props) {
  const [draft, setDraft] = useState('');
  const openTasks = state.tasks.filter((task) => !task.done);
  const doneTasks = state.tasks.filter((task) => task.done);
  const ordered = [...openTasks, ...doneTasks];
  const sunPercent = Math.min(100, (state.sunMsToday / SUN_CAP_MS) * 100);
  const sunFull = state.sunMsToday >= SUN_CAP_MS;

  const weather = weatherFor(state, now);
  const season = seasonAt(now);
  const rare = rareWeatherFor(now);
  const focus = state.focus;
  const focusActive = focusDuskActive(state, now);
  const remaining = focusRemainingMs(state, now);
  const focusPercent = focus
    ? Math.min(
        100,
        Math.max(
          0,
          ((now - focus.startedAt) / Math.max(1, focus.endsAt - focus.startedAt)) * 100,
        ),
      )
    : 0;
  const stars = visibleStars(state.stars, now, STAR_RETENTION_MS)
    .slice()
    .sort((a, b) => b.at - a.at);
  const selectedStar = stars.find((star) => star.id === selectedStarId) ?? null;
  const recentStars = stars.slice(0, 4);

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

      <section className={`weather-chip weather-${weather.kind}`} aria-label="Weather">
        <span className="weather-icon">
          <WeatherIcon kind={weather.kind} />
        </span>
        <div className="weather-copy">
          <span className="weather-label">{weather.label}</span>
          <span className="weather-detail">{weather.detail}</span>
          {rare ? <span className="weather-rare">{rareWeatherLabel(rare)}</span> : null}
        </div>
        <span className="weather-season">{season.name}</span>
      </section>

      <section
        className={`focus-card ${focusActive ? 'is-active' : ''} ${
          focus && !focusActive ? 'is-done' : ''
        }`}
      >
        <div className="focus-head">
          <span className="focus-title">
            {focusActive ? <Moon size={12} /> : <Timer size={12} />} focus dusk
          </span>
          {focus ? (
            <span className="focus-clock">{focusActive ? clockLabel(remaining) : 'settling'}</span>
          ) : (
            <span className="focus-note">dim the jar while you work</span>
          )}
        </div>

        {focus ? (
          <>
            <div className="meter focus-meter" aria-hidden="true">
              <span style={{ width: `${focusPercent}%` }} />
            </div>
            <p className="focus-detail">
              {focusActive
                ? `${focus.minutes} quiet minutes · a vine is climbing the glass`
                : 'the dusk is finished'}
            </p>
            {focusActive ? (
              <button type="button" className="text-button" onClick={actions.stopFocus}>
                let the dusk lift early
              </button>
            ) : null}
          </>
        ) : (
          <div className="focus-options">
            {FOCUS_CHOICES.map((minutes) => (
              <button
                key={minutes}
                type="button"
                className="focus-choice"
                onClick={() => actions.startFocus(minutes)}
              >
                {minutes}m
                <span>focus</span>
              </button>
            ))}
          </div>
        )}
      </section>

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

      <section className="night-section">
        <div className="section-head">
          <h3>
            <Moon size={11} /> night sky
          </h3>
          <span className="counter">{stars.length}</span>
        </div>

        {selectedStar ? (
          <article className="star-note">
            <div className="star-note-head">
              <span className="star-mark" aria-hidden="true">
                ✦
              </span>
              <span className="star-when">{starAge(selectedStar.at, now)}</span>
              <button
                type="button"
                className="task-delete"
                aria-label="Close star"
                onClick={() => onSelectStar(null)}
              >
                <X size={12} />
              </button>
            </div>
            <p className="star-text">{selectedStar.text}</p>
            <span className="star-foot">finished · kept in the sky for a while</span>
          </article>
        ) : null}

        {recentStars.length === 0 ? (
          <p className="hint night-empty">
            finished things gather here after dark. click a star in the jar to read it.
          </p>
        ) : (
          <ul className="star-list">
            {recentStars.map((star) => (
              <li key={star.id}>
                <button
                  type="button"
                  className={`star-row ${star.id === selectedStarId ? 'is-selected' : ''}`}
                  onClick={() => onSelectStar(star.id === selectedStarId ? null : star.id)}
                >
                  <span className="star-mark" aria-hidden="true">
                    ✦
                  </span>
                  <span className="star-row-text">{star.text}</span>
                  <span className="star-row-age">{starAge(star.at, now)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="hint">finish a task and it becomes a small light. stars fade after a month or so.</p>
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
