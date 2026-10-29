import { sellingSpring } from './moya-selling-physics.js';
import {
  loopIndex,
  loopDelta,
  loopCardGeometry,
  loopRenderRadius,
  loopRenderWindow,
  horizontalWheelDelta,
} from './moya-loop-geometry.js';

class MoyaHowCarousel extends HTMLElement {
  connectedCallback() {
    if (this.controller) return;
    this.controller = new AbortController();
    this.viewport = this.querySelector('[data-how-viewport]');
    this.originals = [...this.querySelectorAll('[data-how-card]:not([data-loop-clone])')];
    this.count = this.originals.length;
    this.position = 0;
    this.target = 0;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
    this.status = this.querySelector('[data-how-status]');
    if (!this.viewport || !this.count) return;
    this.dataset.enhanced = '';
    const on = (node, name, handler, options = {}) =>
      node?.addEventListener(name, handler, { ...options, signal: this.controller.signal });
    this.querySelectorAll('[data-how-step]').forEach((button) => {
      button.hidden = this.count < 2;
      on(button, 'click', () => this.go(this.target + Number(button.dataset.howStep)));
    });
    on(this, 'keydown', (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target.closest('input, textarea, select, a, [contenteditable="true"]')) return;
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'Home' || event.key === 'End')
        this.select(event.key === 'Home' ? 0 : this.count - 1);
      else this.go(this.target + (event.key === 'ArrowLeft' ? -1 : 1));
    });
    on(this.viewport, 'pointerdown', (event) => this.startDrag(event));
    on(this.viewport, 'pointermove', (event) => this.drag(event));
    on(window, 'pointerup', (event) => this.endDrag(event));
    on(window, 'pointercancel', (event) => this.endDrag(event, true));
    on(this.viewport, 'lostpointercapture', (event) => this.endDrag(event, true));
    on(this.viewport, 'dragstart', (event) => event.preventDefault());
    on(this.viewport, 'wheel', (event) => this.wheel(event), { passive: false });
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
    on(this.reduced, 'change', () => this.go(this.target, false));
    on(this, 'shopify:block:select', (event) => {
      const index = this.originals.findIndex(
        (card) => card === event.target || card.contains(event.target),
      );
      if (index < 0) return;
      this.editorSelected = true;
      this.select(index);
    });
    on(this, 'shopify:block:deselect', () => {
      this.editorSelected = false;
      this.schedule();
    });
    this.resize = new ResizeObserver(() => this.measure());
    this.resize.observe(this.viewport);
    this.captionResize = new ResizeObserver(() => this.measureCaptions());
    this.originals.forEach((card) => {
      this.captionResize.observe(card.querySelector('.moya-how__caption'));
    });
    this.intersection = new IntersectionObserver(
      ([entry]) => {
        this.inView = entry.isIntersecting;
        if (!this.inView && this.frame) this.go(this.target, false, 0, false);
        this.schedule();
      },
      { threshold: 0.2 },
    );
    this.intersection.observe(this);
    this.measure();
  }

  disconnectedCallback() {
    this.controller?.abort();
    this.controller = null;
    this.resize?.disconnect();
    this.captionResize?.disconnect();
    this.intersection?.disconnect();
    cancelAnimationFrame(this.frame);
    cancelAnimationFrame(this.renderFrame);
    this.renderFrame = null;
    clearTimeout(this.timer);
    clearTimeout(this.wheelTimer);
    this.querySelectorAll('[data-loop-clone]').forEach((card) => card.remove());
    this.originals?.forEach((card) => {
      card.removeAttribute('style');
      card.classList.remove('is-active');
    });
    this.width = undefined;
    this.style.removeProperty('--how-copy-height');
    delete this.dataset.enhanced;
  }

  measure() {
    const style = getComputedStyle(this);
    const height = parseFloat(style.getPropertyValue('--how-card-height')) || 265;
    const gap = parseFloat(style.getPropertyValue('--how-gap')) || 40;
    const width = this.viewport.clientWidth;
    if (this.width === width && this.height === height && this.gap === gap) return;
    this.width = width;
    this.height = height;
    this.gap = gap;
    this.pitch = (height * 272) / 265 + gap;
    this.fullWidth = (height * 398) / 265;
    this.radius = loopRenderRadius(width, height, gap);
    cancelAnimationFrame(this.frame);
    cancelAnimationFrame(this.renderFrame);
    this.renderFrame = null;
    clearTimeout(this.wheelTimer);
    this.wheeling = false;
    this.frame = null;
    delete this.dataset.animating;
    this.pointer = null;
    delete this.dataset.dragging;
    this.position = loopIndex(Math.round(this.target), this.count);
    this.target = this.position;
    this.querySelectorAll('[data-loop-clone]').forEach((card) => card.remove());
    this.pools = this.originals.map((node) => {
      node.style.visibility = 'hidden';
      return [{ node, visible: false }];
    });
    if (this.count > 1) {
      const copies = Math.ceil((this.radius * 2 + 1) / this.count);
      const fragment = document.createDocumentFragment();
      for (let copy = 1; copy < copies; copy++) {
        this.originals.forEach((original, index) => {
          const node = original.cloneNode(true);
          node.dataset.loopClone = '';
          node.removeAttribute('id');
          node.removeAttribute('data-shopify-editor-block');
          node.setAttribute('aria-hidden', 'true');
          node.style.visibility = 'hidden';
          node.removeAttribute('aria-label');
          node.querySelectorAll('[id]').forEach((child) => child.removeAttribute('id'));
          fragment.append(node);
          this.pools[index].push({ node, visible: false });
        });
      }
      this.viewport.append(fragment);
    }
    this.render();
    this.schedule();
  }

  render() {
    const position = loopIndex(this.position, this.count);
    const used = new Set();
    const occurrences = new Map();
    for (const { index, distance } of loopRenderWindow(position, this.count, this.radius)) {
      const occurrence = occurrences.get(index) || 0;
      occurrences.set(index, occurrence + 1);
      const entry = this.pools[index][occurrence];
      const { node } = entry;
      used.add(entry);
      const geometry = loopCardGeometry(distance, this.height, this.gap);
      const scale = geometry.width / this.fullWidth;
      node.style.transform = `translate3d(${geometry.x - this.fullWidth / 2}px, ${(this.height - geometry.height) / 2}px, 0)`;
      // Both image and caption keep fixed layout dimensions throughout the transition.
      if (entry.scale !== scale) {
        node.style.setProperty('--how-scale', scale);
        node.style.setProperty('--how-radius', `${20 / scale}px`);
        node.style.setProperty('--how-caption-offset', `${geometry.height - this.height}px`);
        entry.scale = scale;
      }
      node.style.opacity = geometry.opacity;
      if (!entry.visible) node.style.visibility = 'visible';
      entry.visible = true;
      node.classList.toggle('is-active', Math.abs(distance) < 0.5);
    }
    for (const pool of this.pools)
      for (const entry of pool) {
        if (used.has(entry) || !entry.visible) continue;
        entry.node.style.visibility = 'hidden';
        entry.node.classList.remove('is-active');
        entry.visible = false;
      }
  }

  measureCaptions() {
    // Reserve the tallest caption once, rather than resizing the section as focus changes.
    const height = Math.max(
      95,
      ...this.originals.map(
        (card) => Math.ceil(card.querySelector('.moya-how__caption').offsetHeight) + 20,
      ),
    );
    this.style.setProperty('--how-copy-height', `${height}px`);
  }

  requestRender() {
    if (this.renderFrame) return;
    this.renderFrame = requestAnimationFrame(() => {
      this.renderFrame = null;
      this.render();
    });
  }

  wheel(event) {
    if (event.ctrlKey || this.count < 2 || this.pointer) return;
    const delta = horizontalWheelDelta(
      event.deltaX,
      event.deltaY,
      event.deltaMode,
      event.shiftKey,
      this.width,
    );
    if (!delta) return;
    event.preventDefault();
    cancelAnimationFrame(this.frame);
    this.frame = null;
    delete this.dataset.animating;
    this.wheeling = true;
    this.position += delta / this.pitch;
    this.target = Math.round(this.position);
    this.requestRender();
    clearTimeout(this.wheelTimer);
    this.wheelTimer = setTimeout(() => {
      this.wheeling = false;
      this.go(Math.round(this.position));
    }, 140);
    this.schedule();
  }

  select(index) {
    this.go(this.position + loopDelta(loopIndex(this.position, this.count), index, this.count));
  }

  go(destination, animate = true, velocity = 0, announce = true) {
    if (!this.count) return;
    cancelAnimationFrame(this.frame);
    cancelAnimationFrame(this.renderFrame);
    this.renderFrame = null;
    clearTimeout(this.wheelTimer);
    this.wheeling = false;
    this.target = this.count === 1 ? 0 : Math.round(destination);
    const finish = () => {
      this.position = loopIndex(this.target, this.count);
      this.target = this.position;
      this.frame = null;
      delete this.dataset.animating;
      this.render();
      const active = this.originals[this.position];
      if (announce)
        this.status.textContent = `${this.position + 1} of ${this.count}: ${active.dataset.title}`;
      this.schedule();
    };
    if (
      !animate ||
      this.dataset.motion === 'false' ||
      this.reduced.matches ||
      Math.abs(this.target - this.position) < 0.0005
    ) {
      finish();
      return;
    }
    this.dataset.animating = '';
    let previous = performance.now();
    const started = previous;
    const frame = (time) => {
      const state = sellingSpring(
        this.position,
        velocity,
        this.target,
        (time - previous) / 1000,
        Number(this.dataset.duration),
      );
      this.position = state.position;
      velocity = state.velocity;
      previous = time;
      this.render();
      if (
        (Math.abs(this.target - this.position) < 0.0005 && Math.abs(velocity) < 0.003) ||
        time - started > 2400
      )
        finish();
      else this.frame = requestAnimationFrame(frame);
    };
    this.frame = requestAnimationFrame(frame);
    this.schedule();
  }

  startDrag(event) {
    if (!event.isPrimary || event.button !== 0 || this.count < 2) return;
    cancelAnimationFrame(this.frame);
    clearTimeout(this.wheelTimer);
    this.wheeling = false;
    this.frame = null;
    delete this.dataset.animating;
    this.pointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      start: this.position,
      origin: Math.round(this.position),
      last: this.position,
      time: performance.now(),
      velocity: 0,
    };
    this.schedule();
  }

  drag(event) {
    const pointer = this.pointer;
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    if (!pointer.locked) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        this.endDrag(event, true);
        return;
      }
      pointer.locked = true;
      this.viewport.setPointerCapture(pointer.id);
      this.dataset.dragging = '';
    }
    event.preventDefault();
    this.position = pointer.start - dx / this.pitch;
    const now = performance.now();
    pointer.velocity =
      pointer.velocity * 0.3 +
      ((this.position - pointer.last) / Math.max(1, now - pointer.time)) * 700;
    pointer.last = this.position;
    pointer.time = now;
    this.requestRender();
  }

  endDrag(event, cancelled = false) {
    const pointer = this.pointer;
    if (!pointer || pointer.id !== event.pointerId) return;
    this.pointer = null;
    if (this.viewport.hasPointerCapture(pointer.id))
      this.viewport.releasePointerCapture(pointer.id);
    delete this.dataset.dragging;
    const velocity = !cancelled && performance.now() - pointer.time < 100 ? pointer.velocity : 0;
    const destination = Math.round(this.position + velocity * 0.2);
    this.go(
      Math.max(pointer.origin - 1, Math.min(pointer.origin + 1, destination)),
      true,
      velocity,
    );
  }

  schedule() {
    clearTimeout(this.timer);
    if (
      this.dataset.autoplay !== 'true' ||
      this.reduced.matches ||
      this.count < 2 ||
      !this.inView ||
      this.hovered ||
      this.pointer ||
      this.wheeling ||
      this.frame ||
      this.editorSelected ||
      document.hidden ||
      this.contains(document.activeElement)
    )
      return;
    this.timer = setTimeout(
      () => this.go(this.target + 1, true, 0, false),
      Number(this.dataset.delay) || 5000,
    );
  }
}

if (!customElements.get('moya-how-carousel'))
  customElements.define('moya-how-carousel', MoyaHowCarousel);
