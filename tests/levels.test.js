import test from 'node:test';
import assert from 'node:assert/strict';
import { createDream, DREAMS } from '../src/game/levels.js';

test('all dreams have spawn, timed exit, three clues, and reachable world bounds', () => {
  for (const id of Object.keys(DREAMS)) {
    const level = createDream(id);
    assert.equal(level.collectibles.filter((item) => item.kind === 'memory').length, 3);
    assert.ok(level.timeLimit > 30);
    assert.ok(level.exit.x > level.spawn.x);
    assert.ok(level.platforms.length >= 8);
    assert.ok(level.platforms.every((p) => p.w > 0 && p.h > 0));
  }
});

test('later dreams combine the mechanics introduced by earlier dreams', () => {
  assert.ok(createDream('bellwright').platforms.some((p) => p.motion));
  assert.ok(createDream('archivist').platforms.some((p) => p.vanish));
  assert.ok(createDream('cartographer').platforms.some((p) => p.rotate));
  assert.ok(createDream('cartographer').walls.length > 0);
  assert.ok(createDream('archivist').hazards.length > 0);
});
