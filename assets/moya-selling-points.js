import { sellingTarget, sellingSpring } from './moya-selling-physics.js';

class MoyaSellingPoints extends HTMLElement {
  connectedCallback() {
    if (this.controller) return;
    this.controller = new AbortController();
    this.viewport = this.querySelector('[data-selling-viewport]');
    this.slides = [...this.querySelectorAll('[data-selling-slide]')];
    this.layers = this.slides.map((slide) => ({
      media: slide.querySelector('.moya-selling__media'),
      content: slide.querySelector('.moya-selling__content'),
    }));
    this.revealAnimations = [];
    this.lastRevealed = -1;
    this.dots = [...this.querySelectorAll('[data-selling-dot]')];
    this.previous = this.querySelector('[data-selling-previous]');
    this.next = this.querySelector('[data-selling-next]');
    this.status = this.querySelector('[data-selling-status]');
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.index = 0;
    this.inView = false;
    this.editorSelected = false;
    if (!this.viewport || !this.slides.length) return;
    this.dataset.enhanced = '';
    const on = (target, event, handler, options = {}) =>
      target?.addEventListener(event, handler, { ...options, signal: this.controller.signal });
    this.previous?.removeAttribute('hidden');
    this.next?.removeAttribute('hidden');
    on(this.previous, 'click', () => this.goTo(this.index - 1));
    on(this.next, 'click', () => this.goTo(this.index + 1));
    this.dots.forEach((dot, index) => on(dot, 'click', () => this.goTo(index)));
    on(this.viewport, 'keydown', (event) => {
      if (event.target !== this.viewport) return;
      const destinations = {
        ArrowLeft: this.index - 1,
        ArrowRight: this.index + 1,
        Home: 0,
        End: this.slides.length - 1,
      };
      if (!(event.key in destinations)) return;
      event.preventDefault();
      this.goTo(destinations[event.key]);
    });
    on(this.viewport, 'pointerdown', (event) => this.startDrag(event));
    on(this.viewport, 'pointermove', (event) => this.drag(event));
    on(window, 'pointerup', (event) => this.endDrag(event));
    on(window, 'pointercancel', (event) => this.endDrag(event, true));
    on(this.viewport, 'lostpointercapture', (event) => this.endDrag(event, true));
    on(this.viewport, 'dragstart', (event) => event.preventDefault());
    on(
      this.viewport,
      'scroll',
      () => {
        this.renderLayers();
        if (this.motionFrame || this.pointer) return;
        this.update(Math.round(this.viewport.scrollLeft / this.step));
        clearTimeout(this.scrollTimer);
        this.scrollTimer = setTimeout(() => this.goTo(this.index), 140);
      },
      { passive: true },
    );
    on(
      this.viewport,
      'wheel',
      (event) => {
        if (Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.shiftKey) this.stopMotion();
      },
      { passive: true },
    );
    on(this, 'mouseenter', () => {
      this.hovered = true;
      this.schedule();
    });
    on(this, 'mouseleave', () => {
      this.hovered = false;
      this.schedule();
    });
    on(this, 'focusin', () => this.schedule());
    on(this, 'focusout', () => queueMicrotask(() => this.schedule()));
    on(document, 'visibilitychange', () => this.schedule());
    on(this.reduced, 'change', () => {
      this.goTo(this.index, false);
    });
    on(document, 'shopify:block:select', (event) => {
      const index = this.slides.findIndex(
        (slide) => slide === event.target || slide.contains(event.target),
      );
      if (index < 0) return;
      this.editorSelected = true;
      this.goTo(index);
    });
    on(document, 'shopify:block:deselect', () => {
      this.editorSelected = false;
      this.schedule();
    });
    this.resizeObserver = new ResizeObserver(() => {
      const width = this.viewport.clientWidth;
      if (this.step === width) return;
      this.step = width;
      this.pointer = null;
      delete this.dataset.dragging;
      this.goTo(this.index, false);
    });
    this.resizeObserver.observe(this.viewport);
    this.intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        this.inView = entry.isIntersecting;
        if (this.inView && !this.hasEntered) {
          this.hasEntered = true;
          this.reveal(this.index);
        }
        this.schedule();
      },
      { threshold: 0.15 },
    );
    this.intersectionObserver.observe(this);
    this.step = this.viewport.clientWidth;
    this.update(0);
    this.renderLayers();
  }

  disconnectedCallback() {
    this.controller?.abort();
    this.controller = null;
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    this.stopMotion();
    this.revealAnimations?.forEach((animation) => animation.cancel());
    clearTimeout(this.autoplayTimer);
    clearTimeout(this.scrollTimer);
  }

  update(index) {
    this.index = Math.max(0, Math.min(this.slides.length - 1, index || 0));
    this.dots.forEach((dot, i) => {
      if (i === this.index) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
    this.slides.forEach((slide, i) => {
      slide.inert = i !== this.index;
      slide.setAttribute('aria-hidden', String(i !== this.index));
    });
    if (this.previous) this.previous.disabled = this.index === 0;
    if (this.next) this.next.disabled = this.index === this.slides.length - 1;
  }

  stopMotion() {
    cancelAnimationFrame(this.motionFrame);
    this.motionFrame = null;
    delete this.dataset.animating;
  }

  renderLayers() {
    if (!this.step) return;
    const enabled = this.dataset.motion !== 'false' && !this.reduced.matches;
    const position = this.viewport.scrollLeft / this.step;
    this.layers.forEach(({ media, content }, index) => {
      const offset = enabled ? Math.max(-1, Math.min(1, index - position)) : 0;
      const distance = Math.abs(offset);
      media.style.setProperty('--selling-media-shift', `${offset * -4}%`);
      media.style.setProperty('--selling-media-scale', String(enabled ? 1.08 + distance * 0.04 : 1));
      content.style.setProperty('--selling-copy-shift', `${offset * 36}px`);
      content.style.setProperty('--selling-copy-opacity', String(1 - distance * 0.75));
    });
  }

  reveal(index) {
    if (index === this.lastRevealed) return;
    this.lastRevealed = index;
    this.revealAnimations.forEach((animation) => animation.cancel());
    this.revealAnimations = [];
    if (this.dataset.motion === 'false' || this.reduced.matches) return;
    const duration = Math.max(400, Math.min(760, Number(this.dataset.duration) || 520));
    const children = [...this.layers[index].content.children];
    this.revealAnimations = children.map((child, order) =>
      child.animate(
        [
          { opacity: 0, transform: `translate3d(0, ${order === 0 ? 12 : 24}px, 0)` },
          { opacity: 1, transform: 'translate3d(0, 0, 0)' },
        ],
        {
          duration,
          delay: 90 + order * 85,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          fill: 'backwards',
        },
      ),
    );
  }

  goTo(index, animate = true, velocity = 0) {
    clearTimeout(this.scrollTimer);
    // Keep snapping disabled while interrupting a running transition.
    this.dataset.dragging = '';
    this.stopMotion();
    this.update(index);
    const target = this.index * this.step;
    const finish = () => {
      this.viewport.scrollLeft = target;
      this.renderLayers();
      this.stopMotion();
      this.status.textContent = `Slide ${this.index + 1} of ${this.slides.length}`;
      this.schedule();
    };
    if (!animate || this.dataset.motion === 'false' || this.reduced.matches) {
      this.revealAnimations.forEach((animation) => animation.cancel());
      finish();
      delete this.dataset.dragging;
      return;
    }
    this.dataset.animating = '';
    this.reveal(this.index);
    delete this.dataset.dragging;
    let position = this.viewport.scrollLeft;
    let previousTime = performance.now();
    const started = previousTime;
    const frame = (time) => {
      ({ position, velocity } = sellingSpring(
        position,
        velocity,
        target,
        (time - previousTime) / 1000,
        Number(this.dataset.duration),
      ));
      previousTime = time;
      this.viewport.scrollLeft = position;
      this.renderLayers();
      if ((Math.abs(target - position) < 0.5 && Math.abs(velocity) < 3) || time - started > 2600)
        finish();
      else this.motionFrame = requestAnimationFrame(frame);
    };
    this.motionFrame = requestAnimationFrame(frame);
    this.schedule();
  }

  startDrag(event) {
    if (
      !event.isPrimary ||
      event.button !== 0 ||
      event.target.closest('a, button, input, select, textarea')
    )
      return;
    this.dataset.dragging = '';
    this.stopMotion();
    this.revealAnimations.forEach((animation) => animation.cancel());
    this.pointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      start: this.viewport.scrollLeft,
      position: this.viewport.scrollLeft,
      time: performance.now(),
      velocity: 0,
      locked: false,
      origin: this.index,
    };
    this.schedule();
  }

  drag(event) {
    const pointer = this.pointer;
    if (!pointer || event.pointerId !== pointer.id) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    if (!pointer.locked) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        this.endDrag(event, true);
        return;
      }
      pointer.locked = true;
      this.viewport.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    this.viewport.scrollLeft = pointer.start - dx;
    const now = performance.now();
    const elapsed = Math.max(1, now - pointer.time);
    pointer.velocity =
      pointer.velocity * 0.3 + ((this.viewport.scrollLeft - pointer.position) / elapsed) * 0.7;
    pointer.position = this.viewport.scrollLeft;
    pointer.time = now;
  }

  endDrag(event, cancelled = false) {
    const pointer = this.pointer;
    if (!pointer || pointer.id !== event.pointerId) return;
    this.pointer = null;
    if (this.viewport.hasPointerCapture(pointer.id))
      this.viewport.releasePointerCapture(pointer.id);
    const velocity =
      !cancelled && pointer.locked && performance.now() - pointer.time < 100 ? pointer.velocity : 0;
    const strength =
      this.dataset.inertia === 'false' ? 0 : Number(this.dataset.inertiaStrength) / 100;
    const target = sellingTarget(
      this.viewport.scrollLeft,
      velocity,
      this.step,
      this.slides.length,
      strength,
    );
    const adjacent = Math.max(pointer.origin - 1, Math.min(pointer.origin + 1, target));
    this.goTo(adjacent, true, velocity * 1000 * strength);
    delete this.dataset.dragging;
  }

  schedule() {
    clearTimeout(this.autoplayTimer);
    if (
      this.dataset.autoplay !== 'true' ||
      this.reduced.matches ||
      !this.inView ||
      this.hovered ||
      this.pointer ||
      this.motionFrame ||
      this.editorSelected ||
      document.hidden ||
      this.contains(document.activeElement) ||
      this.index >= this.slides.length - 1
    )
      return;
    this.autoplayTimer = setTimeout(
      () => this.goTo(this.index + 1),
      Number(this.dataset.autoplayDelay) || 6000,
    );
  }
}

if (!customElements.get('moya-selling-points'))
  customElements.define('moya-selling-points', MoyaSellingPoints);
