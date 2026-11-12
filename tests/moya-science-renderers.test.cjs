const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

function fixture() {
  const context = vm.createContext({});
  vm.runInContext(readFileSync('assets/moya-science-renderers.js', 'utf8').replaceAll('export function', 'function'), context);
  return context;
}

function canvasContext() {
  return new Proxy({
    canvas: { width: 800, height: 400 },
    getTransform: () => ({ a: 1 }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createLinearGradient: () => ({ addColorStop() {} }),
  }, { get: (target, key) => target[key] ?? (() => {}) });
}

test('study phases update only on a phase change, including seeking and resetting', () => {
  const { createStudyRenderer } = fixture();
  let queries = 0;
  let writes = 0;
  const metrics = Array.from({ length: 3 }, () => ({ classList: { toggle: () => writes++ } }));
  const buttons = Array.from({ length: 3 }, () => ({ setAttribute: () => writes++ }));
  const word = { set textContent(value) { writes++; this.value = value; } };
  const study = {
    dataset: { study: 'sleep' },
    querySelectorAll(selector) {
      queries++;
      return selector === '[data-value]' ? [{}, {}, {}] : selector === '[data-phase]' ? buttons : metrics;
    },
    querySelector() { queries++; return word; },
  };
  const renderer = createStudyRenderer(study);
  const ctx = canvasContext();
  renderer.draw(ctx, 800, 400, 0, false);
  const firstWrites = writes;
  renderer.draw(ctx, 800, 400, 0.1, false);
  assert.equal(writes, firstWrites);
  assert.equal(queries, 4);
  renderer.seek(6, 0.1);
  renderer.draw(ctx, 800, 400, 0.1, false);
  assert.equal(word.value, 'Slow down.');
  assert.equal(writes, firstWrites + 7);
  renderer.reset();
  renderer.draw(ctx, 800, 400, 0, true);
  assert.equal(word.value, 'Let go.');
  assert.equal(writes, firstWrites + 14);
});
