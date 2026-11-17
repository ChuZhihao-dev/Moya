import { clamp, readingWeight, journeyTiming, project, photoSize, photoCenterY, photoPose, planeTransform, createRoute, projectRoute } from './moya-story-geometry.js';
import { createJourneyTimeline } from './moya-story-timeline.js';
import { createStoryParticles } from './moya-story-particles.js';
import { loadStoryMotion, acquireStoryScroll, storyScrollTo } from './moya-story-runtime.js';

class MoyaScienceStorytelling extends HTMLElement {
  connectedCallback() {
    this.disconnectedCallback();
    this.positionToRestore = undefined;
    this.hasAppliedInitialHash = false;
    this.nearby = false;
    this.controller = new AbortController();
    const { signal } = this.controller;
    this.stage = this.querySelector('.moya-story__stage');
    this.intro = this.querySelector('.moya-story__intro');
    this.nav = this.querySelector('.moya-story__nav');
    this.chrome = this.querySelector('.moya-story__chrome');
    this.status = this.querySelector('[data-story-status]');
    this.dusk = this.querySelector('.moya-story__dusk');
    this.night = this.querySelector('.moya-story__night');
    this.route = this.querySelector('.moya-story__route');
    this.paths = [...this.querySelectorAll('.moya-story__route path')];
    this.links = [...this.nav.querySelectorAll('a')];
    this.introLabel = this.status.textContent;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
    this.reduced.addEventListener('change', this.scheduleConfigure, { signal });
    this.items = [...this.querySelectorAll('.moya-story__chapter')].map((node) => {
      const figure = node.querySelector('figure');
      return {
        node, figure, image: figure.querySelector('img'), caption: figure.querySelector('figcaption'),
        shade: figure.querySelector('.moya-story__shade'), copy: node.querySelector('.moya-story__copy'),
        body: node.querySelector('.moya-story__body'), teaser: node.querySelector('.moya-story__teaser'),
        marker: node.querySelector('.moya-story__marker'),
        particles: createStoryParticles(figure, {
          topic: node.dataset.effect, x: Number(node.dataset.particleX) || 0,
          y: Number(node.dataset.particleY) || 0, scale: Number(node.dataset.particleScale) || 100,
        }),
      };
    });
    if (!this.stage || !this.items.length) return;
    this.timing = journeyTiming(this.items.length, Number(this.dataset.readingHold) || 1.2, Number(this.dataset.introDelay) || 0, this.items.map(({ body }) => readingWeight(body.textContent)));
    this.addEventListener('click', this.onClick, { signal });
    this.addEventListener('shopify:block:select', this.onBlockSelect, { signal });
    this.addEventListener('shopify:section:select', this.onSectionSelect, { signal });
    this.nav.addEventListener('keydown', this.onNavKey, { signal });
    window.addEventListener('hashchange', this.followHash, { signal });
    window.addEventListener('resize', this.scheduleConfigure, { passive: true, signal });
    document.addEventListener('shopify:section:reorder', this.scheduleRefresh, { signal });
    document.addEventListener('shopify:section:load', this.scheduleRefresh, { signal });
    document.addEventListener('shopify:section:unload', this.scheduleRefresh, { signal });
    this.items.forEach(({ image }) => image.addEventListener('load', this.scheduleConfigure, { signal }));
    this.nearObserver = new IntersectionObserver(([entry]) => {
      this.nearby = entry.isIntersecting;
      if (this.nearby) this.prepareNearbyPhotos();
    }, { rootMargin: '500px 0px' });
    this.nearObserver.observe(this);
    this.headerObserver = new ResizeObserver(this.scheduleConfigure);
    for (const header of document.querySelectorAll('.shopify-section--header, .shopify-section--announcement-bar, moya-product-nav')) this.headerObserver.observe(header);
    this.configure();
    document.fonts.ready.then(() => { if (!signal.aborted) this.scheduleConfigure(); });
  }

  disconnectedCallback() {
    this.controller?.abort();
    this.headerObserver?.disconnect();
    this.nearObserver?.disconnect();
    clearTimeout(this.configureTimer);
    clearTimeout(this.refreshTimer);
    this.version = (this.version || 0) + 1;
    this.media?.revert();
    this.media = undefined;
    this.clearEnhanced();
    this.items?.forEach(({ particles }) => particles.destroy());
  }

