/** Responsive testimonial collage with a section-local lifecycle. */
class MoyaCustomerVoices extends HTMLElement {
  #controller;
  #resizeObserver;
  #introObserver;
  #timer;
  #frame;
  #cards = [];
  #collage;
  #inner;
  #quote;
  #name;
  #motion = window.matchMedia('(prefers-reduced-motion: reduce)');

  connectedCallback() {
    this.#controller?.abort();
    this.#controller = new AbortController();
    const { signal } = this.#controller;
    this.#collage = this.querySelector('[data-cv-collage]');
    this.#inner = this.querySelector('[data-cv-collage-inner]');
    this.#quote = this.querySelector('[data-cv-quote-text]');
    this.#name = this.querySelector('[data-cv-quote-name]');
    this.#cards = [...this.querySelectorAll('[data-cv-card]')];
    if (!this.#collage || !this.#inner) return;
    for (const card of this.#cards) {
      card.addEventListener('mouseenter', () => this.#show(card), { signal });
      card.addEventListener('focus', () => this.#show(card), { signal });
      card.addEventListener('click', () => this.#show(card), { signal });
    }
    this.#collage.addEventListener('mouseleave', () => {
      if (!this.#cards.includes(document.activeElement)) this.#show(this.#cards[0]);
    }, { signal });
    this.addEventListener('shopify:block:select', (event) => {
      const card = event.target instanceof Element && event.target.closest('[data-cv-card]');
      if (this.#cards.includes(card)) { this.#finishIntro(); this.#show(card); }
    }, { signal });
    this.#motion.addEventListener('change', this.#finishIntro, { signal });
    this.#resizeObserver = new ResizeObserver(this.#resize);
    this.#resizeObserver.observe(this.#collage);
    this.#resize();
    this.#show(this.#cards[0]);
    this.#setupIntro();
  }

  disconnectedCallback() {
    this.#controller?.abort();
    this.#resizeObserver?.disconnect();
    this.#finishIntro();
  }

  #resize = () => {
    if (!this.isConnected) return;
    const scale = this.#collage.clientWidth / 1232;
    this.#inner.style.transform = `scale(${scale})`;
    this.#collage.style.height = `${445 * scale}px`;
  };

  #show(card) {
    if (!card || !this.#quote || !this.#name) return;
    this.#quote.textContent = `“${card.dataset.cvQuote || ''}”`;
    this.#name.textContent = card.dataset.cvName ? `- ${card.dataset.cvName}` : '';
    for (const item of this.#cards) {
      item.classList.toggle('is-active', item === card);
      item.setAttribute('aria-pressed', String(item === card));
    }
  }

  #setupIntro() {
    if (this.dataset.cvIntro !== 'true' || this.#motion.matches || !this.#cards.length) return;
    this.#cards.forEach((card, index) => {
      const offset = index - (this.#cards.length - 1) / 2;
      const x = 616 - card.offsetLeft - card.offsetWidth / 2 + offset * 4;
      const y = 222.5 - card.offsetTop - card.offsetHeight / 2;
      card.style.setProperty('--cv-stack-x', `${x}px`);
      card.style.setProperty('--cv-stack-y', `${y}px`);
      card.style.setProperty('--cv-fan-rot', `${offset * 3}deg`);
      card.style.setProperty('--cv-delay', '150ms');
      card.style.setProperty('--cv-tag-delay', '410ms');
    });
    this.classList.add('is-stacked');
    this.#introObserver = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      this.#introObserver.disconnect();
      this.classList.add('is-animating');
      this.#frame = requestAnimationFrame(() => {
        this.#frame = requestAnimationFrame(() => {
          this.#frame = undefined;
          this.classList.remove('is-stacked');
        });
      });
      this.#timer = setTimeout(this.#finishIntro, 1120);
    }, { threshold: 0.3 });
    this.#introObserver.observe(this.#collage);
  }

  #finishIntro = () => {
    this.#introObserver?.disconnect();
    clearTimeout(this.#timer);
    if (this.#frame !== undefined) cancelAnimationFrame(this.#frame);
    this.#frame = undefined;
    this.classList.remove('is-stacked', 'is-animating');
  };
}

if (!customElements.get('moya-customer-voices-component')) customElements.define('moya-customer-voices-component', MoyaCustomerVoices);
