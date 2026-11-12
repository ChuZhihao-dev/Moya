const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

function fixture({ count = 3, cover = true } = {}) {
  class Element extends EventTarget {
    constructor() {
      super();
      this.isConnected = true;
      this.dataset = {};
      const classes = new Set();
      this.classList = {
        contains: (key) => classes.has(key),
        add: (...keys) => keys.forEach((key) => classes.add(key)),
        remove: (...keys) => keys.forEach((key) => classes.delete(key)),
        toggle(key, value = !classes.has(key)) {
          if (value) classes.add(key); else classes.delete(key);
        },
      };
      this.styles = new Map();
      this.writes = 0;
      this.style = {
        setProperty: (key, value) => { this.styles.set(key, value); this.writes++; },
        removeProperty: (key) => this.styles.delete(key),
      };
    }
    setAttribute() {}
    removeAttribute() {}
    toggleAttribute() {}
    querySelector() { return null; }
  }
  const window = Object.assign(new EventTarget(), { innerHeight: 800, scrollY: 0 });
  const document = new EventTarget();
  const motion = Object.assign(new EventTarget(), { matches: false });
  const mobile = Object.assign(new EventTarget(), { matches: false });
  window.matchMedia = (query) => query.includes('reduced-motion') ? motion : mobile;
  let Constructor;
  const frames = new Map();
  let frameId = 0;
  vm.runInNewContext(readFileSync('assets/moya-meet.js', 'utf8'), {
    HTMLElement: Element, Element, window, document, AbortController,
    setTimeout: () => 1, clearTimeout() {},
    ResizeObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: (fn) => { frames.set(++frameId, fn); return frameId; },
    cancelAnimationFrame: (id) => frames.delete(id),
    customElements: { get() {}, define: (_, value) => { Constructor = value; } },
  });
  const meet = new Constructor();
  const section = new Element();
  const science = new Element();
  science.matches = () => true;
  science.querySelector = () => ({});
  section.nextElementSibling = science;
  const sticky = new Element();
  sticky.offsetHeight = 800;
  const scenes = Array.from({ length: count }, () => new Element());
  const fill = new Element();
  meet.dataset.coverNextScience = String(cover);
  meet.dataset.transitionDuration = '0';
  meet.closest = () => section;
  meet.querySelectorAll = (selector) => selector.includes('scenes') ? scenes : [];
  meet.querySelector = (selector) => selector.includes('sticky') ? sticky : selector.includes('fill') ? fill : null;
  const extension = () => parseFloat(section.styles.get('--moya-meet-handoff-height')) || 0;
  const baseHeight = () => count * window.innerHeight;
  meet.getBoundingClientRect = () => ({ top: -window.scrollY, height: baseHeight() + extension() });
  // The overlap cancels the extra runway in normal flow, preserving Science's start.
  science.getBoundingClientRect = () => ({
    top: baseHeight() + extension() - (parseFloat(science.styles.get('--moya-meet-handoff-height')) || 0) - window.scrollY,
  });
  meet.connectedCallback();
  function scroll(y) {
    window.scrollY = y;
    document.dispatchEvent(new Event('scroll'));
    for (const [id, fn] of [...frames]) { frames.delete(id); fn(); }
  }
  return { meet, section, science, scenes, fill, motion, sticky, window, scroll };
}

test('overlap preserves scene milestones and science start without scroll-time layout writes', () => {
  const { section, science, scenes, fill, scroll } = fixture();
  assert.equal(section.styles.get('--moya-meet-handoff-height'), '800px');
  const writes = section.writes;
  scroll(800);
  assert.equal(fill.style.height, '50%');
  assert.equal(scenes[1].classList.contains('is-active'), true);
  scroll(1600);
  assert.equal(fill.style.height, '100%');
  assert.equal(scenes[2].classList.contains('is-active'), true);
  assert.equal(science.getBoundingClientRect().top, 800);
  scroll(2400);
  assert.equal(science.getBoundingClientRect().top, 0);
  assert.equal(section.writes, writes);
  assert.equal(section.classList.contains('moya-meet-section--page-underlay'), true);
  scroll(800);
  assert.equal(scenes[1].classList.contains('is-active'), true);
});

test('reduced motion and disconnection remove both sides of the overlap', () => {
  const { meet, section, science, motion } = fixture();
  motion.matches = true;
  motion.dispatchEvent(new Event('change'));
  assert.equal(section.styles.size, 0);
  assert.equal(science.styles.size, 0);
  motion.matches = false;
  motion.dispatchEvent(new Event('change'));
  assert.equal(section.styles.size, 1);
  meet.disconnectedCallback();
  assert.equal(section.styles.size, 0);
  assert.equal(science.styles.size, 0);
});

test('a viewport resize updates the overlap while opt-out and single scenes stay in normal flow', () => {
  const { window, section, science, sticky } = fixture();
  window.innerHeight = sticky.offsetHeight = 900;
  window.dispatchEvent(new Event('resize'));
  assert.equal(section.styles.get('--moya-meet-handoff-height'), '900px');
  assert.equal(science.styles.get('--moya-meet-handoff-height'), '900px');
  assert.equal(fixture({ cover: false }).section.styles.size, 0);
  assert.equal(fixture({ count: 1 }).section.styles.size, 0);
});
