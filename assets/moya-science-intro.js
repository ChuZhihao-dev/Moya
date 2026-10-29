import { createStudyRenderer, createTextileRenderer } from './moya-science-renderers.js';
const clamp = (n, min = 0, max = 1) => Math.max(min, Math.min(max, n));
const scienceState = (progress, count) => ({
  intro: 1 - clamp((progress - 0.08) / 0.12),
  deck: clamp((progress - 0.16) / 0.1),
  index: Math.min(count - 1, Math.floor(clamp((progress - 0.22) / 0.78) * count)),
});
class MoyaScienceIntro extends HTMLElement {
  connectedCallback() {
    this.controller?.abort();
    this.observer?.disconnect();
    this.resizeObserver?.disconnect();
    cancelAnimationFrame(this.frame);
    cancelAnimationFrame(this.scrollFrame);
    this.controller = new AbortController();
    const { signal } = this.controller;
    this.stage = this.querySelector('.moya-science__stage');
    this.intro = this.querySelector('.moya-science__content');
    this.deck = this.querySelector('.moya-science__deck');
    this.studies = [...this.querySelectorAll('[data-study]')];
    this.backdrop = this.querySelector('.moya-science__backdrop');
    if (!this.stage || !this.intro || !this.deck) return;
    this.motion = matchMedia('(prefers-reduced-motion: reduce)');
    this.clock = 0;
    this.active = -1;
    this.visible = false;
    this.lastFrame = 0;
    this.scrollFrame = 0;
    this.starts = this.studies.map(() => 0);
    this.renderers = this.studies.map(createStudyRenderer);
    this.textile = createTextileRenderer();
    this.previous = this.querySelector('[data-previous]');
    this.next = this.querySelector('[data-next]');
    this.studies.forEach((study, i) => {
      const kind = study.dataset.study;
      const labels =
        kind === 'touch'
          ? ['Contact Pressure', 'Contact Area', 'Contact Duration']
          : kind === 'safety'
            ? ['Touch Force', 'Response Lag', 'Rhythm Alignment']
            : ['Breathing Rhythm', 'Wind-down Progress', 'Session Time'];
      const units =
        kind === 'touch'
          ? ['kPa', 'cm²', 's']
          : kind === 'safety'
            ? ['N', 'ms', '%']
            : ['/min', '%', ''];
      study.querySelectorAll('[data-label]').forEach((el, n) => {
        el.textContent = labels[n];
      });
      study.querySelectorAll('[data-unit]').forEach((el, n) => {
        el.textContent = units[n];
      });
      study.querySelector('[data-pulse]')?.addEventListener(
        'click',
        (event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const x = event.detail ? clamp((event.clientX - rect.left) / rect.width) : 0.5;
          const y = event.detail ? clamp((event.clientY - rect.top) / rect.height) : 0.53;
          this.renderers[i].pulse(x, y, this.clock - this.starts[i]);
          this.drawStudy(i);
        },
        { signal },
      );
      study.querySelectorAll('[data-phase]').forEach((button) =>
        button.addEventListener(
          'click',
          () => {
            this.renderers[i].seek(Number(button.dataset.phase), this.clock - this.starts[i]);
            this.drawStudy(i);
          },
          { signal },
        ),
      );
    });
    this.querySelectorAll('[data-slide]').forEach((button) =>
      button.addEventListener('click', () => this.go(Number(button.dataset.slide)), { signal }),
    );
    this.previous?.addEventListener('click', () => this.go(this.active - 1), { signal });
    this.next?.addEventListener('click', () => this.go(this.active + 1), { signal });
    this.addEventListener(
      'keydown',
      (event) => {
        if (
          !this.enhanced ||
          !['ArrowLeft', 'ArrowRight'].includes(event.key) ||
          !event.target.closest('.moya-science__navigation')
        )
          return;
        event.preventDefault();
        const index = clamp(
          this.active + (event.key === 'ArrowRight' ? 1 : -1),
          0,
          this.studies.length - 1,
        );
        this.querySelector(`[data-slide="${index}"]`)?.focus({ preventScroll: true });
        this.go(index);
      },
      { signal },
    );
    this.addEventListener(
      'shopify:block:select',
      (event) => {
        const i = this.studies.indexOf(event.target.closest('[data-study]'));
        if (i >= 0) this.go(i);
      },
      { signal },
    );
    this.motion.addEventListener('change', () => this.resize(), { signal });
    window.addEventListener('scroll', () => this.queueUpdate(), { passive: true, signal });
    window.addEventListener('resize', () => this.resize(), { passive: true, signal });
    document.addEventListener('visibilitychange', () => this.sync(), { signal });
    this.observer = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      this.sync();
    });
    this.observer.observe(this.stage);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.stage);
    this.resize();
  }
  disconnectedCallback() {
    this.controller?.abort();
    this.observer?.disconnect();
    this.resizeObserver?.disconnect();
    cancelAnimationFrame(this.frame);
    cancelAnimationFrame(this.scrollFrame);
    this.frame = this.scrollFrame = 0;
  }
  resize() {
    const enhanced = this.studies.length > 0 && !this.motion.matches;
    if (enhanced !== this.enhanced) this.active = -1;
    this.enhanced = enhanced;
    this.classList.toggle('is-enhanced', this.enhanced);
    this.top = parseFloat(getComputedStyle(this.stage).top) || 0;
    const custom =
      this.dataset.backgroundImage === 'true' ||
      (innerWidth < 750 && this.dataset.mobileBackgroundImage === 'true');
    this.animateBackground = this.dataset.animation === 'true' && !custom;
    this.canvases = [...this.querySelectorAll('canvas')].map((canvas) => {
      const rect = canvas.getBoundingClientRect(),
        ratio = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      const ctx = canvas.getContext('2d');
      ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
      return { canvas, ctx, w: rect.width, h: rect.height };
    });
    this.backdrop.classList.toggle(
      'is-live',
      this.animateBackground && Boolean(this.canvases[0]?.ctx),
    );
    this.update();
    this.studies.forEach((_, i) => this.drawStudy(i));
    this.drawParticles();
    this.sync();
  }
  queueUpdate() {
    if (this.scrollFrame) return;
    this.scrollFrame = requestAnimationFrame(() => {
      this.scrollFrame = 0;
      this.update();
    });
  }
  update() {
    if (!this.enhanced) {
      this.intro.style.opacity = '';
      this.intro.inert = false;
      this.intro.removeAttribute('aria-hidden');
      this.deck.style.opacity = '';
      this.deck.style.pointerEvents = '';
      this.deck.inert = false;
      this.classList.remove('is-showing-study');
      this.studies.forEach((study) => {
        study.inert = false;
        study.removeAttribute('aria-hidden');
      });
      return;
    }
    const rect = this.getBoundingClientRect();
    const progress = clamp(
      (this.top - rect.top) / Math.max(1, this.offsetHeight - this.stage.offsetHeight),
    );
    const state = scienceState(progress, this.studies.length);
    this.intro.style.opacity = state.intro;
    this.intro.inert = state.intro < 0.5;
    this.intro.setAttribute('aria-hidden', String(state.intro < 0.5));
    this.deck.style.opacity = state.deck;
    this.deck.inert = state.deck < 0.5;
    this.deck.style.pointerEvents = state.deck < 0.5 ? 'none' : '';
    this.classList.toggle('is-showing-study', state.deck > 0.01);
    if (this.active !== state.index) {
      this.active = state.index;
      this.starts[this.active] = this.clock;
      this.renderers[this.active].reset();
      this.studies.forEach((study, i) => {
        study.classList.toggle('is-active', i === this.active);
        study.inert = i !== this.active;
        study.setAttribute('aria-hidden', String(i !== this.active));
      });
      this.querySelectorAll('[data-slide]').forEach((button, i) =>
        button.setAttribute('aria-current', String(i === this.active)),
      );
      if (this.previous) this.previous.disabled = this.active === 0;
      if (this.next) this.next.disabled = this.active === this.studies.length - 1;
      this.drawStudy(this.active);
    }
  }
  go(index) {
    if (!this.studies.length) return;
    index = clamp(index, 0, this.studies.length - 1);
    if (!this.enhanced) {
      this.studies[index].scrollIntoView({ block: 'start', behavior: 'instant' });
      return;
    }
    const progress = 0.22 + ((index + 0.5) / this.studies.length) * 0.78;
    window.scrollTo({
      top:
        scrollY +
        this.getBoundingClientRect().top -
        this.top +
        progress * (this.offsetHeight - this.stage.offsetHeight),
      behavior: 'smooth',
    });
  }
  sync() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.lastFrame = 0;
    if (this.visible && !document.hidden && !this.motion.matches)
      this.frame = requestAnimationFrame((time) => this.tick(time));
  }
  tick(time) {
    if (!this.isConnected) return;
    if (!this.lastFrame) this.lastFrame = time;
    const elapsed = time - this.lastFrame;
    if (elapsed >= 1000 / 30) {
      this.clock += Math.min(elapsed, 100) / 1000;
      this.lastFrame = time;
      this.drawParticles();
      if (this.enhanced) {
        if (this.active >= 0 && !this.deck.inert) this.drawStudy(this.active);
      } else this.studies.forEach((_, i) => this.drawStudy(i));
    }
    this.frame = requestAnimationFrame((t) => this.tick(t));
  }
  drawParticles() {
    const field = this.canvases?.[0];
    if (!field?.ctx || !this.animateBackground) return;
    this.textile(
      field.ctx,
      field.w,
      field.h,
      this.motion.matches ? 0 : this.clock,
      this.motion.matches,
    );
  }
  drawStudy(index) {
    const field = this.canvases?.[index + 1];
    if (!field?.ctx) return;
    this.renderers[index].draw(
      field.ctx,
      field.w,
      field.h,
      this.clock - this.starts[index],
      this.motion.matches,
    );
    this.studies[index].querySelector('.moya-science__visual').classList.add('is-ready');
  }
}
if (!customElements.get('moya-science-intro'))
  customElements.define('moya-science-intro', MoyaScienceIntro);
