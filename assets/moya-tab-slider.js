/** Moya feature slider with native controls; no Horizon runtime dependencies. */
class MoyaTabSlider extends HTMLElement {
  #viewport;
  #track;
  #indicator;
  #slides = [];
  #tabs = [];
  #index = 0;
  #controller;
  #resizeObserver;
  #timer;
  #frame;
  #pointer;
  #startX = 0;
  #startY = 0;
  #offset = 0;
  #dragging = false;
  #editorSelected = false;
  #motion = window.matchMedia('(prefers-reduced-motion: reduce)');

  connectedCallback() {
    this.#controller?.abort();
    this.#controller = new AbortController();
    const { signal } = this.#controller;
    this.#viewport = this.querySelector('[data-moya-ref="viewport"]');
    this.#track = this.querySelector('[data-moya-ref="track"]');
    this.#indicator = this.querySelector('[data-moya-ref="tabIndicator"]');
    this.#slides = [...this.querySelectorAll('[data-moya-ref="slides[]"]')];
    this.#tabs = [...this.querySelectorAll('[data-moya-ref="tabs[]"]')];
    if (!this.#viewport || !this.#track || !this.#slides.length) return;
    this.#index = Math.min(this.#index, this.#slides.length - 1);
    this.addEventListener('click', this.#click, { signal });
    this.addEventListener('keydown', this.#keydown, { signal });
    this.addEventListener('pointerdown', this.#pointerDown, { signal });
    this.addEventListener('pointermove', this.#pointerMove, { signal });
    this.addEventListener('pointerup', this.#pointerUp, { signal });
    this.addEventListener('pointercancel', this.#pointerUp, { signal });
    this.addEventListener('mouseenter', this.#stop, { signal });
    this.addEventListener('mouseleave', this.#restart, { signal });
    this.addEventListener('focusin', this.#stop, { signal });
    this.addEventListener('focusout', this.#restart, { signal });
    this.addEventListener('dragstart', (event) => event.preventDefault(), { signal });
    this.addEventListener('shopify:block:select', this.#selectEditorBlock, { signal });
    this.addEventListener(
      'shopify:block:deselect',
      () => {
        this.#editorSelected = false;
        this.#restart();
      },
      { signal },
    );
    document.addEventListener('visibilitychange', this.#restart, { signal });
    this.#motion.addEventListener('change', this.#restart, { signal });
    this.#resizeObserver = new ResizeObserver(this.#resize);
    this.#resizeObserver.observe(this);
    this.#resize();
    document.fonts?.ready.then(() => {
      if (this.isConnected) this.#resize();
    });
  }

  disconnectedCallback() {
    this.#controller?.abort();
    this.#resizeObserver?.disconnect();
    this.#stop();
    if (this.#frame !== undefined) cancelAnimationFrame(this.#frame);
    this.#pointer = undefined;
    this.#dragging = false;
    this.removeAttribute('data-dragging');
  }

  #select(index) {
    this.#index = (index + this.#slides.length) % this.#slides.length;
    this.dataset.currentIndex = String(this.#index);
    this.#slides.forEach((slide, position) => {
      const active = position === this.#index;
      slide.classList.toggle('is-active', active);
      slide.setAttribute('aria-hidden', String(!active));
      slide.toggleAttribute('inert', !active);
    });
    this.#tabs.forEach((tab, position) => {
      const active = position === this.#index;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    const tab = this.#tabs[this.#index];
    if (this.#indicator && tab) {
      this.#indicator.style.setProperty('--moya-tab-indicator-x', `${tab.offsetLeft}px`);
      this.#indicator.style.setProperty('--moya-tab-indicator-width', `${tab.offsetWidth}px`);
    }
    if (tab) {
      const container = tab.parentElement;
      const bounds = container.getBoundingClientRect();
      const tabBounds = tab.getBoundingClientRect();
      const delta =
        tabBounds.left < bounds.left
          ? tabBounds.left - bounds.left
          : Math.max(tabBounds.right - bounds.right, 0);
      if (delta) container.scrollBy({ left: delta, behavior: 'instant' });
    }
    this.#renderTrack();
    this.#restart();
  }

  #renderTrack() {
    const slide = this.#slides[this.#index];
    if (!slide) return;
    const center = this.#viewport.getBoundingClientRect().width / 2;
    this.#track.style.transform = `translate3d(${center - slide.offsetLeft - slide.offsetWidth / 2}px, 0, 0)`;
  }

  #resize = () => {
    if (!this.isConnected) return;
    this.#track.style.transition = 'none';
    if (this.#indicator) this.#indicator.style.transition = 'none';
    this.#select(this.#index);
    if (this.#frame !== undefined) cancelAnimationFrame(this.#frame);
    this.#frame = requestAnimationFrame(() => {
      this.#frame = undefined;
      this.#track.style.transition = '';
      if (this.#indicator) this.#indicator.style.transition = '';
    });
  };

  #stop = () => {
    clearInterval(this.#timer);
    this.#timer = undefined;
  };

  #restart = () => {
    this.#stop();
    if (!this.isConnected || this.dataset.autoplay !== 'true' || this.#slides.length < 2) return;
    if (
      this.#motion.matches ||
      document.hidden ||
      this.matches(':hover') ||
      this.contains(document.activeElement) ||
      this.#pointer !== undefined ||
      this.#editorSelected
    )
      return;
    this.#timer = setInterval(
      () => this.#select(this.#index + 1),
      Number(this.dataset.autoplayInterval) || 5000,
    );
  };

  #click = (event) => {
    if (!(event.target instanceof Element)) return;
    const tab = event.target.closest('[data-tab-index]');
    if (tab && this.contains(tab)) {
      this.#select(Number(tab.dataset.tabIndex));
    } else if (event.target.closest('[data-moya-previous]')) this.#select(this.#index - 1);
    else if (event.target.closest('[data-moya-next]')) this.#select(this.#index + 1);
  };

  #keydown = (event) => {
    const tab = event.target;
    if (!this.#tabs.includes(tab)) return;
    const direction = getComputedStyle(tab.parentElement).direction === 'rtl' ? -1 : 1;
    let index = Number(tab.dataset.tabIndex);
    if (event.key === 'ArrowRight') index += direction;
    else if (event.key === 'ArrowLeft') index -= direction;
    else if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = this.#tabs.length - 1;
    else return;
    event.preventDefault();
    this.#select(index);
    this.#tabs[this.#index]?.focus({ preventScroll: true });
  };

  #pointerDown = (event) => {
    if (
      !event.isPrimary ||
      event.button > 0 ||
      !this.#viewport.contains(event.target) ||
      event.target.closest('button, a, input, textarea, select')
    )
      return;
    this.#pointer = event.pointerId;
    this.#startX = event.clientX;
    this.#startY = event.clientY;
    this.#offset = 0;
    this.#dragging = false;
    this.#stop();
  };

  #pointerMove = (event) => {
    if (this.#pointer !== event.pointerId) return;
    const dx = event.clientX - this.#startX;
    if (!this.#dragging) {
      if (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(event.clientY - this.#startY)) return;
      this.#dragging = true;
      this.setAttribute('data-dragging', '');
      this.#track.style.transition = 'none';
      this.#viewport.setPointerCapture(event.pointerId);
    }
    this.#offset = dx;
    const slide = this.#slides[this.#index];
    const center = this.#viewport.getBoundingClientRect().width / 2;
    this.#track.style.transform = `translate3d(${center - slide.offsetLeft - slide.offsetWidth / 2 + dx}px, 0, 0)`;
  };

  #pointerUp = (event) => {
    if (this.#pointer !== event.pointerId) return;
    if (this.#viewport.hasPointerCapture(event.pointerId))
      this.#viewport.releasePointerCapture(event.pointerId);
    this.#pointer = undefined;
    const moved = this.#offset;
    const change =
      this.#dragging &&
      event.type !== 'pointercancel' &&
      Math.abs(moved) > Math.min(120, this.#viewport.clientWidth * 0.15);
    this.#dragging = false;
    this.#offset = 0;
    this.removeAttribute('data-dragging');
    this.#track.style.transition = '';
    this.#select(this.#index + (change ? (moved < 0 ? 1 : -1) : 0));
  };

  #selectEditorBlock = (event) => {
    if (!(event.target instanceof Element)) return;
    const index = this.#slides.indexOf(event.target.closest('[data-moya-ref="slides[]"]'));
    if (index < 0) return;
    this.#editorSelected = true;
    this.#select(index);
  };
}

if (!customElements.get('moya-tab-slider-component'))
  customElements.define('moya-tab-slider-component', MoyaTabSlider);
