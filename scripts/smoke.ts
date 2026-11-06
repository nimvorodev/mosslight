/**
 * A tiny, dependency-free check of the growth rules. Run `npm run smoke`.
 * These are the invariants the UI relies on, so they are worth guarding.
 */
import assert from 'node:assert/strict';
import {
  CUTTING_MIN_GROWTH,
  MAX_PLANTS,
  MIST_COST,
  OFFLINE_REST_CAP_MS,
  REST_MOSS_FULL_MS,
  STAR_RETENTION_MS,
  SUN_CAP_MS,
  TASK_DEW,
  TASK_SPORES,
  addRest,
  addTask,
  applyOfflineRest,
  applyPresence,
  completeTask,
  cuttingFromPlant,
  cuttingToJson,
  focusRemainingMs,
  makeInitialState,
  mistPlants,
  normalizeDay,
  normalizeState,
  parseCutting,
  plantCutting,
  plantSpecies,
  pruneStars,
  startFocus,
  syncCreatures,
  tickFocus,
} from '../src/lib/state';
import { SPECIES } from '../src/lib/species';
import { P } from '../src/lib/palette';
import { ageLabel, traitsFor } from '../src/lib/genetics';
import { rareWeatherFor, seasonAt, weatherFor } from '../src/lib/atmosphere';
import { starPoint } from '../src/lib/constellations';
import { pickAt, sceneGeometry } from '../src/lib/interact';
import type { TaskStar } from '../src/lib/types';

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

check('pausing also stops task growth and misting', () => {
  const now = NOW;
  const base = makeInitialState(now);
  const paused = {
    ...base,
    dew: 10,
    settings: { ...base.settings, paused: true },
  };
  const before = paused.plants.map((plant) => plant.growth);

  const task = addTask(paused, 'resting task', now).state;
  const done = completeTask(task, task.tasks[0].id, now + MINUTE);
  assert.deepEqual(
    done.state.plants.map((plant) => plant.growth),
    before,
    'a finished task must not grow a resting garden',
  );
  assert.equal(done.state.dew, paused.dew + TASK_DEW, 'rewards still arrive');

  const misted = mistPlants(paused, now);
  assert.ok(misted.error, 'misting should be refused while resting');
  assert.equal(misted.state.dew, paused.dew, 'no dew is spent');
  assert.deepEqual(
    misted.state.plants.map((plant) => plant.growth),
    before,
    'no growth is applied',
  );
});

check('bad settings snap back to safe defaults', () => {
  const now = NOW;
  const state = makeInitialState(now);
  const fixed = normalizeState(
    {
      ...state,
      settings: {
        display: 'sideways',
        alwaysOnTop: 'yes',
        launchAtLogin: 1,
        paused: 'no',
        reducedMotion: null,
        atmosphere: 'on',
      },
      seenUnlocks: ['fern', 'fern', 'bogus'],
    },
    now,
  );
  assert.deepEqual(fixed.settings, {
    display: 'jar',
    alwaysOnTop: true,
    launchAtLogin: false,
    paused: false,
    reducedMotion: false,
    atmosphere: true,
  });
  assert.deepEqual(fixed.seenUnlocks, ['fern']);
});

