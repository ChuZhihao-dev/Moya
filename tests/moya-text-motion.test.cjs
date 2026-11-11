const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');

// Exercise lifecycle/scene integration without a browser or the Shopify editor.
function fixture() {
  const calls = { splits: 0, reverts: 0, kills: 0, options: [] };
  const observers = [];
  const context = {
    gsap: {
      registerPlugin() {},
      matchMedia: () => ({}),
      from(chars, options) {
        calls.options.push(options);
        return { kill: () => calls.kills++ };
      },
    },
    SplitText: {
      create() {
        calls.splits++;
        return { chars: Array(100), revert: () => calls.reverts++ };
      },
    },
    document: { querySelector: () => null },
    getComputedStyle: () => ({ visibility: 'visible' }),
    IntersectionObserver: class {
      constructor(callback) { this.callback = callback; observers.push(this); }
      observe() {}
      disconnect() { this.disconnected = true; }
    },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    console,
  };
  const source = readFileSync('assets/moya-text-motion.js', 'utf8')
    .replace(/^import .*;\n/gm, '').replace(/\nstart\(\);\s*$/, '\nglobalThis.TextMotion = TextMotion;');
  runInNewContext(source, context);
  function element(scene = null) {
    return {
      textContent: 'One hundred characters',
      hidden: false,
      rendered: true,
      attributes: new Set(),
      closest(selector) { return selector.includes('.moya-hero__slide') ? scene : this.hidden ? {} : null; },
      querySelector: () => null,
      getClientRects() { return this.rendered ? [{}] : []; },
      setAttribute(name) { this.attributes.add(name); },
      removeAttribute(name) { this.attributes.delete(name); },
    };
  }
  function mount(elements) {
    const root = { querySelectorAll: () => elements, setAttribute() {}, removeAttribute() {} };
    const instance = new context.TextMotion(root);
    const observer = observers.at(-1);
    return { instance, observer, enter: () => observer.callback(elements.map((target) => ({ target, isIntersecting: true }))) };
  }
  return { calls, element, mount };
}

test('static copy uses the requested basic tween and restores markup on completion', () => {
  const f = fixture();
  const target = f.element();
  const { instance, observer, enter } = f.mount([target]);
  enter();
  assert.equal(f.calls.splits, 1);
  assert.equal(f.calls.options[0].y, 50);
  assert.equal(f.calls.options[0].opacity, 0);
  assert.equal(f.calls.options[0].duration, 0.6);
  assert.equal(f.calls.options[0].stagger, 0.03);
  f.calls.options[0].onComplete();
  assert.equal(f.calls.reverts, 1);
  observer.callback([{ target, isIntersecting: false }]);
  enter();
  assert.equal(f.calls.splits, 1);
  instance.destroy();
  assert.equal(observer.disconnected, true);
  assert.equal(target.attributes.size, 0);
});

test('overlapping scenes wait for activation and replay on return', () => {
  const f = fixture();
  const scene = { active: false, closest: () => null, classList: { contains: () => scene.active } };
  const { instance, enter } = f.mount([f.element(scene)]);
  enter();
  assert.equal(f.calls.splits, 0);
  scene.active = true;
  instance.sync();
  assert.equal(f.calls.splits, 1);
  scene.active = false;
  instance.sync();
  assert.equal(f.calls.reverts, 1);
  scene.active = true;
  instance.sync();
  assert.equal(f.calls.splits, 2);
});

test('hidden responsive copy and inert science panels wait until visible', () => {
  const f = fixture();
  const target = f.element();
  target.rendered = false;
  const { instance, enter } = f.mount([target]);
  enter();
  assert.equal(f.calls.splits, 0);
  target.rendered = true;
  target.hidden = true;
  instance.sync();
  assert.equal(f.calls.splits, 0);
  target.hidden = false;
  instance.sync();
  assert.equal(f.calls.splits, 1);
});

test('unloading one section restores its copy and leaves duplicate instances running', () => {
  const f = fixture();
  const first = f.mount([f.element()]);
  const second = f.mount([f.element()]);
  first.enter();
  second.enter();
  first.instance.destroy();
  assert.equal(f.calls.kills, 1);
  assert.ok(second.instance.states[0].split);
  second.instance.destroy();
  assert.equal(f.calls.reverts, 2);
});

test('interactive rich text keeps its original link semantics', () => {
  const f = fixture();
  const target = f.element();
  target.querySelector = () => ({});
  f.mount([target]).enter();
  assert.equal(f.calls.splits, 0);
});
