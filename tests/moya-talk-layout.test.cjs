const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

// Exercise the shipped custom element's lifecycle and resize events without media
// or browser dependencies. Geometry represents a phone with a sticky 64px header.
function fixture({ overflow = false, viewport = 700, reducedMotion = false } = {}) {
  class Element extends EventTarget {
    constructor() {
      super();
      this.hidden = false;
      this.dataset = {};
      this.children = [];
      this.isConnected = true;
      this.clientWidth = 375;
      const classes = new Set();
      this.classList = {
        add: (...names) => names.forEach((name) => classes.add(name)),
        remove: (...names) => names.forEach((name) => classes.delete(name)),
        contains: (name) => classes.has(name),
        toggle(name, force = !classes.has(name)) {
          if (force) classes.add(name);
          else classes.delete(name);
          return force;
        },
      };
      const styles = new Map();
      this.style = {
        setProperty: (name, value) => styles.set(name, value),
        getPropertyValue: (name) => styles.get(name) || '',
      };
    }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    get childElementCount() { return this.children.length; }
    getBoundingClientRect() { return this.bounds?.() || { top: 0, bottom: 0 }; }
    contains() { return false; }
    querySelectorAll() { return []; }
    querySelector(selector) { return this.elements?.[selector] || null; }
  }

  let Constructor;
  let nextFrame = 0;
  let time = 0;
  const frames = new Map();
  const window = new EventTarget();
  const document = new EventTarget();
  document.documentElement = { clientHeight: viewport };
  document.hidden = false;
  const header = { offsetHeight: 64 };
  document.querySelector = (selector) => selector.startsWith('store-header') ? header : null;
  document.createElement = () => new Element();
  const context = vm.createContext({
    HTMLElement: Element,
    Element,
    IntersectionObserver: class { observe() {} disconnect() {} },
    ResizeObserver: class { observe() {} disconnect() {} },
    AbortController,
    URL,
    console,
    document,
    window,
    navigator: { connection: { saveData: true } },
    location: { href: 'https://example.com/' },
    innerHeight: 800,
    matchMedia: (query) => Object.assign(new EventTarget(), {
      matches: query.includes('reduced-motion') ? reducedMotion : true,
    }),
    getComputedStyle: () => ({ getPropertyValue: () => '64px' }),
    requestAnimationFrame: (fn) => { frames.set(++nextFrame, fn); return nextFrame; },
    cancelAnimationFrame: (id) => frames.delete(id),
    customElements: { get: () => undefined, define: (_, value) => { Constructor = value; } },
  });
  vm.runInContext(readFileSync(join(__dirname, '../assets/moya-talk.js'), 'utf8'), context);
  const talk = new Constructor();
  talk.dataset.start = 'start';
  talk.dataset.motion = 'true';
  talk.style.setProperty('--talk-distance', '100');
  talk.bounds = () => ({ top: 900, bottom: 3000 });
  const stage = new Element();
  const ui = new Element();
  const options = new Element();
  const answer = new Element();
  const asked = new Element();
  const probe = { offsetHeight: viewport };
  const nodes = { textContent: JSON.stringify([{
    key: 'start',
    prompt: 'Hello',
    options: [{ label: 'Explore', action: 'link', href: 'https://example.com/' }],
  }]) };
  ui.hidden = answer.hidden = asked.hidden = true;
  const height = () => parseFloat(talk.style.getPropertyValue('--talk-height')) || viewport - 64;
  stage.bounds = () => ({ top: 900, bottom: 900 + height() });
  options.bounds = () => ui.hidden
    ? { top: 0, bottom: 0 }
    : { top: 900 + height() - 100, bottom: 900 + height() + (overflow ? 40 : -40) };
  talk.elements = {
    '[data-stage]': stage,
    '[data-interface]': ui,
    '[data-options]': options,
    '[data-reply]': new Element(),
    '[data-answer]': answer,
    '[data-asked]': asked,
    '[data-viewport-probe]': probe,
    '[data-nodes]': nodes,
    '[data-arrow]': { content: { cloneNode: () => new Element() } },
  };
  function flush() {
    for (let turn = 0; frames.size; turn++) {
      assert.ok(turn < 10, 'layout must settle instead of scheduling an endless frame loop');
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((fn) => fn(time += 16));
    }
  }
  talk.connectedCallback();
  flush();
  return {
    talk,
    ui,
    probe,
    context,
    setOverflow: (value) => { overflow = value; },
    resize() { window.dispatchEvent(new Event('resize')); flush(); },
    disconnect() { talk.disconnectedCallback(); },
  };
}

test('overflow is detected before the opening reveals the hidden interface', () => {
  const f = fixture({ overflow: true });
  assert.equal(f.talk.classList.contains('is-flow'), true);
  f.disconnect();
});

test('removing dialogue options does not switch flow back to pinned layout', () => {
  const f = fixture({ overflow: true });
  f.setOverflow(false);
  for (let i = 0; i < 4; i++) f.resize();
  assert.equal(f.talk.classList.contains('is-flow'), true);
  f.disconnect();
});

test('a genuine layout-width change allows pinned layout to be reconsidered', () => {
  const f = fixture({ overflow: true });
  f.setOverflow(false);
  f.talk.clientWidth = 414;
  f.resize();
  assert.equal(f.talk.classList.contains('is-flow'), false);
  assert.equal(f.ui.hidden, true);
  f.disconnect();
});

test('browser toolbar resize keeps the stable measured height and layout', () => {
  const f = fixture();
  const height = f.talk.style.getPropertyValue('--talk-height');
  for (const visibleHeight of [850, 780, 900, 800]) {
    f.context.innerHeight = visibleHeight;
    f.resize();
    assert.equal(f.talk.style.getPropertyValue('--talk-height'), height);
    assert.equal(f.talk.classList.contains('is-flow'), false);
  }
  f.disconnect();
});

test('a short viewport and reduced motion retain the accessible flow fallback', () => {
  const short = fixture({ viewport: 580 });
  assert.equal(short.talk.classList.contains('is-flow'), true);
  short.probe.offsetHeight = 800;
  short.resize();
  assert.equal(short.talk.classList.contains('is-flow'), false);
  short.disconnect();
  const reduced = fixture({ reducedMotion: true });
  assert.equal(reduced.talk.classList.contains('is-flow'), true);
  reduced.disconnect();
});
