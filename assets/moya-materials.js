class MoyaMaterials extends HTMLElement {
  connectedCallback() {
    if (this.controller) return;
    this.controller = new AbortController();
    this.cards = [...this.querySelectorAll('[data-material-card]')];
    this.selectors = [...this.querySelectorAll('[data-material-select]')];
    this.status = this.querySelector('[data-material-status]');
    this.motion = matchMedia('(prefers-reduced-motion: reduce)');
    this.hover = matchMedia('(hover: hover) and (pointer: fine)');
    this.animations = [];
    if (!this.cards.length) return;
    this.dataset.enhanced = '';
    const on = (node, name, fn) =>
      node.addEventListener(name, fn, { signal: this.controller.signal });
    this.cards.forEach((card, index) => {
      on(card, 'pointerenter', () => {
        if (this.hover.matches) this.select(index);
      });
      on(this.selectors[index], 'focus', () => this.select(index));
      on(this.selectors[index], 'click', () => this.select(index, true));
    });
    on(this, 'keydown', (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const button = event.target.closest('[data-material-select]');
      if (!button || !this.contains(button)) return;
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key))
        return;
      event.preventDefault();
      const collection = this.selectors;
      const columns = Number(getComputedStyle(this).getPropertyValue('--material-columns')) || 2;
      const current = collection.indexOf(button);
      const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns };
      const index =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? this.cards.length - 1
            : (current + offsets[event.key] + this.cards.length) % this.cards.length;
      collection[index].focus({ preventScroll: true });
      this.select(index, true);
    });
    on(this, 'shopify:block:select', (event) => {
      const index = this.cards.findIndex(
        (card) => card === event.target || card.contains(event.target),
      );
      if (index >= 0) this.select(index);
    });
    on(this.motion, 'change', () => this.finishIntro());
    this.select(0);
    if (!this.hasRevealed && this.dataset.motion !== 'false' && !this.motion.matches) {
      this.observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          this.observer.disconnect();
          this.reveal();
        },
        { threshold: 0.15 },
      );
      this.observer.observe(this);
    }
  }

  disconnectedCallback() {
    this.controller?.abort();
    this.controller = null;
    this.finishIntro();
    delete this.dataset.enhanced;
  }

  select(index, announce = false) {
    const card = this.cards[index];
    if (!card) return;
    this.cards.forEach((item, i) => item.classList.toggle('is-active', i === index));
    this.selectors.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
    if (announce && this.status) this.status.textContent = card.dataset.title;
  }

  reveal() {
    if (this.hasRevealed || this.dataset.motion === 'false' || this.motion.matches) return;
    this.hasRevealed = true;
    const duration = Number(this.dataset.duration) || 640;
    const elements = [
      { element: this.querySelector('.moya-materials__heading'), delay: 0, distance: 16 },
      { element: this.querySelector('.moya-materials__scene'), delay: 90, distance: 24 },
      ...this.cards.map((element, index) => ({ element, delay: 180 + index * 70, distance: 16 })),
    ].filter(({ element }) => element && typeof element.animate === 'function');
    this.animations = elements.map(({ element, delay, distance }) =>
      element.animate(
        [
          // Individual translate composes with the card's hover/press transform.
          { opacity: 0, translate: `0 ${distance}px` },
          { opacity: 1, translate: '0 0' },
        ],
        {
          duration,
          delay,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          fill: 'backwards',
        },
      ),
    );
  }

  finishIntro() {
    this.observer?.disconnect();
    this.animations?.forEach((animation) => animation.cancel());
    this.animations = [];
  }
}

if (!customElements.get('moya-materials')) customElements.define('moya-materials', MoyaMaterials);