check('duplicate ids are repaired when loading', () => {
  const now = NOW;
  const state = makeInitialState(now);
  const repaired = normalizeState(
    {
      ...state,
      plants: state.plants.map((plant) => ({ ...plant, id: 'same' })),
      tasks: [
        { id: 'dup', text: 'one', done: false, createdAt: now },
        { id: 'dup', text: 'two', done: false, createdAt: now },
      ],
    },
    now,
  );
  assert.equal(
    new Set(repaired.plants.map((plant) => plant.id)).size,
    repaired.plants.length,
  );
  assert.equal(new Set(repaired.tasks.map((task) => task.id)).size, repaired.tasks.length);
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

check('finished tasks become stars in the sky', () => {
  const now = NOW;
  let state = makeInitialState(now);
  state = addTask(state, 'send the note', now).state;
  const result = completeTask(state, state.tasks[0].id, now + MINUTE);
  assert.equal(result.state.stars.length, 1);
  const star = result.state.stars[0];
  assert.equal(star.text, 'send the note');
  assert.ok(star.x >= 0 && star.x <= 1);
  assert.ok(star.y >= 0 && star.y <= 1);
});

check('old stars fade out of the sky', () => {
  const now = NOW;
  const old: TaskStar = {
    id: 'old',
    taskId: 'old',
    text: 'long gone',
    at: now - STAR_RETENTION_MS - DAY,
    x: 0.4,
    y: 0.2,
    size: 1,
    color: 0,
  };
  const fresh = pruneStars(
    [
      old,
      {
        id: 'new',
        taskId: 'new',
        text: 'still here',
        at: now - HOUR,
        x: 0.4,
        y: 0.2,
        size: 1,
        color: 0,
      },
    ],
    now,
  );
  assert.equal(fresh.length, 1);
  assert.equal(fresh[0].text, 'still here');
});

check('stars stay unique per task and ignore far-future clock skew', () => {
  const now = NOW;
  const star: TaskStar = {
    id: 'st_one',
    taskId: 'tk_one',
    text: 'the first copy',
    at: now - 2 * MINUTE,
    x: 0.4,
    y: 0.2,
    size: 1,
    color: 0,
  };
  const duplicate: TaskStar = { ...star, id: 'st_two', text: 'the newest copy', at: now - MINUTE };
  const future: TaskStar = {
    ...star,
    id: 'st_future',
    taskId: 'tk_future',
    text: 'from next week',
    at: now + DAY,
  };
  const pruned = pruneStars([star, duplicate, future], now);
  assert.equal(pruned.length, 1);
  assert.equal(pruned[0].text, 'the newest copy');
});

check('rest moss grows only while away and caps at eight hours', () => {
  const now = NOW;
  const state = makeInitialState(now);
  const before = state.restMs;
  const quiet = applyOfflineRest(state, now + 2 * HOUR);
  assert.equal(quiet.restMs, before + 2 * HOUR);

  const capped = applyOfflineRest(state, now + 30 * HOUR);
  assert.equal(capped.restMs, OFFLINE_REST_CAP_MS);

  const tiny = applyOfflineRest(state, now + 20_000);
  assert.equal(tiny.restMs, before, 'a brief blink does not count');

  const overflow = addRest(state, REST_MOSS_FULL_MS * 2, now + HOUR);
  assert.equal(overflow.restMs, OFFLINE_REST_CAP_MS);

  const awake = applyPresence(quiet, HOUR, now + 3 * HOUR).state;
  assert.equal(awake.restMs, before + HOUR, 'being present wears the moss back');
});

check('a focus session runs down and completes', () => {
  const now = NOW;
  const started = startFocus(makeInitialState(now), 25, now);
  assert.ok(started.state.focus);
  assert.equal(focusRemainingMs(started.state, now), 25 * MINUTE);

  const early = tickFocus(started.state, now + 24 * MINUTE);
  assert.equal(early.completed, false);
  assert.ok(early.state.focus, 'the dusk is still going');

  const done = tickFocus(started.state, now + 25 * MINUTE);
  assert.equal(done.completed, true);
  assert.equal(done.state.focus, null);
  assert.equal(done.state.lastFocusDoneAt, now + 25 * MINUTE);

  const again = startFocus(done.state, 50, now + 26 * MINUTE);
  assert.equal(again.error, undefined);
  assert.equal(again.state.focus?.minutes, 50, 'a new dusk can follow a finished one');
});

check('a cutting round trips through a .moss file and replants', () => {
  const now = NOW;
  const base = makeInitialState(now);
  const state = {
    ...base,
    plants: base.plants.map((plant, index) =>
      index === 0 ? { ...plant, growth: CUTTING_MIN_GROWTH + 0.2 } : plant,
    ),
  };
  const parent = state.plants[0];
  const taken = cuttingFromPlant(parent, now);
  assert.equal(taken.error, undefined);
  assert.ok(taken.cutting);

  const json = cuttingToJson(taken.cutting);
  const parsed = parseCutting(json);
  assert.equal(parsed.error, undefined);
  assert.ok(parsed.cutting);

  const planted = plantCutting(state, parsed.cutting, now + MINUTE);
  assert.equal(planted.error, undefined);
  assert.equal(planted.state.plants.length, state.plants.length + 1);
  const child = planted.state.plants[planted.state.plants.length - 1];
  assert.equal(child.species, parent.species);
  assert.equal(child.seed, parent.seed);
  assert.equal(child.parent?.species, parent.species);
  assert.ok(child.growth < taken.cutting.growth, 'a cutting starts a little shorter');
});

check('a cutting cannot be planted into a full jar', () => {
  const now = NOW;
  const base = makeInitialState(now);
  const source = base.plants[0];
  const plants = Array.from({ length: MAX_PLANTS }, (_, slot) => ({
    ...source,
    id: `pl_full_${slot}`,
    slot,
    growth: 0.8,
  }));
  const full = { ...base, plants };
  const taken = cuttingFromPlant(plants[0], now);
  assert.ok(taken.cutting);
  const result = plantCutting(full, taken.cutting!, now + MINUTE);
  assert.ok(result.error);
  assert.equal(result.state.plants.length, MAX_PLANTS);
});

check('unreadable cuttings are refused', () => {
  assert.ok(parseCutting('not json').error);
  assert.ok(parseCutting(JSON.stringify({ kind: 'something-else', version: 1 })).error);
  assert.ok(
    parseCutting(
      JSON.stringify({ kind: 'mosslight-cutting', version: 1, species: 'bogus', growth: 1 }),
    ).error,
  );
});

check('genetics are stable per seed and name their traits', () => {
  const first = traitsFor('fern', 412);
  const again = traitsFor('fern', 412);
  assert.deepEqual(first.colors, again.colors);
  assert.equal(first.name, again.name);

  const neighbour = traitsFor('fern', 413);
  assert.notEqual(neighbour.variant, first.variant);

  assert.equal(ageLabel(NOW, NOW), 'planted today');
  assert.equal(ageLabel(NOW - DAY, NOW), '1 day old');
  assert.equal(ageLabel(NOW - 3 * DAY, NOW), '3 days old');
});

check('uncommon genetics keep their own species palette', () => {
  const succulent = traitsFor('succulent', 0);
  assert.equal(succulent.variant, 0);
  assert.equal(succulent.colors.dark, P.succulent.dark);
  assert.equal(succulent.colors.mid, P.succulent.mid);
  assert.equal(succulent.colors.light, P.succulent.light);
  assert.equal(succulent.colors.edge, P.succulent.edge);

  const vine = traitsFor('vine', 0);
  assert.equal(vine.variant, 0);
  assert.equal(vine.colors.stem, P.vine.stem);
  assert.equal(vine.colors.leaf, P.vine.leaf);

  const crystal = traitsFor('crystal', 0);
  assert.equal(crystal.variant, 0);
  assert.equal(crystal.colors.dark, P.crystal.dark);
  assert.equal(crystal.colors.mid, P.crystal.mid);
  assert.equal(crystal.colors.glow, P.crystal.glow);
  assert.equal(crystal.colors.edge, P.crystal.edge);
});

check('weather reads the day without scolding it', () => {
  const now = NOW;
  const base = makeInitialState(now);
  assert.equal(weatherFor(base, now).label, 'clear');

  const paused = { ...base, settings: { ...base.settings, paused: true } };
  assert.equal(weatherFor(paused, now).kind, 'fog');

  const focused = startFocus(base, 25, now).state;
  assert.equal(weatherFor(focused, now).kind, 'golden');

  let raining = base;
  for (let index = 0; index < 2; index += 1) {
    raining = addTask(raining, `done ${index}`, now).state;
    const id = raining.tasks[raining.tasks.length - 1].id;
    raining = completeTask(raining, id, now + MINUTE).state;
  }
  assert.equal(weatherFor(raining, now + 2 * MINUTE).kind, 'rain');
  assert.equal(weatherFor(base, now, false).kind, 'fog', 'idle reads as quiet fog');
  assert.equal(
    weatherFor(raining, now + 2 * MINUTE, false).kind,
    'fog',
    'idle fog outranks earlier rain',
  );
  assert.equal(
    weatherFor(focused, now, false).kind,
    'golden',
    'an explicit focus stays golden while idle',
  );
});

check('seasonal drift is stable across the year', () => {
  assert.equal(seasonAt(new Date(2023, 0, 15).getTime()).id, 'winter');
  assert.equal(seasonAt(new Date(2023, 3, 15).getTime()).id, 'spring');
  assert.equal(seasonAt(new Date(2023, 6, 15).getTime()).id, 'summer');
  assert.equal(seasonAt(new Date(2023, 9, 15).getTime()).id, 'autumn');
  assert.equal(rareWeatherFor(new Date(2023, 6, 15).getTime()), null, 'summer stays clear');

  const morning = new Date(2023, 9, 15, 0, 30).getTime();
  const evening = new Date(2023, 9, 15, 23, 30).getTime();
  assert.equal(
    rareWeatherFor(morning),
    rareWeatherFor(evening),
    'a rare visitor lasts the local day',
  );
});

check('plants and stars can be picked from the jar', () => {
  const state = makeInitialState(NOW);
  const geometry = sceneGeometry(state, 'jar', 192, 160);

  const plant = state.plants[0];
  const slot = geometry.slots[plant.slot];
  const plantX = geometry.x + slot.x * geometry.w;
  const plantY = geometry.y + (geometry.horizon + slot.y - 0.68) * geometry.h;
  const pickedPlant = pickAt(state, geometry, plantX, plantY - 3, false, NOW);
  assert.equal(pickedPlant.plantId, plant.id);

  const star: TaskStar = {
    id: 'st_pick',
    taskId: 'tk_pick',
    text: 'a finished thing',
    at: NOW,
    x: 0.5,
    y: 0.2,
    size: 1,
    color: 0,
  };
  const starState = { ...state, stars: [star] };
  const point = starPoint(star, geometry.sky);
  const pickedStar = pickAt(starState, geometry, point.x, point.y, true, NOW);
  assert.equal(pickedStar.star?.id, star.id);

  const daytime = pickAt(starState, geometry, point.x, point.y, false, NOW);
  assert.equal(daytime.star, null, 'stars are only clickable at night');
});

check('expired or far-future stars cannot be picked', () => {
  const state = makeInitialState(NOW);
  const geometry = sceneGeometry(state, 'jar', 192, 160);
  const base: TaskStar = {
    id: 'st_old',
    taskId: 'tk_old',
    text: 'long gone',
    at: NOW - STAR_RETENTION_MS - DAY,
    x: 0.5,
    y: 0.2,
    size: 1,
    color: 0,
  };
  const future: TaskStar = {
    ...base,
    id: 'st_future',
    taskId: 'tk_future',
    at: NOW + DAY,
  };
  for (const star of [base, future]) {
    const point = starPoint(star, geometry.sky);
    const picked = pickAt({ ...state, stars: [star] }, geometry, point.x, point.y, true, NOW);
    assert.equal(picked.star, null);
  }
});

check('shelf geometry spreads plants across the drawn sill', () => {
  const state = makeInitialState(NOW);
  const geometry = sceneGeometry(state, 'shelf', 800, 250);
  assert.equal(geometry.h, Math.round(250 * 0.86));

  const used = state.plants.map((plant) => plant.slot).sort((a, b) => a - b);
  const xs = used.map((slot) => geometry.slots[slot].x);
  const center = xs.reduce((sum, x) => sum + x, 0) / xs.length;
  assert.ok(Math.abs(center - 0.5) < 1e-9, 'the bed stays centred');

  const plant = state.plants[0];
  const slot = geometry.slots[plant.slot];
  const x = geometry.x + slot.x * geometry.w;
  const y = geometry.y + (geometry.horizon + slot.y - 0.68) * geometry.h;
  assert.equal(pickAt(state, geometry, x, y - 3, false, NOW).plantId, plant.id);
});

console.log('all checks passed');
