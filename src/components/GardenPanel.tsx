import { Check, Lock, Moon, Scissors, Sparkles, Sprout, Upload } from 'lucide-react';
import {
  CREATURES,
  CREATURE_ORDER,
  SPECIES,
  SPECIES_ORDER,
  isSpeciesUnlocked,
  unlockText,
} from '../lib/species';
import {
  CUTTING_MIN_GROWTH,
  MAX_PLANTS,
  MIST_GROWTH,
  REST_MOSS_FULL_MS,
  currentHarmony,
  restLevel,
} from '../lib/state';
import { ageLabel, traitLabel, traitsFor } from '../lib/genetics';
import type { TerrariumState } from '../lib/types';
import type { TerrariumActions } from '../lib/useTerrarium';
import { PlantThumb } from './PlantThumb';

interface Props {
  state: TerrariumState;
  now: number;
  actions: TerrariumActions;
  selectedPlantId: string | null;
  onSelectPlant: (id: string | null) => void;
}

function quietLabel(restMs: number): string {
  const minutes = Math.floor(restMs / 60_000);
  if (minutes < 1) return 'no quiet yet';
  if (minutes < 60) return `${minutes}m of quiet`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest > 0 ? `${hours}h ${rest}m of quiet` : `${hours}h of quiet`;
  return 'a full day of quiet';
}

export function GardenPanel({ state, now, actions, selectedPlantId, onSelectPlant }: Props) {
  const harmony = currentHarmony(state);
  const nextCreature = CREATURE_ORDER.map((id) => CREATURES[id]).find(
    (creature) => !state.creatures.some((resident) => resident.species === creature.id),
  );
  const harmonyPercent = nextCreature
    ? Math.min(100, (harmony / nextCreature.harmony) * 100)
    : 100;
  const full = state.plants.length >= MAX_PLANTS;

  const selectedPlant = state.plants.find((plant) => plant.id === selectedPlantId) ?? null;
  const selectedTraits = selectedPlant ? traitsFor(selectedPlant.species, selectedPlant.seed) : null;
  const selectedDef = selectedPlant ? SPECIES[selectedPlant.species] : null;
  const mossLevel = restLevel(state.restMs);
  const mossPercent = Math.round(mossLevel * 100);

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

      <section className={`rest-card ${mossLevel > 0.98 ? 'is-full' : ''}`}>
        <div className="rest-head">
          <span className="rest-title">
            <Moon size={12} /> rest moss
          </span>
          <span className="rest-level">{mossPercent}%</span>
        </div>
        <div className="meter rest-meter" aria-hidden="true">
          <span style={{ width: `${mossPercent}%` }} />
        </div>
        <p className="rest-copy">
          {mossLevel <= 0
            ? 'this patch only grows while the jar is alone. leave it for a while.'
            : mossLevel >= 1
              ? 'the moss has reached its full width. it keeps the jar company.'
              : `${quietLabel(state.restMs)} · it fills over ${REST_MOSS_FULL_MS / 3_600_000} hours away.`}
        </p>
      </section>

      <section className="planted-section">
        <div className="section-head">
          <h3>the living</h3>
          <span className="counter">{state.plants.length}</span>
          <button type="button" className="mini-action" onClick={actions.importCutting}>
            <Upload size={10} /> plant a cutting
          </button>
        </div>

        {state.plants.length === 0 ? (
          <p className="hint">the soil is bare. plant a spore or bring in a .moss cutting.</p>
        ) : (
          <ul className="planted-list">
            {state.plants.map((plant) => {
              const def = SPECIES[plant.species];
              const selected = plant.id === selectedPlantId;
              return (
                <li key={plant.id}>
                  <button
                    type="button"
                    className={`planted-row ${selected ? 'is-selected' : ''}`}
                    onClick={() => onSelectPlant(selected ? null : plant.id)}
                    aria-pressed={selected}
                    aria-label={`Open the herbarium card for the ${def.name}`}
                  >
                    <span className="planted-thumb">
                      <PlantThumb
                        species={plant.species}
                        seed={plant.seed}
                        growth={plant.growth}
                        size={42}
                      />
                    </span>
                    <span className="planted-info">
                      <span className="planted-name">{def.name}</span>
                      <span className="planted-meta">
                        {Math.round(plant.growth * 100)}% grown
                        {plant.parent ? ' · cutting' : ''}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {selectedPlant && selectedTraits && selectedDef ? (
          <article className="herbarium-card">
            <div className="herbarium-top">
              <div className="herbarium-thumb">
                <PlantThumb
                  species={selectedPlant.species}
                  seed={selectedPlant.seed}
                  growth={selectedPlant.growth}
                  size={68}
                />
              </div>
              <div className="herbarium-copy">
                <p className="eyebrow">herbarium card</p>
                <h3>{selectedDef.name}</h3>
                <p className="herbarium-trait">{traitLabel(selectedTraits)}</p>
                <div className="herbarium-facts">
                  <span>{ageLabel(selectedPlant.plantedAt, now)}</span>
                  <span>{Math.round(selectedPlant.growth * 100)}% grown</span>
                </div>
              </div>
            </div>
            <p className="herbarium-lineage">
              {selectedPlant.parent
                ? `grown from a ${SPECIES[selectedPlant.parent.species].name} cutting · parent ${ageLabel(
                    selectedPlant.parent.plantedAt,
                    now,
                  )}`
                : 'grown from a spore in this jar'}
            </p>
            <div className="herbarium-actions">
              <button
                type="button"
                className="cutting-button"
                onClick={() => actions.takeCutting(selectedPlant.id)}
                disabled={selectedPlant.growth < CUTTING_MIN_GROWTH}
              >
                <Scissors size={12} />
                take a cutting
              </button>
              <button type="button" className="text-button" onClick={() => onSelectPlant(null)}>
                close card
              </button>
            </div>
            {selectedPlant.growth < CUTTING_MIN_GROWTH ? (
              <p className="hint herbarium-hint">
                a cutting can be taken once the plant is {Math.round(CUTTING_MIN_GROWTH * 100)}%
                grown.
              </p>
            ) : null}
          </article>
        ) : (
          <p className="hint herbarium-empty">
            tap a plant in the jar or in this list to read its herbarium card.
          </p>
        )}
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
