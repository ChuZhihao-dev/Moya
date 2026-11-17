const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

function fixture() {
  class Element {
    constructor() {
      const classes = new Set();
      this.classList = {
        add: (...keys) => keys.forEach((key) => classes.add(key)),
        remove: (...keys) => keys.forEach((key) => classes.delete(key)),
        contains: (key) => classes.has(key),
      };
      this.styleWrites = 0;
      this.style = {
        setProperty: (key, value) => { this.style[key] = value; this.styleWrites++; },
        removeProperty: (key) => { delete this.style[key]; },
      };
      this.isConnected = true;
      this.attributes = {};
    }
    getAttribute(key) { return this.attributes[key] ?? null; }
    setAttribute(key, value) { this.attributes[key] = value; }
    removeAttribute(key) { delete this.attributes[key]; }
    getBoundingClientRect() { return { top: 100 }; }
  }
  let Constructor;
  const scrolls = [];
  const context = vm.createContext({
    HTMLElement: Element, innerHeight: 900, scrollY: 1000,
    getComputedStyle: () => ({ top: '80px' }),
    storyScrollTo: (...args) => scrolls.push(args),
    customElements: { get() {}, define: (_, value) => { Constructor = value; } },
  });
  vm.runInContext(readFileSync('assets/moya-story-geometry.js', 'utf8').replace(/export /g, ''), context);
  vm.runInContext(readFileSync('assets/moya-science-storytelling.js', 'utf8').replace(/^import .*;\n/gm, ''), context);
  const story = new Constructor();
  story.dataset = { scrollDistance: '100', motion: 'true', layout: 'journey' };
  story.mobile = false;
  story.reduced = { matches: false };
  story.stage = { clientWidth: 1440, clientHeight: 800 };
  story.chrome = { offsetHeight: 60 };
  story.nav = { offsetHeight: 50 };
  story.intro = Object.assign(new Element(), { offsetHeight: 280 });
  const counters = { refresh: 0, triggerKill: 0, timelineKill: 0, release: 0, render: 0, update: 0, particleResize: 0 };
  story.items = Array.from({ length: 4 }, (_, index) => {
    const image = Object.assign(new Element(), {
      naturalWidth: 0, naturalHeight: 0,
      src: `photo-${index}.webp`, currentSrc: '', loading: 'lazy', decodes: 0,
      decode() { this.decodes++; return Promise.resolve(); },
    });
    image.attributes = { width: '2560', height: '1707' };
    return {
      node: new Element(), image,
      figure: Object.assign(new Element(), { clientWidth: 1000, clientHeight: 667 }),
      copy: Object.assign(new Element(), { offsetHeight: 350 }),
      body: new Element(), caption: new Element(), shade: new Element(), marker: new Element(), teaser: new Element(),
      particles: { resize() { counters.particleResize++; }, select() {} },
    };
  });
  story.timing = vm.runInContext('journeyTiming(4)', context);
  story.measureEnhanced();
  story.media = { revert() { throw new Error('A geometry update must not revert matchMedia'); } };
  story.trigger = { isActive: true, start: 1000, end: 12000, kill() { counters.triggerKill++; }, update() { counters.update++; } };
  story.timeline = { time: () => 3, kill() { counters.timelineKill++; } };
  story.motion = { ScrollTrigger: { refresh() { counters.refresh++; } } };
  story.releaseScroll = () => { counters.release++; };
  story.render = () => { counters.render++; };
  story.chapterStates = Array.from({ length: 4 }, () => ({ detail: 1 }));
  story.active = 0;
  story.hasAppliedInitialHash = true;
  return { story, context, counters, scrolls };
}

