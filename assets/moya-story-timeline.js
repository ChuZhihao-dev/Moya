/** Declarative stops: the same timeline can be sampled forwards or backwards. */
export function createJourneyTimeline(gsap, state, chapters, timing, onUpdate) {
  const timeline = gsap.timeline({ paused: true, defaults: { ease: 'none' }, onUpdate });
  timeline.set(state, { camera: -1 }, 0);
  timeline.set(chapters, { entrance: 0, exit: 0, detail: 0, caption: 1 }, 0);
  timeline.addLabel('introduction', 0);
  timeline.fromTo(state, { camera: -1 }, { camera: 0, duration: 0.85, ease: 'sine.inOut', immediateRender: false }, timing.intro - 0.85);
  chapters.forEach((chapter, index) => {
    const stop = timing.chapters[index];
    const { start } = stop;
    timeline.addLabel(`chapter-${index}`, start);
    timeline.addLabel(`detail-${index}`, stop.detail);
    timeline.addLabel(`read-end-${index}`, stop.exit);
    // Every photo reaches its own stop before its foreground card enters.
    // Keep the teaser readable through the entrance, then unfold the body.
    timeline.fromTo(chapter, { entrance: 0 }, { entrance: 1, duration: 0.3, ease: 'sine.inOut', immediateRender: false }, start + 0.25);
    timeline.fromTo(chapter, { detail: 0 }, { detail: 1, duration: 0.35, ease: 'sine.inOut', immediateRender: false }, start + 0.65);
    timeline.fromTo(chapter, { caption: 1 }, { caption: 0, duration: 0.3, ease: 'sine.inOut', immediateRender: false }, start + 0.25);
    if (index < chapters.length - 1) {
      timeline.fromTo(chapter, { exit: 0 }, { exit: 1, duration: 0.25, ease: 'sine.inOut', immediateRender: false }, stop.exit);
      timeline.fromTo(state, { camera: index }, { camera: index + 1, duration: timing.travel, ease: 'sine.inOut', immediateRender: false }, stop.travelStart);
    }
  });
  // Holds are real timeline space, including the final reading stop.
  timeline.to({ clock: 0 }, { clock: 1, duration: timing.duration }, 0);
  return timeline;
}
