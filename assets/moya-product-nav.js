const SECTION_ELEMENTS = {
  'selling-points': 'moya-selling-points',
  scenarios: 'moya-scenarios',
  materials: 'moya-materials',
  'how-carousel': 'moya-how-carousel',
  specifications: 'moya-specifications',
  faq: 'moya-faq',
  'product-details': 'moya-product-details',
};

class MoyaProductNav extends HTMLElement {
  connectedCallback() {
    if (this.controller) return;
    this.controller = new AbortController();
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
    this.wrapper = this.closest('.shopify-section');
    this.scroller = this.querySelector('.moya-product-nav__scroller');
    this.replacedHeaders = [
      document.querySelector('store-header')?.closest('.shopify-section'),
      ...document.querySelectorAll('.shopify-section--announcement-bar'),
    ]
      .filter(Boolean)
      .map((element) => ({
        element,
        inert: element.inert,
        ariaHidden: element.getAttribute('aria-hidden'),
      }));
    this.replacedHeaders.forEach(({ element }) =>
      element.setAttribute('data-moya-header-replaced', ''),
    );
    const options = { signal: this.controller.signal };
    this.resolveTargets();
    this.addEventListener(
      'click',
      (event) => {
        const link = event.target.closest('.moya-product-nav__link');
        if (
          !link ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        const entry = this.entries.find((item) => item.link === link);
        if (!entry) return;
        event.preventDefault();
        // The theme also delegates hash links; this component owns its offset-aware scroll.
        event.stopPropagation();
        this.navigate(entry, true);
      },
      options,
    );
    window.addEventListener('scroll', () => this.scheduleUpdate(), { ...options, passive: true });
    window.addEventListener(
      'resize',
      () => {
        this.revealActive = true;
        this.scheduleUpdate();
      },
      options,
    );
    const cancel = () => {
      this.userInteracted = true;
      this.cancelNavigation();
    };
    window.addEventListener('wheel', cancel, { ...options, passive: true });
    window.addEventListener('touchstart', cancel, { ...options, passive: true });
    window.addEventListener('pointerdown', cancel, { ...options, passive: true });
    window.addEventListener(
      'keydown',
      (event) => {
        if (
          ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', 'Escape', ' '].includes(
            event.key,
          )
        )
          cancel();
      },
      options,
    );
    window.addEventListener('hashchange', () => this.followHash(), options);
    window.addEventListener('popstate', () => this.followHash(), options);
    this.reduced.addEventListener('change', cancel, options);
    this.addEventListener(
      'shopify:block:select',
      (event) => {
        const link = event.target.querySelector('.moya-product-nav__link');
        const entry = this.entries.find((item) => item.link === link);
        if (entry) this.navigate(entry, false);
      },
      options,
    );
    for (const name of [
      'shopify:section:load',
      'shopify:section:unload',
      'shopify:section:reorder',
    ]) {
      document.addEventListener(name, () => this.resolveTargets(), options);
    }
    this.observer = new ResizeObserver(() => {
      this.revealActive = true;
      this.scheduleUpdate();
    });
    this.observer.observe(document.querySelector('main') || document.body);
    this.observer.observe(this);
    document.fonts?.ready.then(() => {
      if (this.isConnected) this.scheduleUpdate();
    });
    this.scheduleUpdate();
    if (location.hash) this.followHash();
    window.addEventListener(
      'load',
      () => {
        if (!this.userInteracted && location.hash) this.followHash();
      },
      { ...options, once: true },
    );
  }

  disconnectedCallback() {
    this.controller?.abort();
    this.controller = null;
    this.observer?.disconnect();
    this.cancelNavigation();
    cancelAnimationFrame(this.updateFrame);
    this.updateFrame = null;
    this.active = null;
    this.setHeaderReplaced(false);
    this.replacedHeaders?.forEach(({ element }) =>
      element.removeAttribute('data-moya-header-replaced'),
    );
  }

  resolveTargets() {
    this.entries = [];
    this.querySelectorAll('.moya-product-nav__link').forEach((link) => {
      let target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
      const selector = SECTION_ELEMENTS[link.dataset.sectionKind];
      if (!target && selector)
        target = document.querySelector(`main ${selector}`)?.closest('.shopify-section');
      link.closest('li').hidden = !target;
      if (!target || target === this.wrapper) return;
      link.setAttribute('href', `#${target.id}`);
      this.entries.push({ link, target });
    });
    this.hidden = this.entries.length === 0;
    this.scheduleUpdate();
  }

