/** Scroll-driven Moya story, using native custom elements in Impact. */
class MoyaMeet extends HTMLElement {
  #scenes = [];
  #sticky;
  #fill;
  #icon;
  #progress;
  #frame = null;
  #activeIndex = -1;
  #transitionTimer;
  #controller;
  #motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  #mobile = window.matchMedia('(max-width: 749px)');
  #videos = [];
  #observer;
  #visibleScenes = new Set();
  #pendingVideos = new WeakSet();
  #mediaVersion = 0;
  #section;
  #nextScience;
  #handoffCovered = false;

  connectedCallback() {
    this.#controller?.abort();
    this.#controller = new AbortController();
    const { signal } = this.#controller;
    this.#scenes = [...this.querySelectorAll('[data-moya-ref="scenes[]"]')];
    this.#sticky = this.querySelector('[data-moya-ref="sticky"]');
    this.#fill = this.querySelector('[data-moya-ref="fill"]');
    this.#icon = this.querySelector('[data-moya-ref="icon"]');
    this.#progress = this.querySelector('[data-moya-ref="progress"]');
    this.#videos = [...this.querySelectorAll('video[data-moya-video-device]')];
    if (!this.#sticky || !this.#scenes.length) return;

    document.addEventListener('scroll', this.#schedule, { capture: true, passive: true, signal });
    window.addEventListener('resize', this.#schedule, { signal });
    this.#motion.addEventListener('change', this.#configure, { signal });
    this.#mobile.addEventListener('change', this.#syncMedia, { signal });
    document.addEventListener('visibilitychange', this.#syncMedia, { signal });
    for (const event of ['shopify:section:load', 'shopify:section:unload', 'shopify:section:reorder']) {
      document.addEventListener(event, this.#schedule, { signal });
    }
    this.addEventListener('shopify:block:select', this.#selectEditorScene, { signal });
    this.#observer?.disconnect();
    this.#visibleScenes.clear();
    if (this.#videos.length) {
      for (const video of this.#videos) {
        video.addEventListener('playing', () => {
          if (this.#shouldPlay(video)) video.classList.add('is-playing');
          else video.pause();
        }, { signal });
        for (const event of ['pause', 'error', 'emptied']) {
          video.addEventListener(event, () => video.classList.remove('is-playing'), { signal });
        }
      }
      this.#observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) this.#visibleScenes.add(entry.target);
          else this.#visibleScenes.delete(entry.target);
        }
        this.#syncMedia();
      }, { threshold: 0.01 });
      for (const scene of this.#scenes) this.#observer.observe(scene);
    }
    this.#configure();
  }

  disconnectedCallback() {
    this.#controller?.abort();
    this.#clearHandoff();
    this.#observer?.disconnect();
    this.#visibleScenes.clear();
    for (const video of this.#videos) {
      video.pause();
      video.classList.remove('is-playing');
    }
    clearTimeout(this.#transitionTimer);
    if (this.#frame !== null) cancelAnimationFrame(this.#frame);
    this.#frame = null;
    this.classList.remove('is-enhanced', 'is-inview');
  }

  #configure = () => {
    clearTimeout(this.#transitionTimer);
    const enhanced = !this.#motion.matches && this.#scenes.length > 1;
    this.classList.toggle('is-enhanced', enhanced);
    this.#activeIndex = -1;
    for (const scene of this.#scenes) {
      scene.style.opacity = '';
      scene.removeAttribute('inert');
      scene.removeAttribute('aria-hidden');
      scene.classList.remove('is-active', 'is-entering', 'is-leaving');
    }
    this.#updateHandoff();
    if (enhanced) this.#update();
    else this.#syncMedia();
  };

  #clearHandoff() {
    this.#section?.classList.remove('moya-meet-section--page-underlay');
    this.#section?.style.removeProperty('--moya-meet-pin-top');
    this.#nextScience?.classList.remove('moya-science-intro-section--page-overlay');
    this.#section = this.#nextScience = undefined;
    this.#handoffCovered = false;
  }

  #updateHandoff() {
    const section = this.closest('.shopify-section');
    const next = section?.nextElementSibling;
    const eligible = this.dataset.coverNextScience !== 'false' && !this.#motion.matches
      && next?.matches('.moya-science-intro-section') && next.querySelector('moya-science-intro');
    if (!eligible) {
      const wasCovered = this.#handoffCovered;
      this.#clearHandoff();
      if (wasCovered) this.#syncMedia();
      return;
    }
    if (this.#section !== section || this.#nextScience !== next) this.#clearHandoff();
    this.#section = section;
    this.#nextScience = next;
    const covered = next.getBoundingClientRect().top <= 0;
    const changed = covered !== this.#handoffCovered;
    this.#handoffCovered = covered;
    const viewport = this.#sticky.offsetHeight || window.innerHeight;
    section.style.setProperty('--moya-meet-pin-top', `${Math.min(0, viewport - section.offsetHeight)}px`);
    // Release the underlay only after the next opaque page has completely covered it.
    section.classList.toggle('moya-meet-section--page-underlay', !covered);
    next.classList.add('moya-science-intro-section--page-overlay');
    if (changed) this.#syncMedia();
  }

  #shouldPlay(video) {
    const scene = video.closest('[data-moya-ref="scenes[]"]');
    return this.isConnected && !document.hidden && !this.#motion.matches && !this.#handoffCovered
      && this.#visibleScenes.has(scene)
      && (!this.classList.contains('is-enhanced') || scene === this.#scenes[this.#activeIndex])
      && video.dataset.moyaVideoDevice === (this.#mobile.matches ? 'mobile' : 'desktop');
  }

  #syncMedia = () => {
    const version = ++this.#mediaVersion;
    for (const video of this.#videos) {
      if (!this.#shouldPlay(video)) {
        video.pause();
        video.classList.remove('is-playing');
        continue;
      }
      if (!video.paused || this.#pendingVideos.has(video)) continue;
      let loaded = false;
      for (const source of video.querySelectorAll('source[data-src]')) {
        source.src = source.dataset.src;
        source.removeAttribute('data-src');
        loaded = true;
      }
      if (loaded) video.load();
      video.muted = true;
      this.#pendingVideos.add(video);
      video.play()?.then(() => {
        // A breakpoint or scene may change while playback is starting.
        if (!this.#shouldPlay(video)) video.pause();
      }).catch(() => {
        video.classList.remove('is-playing');
      }).finally(() => {
        this.#pendingVideos.delete(video);
        // Retry an interrupted start only when scene/device/visibility changed meanwhile.
        if (version !== this.#mediaVersion && video.paused && this.#shouldPlay(video)) this.#syncMedia();
      });
    }
  };

  #schedule = () => {
    if (this.#frame !== null) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = null;
      this.#updateHandoff();
      this.#update();
    });
  };

  #update() {
    if (!this.isConnected || !this.classList.contains('is-enhanced')) return;
    const rect = this.getBoundingClientRect();
    const viewport = this.#sticky.offsetHeight || window.innerHeight || 1;
    const distance = rect.height - viewport;
    const progress = distance > 0 ? Math.min(Math.max(-rect.top / distance, 0), 1) : 0;
    const horizontal = this.#mobile.matches;
    if (this.#fill) {
      this.#fill.style.height = horizontal ? '100%' : `${progress * 100}%`;
      this.#fill.style.width = horizontal ? `${progress * 100}%` : '100%';
    }
    if (this.#icon && this.#progress) {
      const markerSize = horizontal ? this.#icon.offsetWidth : this.#icon.offsetHeight;
      const trackSize = horizontal ? this.#progress.offsetWidth : this.#progress.offsetHeight;
      const travel = Math.max(trackSize - markerSize, 0);
      // One offset drives both the marker and the cutout, so they stay in sync.
      this.#progress.style.setProperty('--moya-meet-marker-offset', `${progress * travel}px`);
      this.#progress.style.setProperty('--moya-meet-marker-size', `${markerSize}px`);
    }
    // Equal scroll intervals keep every scene fully visible until its next milestone.
    const activeIndex = Math.min(Math.floor(progress * this.#scenes.length), this.#scenes.length - 1);
    if (activeIndex === this.#activeIndex) return;
    const previous = this.#scenes[this.#activeIndex];
    const duration = Math.max(0, Number(this.dataset.transitionDuration ?? 400));
    clearTimeout(this.#transitionTimer);
    for (const scene of this.#scenes) scene.classList.remove('is-entering', 'is-leaving');
    if (previous && duration > 0) previous.classList.add('is-leaving');
    this.#activeIndex = activeIndex;
    for (const [index, scene] of this.#scenes.entries()) {
      const active = index === activeIndex;
      scene.classList.toggle('is-active', active);
      scene.classList.toggle('is-entering', active && Boolean(previous) && duration > 0);
      scene.toggleAttribute('inert', !active);
      scene.setAttribute('aria-hidden', String(!active));
    }
    this.#syncMedia();
    if (previous && duration > 0) {
      this.#transitionTimer = setTimeout(() => {
        for (const scene of this.#scenes) scene.classList.remove('is-entering', 'is-leaving');
      }, duration);
    }
  }

  #selectEditorScene = (event) => {
    if (!this.classList.contains('is-enhanced') || !(event.target instanceof Element)) return;
    const index = this.#scenes.indexOf(event.target.closest('[data-moya-ref="scenes[]"]'));
    if (index < 0) return;
    const distance = this.offsetHeight - this.#sticky.offsetHeight;
    // Select the middle of the scene's interval, away from a switch boundary.
    const progress = (index + 0.5) / this.#scenes.length;
    window.scrollTo({ top: window.scrollY + this.getBoundingClientRect().top + distance * progress, behavior: 'instant' });
    this.#update();
  };
}

if (!customElements.get('moya-meet-component')) customElements.define('moya-meet-component', MoyaMeet);
