const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

function fixture() {
  let Constructor;
  vm.runInNewContext(readFileSync('assets/moya-science-intro.js', 'utf8').replace(/^import .*;\n/, ''), {
    HTMLElement: class {}, document: { hidden: false },
    requestAnimationFrame: () => 1,
    innerWidth: 1440, devicePixelRatio: 1.5,
    getComputedStyle: () => ({ top: '0' }),
    customElements: { get() {}, define: (_, value) => { Constructor = value; } },
  });
  return new Constructor();
}

test('particle drawing yields to scrolling and resumes after scrolling stops', () => {
  const science = fixture();
  Object.assign(science, {
    isConnected: true, lastFrame: 1, clock: 0, enhanced: true, active: 0,
    deck: { inert: true }, scrolling: true,
  });
  let draws = 0;
  science.drawParticles = () => draws++;
  science.tick(40);
  assert.equal(draws, 0);
  science.scrolling = false;
  science.tick(80);
  assert.equal(draws, 1);
});

test('unchanged scroll progress does not rewrite science opacity or accessibility state', () => {
  const science = fixture();
  let writes = 0;
  const panel = () => ({
    style: new Proxy({}, { set: (target, key, value) => { writes++; target[key] = value; return true; } }),
    setAttribute: () => writes++,
  });
  Object.assign(science, {
    enhanced: true, top: 0, scrollDistance: 1700,
    getBoundingClientRect: () => ({ top: 800 }),
    intro: panel(), deck: panel(), studies: [{}], active: 0,
    classList: { toggle: () => writes++ },
  });
  science.update();
  const initialWrites = writes;
  science.update();
  assert.equal(writes, initialWrites);
});

test('canvas setup preserves the bitmap on repeated draws and updates its DPR transform', () => {
  const science = fixture();
  let bitmapWrites = 0;
  let transforms = 0;
  const canvas = new Proxy({
    width: 300, height: 150,
    getContext: () => ({ setTransform: () => transforms++ }),
  }, { set(target, key, value) { bitmapWrites++; target[key] = value; return true; } });
  const field = { canvas, w: 400, h: 200, ratio: 1.5, dirty: true };
  assert.equal(science.prepareCanvas(field), true);
  assert.equal(canvas.width, 600);
  assert.equal(canvas.height, 300);
  assert.equal(bitmapWrites, 2);
  science.prepareCanvas(field);
  assert.equal(bitmapWrites, 2);
  assert.equal(transforms, 1);
  // Fractional CSS-size changes can require redrawing without reallocating the bitmap.
  field.w = 400.1;
  field.dirty = true;
  science.prepareCanvas(field);
  assert.equal(bitmapWrites, 2);
  assert.equal(transforms, 2);
  field.ratio = 1;
  field.dirty = true;
  science.prepareCanvas(field);
  assert.equal(canvas.width, 400);
  assert.equal(canvas.height, 200);
});

test('hidden studies allocate only when drawn and mark their visual ready once', () => {
  const science = fixture();
  let setups = 0;
  let draws = 0;
  let readyWrites = 0;
  science.canvases = [{}, ...Array.from({ length: 3 }, () => ({
    canvas: { width: 0, height: 0, getContext() {
      setups++;
      return { setTransform() {} };
    } }, w: 400, h: 200, ratio: 1, dirty: true,
  }))];
  science.renderers = Array.from({ length: 3 }, () => ({ draw: () => draws++ }));
  science.studyVisuals = Array.from({ length: 3 }, () => ({ classList: { add: () => readyWrites++ } }));
  Object.assign(science, { active: 1, clock: 0, starts: [0, 0, 0], motion: { matches: false } });
  science.drawStudy(1);
  science.drawStudy(1);
  assert.equal(setups, 1);
  assert.equal(draws, 2);
  assert.equal(readyWrites, 1);
  assert.equal(science.canvases[1].ctx, undefined);
  assert.equal(science.canvases[3].ctx, undefined);
  science.drawStudy(2);
  assert.equal(setups, 2);
});

test('resize skips unchanged bitmaps and defers hidden-card resizing until its reveal', () => {
  const science = fixture();
  let top = -1000;
  let hiddenWidth = 400;
  const draws = [0, 0, 0];
  const allocations = [0, 0, 0, 0];
  const canvases = allocations.map((_, i) => new Proxy({
    width: 300, height: 150,
    getBoundingClientRect: () => ({ width: i === 3 ? hiddenWidth : 400, height: 200 }),
    getContext: () => ({ setTransform() {} }),
  }, { set(target, key, value) { allocations[i]++; target[key] = value; return true; } }));
  const panel = () => ({ style: {}, setAttribute() {} });
  Object.assign(science, {
    enhanced: true, active: 1, offsetHeight: 2500, stage: { offsetHeight: 800 },
    motion: { matches: false }, dataset: { animation: 'false' },
    studies: Array.from({ length: 3 }, () => ({ classList: { toggle() {} }, setAttribute() {} })),
    studyVisuals: Array.from({ length: 3 }, () => ({ classList: { add() {} } })),
    renderers: draws.map((_, i) => ({ draw: () => draws[i]++, reset() {} })),
    starts: [0, 0, 0], clock: 0, classList: { toggle() {} },
    backdrop: { classList: { toggle() {} } }, intro: panel(), deck: panel(),
    getBoundingClientRect: () => ({ top }),
    querySelectorAll: (selector) => selector === 'canvas' ? canvases : [],
    sync() {},
  });
  science.resize();
  assert.deepEqual(draws, [0, 1, 0]);
  assert.deepEqual(allocations, [0, 0, 2, 0]);
  science.resize();
  assert.deepEqual(draws, [0, 1, 0]);
  assert.deepEqual(allocations, [0, 0, 2, 0]);
  hiddenWidth = 500;
  science.resize();
  assert.equal(canvases[3].width, 300);
  top = -1500;
  science.update();
  assert.deepEqual(draws, [0, 1, 1]);
  assert.equal(canvases[3].width, 750);
});