  setHeaderReplaced(replaced) {
    if (this.headerReplaced === replaced) return;
    this.headerReplaced = replaced;
    document.documentElement.classList.toggle('moya-product-nav-takeover', replaced);
    this.replacedHeaders.forEach(({ element, inert, ariaHidden }) => {
      element.inert = replaced || inert;
      if (replaced) element.setAttribute('aria-hidden', 'true');
      else if (ariaHidden === null) element.removeAttribute('aria-hidden');
      else element.setAttribute('aria-hidden', ariaHidden);
    });
  }

  updateHeader() {
    const rect = this.wrapper.getBoundingClientRect();
    // Sticky geometry is stable in both scroll directions; hiding the header never
    // changes document flow, so the handoff cannot shift its own trigger point.
    this.setHeaderReplaced(!this.hidden && rect.height > 0 && rect.top <= 0 && rect.bottom > 0);
  }

  offset(target) {
    // Optional overview/custom anchors above the navigation still use the site header.
    if (target && target.compareDocumentPosition(this.wrapper) & Node.DOCUMENT_POSITION_FOLLOWING) {
      return this.replacedHeaders.reduce((height, { element }) => {
        const position = getComputedStyle(element).position;
        return (
          height +
          (['sticky', 'fixed'].includes(position) ? element.getBoundingClientRect().height : 0)
        );
      }, 20);
    }
    return this.getBoundingClientRect().height + 20;
  }

  scheduleUpdate() {
    if (this.updateFrame) return;
    this.updateFrame = requestAnimationFrame(() => {
      this.updateFrame = null;
      this.updateHeader();
      this.updateActive();
    });
  }

  updateActive() {
    if (!this.entries.length || this.navigation) return;
    const sorted = this.entries
      .filter(({ target }) => target.isConnected && target.getBoundingClientRect().height > 0)
      .sort((a, b) => a.target.getBoundingClientRect().top - b.target.getBoundingClientRect().top);
    if (!sorted.length) return;
    const line = this.offset() + 2;
    let current = sorted[0];
    for (const entry of sorted) {
      if (entry.target.getBoundingClientRect().top <= line) current = entry;
    }
    if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 3)
      current = sorted.at(-1);
    this.setActive(current);
  }

  setActive(entry) {
    if (this.active === entry.link && !this.revealActive) return;
    this.revealActive = false;
    this.active = entry.link;
    this.entries.forEach(({ link }) => {
      if (link === entry.link) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    const item = entry.link.getBoundingClientRect();
    const viewport = this.scroller.getBoundingClientRect();
    // Scroll only this horizontal strip; scrollIntoView would also move the page.
    if (item.left < viewport.left || item.right > viewport.right) {
      this.scroller.scrollTo({
        left:
          this.scroller.scrollLeft + item.left - viewport.left - (viewport.width - item.width) / 2,
        behavior: this.reduced.matches || this.dataset.motion === 'false' ? 'auto' : 'smooth',
      });
    }
  }

  followHash() {
    const entry = this.entries.find(({ link }) => link.hash === location.hash);
    if (entry) this.navigate(entry, false, false);
  }

  cancelNavigation() {
    cancelAnimationFrame(this.navigationFrame);
    this.navigation = null;
    if (this.isConnected) this.scheduleUpdate();
  }

  navigate(entry, updateHistory, animate = true) {
    this.cancelNavigation();
    this.navigation = entry;
    this.setActive(entry);
    if (updateHistory && location.hash !== entry.link.hash)
      history.pushState(null, '', entry.link.hash);
    const start = window.scrollY;
    const duration =
      animate && this.dataset.motion !== 'false' && !this.reduced.matches
        ? Number(this.dataset.duration) || 600
        : 0;
    const began = performance.now();
    const step = (now) => {
      if (this.navigation !== entry || !entry.target.isConnected) return;
      const progress = duration ? Math.min(1, (now - began) / duration) : 1;
      const eased = 1 - (1 - progress) ** 4;
      // Re-measure so lazy content and the theme's hide-on-scroll header cannot misalign the anchor.
      const desired =
        window.scrollY + entry.target.getBoundingClientRect().top - this.offset(entry.target);
      const end = Math.max(
        0,
        Math.min(desired, document.documentElement.scrollHeight - innerHeight),
      );
      window.scrollTo({ top: start + (end - start) * eased, behavior: 'instant' });
      if (progress < 1) this.navigationFrame = requestAnimationFrame(step);
      else {
        this.navigation = null;
        this.revealActive = true;
        this.scheduleUpdate();
      }
    };
    this.navigationFrame = requestAnimationFrame(step);
  }
}

if (!customElements.get('moya-product-nav'))
  customElements.define('moya-product-nav', MoyaProductNav);
