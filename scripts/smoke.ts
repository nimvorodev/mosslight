/**
 * A tiny, dependency-free check of the growth rules. Run `npm run smoke`.
 * These are the invariants the UI relies on, so they are worth guarding.
 */
import assert from 'node:assert/strict';
import {
  MIST_COST,
  SUN_CAP_MS,
  TASK_DEW,
  TASK_SPORES,
  addTask,
  applyPresence,
  completeTask,
  makeInitialState,
  mistPlants,
  normalizeDay,
  normalizeState,
  plantSpecies,
  syncCreatures,
} from '../src/lib/state';
import { SPECIES } from '../src/lib/species';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
/** Local 9am, so adding hours stays inside one calendar day. */
const NOW = new Date(2023, 10, 14, 9, 0, 0).getTime();
const MINUTE = 60 * 1000;

function check(label: string, fn: () => void): void {
  fn();
  console.log(`  ok  ${label}`);
}

console.log('mosslight state checks');

check('a fresh jar has four plants and a snail', () => {
  const state = makeInitialState(NOW);
  assert.equal(state.plants.length, 4);
  assert.equal(state.creatures.length, 1);
  assert.equal(state.creatures[0].species, 'snail');
  assert.equal(state.settings.paused, false);
});

check('saved state survives a JSON round trip', () => {
  const now = NOW;
  const state = makeInitialState(now);
  const restored = normalizeState(JSON.parse(JSON.stringify(state)), now);
  assert.deepEqual(restored.plants, state.plants);
  assert.equal(restored.version, 1);
});

check('presence is sunlight, capped at six hours a day', () => {
  const now = NOW;
  const start = makeInitialState(now);
  const half = applyPresence(start, 30 * MINUTE, now + 30 * MINUTE);
  assert.ok(half.state.focusMsToday === 30 * MINUTE);
  assert.ok(
    half.state.plants[0].growth > start.plants[0].growth,
    'a plant should grow in the light',
  );

  const allDay = applyPresence(half.state, 12 * HOUR, now + 12 * HOUR);
  assert.equal(allDay.state.sunMsToday, SUN_CAP_MS);
  assert.equal(allDay.state.focusMsToday, 30 * MINUTE + 12 * HOUR);
  const before = allDay.state.plants.map((plant) => plant.growth);
  const more = applyPresence(allDay.state, 2 * HOUR, now + 14 * HOUR);
  assert.deepEqual(
    more.state.plants.map((plant) => plant.growth),
    before,
    'no growth beyond the daily cap',
  );
});

check('pausing stops growth but still records the visit', () => {
  const now = NOW;
  const state = {
    ...makeInitialState(now),
    settings: { ...makeInitialState(now).settings, paused: true },
  };
  const result = applyPresence(state, HOUR, now + HOUR).state;
  assert.equal(result.plants[0].growth, state.plants[0].growth);
  assert.equal(result.lastSeenAt, now + HOUR);
});

check('finishing a task drops dew, a spore, and starts a streak', () => {
  const now = NOW;
  const state = makeInitialState(now);
  const added = addTask(state, 'water the fern', now);
  assert.ok(added.state);
  const taskId = added.state.tasks[0].id;

  const result = completeTask(added.state, taskId, now + MINUTE);
  assert.equal(result.completed, true);
  assert.equal(result.newStreak, true);
  assert.equal(result.state.dew, state.dew + TASK_DEW);
  assert.equal(result.state.spores, state.spores + TASK_SPORES);
  assert.equal(result.state.streak, 1);
  assert.equal(result.state.tasksDoneToday, 1);
});

check('a streak grows across consecutive days and resets after a gap', () => {
  const now = NOW;
  let state = makeInitialState(now);
  state = addTask(state, 'day one', now).state;
  state = completeTask(state, state.tasks[0].id, now + MINUTE).state;
  assert.equal(state.streak, 1);

  const tomorrow = now + DAY;
  state = normalizeDay(state, tomorrow);
  state = addTask(state, 'day two', tomorrow).state;
  state = completeTask(state, state.tasks[state.tasks.length - 1].id, tomorrow + MINUTE).state;
  assert.equal(state.streak, 2);

  const afterGap = normalizeDay(state, tomorrow + 3 * DAY);
  assert.equal(afterGap.streak, 0);
});

check('planting spends spores and fills a free slot', () => {
  const now = NOW;
  const state = { ...makeInitialState(now), spores: 10 };
  const result = plantSpecies(state, 'mushroom', now);
  assert.equal(result.planted, true);
  assert.equal(result.state.spores, 10 - SPECIES.mushroom.cost);
  assert.equal(result.state.plants.length, state.plants.length + 1);
  const slots = new Set(result.state.plants.map((plant) => plant.slot));
  assert.equal(slots.size, result.state.plants.length, 'slots stay unique');
});

check('locked seeds cannot be planted', () => {
  const now = NOW;
  const state = { ...makeInitialState(now), spores: 99 };
  const result = plantSpecies(state, 'crystal', now);
  assert.ok(result.error);
  assert.equal(result.state.plants.length, state.plants.length);
});

check('misting spends dew and nudges growth', () => {
  const now = NOW;
  const state = { ...makeInitialState(now), dew: 5 };
  const before = state.plants.map((plant) => plant.growth);
  const result = mistPlants(state, now);
  assert.equal(result.error, undefined);
  assert.equal(result.state.dew, 5 - MIST_COST);
  result.state.plants.forEach((plant, index) => {
    assert.ok(plant.growth > before[index]);
  });
});

check('harmony invites a ladybug after a few finished tasks', () => {
  const now = NOW;
  let state = makeInitialState(now);
  for (let index = 0; index < 4; index += 1) {
    state = addTask(state, `task ${index}`, now).state;
    const id = state.tasks[state.tasks.length - 1].id;
    state = completeTask(state, id, now + index * MINUTE).state;
  }
  const result = syncCreatures(state, now);
  assert.ok(
    result.arrived.includes('ladybug'),
    `harmony should be high enough: ${result.arrived.join(',')}`,
  );
});

check('the jar is never empty after normalization', () => {
  const now = NOW;
  const state = makeInitialState(now);
  const broken = normalizeState({ ...state, plants: [] }, now);
  assert.ok(broken.plants.length > 0);
});

console.log('all checks passed');
