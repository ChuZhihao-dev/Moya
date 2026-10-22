/* Scroll-driven science chapter. Values illustrate the animation, not sensor readings. */
const clamp = (n, min = 0, max = 1) => Math.max(min, Math.min(max, n));
const scienceState = (progress, count) => ({
  intro: 1 - clamp((progress - .08) / .12),
  deck: clamp((progress - .16) / .1),
  index: Math.min(count - 1, Math.floor(clamp((progress - .22) / .78) * count))
});
class MoyaScienceIntro extends HTMLElement {
  connectedCallback() {
    this.controller?.abort();
    this.controller = new AbortController();
    const { signal } = this.controller;
    this.stage = this.querySelector('.moya-science__stage');
    this.intro = this.querySelector('.moya-science__content');
    this.deck = this.querySelector('.moya-science__deck');
    this.studies = [...this.querySelectorAll('[data-study]')];
    this.motion = matchMedia('(prefers-reduced-motion: reduce)');
    this.clock = 0; this.active = -1; this.visible = false; this.lastFrame = 0;
    this.states = this.studies.map(() => ({ start: 0, x: .5, y: .5, phase: 0 }));
    this.previous = this.querySelector('[data-previous]');
    this.next = this.querySelector('[data-next]');
    this.studies.forEach((study, i) => {
      const kind = study.dataset.study;
      const labels = kind === 'touch' ? ['Peak Pressure', 'Contact Area', 'Contact Duration'] : kind === 'safety' ? ['Response Force', 'Response Lag', 'Alignment'] : ['Breathing Rhythm', 'Settling Progress', 'Session'];
      const units = kind === 'touch' ? ['kPa', 'cm²', 's'] : kind === 'safety' ? ['N', 'ms', '%'] : ['/min', '%', ''];
      study.querySelectorAll('[data-label]').forEach((el, n) => { el.textContent = labels[n]; });
      study.querySelectorAll('[data-unit]').forEach((el, n) => { el.textContent = units[n]; });
      study.querySelector('[data-pulse]').addEventListener('click', event => {
        const rect = event.currentTarget.getBoundingClientRect();
        Object.assign(this.states[i], { start: this.clock, x: event.detail ? clamp((event.clientX - rect.left) / rect.width) : .5, y: event.detail ? clamp((event.clientY - rect.top) / rect.height) : .5 });
        this.drawStudy(i);
      }, { signal });
      study.querySelectorAll('[data-phase]').forEach(button => button.addEventListener('click', () => {
        this.states[i].start = this.clock - Number(button.dataset.phase);
        this.drawStudy(i);
      }, { signal }));
    });
    this.querySelectorAll('[data-slide]').forEach(button => button.addEventListener('click', () => this.go(Number(button.dataset.slide)), { signal }));
    this.previous.addEventListener('click', () => this.go(this.active - 1), { signal });
    this.next.addEventListener('click', () => this.go(this.active + 1), { signal });
    this.addEventListener('keydown', event => {
      if (!this.enhanced || !['ArrowLeft', 'ArrowRight'].includes(event.key) || !event.target.closest('.moya-science__navigation')) return;
      event.preventDefault(); this.go(this.active + (event.key === 'ArrowRight' ? 1 : -1));
    }, { signal });
    this.addEventListener('shopify:block:select', event => {
      const i = this.studies.indexOf(event.target.closest('[data-study]')); if (i >= 0) this.go(i);
    }, { signal });
    this.motion.addEventListener('change', () => this.resize(), { signal });
    window.addEventListener('scroll', () => this.queueUpdate(), { passive: true, signal });
    window.addEventListener('resize', () => this.resize(), { passive: true, signal });
    document.addEventListener('visibilitychange', () => this.sync(), { signal });
    this.observer = new IntersectionObserver(([entry]) => { this.visible = entry.isIntersecting; this.sync(); });
    this.observer.observe(this);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.stage);
    this.resize();
  }
  disconnectedCallback() {
    this.controller?.abort(); this.observer?.disconnect(); this.resizeObserver?.disconnect();
    cancelAnimationFrame(this.frame); cancelAnimationFrame(this.scrollFrame);
  }
  resize() {
    this.top = parseFloat(getComputedStyle(this.stage).top) || 0;
    const css = getComputedStyle(this);
    const desired = parseFloat(css.getPropertyValue(innerWidth < 750 ? '--moya-science-mobile-height' : '--moya-science-height')) || 783;
    const height = Math.max(360, Math.min(desired, innerHeight - this.top));
    this.style.setProperty('--science-stage-height', `${height}px`);
    const enhanced = this.studies.length > 0 && !this.motion.matches;
    if (enhanced !== this.enhanced) this.active = -1;
    this.enhanced = enhanced;
    this.classList.toggle('is-enhanced', this.enhanced);
    this.canvases = [...this.querySelectorAll('canvas')].map(canvas => {
      const rect = canvas.getBoundingClientRect(), ratio = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.round(rect.width * ratio)); canvas.height = Math.max(1, Math.round(rect.height * ratio));
      const ctx = canvas.getContext('2d'); ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
      return { canvas, ctx, w: rect.width, h: rect.height };
    });
    this.update(); this.studies.forEach((_, i) => this.drawStudy(i)); this.drawParticles(); this.sync();
  }
  queueUpdate() {
    if (this.scrollFrame) return;
    this.scrollFrame = requestAnimationFrame(() => { this.scrollFrame = 0; this.update(); });
  }
  update() {
    if (!this.enhanced) {
      this.intro.style.opacity = ''; this.intro.style.transform = ''; this.intro.inert = false; this.intro.removeAttribute('aria-hidden');
      this.deck.style.opacity = ''; this.deck.style.pointerEvents = ''; this.deck.inert = false;
      this.studies.forEach(study => { study.inert = false; study.removeAttribute('aria-hidden'); });
      return;
    }
    const rect = this.getBoundingClientRect();
    const progress = clamp((this.top - rect.top) / Math.max(1, this.offsetHeight - this.stage.offsetHeight));
    const state = scienceState(progress, this.studies.length);
    this.intro.style.opacity = state.intro;
    this.intro.style.transform = `translateY(${-24 * (1 - state.intro)}px)`;
    this.intro.inert = state.intro < .5; this.intro.setAttribute('aria-hidden', state.intro < .5);
    this.deck.style.opacity = state.deck; this.deck.inert = state.deck < .5;
    this.deck.style.pointerEvents = state.deck < .5 ? 'none' : '';
    if (this.active !== state.index) {
      this.active = state.index; this.states[this.active].start = this.clock;
      this.studies.forEach((study, i) => {
        study.style.setProperty('--slide-offset', i - this.active);
        study.style.setProperty('--slide-scale', i === this.active ? 1 : .9);
        study.style.setProperty('--slide-opacity', i === this.active ? 1 : 0);
        study.inert = i !== this.active; study.setAttribute('aria-hidden', i !== this.active);
      });
      this.querySelectorAll('[data-slide]').forEach((button, i) => button.setAttribute('aria-current', i === this.active));
      this.previous.disabled = this.active === 0; this.next.disabled = this.active === this.studies.length - 1;
      this.drawStudy(this.active);
    }
  }
  go(index) {
    index = clamp(index, 0, this.studies.length - 1);
    if (!this.enhanced) { this.studies[index].scrollIntoView({ block: 'start' }); return; }
    const progress = .22 + ((index + .5) / this.studies.length) * .78;
    window.scrollTo({ top: scrollY + this.getBoundingClientRect().top - this.top + progress * (this.offsetHeight - this.stage.offsetHeight), behavior: 'smooth' });
  }
  sync() {
    cancelAnimationFrame(this.frame); this.frame = 0; this.lastFrame = 0;
    if (this.visible && !document.hidden && !this.motion.matches) this.frame = requestAnimationFrame(time => this.tick(time));
  }
  tick(time) {
    if (!this.isConnected) return;
    if (!this.lastFrame) this.lastFrame = time;
    const elapsed = time - this.lastFrame;
    if (elapsed >= 1000 / 30) {
      this.clock += Math.min(elapsed, 100) / 1000; this.lastFrame = time;
      this.drawParticles();
      if (this.enhanced) { if (this.active >= 0) this.drawStudy(this.active); }
      else this.studies.forEach((_, i) => this.drawStudy(i));
    }
    this.frame = requestAnimationFrame(t => this.tick(t));
  }
  drawParticles() {
    const field = this.canvases?.[0];
    if (!field?.ctx || this.dataset.animation !== 'true' || this.motion.matches) return;
    const { ctx, w, h } = field, t = this.clock;
    ctx.clearRect(0, 0, w, h);
    for (let row = 0; row < 50; row++) {
      for (let col = 0; col < 110; col++) {
        const u = col / 109, v = row / 49;
        const fold = Math.sin(u * 9 + v * 5 + t * .12) * .15 + Math.cos(u * 5 - v * 8 + t * .08) * .1;
        const x = u * w * 1.2 - w * .1 + Math.sin(v * 6) * w * .08;
        const y = (v * .75 + fold + .1) * h;
        ctx.fillStyle = `rgba(155,194,166,${.1 + (1 - v) * .25})`;
        ctx.fillRect(x, y, .8 + v * .7, .8 + v * .7);
      }
    }
  }
  drawStudy(index) {
    const study = this.studies[index], field = this.canvases?.[index + 1];
    if (!field?.ctx) return;
    const { ctx, w, h } = field, state = this.states[index], kind = study.dataset.study;
    const age = Math.max(0, this.clock - state.start), t = this.motion.matches ? 0 : this.clock;
    ctx.clearRect(0, 0, w, h);
    let values;
    if (kind === 'touch') {
      const pulse = age % 8, amplitude = Math.exp(-pulse * .65);
      const project = (u, v) => {
        const distance = Math.hypot(u - state.x, v - state.y);
        const z = Math.sin(u * 9 + v * 5 + t * .35) * .09 + Math.cos(v * 8 - u * 4) * .06 + Math.cos(distance * 24 - pulse * 6) * Math.exp(-distance * 4) * amplitude * .2;
        return [w * (.07 + u * .86), h * (.32 + v * .45 - z)];
      };
      ctx.lineWidth = .6;
      for (let row = 0; row < 34; row++) {
        ctx.beginPath(); ctx.strokeStyle = `rgba(198,221,209,${.18 + row / 100})`;
        for (let col = 0; col <= 70; col++) { const p = project(col / 70, row / 33); col ? ctx.lineTo(...p) : ctx.moveTo(...p); } ctx.stroke();
      }
      for (let col = 0; col < 60; col++) {
        ctx.beginPath(); ctx.strokeStyle = '#c6ddd13d';
        for (let row = 0; row <= 40; row++) { const p = project(col / 59, row / 40); row ? ctx.lineTo(...p) : ctx.moveTo(...p); } ctx.stroke();
      }
      values = [(2.4 + amplitude * 21.2).toFixed(1), Math.round(160 + amplitude * 26), Math.min(age, 42.03).toFixed(2)];
    } else if (kind === 'safety') {
      const alignment = clamp(age / 6);
      ['#d6c9a0', '#abd1bb'].forEach((color, line) => {
        ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.beginPath();
        for (let x = 0; x <= w; x += 3) {
          const u = x / w, lag = line * (1 - alignment) * 2;
          const envelope = Math.exp(-Math.pow((u - .5) * 5, 2));
          const y = h * (.37 + line * .25) + Math.sin(u * 25 - t * 3 + lag) * envelope * 28;
          x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        } ctx.stroke();
      });
      values = [(1.8 + Math.sin(age * 2) * .3).toFixed(1), Math.round(780 - alignment * 655), Math.round(alignment * 84)];
    } else {
      const progress = clamp(age / 18);
      for (let row = 0; row < 26; row++) {
        ctx.beginPath(); ctx.strokeStyle = `rgba(173,210,190,${.12 + row / 90})`; ctx.lineWidth = .8;
        for (let x = 0; x <= w; x += 4) {
          const u = x / w, y = h * (.35 + row * .012) + Math.sin(u * (24 - progress * 14) - t * (1.8 - progress)) * Math.sin(u * Math.PI) * (32 - progress * 16);
          x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        } ctx.stroke();
      }
      const seconds = Math.floor(age);
      values = [(14 - progress * 6).toFixed(1), Math.round(progress * 100), `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`];
      study.querySelectorAll('[data-phase]').forEach((button, i) => button.setAttribute('aria-pressed', i === Math.min(2, Math.floor(age / 6))));
    }
    study.querySelectorAll('[data-value]').forEach((el, i) => { const value = String(values[i]); if (el.textContent !== value) el.textContent = value; });
    study.querySelector('.moya-science__visual').classList.add('is-ready');
  }
}
if (!customElements.get('moya-science-intro')) customElements.define('moya-science-intro', MoyaScienceIntro);
