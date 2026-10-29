if (!customElements.get('moya-product-details')) {
  customElements.define(
    'moya-product-details',
    class extends HTMLElement {
      connectedCallback() {
        this.abort = new AbortController();
        this.accordionAnimations = new Map();
        this.addEventListener('click', this.onClick.bind(this), { signal: this.abort.signal });
        this.addEventListener('change', this.onAccessoryChange.bind(this), {
          signal: this.abort.signal,
        });
        this.addEventListener('submit', this.onBundleSubmit.bind(this), {
          capture: true,
          signal: this.abort.signal,
        });
        this.syncAccessories();
        this.querySelectorAll('[data-countdown]').forEach((el) => this.startCountdown(el));
      }
      disconnectedCallback() {
        this.abort.abort();
        clearInterval(this.timer);
        for (const [details, state] of this.accordionAnimations) {
          state.animation.cancel();
          details.open = state.open;
          details.classList.remove('is-animating', 'is-closing');
        }
        this.accordionAnimations.clear();
      }
      async onClick(event) {
        const summary = event.target.closest('summary');
        const details = summary?.parentElement;
        if (
          details?.matches('.moya-pdp__accordion, .moya-pdp__service') &&
          !event.target.closest('a, button, input, select, textarea')
        ) {
          event.preventDefault();
          this.toggleAccordion(details, summary);
          return;
        }
        const zoom = event.target.closest('[data-zoom]');
        if (zoom) {
          const dialog = this.querySelector('dialog');
          const tile = zoom.closest('.moya-pdp__tile').cloneNode(true);
          tile.querySelector('button')?.replaceWith(...tile.querySelector('button').childNodes);
          dialog.querySelector('[data-zoom-content]').replaceChildren(tile);
          this.opener = zoom;
          dialog.showModal();
          return;
        }
        if (event.target.closest('[data-close]') || event.target === this.querySelector('dialog')) {
          this.querySelector('dialog').close();
          this.opener?.focus();
        }
        const copy = event.target.closest('[data-copy-code]');
        if (copy) {
          try {
            await navigator.clipboard.writeText(copy.dataset.copyCode);
            copy.textContent = 'COPIED';
            this.querySelector('[data-copy-status]').textContent = 'Discount code copied.';
          } catch {
            this.querySelector('[data-copy-status]').textContent =
              'Copy this code: ' + copy.dataset.copyCode;
          }
        }
      }
      onAccessoryChange(event) {
        const select = event.target.closest('[data-accessory-variant]');
        if (select) {
          const card = select.closest('[data-accessory]');
          const option = select.selectedOptions[0];
          const checkbox = card.querySelector('[data-accessory-check]');
          checkbox.value = option.value;
          checkbox.dataset.quantity = option.dataset.quantity;
          checkbox.disabled = option.disabled;
          if (option.disabled) checkbox.checked = false;
          card.querySelector('[data-accessory-price]').textContent = option.dataset.price;
          const compare = card.querySelector('[data-accessory-compare]');
          compare.textContent = option.dataset.compare;
          compare.hidden = !option.dataset.compare;
        }
        if (select || event.target.matches('[data-accessory-check]')) this.syncAccessories();
      }
      syncAccessories() {
        const selected = this.querySelectorAll('[data-accessory-check]:checked:not(:disabled)');
        const status = this.querySelector('[data-accessory-status]');
        if (status) {
          status.textContent = selected.length
            ? `${selected.length} accessory selected. It will be added with your product.`
            : '';
        }
      }
      async onBundleSubmit(event) {
        const form = event.target;
        if (!form.matches('.moya-pdp__form')) return;
        const selected = [
          ...this.querySelectorAll('[data-accessory-check]:checked:not(:disabled)'),
        ];
        const checkout = event.submitter?.name === 'checkout';
        if (!selected.length && !checkout) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (this.addingBundle || !form.reportValidity()) return;

        const data = new FormData(form);
        const mainItem = {
          id: Number(data.get('id')),
          quantity: Number(data.get('quantity') || 1),
        };
        if (data.get('selling_plan')) mainItem.selling_plan = data.get('selling_plan');
        for (const [name, value] of data) {
          const property = name.match(/^properties\[(.+)\]$/);
          if (property) (mainItem.properties ||= {})[property[1]] = value;
        }
        const items = [
          mainItem,
          ...selected.map((checkbox) => ({
            id: Number(checkbox.value),
            quantity: Number(checkbox.dataset.quantity || 1),
          })),
        ];
        const buttons = [...form.elements]
          .filter((element) => element.type === 'submit')
          .map((button) => [button, button.disabled]);
        this.addingBundle = true;
        buttons.forEach(([button]) => {
          button.disabled = true;
          button.setAttribute('aria-busy', 'true');
        });
        try {
          const sections = ['variant-added'];
          document.documentElement.dispatchEvent(
            new CustomEvent('cart:prepare-bundled-sections', {
              bubbles: true,
              detail: { sections },
            }),
          );
          const response = await fetch(`${Shopify.routes.root}cart/add.js`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            body: JSON.stringify({
              items,
              sections: sections.join(','),
              sections_url: `${Shopify.routes.root}variants/${mainItem.id}`,
            }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.description || 'Unable to add these products.');
          if (checkout) {
            window.location.href = `${Shopify.routes.root}checkout`;
            return;
          }
          if (window.themeVariables.settings.cartType === 'page') {
            window.location.href = `${Shopify.routes.root}cart`;
            return;
          }
          const cartResponse = await fetch(`${Shopify.routes.root}cart.js`);
          if (!cartResponse.ok)
            throw new Error('Products added. Please open your cart to view them.');
          const cart = await cartResponse.json();
          cart.sections = result.sections;
          form.dispatchEvent(
            new CustomEvent('variant:add', {
              bubbles: true,
              detail: { items: result.items || [result], cart },
            }),
          );
          document.documentElement.dispatchEvent(
            new CustomEvent('cart:change', {
              bubbles: true,
              detail: { baseEvent: 'variant:add', cart },
            }),
          );
        } catch (error) {
          form.dispatchEvent(
            new CustomEvent('cart:error', {
              bubbles: true,
              detail: { error: error.message },
            }),
          );
          const status = this.querySelector('[data-accessory-status]');
          if (status) status.textContent = error.message;
          document.dispatchEvent(new CustomEvent('cart:refresh'));
        } finally {
          this.addingBundle = false;
          buttons.forEach(([button, disabled]) => {
            button.disabled = disabled;
            button.removeAttribute('aria-busy');
          });
        }
      }
      toggleAccordion(details, summary) {
        const previous = this.accordionAnimations.get(details);
        const open = previous ? !previous.open : !details.open;
        const startHeight = details.getBoundingClientRect().height;
        previous?.animation.cancel();
        this.accordionAnimations.delete(details);

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !details.animate) {
          details.open = open;
          details.classList.remove('is-animating', 'is-closing');
          return;
        }

        details.open = true;
        const style = getComputedStyle(details);
        const collapsedHeight =
          summary.getBoundingClientRect().height +
          parseFloat(style.borderTopWidth) +
          parseFloat(style.borderBottomWidth) +
          parseFloat(style.paddingTop) +
          parseFloat(style.paddingBottom);
        const endHeight = open ? details.getBoundingClientRect().height : collapsedHeight;
        details.classList.add('is-animating');
        details.classList.toggle('is-closing', !open);

        const animation = details.animate(
          [{ height: `${startHeight}px` }, { height: `${endHeight}px` }],
          { duration: 280, easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)' },
        );
        this.accordionAnimations.set(details, { animation, open });
        animation.onfinish = () => {
          if (this.accordionAnimations.get(details)?.animation !== animation) return;
          details.open = open;
          details.classList.remove('is-animating', 'is-closing');
          this.accordionAnimations.delete(details);
        };
      }
      startCountdown(el) {
        const end = Date.parse(el.dataset.countdown);
        if (!Number.isFinite(end)) {
          el.closest('.moya-pdp__coupon').hidden = true;
          return;
        }
        const update = () => {
          const seconds = Math.floor((end - Date.now()) / 1000);
          if (seconds <= 0) {
            el.closest('.moya-pdp__coupon').hidden = true;
            clearInterval(this.timer);
            return;
          }
          el.hidden = false;
          const values = {
            days: Math.floor(seconds / 86400),
            hours: Math.floor(seconds / 3600) % 24,
            minutes: Math.floor(seconds / 60) % 60,
            seconds: seconds % 60,
          };
          for (const [key, value] of Object.entries(values))
            el.querySelector('[data-' + key + ']').textContent = String(value).padStart(2, '0');
        };
        update();
        this.timer = setInterval(update, 1000);
      }
    },
  );
}
