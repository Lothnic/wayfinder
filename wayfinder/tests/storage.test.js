import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAN_KEY, blankPlan, readSavedPlan, persistPlan } from '../dist/storage.js';

function memoryStorage(initial) {
  const values = new Map(initial === undefined ? [] : [[PLAN_KEY, initial]]);
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('new visitors get an empty personal plan without writing shared example data', () => {
  const storage = memoryStorage();
  const loaded = readSavedPlan(storage);
  assert.deepEqual(loaded, { plan: blankPlan(), issue: null, recovery: null });
  assert.equal(storage.getItem(PLAN_KEY), null);
});

test('valid saved maps retain vision and notes across reloads', () => {
  const storage = memoryStorage();
  const saved = { ...blankPlan(), vision: 'More time outdoors', notes: 'Start on Saturday.' };
  assert.equal(persistPlan(storage, saved), true);
  assert.deepEqual(readSavedPlan(storage).plan, saved);
});

test('unreadable and invalid saved maps preserve their original contents for recovery', () => {
  for (const raw of ['{broken json', JSON.stringify({version: 999}), '']) {
    const storage = memoryStorage(raw);
    const loaded = readSavedPlan(storage);
    assert.equal(loaded.issue, 'corrupt');
    assert.equal(loaded.recovery, raw);
    assert.deepEqual(loaded.plan, blankPlan());
    assert.equal(storage.getItem(PLAN_KEY), raw);
  }
});

test('disabled storage and exhausted quota report failure without throwing', () => {
  assert.equal(readSavedPlan(undefined).issue, 'unavailable');
  assert.equal(persistPlan(undefined, blankPlan()), false);
  const blocked = { getItem() { throw new Error('Blocked'); }, setItem() { throw new Error('Quota'); } };
  assert.equal(readSavedPlan(blocked).issue, 'unavailable');
  assert.equal(persistPlan(blocked, blankPlan()), false);
});
