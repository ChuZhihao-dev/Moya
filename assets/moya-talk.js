/** Talk to MoYa: independent scroll, media and dialogue clocks. Build with scripts/build-moya-talk.mjs. */
class MoyaTalk extends HTMLElement {
  #controller;
  #round;
  #frame = 0;
  #last = 0;
  #clock = 0;
  #waiters = new Set();
  #motion = matchMedia('(prefers-reduced-motion: reduce)');
  #mobile = matchMedia('(max-width: 749px)');
  #nodes = new Map();
  #node;
  #clips = new Map();
  #loads = new WeakMap();
  #stage;
  #ui;
  #options;
  #reply;
  #observer;
  #resize;
  #active;
  #visible = false;
  #ready = false;
  #busy = false;
  #words = [];
  #progress = 0;
  #geometryDirty = true;
  #short = false;
  #top = 0;
  #height = 0;
  #introFailed = false;
  #introReady = false;
  #focusNext = false;
  #focusedDuringHide;
  #openingProgress = 0;
  #flow = false;
  #warming = false;

  connectedCallback() {
    this.#controller?.abort();
    this.#controller = new AbortController();
    const { signal } = this.#controller;
    this.#stage = this.querySelector('[data-stage]');
    this.#ui = this.querySelector('[data-interface]');
    this.#options = this.querySelector('[data-options]');
    this.#reply = this.querySelector('[data-reply]');
    if (!this.#stage || !this.#ui) return;
    for (const v of this.querySelectorAll('[data-clip]')) {
      v.muted = true;
      this.#clips.set(v.dataset.clip, v);
      v.addEventListener(
        'error',
        () => {
          if (v === this.#active) this.#showPoster('full');
        },
        { signal },
      );
      v.addEventListener(
        'playing',
        () => {
          if (!this.#visible || !this.#ready || document.hidden) v.pause();
        },
        { signal },
      );
    }
    let data;
    try {
      data = JSON.parse(this.querySelector('[data-nodes]').textContent);
    } catch {
      this.#warn(['Dialogue configuration is not valid JSON.']);
      return;
    }
    const errors = [];
    for (const node of data) {
      if (!node.key || this.#nodes.has(node.key)) {
        errors.push(`Missing or duplicate node ID: ${node.key || '(empty)'}`);
        continue;
      }
      this.#nodes.set(node.key, node);
    }
    for (const node of this.#nodes.values()) {
      node.options = node.options.filter((o) => {
        const valid =
          o.label &&
          (o.action === 'restart' ||
            (o.action === 'link' && this.#safeHref(o.href)) ||
            (o.action === 'next' && this.#nodes.has(o.next) && o.next !== node.key));
        if (o.label && !valid) errors.push(`Invalid option in ${node.key}: ${o.label}`);
        return valid;
      });
    }
    this.#node = this.#nodes.get(this.dataset.start);
    if (!this.#node) {
      errors.push('Starting node was not found.');
      this.#node = this.#nodes.values().next().value;
    }
    const reachable = new Set();
    const visit = (key) => {
      if (reachable.has(key)) return;
      reachable.add(key);
      this.#nodes.get(key)?.options.forEach((o) => {
        if (o.action === 'next') visit(o.next);
      });
    };
    if (this.#node) visit(this.#node.key);
    for (const key of this.#nodes.keys())
      if (!reachable.has(key)) errors.push(`Unreachable node: ${key}`);
    this.#warn(errors);
    if (!this.#node) return;
    this.classList.add('is-enhanced');
    this.#renderOptions();
    document.addEventListener('scroll', this.#schedule, { passive: true, capture: true, signal });
    document.addEventListener('visibilitychange', this.#schedule, { signal });
    window.addEventListener('resize', this.#invalidate, { signal });
    this.#motion.addEventListener('change', this.#configureMotion, { signal });
    this.#mobile.addEventListener('change', this.#deviceChange, { signal });
    this.#options.addEventListener('click', this.#choose, { signal });
    this.addEventListener('shopify:block:select', this.#editorSelect, { signal });
    this.#observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !this.#warming) {
          this.#warming = true;
          this.#prepareIntro();
        }
        this.#schedule();
      },
      { rootMargin: '400px' },
    );
    this.#observer.observe(this);
    this.#resize = new ResizeObserver(this.#invalidate);
    this.#resize.observe(this.#stage);
    const header = document.querySelector('store-header');
    if (header) this.#resize.observe(header);
    document.fonts?.ready.then(() => {
      if (!signal.aborted) this.#invalidate();
    });
    this.#schedule();
  }

  disconnectedCallback() {
    this.#controller?.abort();
    this.#round?.abort();
    this.#observer?.disconnect();
    this.#resize?.disconnect();
    cancelAnimationFrame(this.#frame);
    this.#frame = 0;
    this.#last = 0;
    for (const v of this.#clips.values()) v.pause();
    this.#waiters.clear();
    this.#loads = new WeakMap();
    this.#nodes.clear();
    this.#clips.clear();
    this.#round = undefined;
    this.#active = null;
    this.#busy = this.#ready = this.#warming = this.#introReady = false;
  }

  #safeHref(href) {
    if (!href || typeof href !== 'string') return '';
    try {
      const u = new URL(href, location.href);
      return ['https:', 'http:'].includes(u.protocol) ? href : '';
    } catch {
      return '';
    }
  }

  #warn(errors) {
    this.dataset.configValid = String(!errors.length);
    const box = this.querySelector('[data-config]');
    if (box && this.dataset.editor === 'true' && errors.length) {
      box.hidden = false;
      box.textContent = errors.join(' · ');
    }
  }

  #invalidate = () => {
    this.#geometryDirty = true;
    this.#schedule();
  };
  #configureMotion = () => {
    this.#round?.abort();
    this.#busy = false;
    this.#reveal(1);
    this.#renderOptions();
    if (!this.#motionEnabled()) {
      for (const v of this.#clips.values()) {
        v.pause();
        v.classList.remove('is-active');
      }
      this.#active = null;
    }
    this.#invalidate();
  };
  #deviceChange = () => {
    // Save the current frame before loading the other rendition. Same dialogue remains active.
    this.#introReady = false;
    for (const v of this.#clips.values()) {
      if (!v.hasAttribute('src')) continue;
      const time = v.currentTime;
      v.pause();
      this.#loads.delete(v);
      this.#load(v, time).then((ok) => {
        if (ok && v === this.#active && this.#ready) this.#safePlay(v);
        this.#schedule();
      });
    }
    this.#prepareIntro();
    this.#invalidate();
  };
  #motionEnabled() {
    return this.dataset.motion !== 'false' && !this.#motion.matches;
  }

  #schedule = () => {
    if (!this.#frame && this.isConnected) this.#frame = requestAnimationFrame(this.#tick);
  };
  #tick = (now) => {
    this.#frame = 0;
    if (this.#geometryDirty) this.#measure();
    this.#updateScroll();
    const running = this.#visible && this.#ready && !document.hidden;
    if (running && this.#last) this.#clock += Math.min(64, now - this.#last);
    this.#last = running ? now : 0;
    this.#syncPlayback();
    for (const task of [...this.#waiters]) task();
    if (running && this.#waiters.size) this.#schedule();
  };

  #measure() {
    this.#geometryDirty = false;
    const header = document.querySelector('store-header[sticky]');
    this.#top = header ? header.offsetHeight : 0;
    // svh stays stable while mobile browser chrome expands/collapses.
    const probe = getComputedStyle(document.documentElement).getPropertyValue('--header-height');
    if (header && parseFloat(probe)) this.#top = parseFloat(probe);
    const viewport =
      this.querySelector('[data-viewport-probe]')?.offsetHeight ||
      document.documentElement.clientHeight;
    this.#height = Math.max(300, viewport - this.#top);
    this.#short = this.#height < (this.#mobile.matches ? 545 : 560);
    this.style.setProperty('--talk-height', `${this.#height}px`);
    this.style.setProperty('--talk-top', `${this.#top}px`);
    this.#flow = this.#short || !this.#motionEnabled();
    this.classList.toggle('is-flow', this.#flow);
    // Content overflow is measured separately after layout, never hidden by a fixed stage.
    if (!this.#flow) {
      const answer = this.querySelector('[data-answer]');
      const asked = this.querySelector('[data-asked]');
      const options = this.#options;
      const overlaps =
        (!answer.hidden &&
          answer.getBoundingClientRect().bottom >
            this.#stage.getBoundingClientRect().top +
              this.#height * (this.#mobile.matches ? 0.48 : 0.65)) ||
        (!asked.hidden &&
          asked.getBoundingClientRect().bottom >
            (options.childElementCount
              ? options.getBoundingClientRect().top
              : this.#stage.getBoundingClientRect().top + this.#height * 0.7) -
              12) ||
        options.getBoundingClientRect().bottom > this.#stage.getBoundingClientRect().bottom - 8;
      if (overlaps) {
        this.#flow = true;
        this.classList.add('is-flow');
      }
    }
  }

  #updateScroll() {
    const rect = this.getBoundingClientRect();
    const stage = this.#stage.getBoundingClientRect();
    this.#visible = stage.bottom > this.#top && stage.top < innerHeight && rect.bottom > this.#top;
    const range = Math.max(
      1,
      (this.#height * Number(this.style.getPropertyValue('--talk-distance') || 100)) / 100,
    );
    this.#openingProgress = this.#flow
      ? 1
      : Math.max(0, Math.min(1, (this.#top - rect.top) / range));
    const p = this.#openingProgress;
    this.style.setProperty('--talk-title-zoom', String(1 + p * 0.388));
    this.style.setProperty('--talk-title-opacity', String(Math.max(0.06, 1 - p * 1.5)));
    if (!this.#flow && this.#motionEnabled()) this.#seekIntro(p);
    const ready = (p >= 0.985 && (this.#introReady || this.#introFailed)) || this.#flow;
    if (ready !== this.#ready) {
      this.#ready = ready;
      this.#ui.hidden = !ready;
      this.#ui.inert = !ready;
      this.classList.toggle('is-ready', ready);
      if (ready) {
        this.#invalidate();
        this.#showPoster('full');
        if (!this.#busy && this.#motionEnabled()) this.#idle();
        this.#prepareChoices();
        if (this.#focusedDuringHide) {
          this.#options.querySelector('button,a')?.focus({ preventScroll: true });
          this.#focusedDuringHide = false;
        }
      } else {
        this.#focusedDuringHide = this.#ui.contains(document.activeElement);
        if (this.#focusedDuringHide) {
          this.tabIndex = -1;
          this.focus({ preventScroll: true });
        }
        this.#showPoster('intro');
        for (const v of this.#clips.values())
          if (v.dataset.clip !== 'intro') v.classList.remove('is-active');
      }
    }
    // Restore the active answer frame when scrolling back into the conversation.
    if (ready && this.#active && this.#motionEnabled()) this.#active.classList.add('is-active');
  }

  #showPoster(kind) {
    for (const p of this.querySelectorAll('[data-poster]')) p.hidden = p.dataset.poster !== kind;
  }

  async #prepareIntro() {
    if (!this.#motionEnabled()) return;
    const v = this.#clips.get('intro');
    const ok = await this.#load(v);
    if (!this.isConnected) return;
    this.#introFailed = !ok;
    this.#schedule();
  }

  #seekIntro(progress) {
    const v = this.#clips.get('intro');
    if (!v || v.readyState < 2 || !Number.isFinite(v.duration) || v.seeking) return;
    const target = progress * Math.max(0, v.duration - 1 / 30);
    // Coalesce scroll updates; seeked paints the newest requested position on the next frame.
    if (Math.abs(v.currentTime - target) > 0.025) {
      v.pause();
      v.currentTime = target;
      v.addEventListener(
        'seeked',
        () => {
          this.#introReady = progress >= 0.985;
          this.#schedule();
        },
        { once: true, signal: this.#controller.signal },
      );
    } else if (progress >= 0.985) this.#introReady = true;
    v.classList.toggle('is-active', !this.#ready);
  }

  #load(v, resume = 0) {
    if (!v || !this.#motionEnabled()) return Promise.resolve(false);
    const src = this.#mobile.matches ? v.dataset.mobile : v.dataset.desktop;
    if (this.#loads.has(v) && v.getAttribute('src') === src) return this.#loads.get(v);
    const promise = new Promise((resolve) => {
      const signal = this.#controller.signal;
      let timer,
        settled = false;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        v.removeEventListener('loadeddata', loaded);
        v.removeEventListener('error', failed);
        signal.removeEventListener('abort', failed);
        resolve(ok);
      };
      const loaded = () => {
        if (resume > 0 && Number.isFinite(v.duration))
          v.currentTime = Math.min(resume, v.duration - 0.04);
        finish(true);
      };
      const failed = () => finish(false);
      v.addEventListener('loadeddata', loaded);
      v.addEventListener('error', failed);
      signal.addEventListener('abort', failed, { once: true });
      timer = setTimeout(failed, 8000);
      if (v.getAttribute('src') !== src) {
        v.src = src;
        v.load();
      } else if (v.readyState >= 2) loaded();
    });
    this.#loads.set(v, promise);
    return promise;
  }

  #safePlay(v) {
    if (!this.#ready || !this.#visible || document.hidden || !this.#motionEnabled() || v.ended)
      return;
    if (v.paused && !v.dataset.playPending && !v.dataset.playRejected) {
      v.dataset.playPending = 'true';
      v.play()
        ?.then(() => {
          delete v.dataset.playPending;
          if (v !== this.#active || !this.#ready || !this.#visible || document.hidden) v.pause();
        })
        .catch(() => {
          delete v.dataset.playPending;
          v.dataset.playRejected = 'true';
          v.classList.remove('is-active');
          this.#showPoster('full');
        });
    }
  }
  #syncPlayback() {
    for (const v of this.#clips.values()) {
      if (
        v === this.#active &&
        this.#ready &&
        this.#visible &&
        !document.hidden &&
        this.#motionEnabled()
      )
        this.#safePlay(v);
      else if (!v.paused) v.pause();
    }
  }

  async #activate(name, signal) {
    const v = this.#clips.get(name);
    if (!this.#motionEnabled() || signal?.aborted) return null;
    if (!(await this.#load(v)) || signal?.aborted || !this.isConnected) return null;
    // The loaded first frame is retained under the outgoing layer until playback is ready.
    v.loop = name === 'breathe';
    v.currentTime = 0;
    delete v.dataset.playRejected;
    delete v.dataset.stalled;
    const previous = this.#active;
    this.#active = v;
    // Reveal a decoded first frame; outgoing video fades over it.
    v.style.zIndex = '2';
    if (previous && previous !== v) previous.style.zIndex = '1';
    this.#safePlay(v);
    if (this.#ready && !v.dataset.playRejected) {
      v.classList.add('is-active');
      for (const other of this.#clips.values())
        if (other !== v) other.classList.remove('is-active');
    }
    if (previous && previous !== v) previous.pause();
    return v;
  }

  async #idle() {
    const signal = this.#round?.signal || this.#controller.signal;
    await this.#activate('breathe', signal);
  }

  #until(check, signal) {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException('Cancelled', 'AbortError'));
        return;
      }
      const cancel = () => {
        this.#waiters.delete(task);
        reject(new DOMException('Cancelled', 'AbortError'));
      };
      const task = () => {
        if (!check()) return;
        this.#waiters.delete(task);
        signal.removeEventListener('abort', cancel);
        resolve();
      };
      signal.addEventListener('abort', cancel, { once: true });
      this.#waiters.add(task);
      this.#schedule();
    });
  }
  #finishClip(video, signal) {
    let time = video.currentTime,
      advanced = this.#clock;
    return this.#until(() => {
      if (video.currentTime !== time) {
        time = video.currentTime;
        advanced = this.#clock;
      }
      return (
        video.ended ||
        video.error ||
        video.dataset.playRejected ||
        video.dataset.stalled ||
        this.#clock - advanced > 8000
      );
    }, signal);
  }
  #delay(ms, signal) {
    const start = this.#clock;
    return this.#until(() => this.#clock - start >= ms, signal);
  }

  #writeAnswer(text) {
    this.#reply.replaceChildren();
    this.#words = [];
    this.classList.toggle('has-answer', Boolean(text));
    const avatar = this.querySelector('[data-avatar]');
    const avatarParent = this.querySelector(text ? '[data-answer-label]' : '[data-listening]');
    if (avatar && avatarParent) avatarParent.prepend(avatar);
    const parts =
      typeof Intl.Segmenter === 'function'
        ? Array.from(
            new Intl.Segmenter(undefined, { granularity: 'word' }).segment(text || ''),
            (s) => s.segment,
          )
        : (text || '').split(/(\s+)/u);
    let offset = 0;
    for (const part of parts) {
      if (/^\s*$/u.test(part)) {
        this.#reply.append(document.createTextNode(part));
        offset += part.length;
        continue;
      }
      const word = document.createElement('span');
      word.className = 'moya-talk__reply-word';
      const base = document.createElement('span');
      base.className = 'moya-talk__reply-base';
      base.textContent = part;
      const ink = document.createElement('span');
      ink.className = 'moya-talk__reply-ink';
      ink.textContent = part;
      ink.setAttribute('aria-hidden', 'true');
      word.append(base, ink);
      this.#reply.append(word);
      this.#words.push({ ink, start: offset, length: part.length });
      offset += part.length;
    }
    this.#reply.dataset.length = String(offset);
    this.querySelector('[data-answer]').hidden = !text;
    this.querySelector('[data-listening]').hidden = Boolean(text);
    this.querySelector('[data-dots]').hidden = false;
    this.#reveal(0);
    this.#invalidate();
  }

  #reveal(progress) {
    this.#progress = progress;
    const total = Number(this.#reply.dataset.length);
    for (const word of this.#words) {
      const percent = Math.max(
        0,
        Math.min(120, ((progress * (total + 4) - word.start) / word.length) * 100),
      );
      word.ink.style.setProperty('--talk-reveal-solid', `${Math.max(0, percent - 20)}%`);
      word.ink.style.setProperty('--talk-reveal-edge', `${percent}%`);
      if (progress >= 1) word.ink.style.maskImage = 'none';
      else word.ink.style.maskImage = '';
    }
  }

  async #answer(text, video, node, signal) {
    this.#writeAnswer(text);
    if (!text) return;
    if (this.#motion.matches || this.dataset.reveal === 'false') {
      this.#reveal(1);
      this.querySelector('[data-live]').textContent = `MoYa: ${text}`;
      return;
    }
    const start = this.#clock;
    const textDuration = Math.max(
      1200,
      Math.min(6000, text.length * Number(this.dataset.speed || 30)),
    );
    let fallback = false;
    let lastMedia = -1;
    let lastAdvance = start;
    const from = Number(node.start || 0);
    const end = Number(node.end) > from ? Number(node.end) : video?.duration || textDuration / 1000;
    await this.#until(() => {
      if (video && !fallback && !video.dataset.playRejected) {
        if (video.currentTime !== lastMedia) {
          lastMedia = video.currentTime;
          lastAdvance = this.#clock;
        }
        if (this.#clock - lastAdvance > 8000 || video.error) {
          fallback = true;
          video.dataset.stalled = 'true';
          video.classList.remove('is-active');
          this.#showPoster('full');
        } else {
          const p = video.ended
            ? 1
            : Math.max(0, Math.min(1, (video.currentTime - from) / Math.max(0.1, end - from)));
          this.#reveal(Math.max(this.#progress, p));
          return p >= 1;
        }
      }
      const p = Math.min(1, (this.#clock - start) / textDuration);
      this.#reveal(Math.max(this.#progress, p));
      return p >= 1;
    }, signal);
    this.querySelector('[data-live]').textContent = `MoYa: ${text}`;
  }

  #prepareChoices() {
    if (
      !this.#motionEnabled() ||
      !this.#ready ||
      (typeof navigator !== 'undefined' && navigator.connection?.saveData)
    )
      return;
    for (const choice of this.#node.options)
      if (choice.action === 'next') this.#load(this.#clips.get(choice.motion));
  }

  #renderOptions() {
    this.#options.replaceChildren();
    for (const [index, choice] of (this.#node?.options || []).entries()) {
      const el = document.createElement(choice.action === 'link' ? 'a' : 'button');
      el.className = 'moya-talk__option';
      el.dataset.choice = String(index);
      if (choice.action === 'link') {
        const science = document.querySelector('moya-science-intro[id]');
        el.href =
          choice.href === '#moya-science' && science
            ? `#${science.id}`
            : this.#safeHref(choice.href);
      } else el.type = 'button';
      const label = document.createElement('span');
      label.textContent = choice.label;
      el.append(label, this.querySelector('[data-arrow]').content.cloneNode(true));
      this.#options.append(el);
    }
    if (this.#focusNext) {
      this.#options.querySelector('button,a')?.focus({ preventScroll: true });
      this.#focusNext = false;
    }
    this.#prepareChoices();
    this.#invalidate();
  }

  #choose = (event) => {
    const el = event.target.closest('[data-choice]');
    if (!el || this.#busy || !this.#ready) {
      if (el) event.preventDefault();
      return;
    }
    const choice = this.#node.options[Number(el.dataset.choice)];
    if (!choice) return;
    if (choice.action === 'link') return;
    this.#focusNext = event.detail === 0;
    if (choice.action === 'restart') {
      this.#restart();
      return;
    }
    this.#busy = true;
    this.#round?.abort();
    this.#round = new AbortController();
    this.#respond(choice, this.#round.signal).catch((e) => {
      if (e.name !== 'AbortError') {
        console.error('MoYa dialogue:', e);
        this.#busy = false;
        this.#renderOptions();
      }
    });
  };

  async #respond(choice, signal) {
    this.#options.replaceChildren();
    const asked = this.querySelector('[data-asked]');
    asked.hidden = false;
    this.querySelector('[data-question]').textContent = choice.label;
    this.#invalidate();
    const video = await this.#activate(choice.motion || 'hug', signal);
    if (signal.aborted) return;
    if (video) video.loop = false;
    await this.#answer(choice.reply, video, this.#node, signal);
    if (video && this.#motionEnabled()) {
      await this.#finishClip(video, signal);
      // Let a completed gesture settle before returning to the listening pose.
      // Use the visible conversation clock so the hold pauses offscreen too.
      if (video.ended && !video.error && !video.dataset.stalled && !video.dataset.playRejected) {
        await this.#delay(choice.motion === 'hug' ? 1500 : 750, signal);
      }
    }
    if (['hug', 'look-up'].includes(choice.motion) && this.#motionEnabled()) {
      const returning = await this.#activate(
        choice.motion === 'hug' ? 'return' : 'look-down',
        signal,
      );
      if (returning) await this.#finishClip(returning, signal);
    }
    await this.#idle();
    if (signal.aborted) return;
    this.#node = this.#nodes.get(choice.next);
    await this.#answer(this.#node.prompt, null, this.#node, signal);
    await this.#delay(this.#motion.matches ? 0 : Number(this.dataset.delay || 0), signal);
    this.#busy = false;
    this.#renderOptions();
  }

  #restart() {
    this.#round?.abort();
    this.#round = new AbortController();
    this.#busy = false;
    this.#node = this.#nodes.get(this.dataset.start) || this.#nodes.values().next().value;
    this.querySelector('[data-asked]').hidden = true;
    this.#writeAnswer('');
    this.querySelector('[data-live]').textContent = '';
    this.#renderOptions();
    if (this.#motionEnabled()) this.#idle();
  }

  #editorSelect = (event) => {
    const target =
      event.target.closest('[data-editor-node]') ||
      event.target.querySelector?.('[data-editor-node]');
    const node = this.#nodes.get(target?.dataset.editorNode);
    if (!node) return;
    this.#round?.abort();
    this.#round = new AbortController();
    this.#node = node;
    this.#busy = false;
    this.#writeAnswer(node.prompt);
    this.#reveal(1);
    this.#renderOptions();
    if (!this.#motionEnabled()) {
      for (const v of this.#clips.values()) {
        v.pause();
        v.classList.remove('is-active');
      }
      this.#active = null;
    }
    window.scrollTo({
      top:
        scrollY +
        this.getBoundingClientRect().top -
        this.#top +
        Math.max(0, this.offsetHeight - this.#stage.offsetHeight - this.#height * 0.3),
      behavior: 'instant',
    });
    this.#schedule();
  };
}
if (!customElements.get('moya-talk')) customElements.define('moya-talk', MoyaTalk);
