import { Check, Lock, Sparkles, Sprout } from 'lucide-react';
import {
  CREATURES,
  CREATURE_ORDER,
  SPECIES,
  SPECIES_ORDER,
  isSpeciesUnlocked,
  unlockText,
} from '../lib/species';
import { MAX_PLANTS, MIST_GROWTH, currentHarmony } from '../lib/state';
import type { TerrariumState } from '../lib/types';
import type { TerrariumActions } from '../lib/useTerrarium';
import { PlantThumb } from './PlantThumb';

interface Props {
  state: TerrariumState;
  actions: TerrariumActions;
}

export function GardenPanel({ state, actions }: Props) {
  const harmony = currentHarmony(state);
  const nextCreature = CREATURE_ORDER.map((id) => CREATURES[id]).find(
    (creature) => !state.creatures.some((resident) => resident.species === creature.id),
  );
  const harmonyPercent = nextCreature
    ? Math.min(100, (harmony / nextCreature.harmony) * 100)
    : 100;
  const full = state.plants.length >= MAX_PLANTS;

  return (
    <div className="panel garden-panel">
      <section className="garden-head">
        <div>
          <p className="eyebrow">spore pantry</p>
          <div className="spore-balance">
            <Sparkles size={16} />
            <strong>{state.spores}</strong>
            <span>spores</span>
          </div>
        </div>
        <div className="capacity">
          <span>
            {state.plants.length} / {MAX_PLANTS} planted
          </span>
          <div className="slot-dots" aria-hidden="true">
            {Array.from({ length: MAX_PLANTS }, (_, index) => (
              <span key={index} className={index < state.plants.length ? 'is-filled' : ''} />
            ))}
          </div>
        </div>
      </section>

      <section className="species-section">
        <div className="section-head">
          <h3>seeds</h3>
          <span className="counter">{SPECIES_ORDER.length}</span>
        </div>
        <div className="species-grid">
          {SPECIES_ORDER.map((id) => {
            const def = SPECIES[id];
            const unlocked = isSpeciesUnlocked(state, def);
            const affordable = state.spores >= def.cost;
            return (
              <button
                key={id}
                type="button"
                className={`species-card ${unlocked ? '' : 'is-locked'} ${
                  affordable ? '' : 'is-unaffordable'
                }`}
                disabled={!unlocked || full}
                onClick={() => actions.plant(id)}
                aria-label={
                  unlocked
                    ? `Plant ${def.name} for ${def.cost} spores`
                    : `${def.name} locked: ${unlockText(def.unlock)}`
                }
              >
                <div className="species-thumb">
                  <PlantThumb species={id} size={54} />
                </div>
                <div className="species-info">
                  <div className="species-name">
                    {def.name}
                    {unlocked ? null : <Lock size={10} />}
                  </div>
                  <p>{unlocked ? def.blurb : unlockText(def.unlock)}</p>
                  <span className={`spore-cost ${affordable ? '' : 'is-low'}`}>
                    <Sparkles size={10} /> {def.cost}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        {full ? <p className="hint">the jar is full. there is room in the moss for everyone.</p> : null}
      </section>

      <section className="residents-section">
        <div className="section-head">
          <h3>residents</h3>
          <span className="counter">{state.creatures.length}</span>
        </div>
        <div className="harmony-block">
          <div className="harmony-label">
            <span>harmony</span>
            <span>
              {nextCreature
                ? `${harmony} / ${nextCreature.harmony} · ${nextCreature.name} next`
                : `${harmony} · all residents home`}
            </span>
          </div>
          <div className="meter" aria-hidden="true">
            <span style={{ width: `${harmonyPercent}%` }} />
          </div>
        </div>
        <ul className="resident-list">
          {CREATURE_ORDER.map((id) => {
            const def = CREATURES[id];
            const arrived = state.creatures.some((creature) => creature.species === id);
            return (
              <li key={id} className={arrived ? 'is-here' : ''}>
                <span className="resident-dot">{arrived ? <Check size={10} /> : null}</span>
                <div>
                  <span className="resident-name">{def.name}</span>
                  <span className="resident-note">
                    {arrived ? def.blurb : `arrives at ${def.harmony} harmony`}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="growth-note">
        <Sprout size={14} />
        <p>
          Every active minute is sunlight. Misting adds {Math.round(MIST_GROWTH * 1000) / 10}%
          growth to every plant. You can grow six hours of sunlight a day, then the jar rests.
        </p>
      </section>
    </div>
  );
}
