/** Full-width Moya carousel. Cleans up when the theme editor replaces a section. */
class MoyaHeroSlideshow extends HTMLElement {
  #track;
  #slides = [];
  #dots = [];
  #index = 0;
  #timer;
  #controller;
  #pointer;
  #startX = 0;
  #startY = 0;
  #offset = 0;
  #dragging = false;
  #editorSelected = false;
  #motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  #mobile = window.matchMedia('(max-width: 749px)');
  #videos = [];
  #observer;
  #inView = false;

  connectedCallback() {
    this.#controller?.abort();
    this.#controller = new AbortController();
    const { signal } = this.#controller;
    this.#track = this.querySelector('[data-moya-hero-track]');
    this.#slides = [...this.querySelectorAll('[data-moya-hero-slide]')];
    this.#dots = [...this.querySelectorAll('[data-moya-hero-dot]')];
    this.#videos = [...this.querySelectorAll('.moya-hero__mobile-video')];
    if (!this.#track || !this.#slides.length) return;
    this.addEventListener('click', this.#click, { signal });
    this.querySelectorAll('[data-moya-hero-previous], [data-moya-hero-next]').forEach((arrow) => {
      arrow.addEventListener(
        'click',
        () => {
          this.#select(this.#index + (arrow.hasAttribute('data-moya-hero-next') ? 1 : -1));
        },
        { signal },
      );
    });
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
    this.#motion.addEventListener('change', this.#syncMedia, { signal });
    this.#mobile.addEventListener('change', this.#syncMedia, { signal });
    document.addEventListener('visibilitychange', this.#syncMedia, { signal });
    this.#observer?.disconnect();
    this.#inView = false;
    if (this.#videos.length) {
      if (typeof IntersectionObserver === 'function') {
        this.#observer = new IntersectionObserver(
          ([entry]) => {
            this.#inView = entry.isIntersecting;
            this.#syncMedia();
          },
          { threshold: 0.01 },
        );
        this.#observer.observe(this);
      } else {
        this.#inView = true;
      }
    }
    this.#select(Math.min(this.#index, this.#slides.length - 1));
  }

  disconnectedCallback() {
    this.#controller?.abort();
    this.#stop();
    this.#observer?.disconnect();
    this.#inView = false;
    this.#videos.forEach((video) => video.pause());
    this.#pointer = undefined;
    this.#dragging = false;
    this.classList.remove('is-dragging');
  }

  #select(index) {
    this.#index = (index + this.#slides.length) % this.#slides.length;
    this.dataset.currentIndex = String(this.#index);
    this.dataset.navigationTone = this.#slides[this.#index].dataset.navigationTone || 'dark';
    this.#track.style.transform = `translateX(${-this.#index * 100}%)`;
    this.#slides.forEach((slide, position) => {
      const active = position === this.#index;
      slide.classList.toggle('is-active', active);
      slide.setAttribute('aria-hidden', String(!active));
      slide.toggleAttribute('inert', !active);
    });
    this.#dots.forEach((dot, position) => {
      const active = position === this.#index;
      dot.classList.toggle('is-active', active);
      dot.setAttribute('aria-current', String(active));
    });
    this.#syncMedia();
    this.#restart();
  }

  #syncMedia = () => {
    const canPlay =
      this.isConnected &&
      this.#mobile.matches &&
      this.#inView &&
      !document.hidden &&
      !this.#motion.matches;
    this.#videos.forEach((video) => {
      if (canPlay && video.closest('[data-moya-hero-slide]') === this.#slides[this.#index]) {
        if (video.paused) {
          video.muted = true;
          video.play()?.catch(() => {});
        }
      } else {
        video.pause();
      }
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
    const interval = Number(this.dataset.autoplayInterval) || 5000;
    this.#timer = setInterval(() => this.#select(this.#index + 1), interval);
  };

  #click = (event) => {
    if (!(event.target instanceof Element)) return;
    const dot = event.target instanceof Element && event.target.closest('[data-moya-hero-dot]');
    if (dot && this.contains(dot)) this.#select(Number(dot.dataset.index));
  };

  #keydown = (event) => {
    if (event.target instanceof Element && event.target.closest('input, textarea, select, a'))
      return;
    let next = this.#index;
    if (event.key === 'ArrowLeft') next -= 1;
    else if (event.key === 'ArrowRight') next += 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = this.#slides.length - 1;
    else return;
    event.preventDefault();
    this.#select(next);
    if (this.#dots.includes(event.target)) this.#dots[this.#index]?.focus();
  };

  #pointerDown = (event) => {
    if (
      !event.isPrimary ||
      event.button > 0 ||
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
      if (Math.abs(dx) < 6 || Math.abs(dx) <= Math.abs(event.clientY - this.#startY)) return;
      this.#dragging = true;
      this.classList.add('is-dragging');
      this.#track.style.transition = 'none';
      this.setPointerCapture(event.pointerId);
    }
    this.#offset = dx;
    this.#track.style.transform = `translateX(${-this.#index * this.clientWidth + dx}px)`;
  };

  #pointerUp = (event) => {
    if (event.pointerId !== this.#pointer) return;
    if (this.hasPointerCapture(event.pointerId)) this.releasePointerCapture(event.pointerId);
    this.#pointer = undefined;
    const moved = this.#offset;
    const change =
      this.#dragging &&
      event.type !== 'pointercancel' &&
      Math.abs(moved) > Math.min(80, this.clientWidth * 0.15);
    this.#dragging = false;
    this.#offset = 0;
    this.classList.remove('is-dragging');
    this.#track.style.transition = '';
    this.#select(this.#index + (change ? (moved < 0 ? 1 : -1) : 0));
  };

  #selectEditorBlock = (event) => {
    if (!(event.target instanceof Element)) return;
    const index = this.#slides.indexOf(event.target.closest('[data-moya-hero-slide]'));
    if (index < 0) return;
    this.#editorSelected = true;
    this.#select(index);
  };
}

if (!customElements.get('moya-hero-component'))
  customElements.define('moya-hero-component', MoyaHeroSlideshow);
