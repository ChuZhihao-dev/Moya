const test = require('node:test');
const assert = require('node:assert/strict');
const geometry = import('../assets/moya-loop-geometry.js');

test('loop indices and shortest paths cross both boundaries', async () => {
  const { loopIndex, loopDelta } = await geometry;
  assert.equal(loopIndex(-1, 5), 4);
  assert.equal(loopIndex(5, 5), 0);
  assert.equal(loopIndex(101, 5), 1);
  assert.equal(loopDelta(4, 0, 5), 1);
  assert.equal(loopDelta(0, 4, 5), -1);
  assert.equal(loopDelta(0, 0, 1), 0);
});

test('fixed-height focus and neighboring cards retain their intended geometry', async () => {
  const { loopCardGeometry } = await geometry;
  const center = loopCardGeometry(0, 265, 40);
  const next = loopCardGeometry(1, 265, 40);
  assert.equal(center.width, 398);
  assert.equal(center.height, 265);
  assert.equal(next.width, 272);
  assert.equal(next.x - next.width / 2 - center.width / 2, 40);
  assert.equal(loopCardGeometry(-1, 265, 40).x, -next.x);
  const mobile = loopCardGeometry(0, 200, 20);
  assert.equal(mobile.height, 200);
});

test('repeated copies match position continuously across a wrap', async () => {
  const { loopCardGeometry, loopIndex } = await geometry;
  const before = loopCardGeometry(5 - loopIndex(4.999, 5), 265, 40);
  const after = loopCardGeometry(0 - loopIndex(5.001, 5), 265, 40);
  assert.ok(Math.abs(before.x - after.x) < 1);
  assert.ok(Math.abs(before.width - after.width) < 1);
});

test('render window is bounded to the viewport and keeps nearest originals first', async () => {
  const { loopRenderRadius, loopRenderWindow } = await geometry;
  const desktop = loopRenderRadius(1920, 265, 40);
  assert.equal(desktop, 4);
  const slots = loopRenderWindow(4.9, 5, desktop);
  assert.equal(slots.length, 9);
  assert.equal(slots[0].index, 0);
  assert.ok(Math.abs(slots[0].distance - 0.1) < 1e-9);
  assert.equal(Math.ceil(slots.length / 5) * 5, 10);
  const mobile = loopRenderWindow(0, 5, loopRenderRadius(390, 200, 20));
  assert.equal(mobile.length, 5);
  assert.equal(new Set(mobile.map((slot) => slot.index)).size, 5);
  assert.deepEqual(loopRenderWindow(0, 0, 4), []);
  assert.deepEqual(loopRenderWindow(4, 1, 4), [{ index: 0, distance: 0 }]);
});

test('wheel normalization supports horizontal pixels, lines, pages and shift-scroll', async () => {
  const { horizontalWheelDelta } = await geometry;
  assert.equal(horizontalWheelDelta(24, 2, 0, false, 1000), 24);
  assert.equal(horizontalWheelDelta(-3, 0, 1, false, 1000), -48);
  assert.equal(horizontalWheelDelta(1, 0, 2, false, 1000), 1000);
  assert.equal(horizontalWheelDelta(0, 40, 0, true, 1000), 40);
  assert.equal(horizontalWheelDelta(0, 40, 0, false, 1000), 0);
  assert.equal(horizontalWheelDelta(4, 40, 0, false, 1000), 0);
});
