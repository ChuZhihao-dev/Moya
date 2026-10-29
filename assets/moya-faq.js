class MoyaFaq extends HTMLElement {
  connectedCallback() {
    if (this.controller) return;
    this.controller = new AbortController();
    this.animations = new Map();
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const options = { signal: this.controller.signal };
    this.querySelectorAll('[data-faq-item]').forEach((item) => {
      const summary = item.querySelector('summary');
      summary.setAttribute('aria-expanded', String(item.open));
      summary.addEventListener(
        'click',
        (event) => {
          event.preventDefault();
          const expanded = this.animations.get(item)?.expanded ?? item.open;
          this.setExpanded(item, !expanded);
        },
        options,
      );
      item.addEventListener(
        'toggle',
        () => {
          if (!this.animations.has(item)) summary.setAttribute('aria-expanded', String(item.open));
        },
        options,
      );
    });
    this.addEventListener(
      'shopify:block:select',
      (event) => {
        const item = event.target.closest('[data-faq-item]');
        if (item && this.contains(item)) this.setExpanded(item, true);
      },
      options,
    );
    this.reduced.addEventListener(
      'change',
      () => {
        for (const [item, state] of [...this.animations])
          this.setExpanded(item, state.expanded, false);
      },
      options,
    );
  }

  disconnectedCallback() {
    this.controller?.abort();
    this.controller = null;
    for (const [item, state] of this.animations ?? []) {
      state.height.cancel();
      state.fade?.cancel();
      item.open = state.expanded;
      item.classList.remove('is-animating', 'is-closing');
    }
    this.animations?.clear();
  }

  setExpanded(item, expanded, animate = true) {
    const previous = this.animations.get(item);
    if (previous?.expanded === expanded || (!previous && item.open === expanded)) {
      if (animate) return;
    }
    const summary = item.querySelector('summary');
    const answer = item.querySelector('[data-faq-answer]');
    const startHeight = item.getBoundingClientRect().height;
    const startOpacity = item.open ? getComputedStyle(answer).opacity : '0';
    previous?.height.cancel();
    previous?.fade?.cancel();
    this.animations.delete(item);
    summary.setAttribute('aria-expanded', String(expanded));

    if (expanded && this.dataset.single === 'true') {
      item
        .closest('[data-faq-group]')
        .querySelectorAll('[data-faq-item]')
        .forEach((other) => {
          if (other !== item && (this.animations.get(other)?.expanded ?? other.open)) {
            this.setExpanded(other, false, animate);
          }
        });
    }

    const finish = () => {
      item.open = expanded;
      item.classList.remove('is-animating', 'is-closing');
      this.animations.delete(item);
    };
    if (!animate || this.dataset.motion === 'false' || this.reduced.matches || !item.animate) {
      finish();
      return;
    }

    item.open = true;
    const style = getComputedStyle(item);
    const closedHeight =
      summary.getBoundingClientRect().height +
      parseFloat(style.paddingTop) +
      parseFloat(style.paddingBottom);
    const endHeight = expanded ? item.getBoundingClientRect().height : closedHeight;
    item.classList.add('is-animating');
    item.classList.toggle('is-closing', !expanded);
    const duration = Number(this.dataset.duration) || 320;
    const height = item.animate([{ height: `${startHeight}px` }, { height: `${endHeight}px` }], {
      duration,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    });
    const fade = answer.animate([{ opacity: startOpacity }, { opacity: expanded ? 1 : 0 }], {
      duration: duration * 0.8,
      easing: 'ease-out',
      fill: 'forwards',
    });
    this.animations.set(item, { height, fade, expanded });
    height.onfinish = () => {
      if (this.animations.get(item)?.height !== height) return;
      finish();
      fade.cancel();
    };
  }
}

if (!customElements.get('moya-faq')) customElements.define('moya-faq', MoyaFaq);
