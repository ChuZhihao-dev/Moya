const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const { gsap } = require('gsap/dist/gsap');

function moduleSource(path, names) {
  return vm.runInNewContext(`${readFileSync(path, 'utf8').replace(/export /g, '')}\n({${names.join(',')}})`, {});
}
const geometry = moduleSource('assets/moya-story-geometry.js', ['readingWeight', 'journeyTiming', 'photoSize', 'photoPose', 'planeTransform', 'createRoute', 'projectRoute']);
const { createJourneyTimeline } = moduleSource('assets/moya-story-timeline.js', ['createJourneyTimeline']);

function journey(count = 4, hold = 1.2, weights = []) {
  const timing = geometry.journeyTiming(count, hold, 0, weights);
  const state = { camera: -1 };
  const chapters = Array.from({ length: count }, () => ({ entrance: 0, exit: 0, detail: 0, caption: 1 }));
  const timeline = createJourneyTimeline(gsap, state, chapters, timing);
  return { state, chapters, timing, timeline };
}

test('the photo matrix maps all four corners to the shared camera projection', () => {
  for (const mobile of [false, true]) {
    const width = mobile ? 390 : 1440, height = mobile ? 760 : 850;
    const size = geometry.photoSize(2560 / 1707, width, height, mobile);
    for (const index of [0, 1, 3]) {
      const pose = geometry.photoPose(index, size, index - 0.35, width, height, mobile);
      const matrix = geometry.planeTransform(pose.corners, size.width, size.height).slice(9, -1).split(',').map(Number);
      for (const [corner, [x, y]] of [[0, [0, 0]], [1, [size.width, 0]], [2, [size.width, size.height]], [3, [0, size.height]]]) {
        const divisor = matrix[3] * x + matrix[7] * y + matrix[15];
        const projectedX = (matrix[0] * x + matrix[4] * y + matrix[12]) / divisor;
        const projectedY = (matrix[1] * x + matrix[5] * y + matrix[13]) / divisor;
        assert.ok(Math.abs(projectedX - pose.corners[corner].x) < 1e-7);
        assert.ok(Math.abs(projectedY - pose.corners[corner].y) < 1e-7);
      }
    }
    const behind = geometry.photoPose(0, size, 2, width, height, mobile);
    assert.equal(geometry.planeTransform(behind.corners, size.width, size.height), null);
  }
});

test('thread projection stays finite and deterministic across the full journey', () => {
  for (const mobile of [false, true]) {
    const width = mobile ? 390 : 1440, height = 800;
    const route = geometry.createRoute(8, width, 600, mobile);
    for (let camera = -1; camera <= 7; camera += 0.125) {
      const paths = geometry.projectRoute(route, camera, width, height, mobile);
      assert.equal(paths.length, 3);
      assert.ok(paths.some(Boolean));
      assert.ok(paths.every((path) => !/NaN|Infinity/.test(path)));
      assert.deepEqual(paths, geometry.projectRoute(route, camera, width, height, mobile));
    }
  }
});

test('every detail link lands on fully revealed copy with the camera at its photo', () => {
  for (const count of [1, 4, 8]) {
    for (const hold of [1.2, 2.4, 3]) {
      const { state, chapters, timeline, timing } = journey(count, hold);
      assert.ok(Math.abs(timeline.duration() - timing.duration) < 1e-6);
      for (let index = 0; index < count; index++) {
        timeline.time(timeline.labels[`detail-${index}`]);
        assert.equal(state.camera, index);
        assert.equal(chapters[index].detail, 1);
        assert.equal(chapters[index].entrance, 1);
        assert.equal(chapters[index].exit, 0);
        assert.equal(chapters[index].caption, 0);
      }
      timeline.progress(1);
      assert.equal(chapters[count - 1].exit, 0);
      assert.equal(chapters[count - 1].detail, 1);
      timeline.kill();
    }
  }
});

test('every card waits for its photo to settle before entering and revealing its body', () => {
  for (const count of [1, 4, 8]) {
    const { timeline, state, chapters } = journey(count);
    for (let index = 0; index < count; index++) {
      const start = timeline.labels[`chapter-${index}`];
      for (const offset of [-0.5, -0.01, 0, 0.24]) {
        timeline.time(start + offset);
        assert.equal(chapters[index].entrance, 0);
        assert.equal(chapters[index].detail, 0);
      }
      timeline.time(start + 0.4);
      assert.equal(state.camera, index);
      assert.ok(chapters[index].entrance > 0 && chapters[index].entrance < 1);
      assert.equal(chapters[index].detail, 0);
      timeline.time(start + 0.6);
      assert.equal(chapters[index].entrance, 1);
      assert.equal(chapters[index].detail, 0);
      timeline.time(start + 0.825);
      assert.equal(state.camera, index);
      assert.ok(chapters[index].detail > 0 && chapters[index].detail < 1);
    }
    timeline.kill();
  }
});