  scheduleConfigure = () => {
    this.rememberPosition();
    clearTimeout(this.configureTimer);
    this.configureTimer = setTimeout(() => { if (this.isConnected) this.configure(); }, 160);
  };

  scheduleRefresh = () => {
    clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => this.motion?.ScrollTrigger.refresh(), 160);
  };

  async configure() {
    if (this.media) {
      this.refreshLayout();
      return;
    }
    const version = ++this.version;
    if (this.dataset.motion === 'false' || this.dataset.layout === 'stacked' || this.reduced.matches || innerHeight < 650) {
      this.measureFallback();
      return;
    }
    try {
      this.motion = await loadStoryMotion();
      if (version !== this.version || !this.isConnected) return;
      this.media = this.motion.gsap.matchMedia();
      this.media.add({
        desktop: '(min-width: 750px)', mobile: '(max-width: 749px)',
        reduced: '(prefers-reduced-motion: reduce)', short: '(max-height: 649px)',
      }, (context) => {
        if (context.conditions.reduced || context.conditions.short) {
          this.measureFallback();
          return;
        }
        this.mobile = context.conditions.mobile;
        if (!this.measureEnhanced()) {
          this.clearEnhanced();
          this.measureFallback();
          return () => this.clearEnhanced();
        }
        this.startEnhanced();
        return () => this.clearEnhanced();
      }, this);
    } catch (error) {
      if (version !== this.version || !this.isConnected) return;
      this.clearEnhanced();
      this.measureFallback();
      console.warn('[Moya Science] Showing the complete document layout.', error);
    }
  }

  startEnhanced() {
    this.buildTimeline();
    if (this.positionToRestore) {
      this.restoreTime(this.positionToRestore.time);
      this.positionToRestore = undefined;
    } else if (!this.hasAppliedInitialHash) {
      this.hasAppliedInitialHash = true;
      this.followHash();
    }
    this.prepareNearbyPhotos();
    if (this.dataset.lenis === 'true' && !window.Shopify?.designMode) {
      const session = {};
      this.scrollSession = session;
      acquireStoryScroll(session, this.motion).then((release) => {
        if (this.scrollSession === session && this.isConnected) this.releaseScroll = release;
        else release();
      }).catch((error) => console.warn('[Moya Science] Native scrolling remains active.', error));
    }
  }

  restoreTime(time) {
    const top = this.trigger.start + clamp(time / this.timing.duration) * (this.trigger.end - this.trigger.start);
    storyScrollTo(top, true);
    this.trigger.update();
  }

  refreshLayout() {
    if (this.reduced.matches || innerHeight < 650) {
      if (this.trigger) this.clearEnhanced();
      this.measureFallback();
      return;
    }
    const time = this.trigger?.isActive ? this.positionToRestore?.time ?? this.timeline.time() : null;
    if (!this.measureEnhanced()) {
      this.clearEnhanced();
      this.measureFallback();
      return;
    }
    if (!this.trigger) {
      this.startEnhanced();
      return;
    }
    if (!this.layoutChanged) {
      this.positionToRestore = undefined;
      return;
    }
    this.motion.ScrollTrigger.refresh();
    if (time !== null) this.restoreTime(time);
    this.positionToRestore = undefined;
    this.render();
  }

  prepareNearbyPhotos() {
    if (!this.nearby) return;
    const index = Math.max(0, this.active ?? 0);
    for (const item of [this.items[index], this.trigger && this.items[index + 1]]) {
      if (!item) continue;
      const source = item.image.currentSrc || item.image.src;
      if (item.preparedSource === source) continue;
      item.preparedSource = source;
      item.image.loading = 'eager';
      item.image.decode?.().catch(() => {});
    }
  }

  measureEnhanced() {
    this.classList.add('is-enhanced', 'is-measuring');
    const width = this.stage.clientWidth, height = this.stage.clientHeight;
    const offset = parseFloat(getComputedStyle(this.stage).top) || 0;
    const available = height - this.chrome.offsetHeight - this.nav.offsetHeight - 24;
    const tooTall = height < 500 || this.intro.offsetHeight > available || this.items.some(({ copy }) => copy.offsetHeight > available);
    const ratios = this.items.map(({ image }) => {
      const declared = Number(image.getAttribute('width')) / Number(image.getAttribute('height')) || 2560 / 1707;
      const actual = image.naturalWidth / image.naturalHeight || declared;
      // Resized versions may round their height by one pixel. That is not a
      // composition change and should not trigger another layout refresh.
      const expectedHeight = image.naturalWidth / declared;
      return Math.abs(image.naturalHeight - expectedHeight) <= 1 ? declared : actual;
    });
    this.classList.remove('is-measuring');
    if (tooTall) return false;
    const documentTop = Math.round(scrollY + this.getBoundingClientRect().top);
    const signature = [width, height, offset, documentTop, this.mobile, ...ratios].join(':');
    this.layoutChanged = signature !== this.layoutSignature;
    if (!this.layoutChanged) return true;
    this.layoutSignature = signature;
    this.size = { width, height, offset };
    this.style.setProperty('--story-runway', `${height * (1 + this.timing.duration * (Number(this.dataset.scrollDistance) || 100) / 100)}px`);
    const firstSize = photoSize(ratios[0], width, height, this.mobile);
    this.routeSegments = createRoute(this.items.length, width, photoCenterY(firstSize, height, this.mobile) + firstSize.height / 2 + 25, this.mobile);
    this.route?.setAttribute('viewBox', `0 0 ${width} ${height}`);
    this.routeCamera = undefined;
    this.items.forEach((item, index) => {
      item.size = photoSize(ratios[index], width, height, this.mobile);
      item.figure.style.width = `${item.size.width}px`;
      item.figure.style.height = `${item.size.height}px`;
      item.figure.style.zIndex = String(20 - index);
      item.particles.resize(item.size.width, item.size.height);
    });
    return true;
  }

  measureFallback() {
    this.items.forEach((item) => {
      item.particles.select(true);
      item.particles.resize(item.figure.clientWidth, item.figure.clientHeight);
    });
    if (this.positionToRestore && this.isConnected) {
      const { index, detail, offset } = this.positionToRestore;
      const target = index < 0 ? this.intro : detail ? this.items[index]?.copy : this.items[index]?.node;
      this.positionToRestore = undefined;
      if (target) storyScrollTo(scrollY + target.getBoundingClientRect().top - offset - 12, true);
    } else if (!this.hasAppliedInitialHash) {
      this.hasAppliedInitialHash = true;
      this.followHash();
    }
  }

  buildTimeline() {
    const { gsap, ScrollTrigger } = this.motion;
    this.state = { camera: -1 };
    this.chapterStates = this.items.map(() => ({ entrance: 0, exit: 0, detail: 0, caption: 1 }));
    gsap.set(this.intro, { xPercent: -50, yPercent: -50 });
    this.introSet = Object.fromEntries(['x', 'y', 'scale', 'opacity'].map((key) => [key, gsap.quickSetter(this.intro, key, key === 'x' || key === 'y' ? 'px' : undefined)]));
    this.items.forEach((item) => {
      gsap.set(item.copy, { yPercent: this.mobile ? 0 : -45 });
      item.set = Object.fromEntries(['x', 'y', 'opacity'].map((key) => [key, gsap.quickSetter(item.copy, key, key === 'opacity' ? undefined : 'px')]));
    });
    this.timeline = createJourneyTimeline(gsap, this.state, this.chapterStates, this.timing, this.render);
    this.trigger = ScrollTrigger.create({
      id: this.id, trigger: this, animation: this.timeline,
      start: () => `top ${this.size.offset}px`, end: () => `bottom ${this.size.offset + this.size.height}px`,
      scrub: this.dataset.lenis === 'true' ? true : Number(this.dataset.scrub) || true,
      invalidateOnRefresh: true,
      onRefresh: () => this.render(),
    });
    this.render();
  }

  render = () => {
    if (!this.state || !this.classList.contains('is-enhanced')) return;
    const { width, height } = this.size;
    const { camera } = this.state;
    if (camera !== this.routeCamera) {
      if (this.paths.length) {
        const paths = projectRoute(this.routeSegments, camera, width, height, this.mobile);
        this.paths.forEach((path, index) => path.setAttribute('d', paths[index]));
      }
      const mood = (index) => {
        const name = this.items[clamp(index, 0, this.items.length - 1)].node.dataset.mood;
        return { evening: name === 'day' ? 0 : 1, night: name === 'night' ? 1 : 0 };
      };
      const base = Math.floor(Math.max(0, camera)), blend = clamp(camera - base);
      const from = mood(base), to = mood(base + 1);
      const evening = from.evening + (to.evening - from.evening) * blend;
      const night = from.night + (to.night - from.night) * blend;
      this.dusk.style.opacity = evening;
      this.night.style.opacity = night;
      this.style.setProperty('--story-ambient', `color-mix(in srgb, color-mix(in srgb, var(--story-day), var(--story-dusk) ${evening * 100}%), var(--story-night) ${night * 100}%)`);
      this.style.setProperty('--story-chrome-ink', night < 0.48 ? 'var(--story-ink)' : '#e8e3dc');
      this.items.forEach((item, index) => {
        const pose = photoPose(index, item.size, camera, width, height, this.mobile);
        const transform = planeTransform(pose.corners, item.size.width, item.size.height);
        item.figure.style.visibility = transform ? 'visible' : 'hidden';
        item.figure.style.opacity = clamp((camera + 0.7) / 0.45);
        if (transform) item.figure.style.transform = transform;
        item.marker.style.visibility = transform && pose.marker ? 'visible' : 'hidden';
        if (transform && pose.marker) item.marker.style.transform = `translate(${pose.marker.x}px, ${pose.marker.y}px) translate(-50%, -50%) scale(${pose.marker.scale})`;
      });
      const intro = project(width * (this.mobile ? 0.38 : 0.28), height * 0.18, -1800, camera, width, height, this.mobile);
      const opacity = intro ? 1 - clamp((intro.scale - 1.35) / 0.65) : 0;
      this.introSet.opacity(opacity);
      this.intro.style.visibility = opacity > 0.001 ? 'visible' : 'hidden';
      if (intro) { this.introSet.x(intro.x); this.introSet.y(intro.y); this.introSet.scale(intro.scale); }
      const introActive = camera < -0.78;
      this.intro.inert = !introActive;
      this.intro.setAttribute('aria-hidden', String(!introActive));
      this.routeCamera = camera;
    }
    const selected = this.state.camera < -0.78 ? -1 : clamp(Math.floor(camera + 0.78), 0, this.items.length - 1);
    this.items.forEach((item, index) => {
      const state = this.chapterStates[index];
      const reveal = state.entrance * (1 - state.exit);
      item.set.x((1 - state.entrance) * 64 * (index % 2 ? -1 : 1));
      item.set.y((1 - state.entrance) * height * 0.12 - state.exit * height * 0.18);
      item.set.opacity(reveal);
      item.copy.style.visibility = reveal > 0.001 ? 'visible' : 'hidden';
      if (item.lastDetail !== state.detail) {
        item.copy.style.setProperty('--story-detail', state.detail.toFixed(4));
        item.copy.style.setProperty('--story-rows', `${state.detail.toFixed(4)}fr`);
        item.lastDetail = state.detail;
      }
      item.caption.style.opacity = item.shade.style.opacity = state.caption;
      const current = index === selected;
      this.setInert(item.node, !current);
      this.setInert(item.copy, !current || reveal < 0.95);
      this.setInert(item.body, !current || state.detail < 0.95);
      item.teaser.setAttribute('aria-hidden', String(!current || state.detail > 0.05));
      item.caption.inert = !current || state.caption < 0.95;
      item.node.classList.toggle('is-reading', current && reveal >= 0.95);
      item.particles.select(current);
    });
    if (this.active !== selected) {
      this.active = selected;
      this.prepareNearbyPhotos();
      this.links.forEach((link, index) => {
        if (index === selected + 1) link.setAttribute('aria-current', 'step');
        else link.removeAttribute('aria-current');
      });
      this.status.textContent = selected < 0 ? this.introLabel : `${String(selected + 1).padStart(2, '0')} / ${String(this.items.length).padStart(2, '0')} · ${this.items[selected].marker.textContent.trim()}`;
    }
  };

  setInert(node, value) {
    if (node.inert !== value) node.inert = value;
    const hidden = String(value);
    if (node.getAttribute('aria-hidden') !== hidden) node.setAttribute('aria-hidden', hidden);
  }

  clearEnhanced() {
    this.rememberPosition();
    this.layoutSignature = undefined;
    this.trigger?.kill();
    this.timeline?.kill();
    this.trigger = this.timeline = undefined;
    this.state = undefined;
    this.scrollSession = undefined;
    this.releaseScroll?.();
    this.releaseScroll = undefined;
    this.classList.remove('is-enhanced', 'is-measuring');
    this.style.removeProperty('--story-runway');
    this.style.removeProperty('--story-ambient');
    this.style.removeProperty('--story-chrome-ink');
    this.intro?.removeAttribute('style');
    this.intro?.removeAttribute('inert');
    this.intro?.removeAttribute('aria-hidden');
    this.items?.forEach((item) => {
      for (const node of [item.figure, item.marker, item.copy, item.caption, item.shade]) node.removeAttribute('style');
      for (const node of [item.node, item.copy, item.body, item.caption]) {
        node.inert = false;
        node.removeAttribute('aria-hidden');
      }
      item.teaser.setAttribute('aria-hidden', 'true');
      item.node.classList.remove('is-reading');
      item.lastDetail = undefined;
      item.particles.select(true);
    });
    this.active = undefined;
  }

  rememberPosition() {
    if (this.trigger?.isActive) {
      const index = this.active ?? -1;
      this.positionToRestore = {
        time: this.timeline.time(), index,
        detail: index >= 0 && this.chapterStates[index].detail >= 0.5,
        offset: this.size.offset,
      };
    }
  }

  go(index, detail = false, updateHash = true, immediate = false) {
    const item = this.items[index];
    const target = item ? (detail ? item.copy : item.node) : this.intro;
    if (updateHash) history.replaceState(null, '', `#${target.id}`);
    if (this.trigger) {
      const label = index < 0 ? 'introduction' : `${detail ? 'detail' : 'chapter'}-${index}`;
      const time = this.timeline.labels[label];
      storyScrollTo(this.trigger.start + time / this.timing.duration * (this.trigger.end - this.trigger.start), immediate);
    } else {
      const offset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0;
      storyScrollTo(scrollY + target.getBoundingClientRect().top - offset - 12, immediate || matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
  }

  onClick = (event) => {
    const link = event.target.closest('[data-story-go]');
    if (!link || !this.contains(link)) return;
    event.preventDefault();
    event.stopPropagation();
    this.go(Number(link.dataset.storyGo), link.hasAttribute('data-story-detail'));
  };

  onNavKey = (event) => {
    const current = this.links.indexOf(document.activeElement);
    if (current < 0) return;
    let next;
    if (event.key === 'ArrowRight') next = (current + 1) % this.links.length;
    if (event.key === 'ArrowLeft') next = (current - 1 + this.links.length) % this.links.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = this.links.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    this.links[next].focus({ preventScroll: true });
    this.go(next - 1);
  };

  onBlockSelect = (event) => {
    const index = this.items.findIndex(({ node }) => node === event.target || node.contains(event.target));
    if (index >= 0) this.go(index, true, false, true);
  };

  onSectionSelect = () => this.go(-1, false, false, true);

  followHash = () => {
    if (!location.hash || !this.isConnected) return;
    const hash = location.hash.slice(1);
    if (hash === this.id || hash === this.intro.id || this.querySelector('.moya-story__page-anchor')?.id === hash) {
      this.go(-1, false, false, true);
      return;
    }
    this.items.forEach((item, index) => {
      if (hash === item.node.id || hash === item.copy.id) this.go(index, hash === item.copy.id, false, true);
    });
  };
}

if (!customElements.get('moya-science-storytelling')) customElements.define('moya-science-storytelling', MoyaScienceStorytelling);