test('image loading, font settling and mobile toolbar events keep the same timeline and Lenis lease', async () => {
  const { story, context, counters, scrolls } = fixture();
  const timeline = story.timeline, trigger = story.trigger, writes = story.styleWrites;
  story.items[0].image.naturalWidth = 1000;
  story.items[0].image.naturalHeight = 667;
  await story.configure();
  story.items[0].copy.offsetHeight = 375;
  await story.configure();
  story.items[0].image.naturalWidth = 600;
  story.items[0].image.naturalHeight = 401;
  story.positionToRestore = { time: 2.5 };
  await story.configure();
  assert.equal(story.positionToRestore, undefined);
  context.innerHeight = 950;
  await story.configure();
  assert.equal(story.timeline, timeline);
  assert.equal(story.trigger, trigger);
  assert.equal(story.styleWrites, writes);
  assert.equal(counters.refresh, 0);
  assert.equal(counters.release, 0);
  assert.equal(counters.triggerKill, 0);
  assert.equal(counters.particleResize, 4);
  assert.equal(scrolls.length, 0);
});

test('real width and photo composition changes refresh geometry while preserving the current reading position', async () => {
  const { story, counters, scrolls } = fixture();
  const timeline = story.timeline;
  story.positionToRestore = { time: 2.25 };
  story.stage.clientWidth = 1280;
  await story.configure();
  assert.equal(story.timeline, timeline);
  assert.equal(counters.refresh, 1);
  assert.equal(counters.update, 1);
  assert.equal(counters.release, 0);
  assert.equal(scrolls[0][1], true);
  assert.ok(Math.abs(scrolls[0][0] - (1000 + 2.25 / story.timing.duration * 11000)) < 1e-8);
  assert.equal(story.size.width, 1280);
  story.items[0].image.naturalWidth = 600;
  story.items[0].image.naturalHeight = 800;
  await story.configure();
  assert.equal(counters.refresh, 2);
  assert.ok(Math.abs(story.items[0].size.width / story.items[0].size.height - 0.75) < 1e-8);
});

test('geometry updates outside the story never jump back to its previous anchor', async () => {
  const { story, counters, scrolls } = fixture();
  story.trigger.isActive = false;
  story.stage.clientWidth = 1280;
  await story.configure();
  assert.equal(counters.refresh, 1);
  assert.equal(scrolls.length, 0);
});

test('content above the story can move without rebuilding its timeline', async () => {
  const { story, counters } = fixture();
  const timeline = story.timeline;
  story.getBoundingClientRect = () => ({ top: 180 });
  await story.configure();
  assert.equal(counters.refresh, 1);
  assert.equal(story.timeline, timeline);
  assert.equal(counters.triggerKill, 0);
  assert.equal(counters.release, 0);
});

test('overflow alone switches back to full flow and restores the currently readable card', async () => {
  const { story, counters, scrolls } = fixture();
  story.items[0].copy.offsetHeight = 720;
  await story.configure();
  assert.equal(story.classList.contains('is-enhanced'), false);
  assert.equal(counters.triggerKill, 1);
  assert.equal(counters.timelineKill, 1);
  assert.equal(counters.release, 1);
  assert.equal(scrolls.length, 1);
  assert.equal(scrolls[0][0], 1008);
  assert.ok(story.items.every(({ node }) => node.inert === false));
});

test('adjacent photo decoding starts near the story and is reused until its source changes', () => {
  const { story } = fixture();
  story.active = 1;
  story.prepareNearbyPhotos();
  assert.ok(story.items.every(({ image }) => image.decodes === 0));
  story.nearby = true;
  story.prepareNearbyPhotos();
  story.prepareNearbyPhotos();
  assert.deepEqual(story.items.map(({ image }) => image.decodes), [0, 1, 1, 0]);
  story.active = 2;
  story.prepareNearbyPhotos();
  assert.deepEqual(story.items.map(({ image }) => image.decodes), [0, 1, 1, 1]);
  story.items[2].image.currentSrc = 'photo-2-mobile.webp';
  story.prepareNearbyPhotos();
  assert.deepEqual(story.items.map(({ image }) => image.decodes), [0, 1, 2, 1]);
});