test('reverse scrolling restores the identical camera and chapter state', () => {
  const { state, chapters, timeline, timing } = journey();
  const times = Array.from({ length: 60 }, (_, i) => i * timing.duration / 59);
  const snapshots = times.map((time) => {
    timeline.time(time);
    return JSON.stringify({ state, chapters }, (key, value) => key === '_gsap' ? undefined : value);
  });
  times.reverse().forEach((time, index) => {
    timeline.time(time);
    assert.equal(JSON.stringify({ state, chapters }, (key, value) => key === '_gsap' ? undefined : value), snapshots[59 - index]);
  });
  timeline.kill();
});

test('complete explanations remain readable for their entire independent reading distance', () => {
  const { timeline, timing, state, chapters } = journey(4, 1.2, [1, 1.6, 1.75, 1]);
  timing.chapters.forEach((stop, index) => {
    for (const fraction of [0.01, 0.5, 0.99]) {
      timeline.time(stop.detail + stop.reading * fraction);
      assert.equal(state.camera, index);
      assert.equal(chapters[index].detail, 1);
      assert.equal(chapters[index].entrance, 1);
      assert.equal(chapters[index].exit, 0);
    }
    if (index < chapters.length - 1) {
      timeline.time(stop.exit + 0.125);
      assert.equal(state.camera, index, 'the photo holds while its card exits');
      assert.ok(chapters[index].exit > 0 && chapters[index].exit < 1);
    }
  });
  assert.ok(timing.chapters[1].reading > timing.chapters[0].reading);
  assert.ok(timing.chapters[2].reading > timing.chapters[1].reading);
  timeline.kill();
});

test('reading distance accounts for both spaced words and CJK copy without unbounded scroll', () => {
  assert.equal(geometry.readingWeight('A small moment of warmth.'), 1);
  assert.ok(Math.abs(geometry.readingWeight('word '.repeat(120)) - 1.6) < 1e-6);
  assert.ok(Math.abs(geometry.readingWeight('陪伴'.repeat(120)) - 1.6) < 1e-6);
  assert.equal(geometry.readingWeight('word '.repeat(1000)), 1.75);
});

test('separate section timelines do not share camera or reading state', () => {
  const first = journey(), second = journey();
  first.timeline.progress(1);
  assert.equal(second.state.camera, -1);
  assert.equal(second.chapters[0].detail, 0);
  second.timeline.time(second.timeline.labels['detail-1']);
  assert.equal(first.state.camera, 3);
  first.timeline.kill(); second.timeline.kill();
});

test('a ScrollTrigger refresh at the final chapter cannot change the starting states', () => {
  const { timeline, state, chapters } = journey();
  timeline.progress(1);
  timeline.invalidate();
  timeline.time(0.1);
  assert.equal(state.camera, -1);
  chapters.forEach((chapter) => {
    assert.equal(chapter.entrance, 0);
    assert.equal(chapter.detail, 0);
    assert.equal(chapter.exit, 0);
    assert.equal(chapter.caption, 1);
  });
  timeline.time(timeline.labels['detail-1']);
  assert.equal(state.camera, 1);
  assert.equal(chapters[1].detail, 1);
  timeline.kill();
});

test('Lenis has a single owner group and releases only after the last section', async () => {
  const classes = new Set();
  const root = { classList: { add: (key) => classes.add(key), remove: (key) => classes.delete(key), contains: (key) => classes.has(key) } };
  const document = new EventTarget();
  document.documentElement = root;
  const ticks = new Set();
  let created = 0, destroyed = 0;
  class Lenis {
    constructor() { created++; }
    on() {} stop() {} start() {}
    raf(time) { this.time = time; }
    destroy() { destroyed++; }
    scrollTo(value, options) { this.destination = value; this.options = options; }
  }
  const nativeCalls = [];
  const window = { Lenis, lenis: {}, scrollTo: (value) => nativeCalls.push(value) };
  const motion = { gsap: { ticker: { add: (fn) => ticks.add(fn), remove: (fn) => ticks.delete(fn) } }, ScrollTrigger: { update() {} } };
  const source = readFileSync('assets/moya-story-runtime.js', 'utf8').replace(/export /g, '').replace(/import.meta.url/g, "'https://test.example/runtime.js'");
  const { acquireStoryScroll, storyScrollTo } = vm.runInNewContext(`${source}\n({acquireStoryScroll,storyScrollTo})`, {
    window, document, Element: class {}, URL, location: { href: 'https://test.example/' },
    MutationObserver: class { observe() {} disconnect() {} }, importer: async () => ({}),
  });
  storyScrollTo(80, true);
  assert.equal(nativeCalls[0].top, 80);
  const [releaseFirst, releaseSecond] = await Promise.all([acquireStoryScroll({}, motion), acquireStoryScroll({}, motion)]);
  assert.equal(created, 1);
  assert.equal(ticks.size, 1);
  assert.ok(classes.has('moya-story-smooth'));
  storyScrollTo(1250, true);
  releaseFirst();
  assert.equal(destroyed, 0);
  releaseSecond();
  assert.equal(destroyed, 1);
  assert.equal(ticks.size, 0);
  assert.ok(!classes.has('moya-story-smooth'));
});
