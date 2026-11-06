import { FolderOpen, Ghost, Info, LogOut, Monitor } from 'lucide-react';
import { bridge, isDesktop } from '../lib/bridge';
import type { TerrariumState } from '../lib/types';
import type { TerrariumActions } from '../lib/useTerrarium';

interface Props {
  state: TerrariumState;
  actions: TerrariumActions;
}

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

export function SettingsPanel({ state, actions }: Props) {
  const settings = state.settings;

  return (
    <div className="panel settings-panel">
      <section className="settings-section">
        <div className="section-head">
          <h3>
            <Monitor size={12} /> where it lives
          </h3>
        </div>
        <p className="settings-copy">
          Mosslight is always the living scene. Choose whether it floats as a
          jar or stretches into a garden shelf above the taskbar.
        </p>
        <div
          className="display-choices"
          role="radiogroup"
          aria-label="Where Mosslight lives"
        >
          <button
            type="button"
            role="radio"
            aria-checked={settings.display === 'jar'}
            data-display-mode="jar"
            className={`display-choice ${settings.display === 'jar' ? 'is-active' : ''}`}
            onClick={() => actions.updateSettings({ display: 'jar' })}
          >
            <span className="display-preview is-jar" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="display-choice-copy">
              <span className="display-choice-title">floating jar</span>
              <span className="display-choice-note">small · drag it anywhere</span>
            </span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={settings.display === 'shelf'}
            data-display-mode="shelf"
            className={`display-choice ${settings.display === 'shelf' ? 'is-active' : ''}`}
            onClick={() => actions.updateSettings({ display: 'shelf' })}
          >
            <span className="display-preview is-shelf" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="display-choice-copy">
              <span className="display-choice-title">window shelf</span>
              <span className="display-choice-note">full width · above the taskbar</span>
            </span>
          </button>
        </div>
        <p className="settings-hint">
          The shelf stays live and lets clicks pass through, except on its controls
          and open field notes. Ctrl+Alt+S switches shapes.
        </p>
      </section>

      <section className="settings-section">
        <div className="section-head">
          <h3>the window</h3>
        </div>
        <Toggle
          label="stay on top"
          description="keep the garden above other windows"
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
          description="keep the garden still without closing it"
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
            <Info size={12} /> the small print
          </h3>
        </div>
        <p className="settings-copy">
          Windows has no live surface on the lock screen, so Mosslight does not
          pretend to be a wallpaper. Everything it draws is the real, growing
          window. No account, no telemetry, no network calls.
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
