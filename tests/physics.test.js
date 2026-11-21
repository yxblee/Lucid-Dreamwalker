import test from 'node:test';
import assert from 'node:assert/strict';
import { overlaps, moveAndCollide, resolveCircle, updateRewindBuffer } from '../src/game/physics.js';

test('AABB overlap excludes touching edges', () => {
  assert.equal(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 }), false);
  assert.equal(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 0, w: 10, h: 10 }), true);
});

test('body lands on a platform in normal gravity', () => {
  const body = { x: 10, y: 10, w: 20, h: 20, vx: 0, vy: 100, grounded: false };
  moveAndCollide(body, [{ x: 0, y: 35, w: 100, h: 20 }], 0.2, 1);
  assert.equal(body.y, 15);
  assert.equal(body.vy, 0);
  assert.equal(body.grounded, true);
});

test('body lands on underside in reversed gravity', () => {
  const body = { x: 10, y: 45, w: 20, h: 20, vx: 0, vy: -100, grounded: false };
  moveAndCollide(body, [{ x: 0, y: 20, w: 100, h: 20 }], 0.2, -1);
  assert.equal(body.y, 40);
  assert.equal(body.vy, 0);
  assert.equal(body.grounded, true);
});

test('circle collision pushes the player outside solid ruins', () => {
  const point = resolveCircle({ x: 4, z: 0 }, { x: 0, z: 0, radius: 8 }, 2);
  assert.equal(Math.round(point.x), 10);
});

test('rewind snapshots are capped and returned oldest first', () => {
  const buffer = updateRewindBuffer([], { x: 1 }, 1);
  for (let i = 2; i < 10; i++) updateRewindBuffer(buffer, { x: i }, 1);
  assert.equal(buffer.length, 5);
  assert.equal(buffer[0].x, 5);
});
