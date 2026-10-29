/* Menus start expanded and remain readable without JavaScript. */
if (!customElements.get('moya-footer')) {
  customElements.define(
    'moya-footer',
    class extends HTMLElement {
      connectedCallback() {
        this.controller?.abort();
        this.controller = new AbortController();
        const { signal } = this.controller;
        const mobile = window.matchMedia('(max-width: 749px)');
        const buttons = [...this.querySelectorAll('.moya-footer__toggle')];
        const setExpanded = (button, expanded) => {
          button.setAttribute('aria-expanded', String(expanded));
          const panel = this.querySelector(`#${CSS.escape(button.getAttribute('aria-controls'))}`);
          panel.setAttribute('aria-hidden', String(!expanded));
          panel.inert = !expanded;
        };
        buttons.forEach((button) => {
          button.addEventListener(
            'click',
            () => {
              if (mobile.matches)
                setExpanded(button, button.getAttribute('aria-expanded') !== 'true');
            },
            { signal },
          );
        });
        mobile.addEventListener(
          'change',
          () => {
            if (!mobile.matches) buttons.forEach((button) => setExpanded(button, true));
          },
          { signal },
        );
        this.addEventListener(
          'shopify:block:select',
          (event) => {
            const button = event.target
              .closest('.moya-footer__menu')
              ?.querySelector('.moya-footer__toggle');
            if (button) setExpanded(button, true);
          },
          { signal },
        );
        this.classList.add('is-enhanced');
      }
      disconnectedCallback() {
        this.controller?.abort();
        this.classList.remove('is-enhanced');
      }
    },
  );
}
