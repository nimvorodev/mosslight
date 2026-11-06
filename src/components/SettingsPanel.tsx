import {
  Camera,
  FolderOpen,
  Ghost,
  Info,
  LogOut,
  Monitor,
  RotateCcw,
  Smartphone,
} from 'lucide-react';
import { bridge, isDesktop } from '../lib/bridge';
import type { SnapshotMode } from '../lib/types';
import type { TerrariumState } from '../lib/types';
import type { TerrariumActions } from '../lib/useTerrarium';

interface Props {
  state: TerrariumState;
  actions: TerrariumActions;
  snapshotBusy: boolean;
}

const MODES: { id: SnapshotMode; label: string }[] = [
  { id: 'off', label: 'off' },
  { id: 'desktop', label: 'desktop' },
  { id: 'lock', label: 'lock' },
  { id: 'both', label: 'both' },
];

const INTERVALS = [
  { value: 30, label: 'every 30 min' },
  { value: 60, label: 'every hour' },
  { value: 180, label: 'every 3 hours' },
  { value: 360, label: 'every 6 hours' },
];

function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`setting-row ${disabled ? 'is-disabled' : ''}`}>
      <div className="setting-copy">
        <span className="setting-label">{label}</span>
        <span className="setting-note">{description}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-label={label}
        aria-checked={checked}
        className={`switch ${checked ? 'is-on' : ''}`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </div>
  );
}

export function SettingsPanel({ state, actions, snapshotBusy }: Props) {
  const settings = state.settings;
  const lastUpdate = settings.lastSnapshotAt
    ? new Date(settings.lastSnapshotAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'never';

  return (
    <div className="panel settings-panel">
      <section className="settings-section">
        <div className="section-head">
          <h3>the window</h3>
        </div>
        <Toggle
          label="stay on top"
          description="keep the jar above other windows"
          checked={settings.alwaysOnTop}
          onChange={(value) => actions.updateSettings({ alwaysOnTop: value })}
        />
        <Toggle
          label="start with windows"
          description="open Mosslight quietly at login"
          checked={settings.launchAtLogin}
          disabled={!isDesktop}
          onChange={(value) => actions.updateSettings({ launchAtLogin: value })}
        />
        <div className="setting-row">
          <div className="setting-copy">
            <span className="setting-label">ghost mode</span>
            <span className="setting-note">let clicks pass through · Ctrl+Alt+T returns</span>
          </div>
          <button type="button" className="setting-action" onClick={actions.toggleGhost}>
            <Ghost size={12} /> enter
          </button>
        </div>
      </section>

      <section className="settings-section">
        <div className="section-head">
          <h3>the growing</h3>
        </div>
        <Toggle
          label="pause growth"
          description="keep the jar still without closing it"
          checked={settings.paused}
          onChange={(value) => actions.updateSettings({ paused: value })}
        />
        <Toggle
          label="reduce motion"
          description="calmer sway, fewer floating things"
          checked={settings.reducedMotion}
          onChange={(value) => actions.updateSettings({ reducedMotion: value })}
        />
        <Toggle
          label="show atmosphere"
          description="drifting dust and a little glow"
          checked={settings.atmosphere}
          onChange={(value) => actions.updateSettings({ atmosphere: value })}
        />
      </section>

      <section className="settings-section">
        <div className="section-head">
          <h3>
            <Camera size={12} /> portrait
          </h3>
          <span className="counter">{lastUpdate}</span>
        </div>
        <p className="settings-copy">
          Render the living vivarium as a still image and set it as your wallpaper
          or lock screen. This is how the jar can be seen while the PC is locked.
        </p>
        <div className="segmented snapshot-modes" role="group" aria-label="Snapshot target">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={settings.snapshots === mode.id ? 'is-active' : ''}
              aria-pressed={settings.snapshots === mode.id}
              onClick={() => actions.setSnapshotMode(mode.id)}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <div className="snapshot-controls">
          <label className="select-wrap">
            <span className="sr-only">Snapshot interval</span>
            <select
              value={settings.snapshotMinutes}
              onChange={(event) => actions.setSnapshotMinutes(Number(event.target.value))}
              disabled={settings.snapshots === 'off'}
            >
              {INTERVALS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="setting-action is-primary"
            onClick={() => actions.takeSnapshot()}
            disabled={snapshotBusy}
          >
            <Monitor size={12} />
            {snapshotBusy ? 'rendering…' : 'update now'}
          </button>
        </div>
        {settings.snapshots === 'lock' || settings.snapshots === 'both' ? (
          <div className="settings-note">
            <Smartphone size={11} />
            <div>
              <p>
                Windows blocks live apps on the lock screen. Mosslight renders a still
                portrait and keeps a copy in Pictures\Mosslight. If Windows asks, choose
                that file once under Personalisation → Lock screen.
              </p>
              <button
                type="button"
                className="text-button note-action"
                onClick={actions.openLockScreenSettings}
              >
                open Windows lock screen settings
              </button>
            </div>
          </div>
        ) : null}
        {isDesktop ? (
          <button type="button" className="text-button" onClick={actions.restoreWallpaper}>
            <RotateCcw size={11} /> restore my previous wallpaper
          </button>
        ) : null}
      </section>

      <section className="settings-section">
        <div className="section-head">
          <h3>
            <Info size={12} /> the small print
          </h3>
        </div>
        <p className="settings-copy">
          Everything lives on this machine. No account, no telemetry, no network calls.
          The jar only knows how long the PC has been awake and which tasks you finish here.
        </p>
        <div className="settings-actions">
          <button type="button" className="setting-action" onClick={actions.openDataFolder}>
            <FolderOpen size={12} /> data folder
          </button>
          <button type="button" className="setting-action is-danger" onClick={actions.quit}>
            <LogOut size={12} /> quit
          </button>
        </div>
        <p className="version-line">
          Mosslight {bridge.version} · {isDesktop ? bridge.platform : 'web preview'}
        </p>
      </section>
    </div>
  );
}
