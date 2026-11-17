/** One GSAP registration and at most one owned Lenis instance per page. */
let motionPromise;
let smoothPromise;
let smooth;
let tick;
let lockObserver;
let cancelAnchorInertia;
const owners = new Set();

function loadScript(file, ready) {
  if (ready()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    // Vendor UMD builds must run as classic scripts, outside ES-module strict mode.
    const script = document.createElement('script');
    script.src = new URL(file, import.meta.url).href;
    script.async = true;
    script.onload = () => ready() ? resolve() : reject(new Error(`Could not initialize ${file}`));
    script.onerror = () => { script.remove(); reject(new Error(`Could not load ${file}`)); };
    document.head.append(script);
  });
}

export function loadStoryMotion() {
  motionPromise ||= (async () => {
    await loadScript('./gsap.min.js', () => window.gsap);
    await loadScript('./ScrollTrigger.min.js', () => window.ScrollTrigger);
    const { gsap, ScrollTrigger } = window;
    gsap.registerPlugin(ScrollTrigger);
    return { gsap, ScrollTrigger };
  })().catch((error) => { motionPromise = undefined; throw error; });
  return motionPromise;
}

export async function acquireStoryScroll(owner, motion) {
  owners.add(owner);
  smoothPromise ||= loadScript('./lenis.min.js', () => window.Lenis).then(() => {
    if (!owners.size) return;
    // Respect an existing page-level Lenis owner if another integration has one.
    if (typeof window.lenis?.scrollTo === 'function') return;
    smooth = new window.Lenis({
      autoRaf: false,
      smoothWheel: true,
      syncTouch: false,
      anchors: false,
      lerp: 0.085,
      prevent: (node) => node instanceof Element && Boolean(node.closest('dialog, [role="dialog"], .drawer, .popover, [data-lenis-prevent]')),
    });
    document.documentElement.classList.add('moya-story-smooth');
    smooth.on('scroll', motion.ScrollTrigger.update);
    tick = (time) => smooth?.raf(time * 1000);
    motion.gsap.ticker.add(tick);
    // Use real elapsed time without changing GSAP's page-wide lag settings.
    // Lenis receives the ticker's seconds converted to milliseconds.
    const syncLock = () => {
      if (document.documentElement.classList.contains('lock')) smooth?.stop();
      else smooth?.start();
    };
    lockObserver = new MutationObserver(syncLock);
    lockObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    cancelAnchorInertia = (event) => {
      const link = event.target.closest('a[href]');
      if (!link || link.hasAttribute('data-story-go')) return;
      const url = new URL(link.href, location.href);
      if (url.origin === location.origin && url.pathname === location.pathname && url.hash) {
        smooth?.scrollTo(smooth.actualScroll, { immediate: true });
      }
    };
    document.addEventListener('click', cancelAnchorInertia, true);
    syncLock();
  }).catch((error) => { smoothPromise = undefined; owners.delete(owner); throw error; });
  try { await smoothPromise; }
  catch (error) { owners.delete(owner); throw error; }
  return () => releaseStoryScroll(owner, motion);
}

function releaseStoryScroll(owner, motion) {
  owners.delete(owner);
  if (owners.size) return;
  lockObserver?.disconnect();
  lockObserver = undefined;
  if (cancelAnchorInertia) document.removeEventListener('click', cancelAnchorInertia, true);
  cancelAnchorInertia = undefined;
  if (tick) motion.gsap.ticker.remove(tick);
  tick = undefined;
  smooth?.destroy();
  if (smooth) document.documentElement.classList.remove('moya-story-smooth');
  smooth = undefined;
  smoothPromise = undefined;
}

export function storyScrollTo(top, immediate = false) {
  const scroller = smooth || (typeof window.lenis?.scrollTo === 'function' ? window.lenis : undefined);
  if (scroller) scroller.scrollTo(top, { immediate, duration: 0.85 });
  else window.scrollTo({ top, behavior: immediate ? 'instant' : 'smooth' });
}
