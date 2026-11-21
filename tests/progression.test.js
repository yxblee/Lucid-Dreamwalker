import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame, addExperience, purchaseUpgrade, completeDream, getStats, validateSave } from '../src/game/progression.js';

test('experience levels raise stats and carry remaining experience', () => {
  const state = createNewGame();
  const leveled = addExperience(state, 120);
  assert.equal(leveled.level, 2);
  assert.equal(leveled.xp, 20);
  assert.equal(getStats(leveled).maxHealth, 110);
  assert.equal(getStats(leveled).damage, 18);
});

test('upgrades spend crystals and improve equipment without allowing negative currency', () => {
  const state = { ...createNewGame(), crystals: 30 };
  const upgraded = purchaseUpgrade(state, 'blade');
  assert.equal(upgraded.crystals, 18);
  assert.equal(upgraded.upgrades.blade, 1);
  assert.equal(getStats(upgraded).damage, 22);
  assert.deepEqual(purchaseUpgrade({ ...state, crystals: 0 }, 'blade'), { ...state, crystals: 0 });
});

test('dream completion grants rewards and unlocks the next connected dream', () => {
  let state = createNewGame();
  state = completeDream(state, 'bellwright');
  assert.equal(state.completed.includes('bellwright'), true);
  assert.equal(state.unlocked.includes('archivist'), true);
  assert.equal(state.abilities.doubleJump, true);
  assert.equal(state.abilities.slide, true);
  assert.equal(state.clues.length, 1);
  assert.equal(completeDream(state, 'cartographer').unlocked.includes('cartographer'), false);
});

test('finishing the final dream marks the artifact recoverable', () => {
  let state = createNewGame();
  state = completeDream(state, 'bellwright');
  state = completeDream(state, 'archivist');
  state = completeDream(state, 'cartographer');
  assert.equal(state.artifact, true);
  assert.equal(state.abilities.fly, true);
});

test('save validation rejects malformed data and preserves valid progress', () => {
  assert.equal(validateSave(null), null);
  assert.equal(validateSave({ version: 1, crystals: 'many' }), null);
  const valid = createNewGame();
  assert.equal(validateSave(valid).version, 1);
});
