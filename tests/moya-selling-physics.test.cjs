const test = require('node:test');
const assert = require('node:assert/strict');
const physics = import('../assets/moya-selling-physics.js');

test('flick projects beyond a short drag; disabling inertia uses nearest slide', async () => {
  const { sellingTarget } = await physics;
  assert.equal(sellingTarget(180, 2, 1000, 3), 1);
  assert.equal(sellingTarget(180, 2, 1000, 3, 0), 0);
  assert.equal(sellingTarget(1820, -2, 1000, 3), 1);
  assert.equal(sellingTarget(0, -20, 1000, 3), 0);
  assert.equal(sellingTarget(2000, 20, 1000, 3), 2);
  assert.equal(sellingTarget(200, 1, 0, 0), 0);
});

test('spring settles at the destination at 30, 60 and 120 fps', async () => {
  const { sellingSpring } = await physics;
  for (const fps of [30, 60, 120]) {
    let state = { position: 150, velocity: 1800 };
    for (let i = 0; i < fps * 3; i++)
      state = sellingSpring(state.position, state.velocity, 1000, 1 / fps);
    assert.ok(Math.abs(state.position - 1000) < 0.5);
    assert.ok(Math.abs(state.velocity) < 3);
  }
});
