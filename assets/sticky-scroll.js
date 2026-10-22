/**
 * Returns a function that as long as it continues to be invoked, won't be triggered.
 * @param {Function} fn - Callback function.
 * @param {number} [wait=300] - Delay (in milliseconds).
 * @returns {Function}
 */
function debounce(fn, wait = 300) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
    };
}

/**
 * Adjusts the css top property of an element such that it sticks appropriately based on the scroll
 * direction. The container is assumed to be position: sticky, with top: 0 (or whatever). When
 * scrolling down, it'll stick to the bottom of the container, when scrolling up it'll stick to
 * the top of the container.
 */
if (!customElements.get('sticky-scroll-direction')) {
    class StickyScrollDirection extends HTMLElement {
        connectedCallback() {
            this.init();
        }
    
        init() {
            const headerIsSticky = document.querySelector('store-header[sticky]');
            this.headerHeight = Number.parseInt(
                getComputedStyle(this.parentElement).getPropertyValue('--header-height').replace('px', ''), 10
            );
    
            // Initialize container directly
            this.container = this.querySelector('.product-gallery') || this.firstElementChild;
    
            // 使用 MutationObserver 监测子元素变化
            this.observer = new MutationObserver(() => {
                this.container = this.querySelector('.product-gallery') || this.firstElementChild;
            });
    
            this.observer.observe(this, { childList: true });
    
            this.currentTop = Number.parseInt(
                document.documentElement.scrollTop + this.getBoundingClientRect().top - this.offsetTop,
                10
            );
            this.defaultTop = headerIsSticky ? parseInt(this.headerHeight + 30, 10) : 48;
            this.scrollY = window.scrollY;
            this.minStickySize = this.dataset.minStickySize;
    
            this.toggleListeners();
            window.addEventListener('on:breakpoint-change', this.toggleListeners.bind(this));
        }
    
        // Handle Scroll function
        handleScroll() {
            if (!this.container) {
                return;
            }
            const bounds = this.container.getBoundingClientRect();
            const maxTop = bounds.top + window.scrollY - this.container.offsetTop + this.defaultTop;
            const minTop = this.container.clientHeight - window.innerHeight + 10;
            if (window.scrollY < this.scrollY) {
                this.currentTop -= window.scrollY - this.scrollY;
            } else {
                this.currentTop += this.scrollY - window.scrollY;
            }
            this.currentTop = Math.min(Math.max(this.currentTop, -minTop), maxTop, this.defaultTop);
            this.scrollY = window.scrollY;
            this.container.style.top = `${this.currentTop}px`;
        }
    
        toggleListeners() {
            if (window.innerWidth > 1000) {
                this.addListeners();
            } else {
                this.removeListeners();
            }
        }
    
        addListeners() {
            if (!this.handleScroll) {
                console.error("handleScroll method is not defined.");
                return;
            }
    
            // Ensure `scrollListener` is initialized
            if (!this.scrollListener) {
                this.scrollListener = this.handleScroll.bind(this);
            }
    
            // 如果已经有 scrollListener，避免重复绑定
            if (this.scrollListener) {
                window.addEventListener('scroll', this.scrollListener);
                this.scrollListener();
            }
    
            // Set the height of the parent to the total height of other elements
            if (this.parentElement.dataset.stickyHeightElems) {
                this.debouncedSetStickyHeights = this.debouncedSetStickyHeights
                    || debounce(this.setStickyHeight.bind(this), 500);
                window.addEventListener('resize', this.debouncedSetStickyHeights);
    
                if ('MutationObserver' in window) {
                    this.stickyHeightElems = this.parentElement.dataset.stickyHeightElems;
                    this.observer = new MutationObserver(this.debouncedSetStickyHeights);
                    document.querySelectorAll(this.stickyHeightElems).forEach((elem) => {
                        this.observer.observe(elem, {
                            childList: true,
                            attributes: true,
                            subtree: true
                        });
                    });
                }
    
                this.setStickyHeight();
            }
    
            // Listen for the opening of any disclosures, so their contents can be scrolled to if needed
            this.disclosures = this.querySelectorAll('details');
            if (this.disclosures) {
                this.disclosureChangeHandler = this.disclosureChangeHandler
                    || this.handleDisclosureChange?.bind(this);
                this.disclosures.forEach((disclosure) => {
                    disclosure.addEventListener('transitionend', this.disclosureChangeHandler);
                });
            }
        }
    
        removeListeners() {
            if (window.innerWidth > 768) {
                this.container.style.top = '';
                window.removeEventListener('scroll', this.scrollListener);
    
                if (this.observer) {
                    this.observer.disconnect();
                    window.removeEventListener('resize', this.debouncedSetStickyHeights);
                }
    
                if (this.disclosures) {
                    this.disclosures.forEach((disclosure) => {
                        disclosure.removeEventListener('transitionend', this.disclosureChangeHandler);
                    });
                }
            }
        }
    }
    

    customElements.define('sticky-scroll-direction', StickyScrollDirection);
}

