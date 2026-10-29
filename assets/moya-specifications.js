class MoyaSpecifications extends HTMLElement {
  connectedCallback() {
    if (this.controller) return;
    this.controller = new AbortController();
    this.animations = new Map();
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const options = { signal: this.controller.signal };
    this.querySelectorAll('[data-specs-group]').forEach((item) => {
      const summary = item.querySelector('summary');
      summary.setAttribute('aria-expanded', String(item.open));
      summary.addEventListener(
        'click',
        (event) => {
          event.preventDefault();
          this.setExpanded(item, !(this.animations.get(item)?.expanded ?? item.open));
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
        const item = event.target.closest('[data-specs-group]');
        if (item && this.contains(item)) this.setExpanded(item, true);
      },
      options,
    );
    this.reduced.addEventListener('change', () => this.finishAnimations(), options);
    // Keep animation endpoints correct when wrapping changes or editor content updates.
    const measurements = new WeakMap();
    this.observer = new ResizeObserver((entries) => {
      let changed = false;
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (!width || !height) continue;
        const previous = measurements.get(entry.target);
        if (
          previous &&
          (Math.abs(previous.width - width) > 1 || Math.abs(previous.height - height) > 1)
        )
          changed = true;
        measurements.set(entry.target, { width, height });
      }
      if (changed) this.finishAnimations();
    });
    this.querySelectorAll('[data-specs-body], summary').forEach((body) =>
      this.observer.observe(body),
    );
  }

  disconnectedCallback() {
    this.controller?.abort();
    this.controller = null;
    this.observer?.disconnect();
    this.finishAnimations();
  }

  finishAnimations() {
    for (const [item, state] of this.animations ?? []) {
      this.setExpanded(item, state.expanded, false);
    }
  }

  setExpanded(item, expanded, animate = true) {
    const previous = this.animations.get(item);
    if (animate && (previous?.expanded ?? item.open) === expanded) return;
    const summary = item.querySelector('summary');
    const body = item.querySelector('[data-specs-body]');
    const startHeight = item.getBoundingClientRect().height;
    const startOpacity = item.open ? getComputedStyle(body).opacity : '0';
    previous?.height.cancel();
    previous?.fade.cancel();
    this.animations.delete(item);
    summary.setAttribute('aria-expanded', String(expanded));
    body.inert = !expanded;
    body.setAttribute('aria-hidden', String(!expanded));
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
    const endHeight = expanded
      ? item.getBoundingClientRect().height
      : summary.getBoundingClientRect().height;
    item.classList.add('is-animating');
    item.classList.toggle('is-closing', !expanded);
    const duration = Number(this.dataset.duration) || 360;
    const height = item.animate([{ height: `${startHeight}px` }, { height: `${endHeight}px` }], {
      duration,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    });
    const fade = body.animate([{ opacity: startOpacity }, { opacity: expanded ? 1 : 0 }], {
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

if (!customElements.get('moya-specifications')) {
  customElements.define('moya-specifications', MoyaSpecifications);
}
