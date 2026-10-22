/** Scroll-driven Moya story, using native custom elements in Impact. */
class MoyaMeet extends HTMLElement {
  #scenes = [];
  #sticky;
  #fill;
  #icon;
  #progress;
  #frame = null;
  #activeIndex = -1;
  #observer;
  #controller;
  #motion = window.matchMedia('(prefers-reduced-motion: reduce)');

  connectedCallback() {
    this.#controller?.abort();
    this.#controller = new AbortController();
    const { signal } = this.#controller;
    this.#scenes = [...this.querySelectorAll('[data-moya-ref="scenes[]"]')];
    this.#sticky = this.querySelector('[data-moya-ref="sticky"]');
    this.#fill = this.querySelector('[data-moya-ref="fill"]');
    this.#icon = this.querySelector('[data-moya-ref="icon"]');
    this.#progress = this.querySelector('[data-moya-ref="progress"]');
    if (!this.#sticky || !this.#scenes.length) return;

    document.addEventListener('scroll', this.#schedule, { capture: true, passive: true, signal });
    window.addEventListener('resize', this.#schedule, { signal });
    this.#motion.addEventListener('change', this.#configure, { signal });
    this.addEventListener('shopify:block:select', this.#selectEditorScene, { signal });
    this.#observer = new IntersectionObserver(([entry]) => {
      this.classList.toggle('is-inview', entry.isIntersecting);
    });
    this.#observer.observe(this);
    this.#configure();
  }

  disconnectedCallback() {
    this.#controller?.abort();
    this.#observer?.disconnect();
    if (this.#frame !== null) cancelAnimationFrame(this.#frame);
    this.#frame = null;
    this.classList.remove('is-enhanced', 'is-inview');
  }

  #configure = () => {
    const enhanced = !this.#motion.matches && this.#scenes.length > 1;
    this.classList.toggle('is-enhanced', enhanced);
    this.#activeIndex = -1;
    for (const scene of this.#scenes) {
      scene.style.opacity = '';
      scene.removeAttribute('inert');
      scene.removeAttribute('aria-hidden');
      scene.classList.remove('is-active');
    }
    if (enhanced) this.#update();
  };

  #schedule = () => {
    if (this.#frame !== null || !this.classList.contains('is-enhanced')) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = null;
      this.#update();
    });
  };

  #update() {
    if (!this.isConnected || !this.classList.contains('is-enhanced')) return;
    const rect = this.getBoundingClientRect();
    const viewport = this.#sticky.offsetHeight || window.innerHeight || 1;
    const distance = rect.height - viewport;
    const progress = distance > 0 ? Math.min(Math.max(-rect.top / distance, 0), 1) : 0;
    const position = progress * (this.#scenes.length - 1);
    for (const [index, scene] of this.#scenes.entries()) {
      scene.style.opacity = (index === 0 ? 1 : Math.min(Math.max(position - index + 1, 0), 1)).toFixed(4);
    }
    if (this.#fill) this.#fill.style.height = `${progress * 100}%`;
    if (this.#icon && this.#progress) {
      const travel = Math.max(this.#progress.offsetHeight - this.#icon.offsetHeight, 0);
      this.#icon.style.transform = `translate3d(0, ${progress * travel}px, 0)`;
    }
    const activeIndex = Math.round(position);
    if (activeIndex === this.#activeIndex) return;
    this.#activeIndex = activeIndex;
    for (const [index, scene] of this.#scenes.entries()) {
      const active = index === activeIndex;
      scene.classList.toggle('is-active', active);
      scene.toggleAttribute('inert', !active);
      scene.setAttribute('aria-hidden', String(!active));
    }
  }

  #selectEditorScene = (event) => {
    if (!this.classList.contains('is-enhanced') || !(event.target instanceof Element)) return;
    const index = this.#scenes.indexOf(event.target.closest('[data-moya-ref="scenes[]"]'));
    if (index < 0) return;
    const distance = this.offsetHeight - this.#sticky.offsetHeight;
    window.scrollTo({ top: window.scrollY + this.getBoundingClientRect().top + distance * index / (this.#scenes.length - 1), behavior: 'instant' });
    this.#update();
  };
}

if (!customElements.get('moya-meet-component')) customElements.define('moya-meet-component', MoyaMeet);
