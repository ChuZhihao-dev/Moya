class MoyaScenarios extends HTMLElement {
  connectedCallback() {
    if (this.controller) return;
    this.controller = new AbortController();
    this.items = [...this.querySelectorAll('[data-scenario]')];
    this.list = this.querySelector('[data-scenario-list]');
    this.animations = new Map();
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
    if (!this.items.length || !this.list) return;
    this.activeIndex = Math.min(
      this.items.length - 1,
      Math.max(0, Number(this.dataset.initial) - 1 || 0),
    );
    this.items.forEach((item, index) => {
      item.querySelector('summary').addEventListener(
        'click',
        (event) => {
          event.preventDefault();
          this.select(index);
        },
        { signal: this.controller.signal },
      );
      this.setItem(item, index === this.activeIndex, false);
    });
    this.addEventListener(
      'keydown',
      (event) => {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        const summary = event.target.closest('summary');
        const current = this.items.findIndex((item) => item.firstElementChild === summary);
        if (current < 0 || !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const index =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? this.items.length - 1
              : (current + (event.key === 'ArrowDown' ? 1 : -1) + this.items.length) %
                this.items.length;
        this.items[index].firstElementChild.focus();
      },
      { signal: this.controller.signal },
    );
    this.addEventListener(
      'shopify:block:select',
      (event) => {
        const index = this.items.findIndex(
          (item) => item === event.target || item.contains(event.target),
        );
        if (index >= 0) this.select(index);
      },
      { signal: this.controller.signal },
    );
    this.reduced.addEventListener('change', () => this.settle(), {
      signal: this.controller.signal,
    });
    this.resize = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      if (this.listWidth === width) return;
      this.listWidth = width;
      this.list.style.setProperty('--scenario-list-width', `${width}px`);
      this.settle();
    });
    this.resize.observe(this.list);
  }

  disconnectedCallback() {
    this.controller?.abort();
    this.controller = null;
    this.resize?.disconnect();
    this.settle();
  }

  select(index) {
    if (index === this.activeIndex || !this.items[index]) return;
    const previous = this.activeIndex;
    this.activeIndex = index;
    this.setItem(this.items[previous], false);
    this.setItem(this.items[index], true);
  }

  settle() {
    this.items?.forEach((item, index) => this.setItem(item, index === this.activeIndex, false));
  }

  setItem(item, expanded, animate = true) {
    const previous = this.animations.get(item);
    if (
      animate &&
      (previous?.expanded === expanded ||
        (!previous && item.classList.contains('is-active') === expanded))
    )
      return;
    const summary = item.querySelector('summary');
    const title = item.querySelector('[data-scenario-title]');
    const body = item.querySelector('[data-scenario-body]');
    const start = item.getBoundingClientRect();
    const titleStart = title.getBoundingClientRect().left;
    const opacity = item.open ? getComputedStyle(body).opacity : '0';
    previous?.animations.forEach((animation) => animation.cancel());
    this.animations.delete(item);
    item.classList.toggle('is-active', expanded);
    summary.setAttribute('aria-expanded', String(expanded));
    summary.setAttribute('aria-disabled', String(expanded));
    body.inert = !expanded;
    body.setAttribute('aria-hidden', String(!expanded));
    const finish = () => {
      item.open = expanded;
      item.classList.remove('is-animating');
      this.animations.delete(item);
    };
    if (!animate || this.dataset.motion === 'false' || this.reduced.matches || !item.animate) {
      finish();
      return;
    }
    item.open = true;
    const style = getComputedStyle(item);
    const padding =
      parseFloat(style.paddingTop) +
      parseFloat(style.paddingBottom) +
      parseFloat(style.borderTopWidth) +
      parseFloat(style.borderBottomWidth);
    const end = item.getBoundingClientRect();
    const endHeight = expanded ? end.height : summary.getBoundingClientRect().height + padding;
    const titleOffset = titleStart - title.getBoundingClientRect().left;
    const duration = Number(this.dataset.duration) || 360;
    item.classList.add('is-animating');
    const options = { duration, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' };
    const height = item.animate(
      [
        { height: `${start.height}px`, width: `${start.width}px` },
        { height: `${endHeight}px`, width: `${end.width}px` },
      ],
      options,
    );
    const fade = body.animate([{ opacity }, { opacity: expanded ? 1 : 0 }], {
      ...options,
      duration: duration * 0.8,
      fill: 'forwards',
    });
    const movement = title.animate(
      [{ translate: `${titleOffset}px 0` }, { translate: '0 0' }],
      options,
    );
    this.animations.set(item, { animations: [height, fade, movement], expanded });
    height.onfinish = () => {
      if (this.animations.get(item)?.animations[0] !== height) return;
      finish();
      fade.cancel();
    };
  }
}

if (!customElements.get('moya-scenarios')) customElements.define('moya-scenarios', MoyaScenarios);
