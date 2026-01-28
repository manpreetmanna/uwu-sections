if (!customElements.get('product-form')) {
  customElements.define(
    'product-form',
    class ProductForm extends HTMLElement {
      constructor() {
        super();
        this.form = this.querySelector('form');
        this.submitButton = this.querySelector('[type="submit"]');

        if (this.isPetitionProduct()) {
          this.submitButton.addEventListener('click', this.onPetitionButtonClick.bind(this), true);
          this.submitButton.disabled = false;
        } else {
          this.form.querySelector('[name=id]').disabled = false;
          this.form.addEventListener('submit', this.onSubmitHandler.bind(this));
          this.cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
          if (document.querySelector('cart-drawer')) this.submitButton.setAttribute('aria-haspopup', 'dialog');
          this.hideErrors = this.dataset.hideErrors === 'true';
          
          // Debug: Log cart element to ensure it's found
          console.log('Cart element found:', this.cart);
        }
      }

      isPetitionProduct() {
        return this.submitButton.textContent.includes('Pledge');
      }

      onPetitionButtonClick(evt) {
        evt.preventDefault();
        evt.stopPropagation();
        evt.stopImmediatePropagation();
        this.openPetitionModal();
      }

      onSubmitHandler(evt) {
        evt.preventDefault();
        if (this.submitButton.getAttribute('aria-disabled') === 'true') return;

        this.handleErrorMessage();

        this.submitButton.setAttribute('aria-disabled', true);
        this.submitButton.classList.add('loading');
        this.querySelector('.loading__spinner').classList.remove('hidden');

        // Ensure protection is in cart BEFORE adding the selected product
        const ensureProtectionBeforeAdd = async () => {
          try {
            if (window.setProtection) {
              await window.setProtection(true);
              return;
            }
            const cartRes = await fetch('/cart.js?ts=' + Date.now(), { credentials: 'same-origin', cache: 'no-store' });
            const cartData = await cartRes.json();
            const items = Array.isArray(cartData.items) ? cartData.items : [];
            const hasProt = items.some((i) => (i.product_id === 8936417853667) || (i.variant_id === 46997990703331) || (i.id === 46997990703331));
            if (!hasProt) {
              const body = new URLSearchParams({ id: '46997990703331', quantity: '1' });
              await fetch('/cart/add.js', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }, credentials: 'same-origin', body: body.toString() });
            }
          } catch(_) { /* ignore */ }
        };

        const config = fetchConfig('javascript');
        config.headers['X-Requested-With'] = 'XMLHttpRequest';
        delete config.headers['Content-Type'];

        const formData = new FormData(this.form);
        if (this.cart) {
          formData.append(
            'sections',
            this.cart.getSectionsToRender().map((section) => section.id)
          );
          formData.append('sections_url', window.location.pathname);
          this.cart.setActiveElement(document.activeElement);
        }
        config.body = formData;

        // Run protection ensure pre-add
        Promise.resolve(ensureProtectionBeforeAdd())
          .then(() => fetch(`${routes.cart_add_url}`, config))
          .then((response) => response.json())
          .then((response) => {
            if (response.status) {
              publish(PUB_SUB_EVENTS.cartError, {
                source: 'product-form',
                productVariantId: formData.get('id'),
                errors: response.errors || response.description,
                message: response.message,
              });
              this.handleErrorMessage(response.description);

              const soldOutMessage = this.submitButton.querySelector('.sold-out-message');
              if (!soldOutMessage) return;
              this.submitButton.setAttribute('aria-disabled', true);
              this.submitButton.querySelector('span').classList.add('hidden');
              soldOutMessage.classList.remove('hidden');
              this.error = true;
              return;
            } else if (!this.cart) {
              window.location = window.routes.cart_url;
              return;
            }

            if (!this.error)
              publish(PUB_SUB_EVENTS.cartUpdate, {
                source: 'product-form',
                productVariantId: formData.get('id'),
                cartData: response,
              });
            this.error = false;
            const quickAddModal = this.closest('quick-add-modal');
            if (quickAddModal) {
              document.body.addEventListener(
                'modalClosed',
                () => {
                  setTimeout(() => {
                    this.cart.renderContents(response);
                  });
                },
                { once: true }
              );
              quickAddModal.hide(true);
            } else {
              console.log('Regular product: calling cart.renderContents with response:', response);
              console.log('Cart element:', this.cart);
              this.cart.renderContents(response);
            }
            // Ensure shipping protection is present after add-to-cart
            (async () => {
              try {
                const ensureProtection = async () => {
                  try {
                    const cartRes = await fetch('/cart.js?ts=' + Date.now(), { credentials: 'same-origin', cache: 'no-store' });
                    const cartData = await cartRes.json();
                    const items = Array.isArray(cartData.items) ? cartData.items : [];
                    const hasProt = items.some((i) => (i.product_id === 8936417853667) || (i.variant_id === 46997990703331) || (i.id === 46997990703331));
                    if (!hasProt) {
                      const body = new URLSearchParams({ id: '46997990703331', quantity: '1' });
                      await fetch('/cart/add.js', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }, credentials: 'same-origin', body: body.toString() });
                    }
                  } catch (_) { /* ignore */ }
                };
                if (window.setProtection) {
                  await window.setProtection(true);
                } else {
                  await ensureProtection();
                }
                try { window.updateProtectedCheckoutLabels && window.updateProtectedCheckoutLabels(); } catch(_) {}
              } catch (_) { /* ignore */ }
            })();
          })
          .catch((e) => {
            console.error(e);
          })
          .finally(() => {
            this.submitButton.classList.remove('loading');
            if (this.cart && this.cart.classList.contains('is-empty')) this.cart.classList.remove('is-empty');
            if (!this.error) this.submitButton.removeAttribute('aria-disabled');
            this.querySelector('.loading__spinner').classList.add('hidden');
          });
      }

      handleErrorMessage(errorMessage = false) {
        if (this.hideErrors) return;

        this.errorMessageWrapper =
          this.errorMessageWrapper || this.querySelector('.product-form__error-message-wrapper');
        if (!this.errorMessageWrapper) return;
        this.errorMessage = this.errorMessage || this.errorMessageWrapper.querySelector('.product-form__error-message');

        this.errorMessageWrapper.toggleAttribute('hidden', !errorMessage);

        if (errorMessage) {
          this.errorMessage.textContent = errorMessage;
        }
      }

      async openPetitionModal() {
        console.log('Opening petition modal...');
        const modal = document.getElementById('petition-checkout-modal');
        if (!modal) {
          console.error('Petition modal not found');
          this.createDirectCheckout(1);
          return;
        }

        const productId = this.getAttribute('product-id');
        const productTitle = this.closest('.product__info')?.querySelector('.product__title')?.textContent || 'Petition Product';
        const productImage = this.closest('.product')?.querySelector('.product__media img')?.src || '';
        
        const modalTitle = modal.querySelector('.petition-modal-product-title');
        const modalImage = modal.querySelector('.petition-modal-product-image');
        const descriptionElement = modal.querySelector('#petition-selling-plan-description');
        
        if (modalTitle) modalTitle.textContent = productTitle;
        if (modalImage && productImage) {
          modalImage.src = productImage;
          modalImage.alt = productTitle;
        }
        
        try {
          const sellingPlanInfo = await this.getProductSellingPlanInfo(productId);
          if (sellingPlanInfo && descriptionElement) {
            descriptionElement.textContent = sellingPlanInfo.description;
            this.pledgeAmount = this.extractPledgeAmount(sellingPlanInfo.description);
            this.remainingAmount = this.extractRemainingAmount(sellingPlanInfo.description);
          }
        } catch (error) {
          console.error('Failed to fetch selling plan info:', error);
        }
        
        const quantityInput = modal.querySelector('#petition-quantity');
        if (quantityInput) {
          quantityInput.value = 1;
          this.updatePricingDisplay(1);
        }
        
        if (!this.modalInitialized) {
          this.initializeModal(modal);
          this.modalInitialized = true;
        }
        
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }

      initializeModal(modal) {
        const closeButtons = modal.querySelectorAll('.petition-modal-close');
        closeButtons.forEach(btn => {
          btn.addEventListener('click', () => this.closePetitionModal());
        });
        
        const overlay = modal.querySelector('.petition-modal-overlay');
        if (overlay) {
          overlay.addEventListener('click', () => this.closePetitionModal());
        }
        
        const quantityButtons = modal.querySelectorAll('.petition-quantity-btn');
        quantityButtons.forEach(btn => {
          btn.addEventListener('click', (e) => this.handleQuantityChange(e));
        });
        
        const quantityInput = modal.querySelector('#petition-quantity');
        if (quantityInput) {
          quantityInput.addEventListener('change', () => {
            const quantity = parseInt(quantityInput.value, 10) || 1;
            this.updatePricingDisplay(quantity);
          });
        }
        
        const pledgeButton = modal.querySelector('#petition-direct-checkout-btn');
        if (pledgeButton) {
          pledgeButton.addEventListener('click', () => {
            const quantity = parseInt(quantityInput.value, 10) || 1;
            this.createDirectCheckout(quantity);
          });
        }
      }

      closePetitionModal() {
        const modal = document.getElementById('petition-checkout-modal');
        if (modal) {
          modal.classList.remove('active');
          document.body.style.overflow = '';
        }
      }

      handleQuantityChange(evt) {
        const action = evt.currentTarget.dataset.action;
        const quantityInput = document.querySelector('#petition-quantity');
        let quantity = parseInt(quantityInput.value, 10) || 1;
        
        if (action === 'increment') {
          quantity = Math.min(quantity + 1, 99);
        } else if (action === 'decrement') {
          quantity = Math.max(quantity - 1, 1);
        }
        
        quantityInput.value = quantity;
        this.updatePricingDisplay(quantity);
      }

      updatePricingDisplay(quantity) {
        const pledgeElement = document.querySelector('#pledge-amount');
        const remainingElement = document.querySelector('#remaining-amount');
        
        if (pledgeElement && this.pledgeAmount) {
          pledgeElement.textContent = `$${(this.pledgeAmount * quantity).toFixed(2)}`;
        }
        
        if (remainingElement && this.remainingAmount) {
          remainingElement.textContent = `$${(this.remainingAmount * quantity).toFixed(2)}`;
        }
      }

      extractPledgeAmount(description) {
        const match = description.match(/\$([\d.]+)\s*now/i);
        return match ? parseFloat(match[1]) : 2.00;
      }

      extractRemainingAmount(description) {
        const match = description.match(/remaining\s*\$([\d.]+)/i);
        return match ? parseFloat(match[1]) : 29.99;
      }

      async getProductSellingPlanInfo(productId) {
        try {
          const response = await fetch('/api/2025-04/graphql.json', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Storefront-Access-Token': window.storefrontToken,
            },
            body: JSON.stringify({
              query: `
                query getProductSellingPlans($id: ID!) {
                  product(id: $id) {
                    sellingPlanGroups(first: 1) {
                      edges {
                        node {
                          sellingPlans(first: 1) {
                            edges {
                              node {
                                id
                                name
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              `,
              variables: { id: `gid://shopify/Product/${productId}` },
            }),
          });

          const { data } = await response.json();
          const sellingPlanEdges = data?.product?.sellingPlanGroups?.edges?.[0]?.node?.sellingPlans?.edges;
          
          if (sellingPlanEdges && sellingPlanEdges.length > 0) {
            return {
              id: sellingPlanEdges[0].node.id,
              description: sellingPlanEdges[0].node.name
            };
          }
          
          return null;
        } catch (error) {
          console.error('Failed to fetch selling plan info:', error);
          return null;
        }
      }

      async getProductSellingPlan(productId) {
        try {
          const response = await fetch('/api/2025-04/graphql.json', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Storefront-Access-Token': window.storefrontToken,
            },
            body: JSON.stringify({
              query: `
                query getProductSellingPlans($id: ID!) {
                  product(id: $id) {
                    sellingPlanGroups(first: 1) {
                      edges {
                        node {
                          sellingPlans(first: 1) {
                            edges {
                              node {
                                id
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              `,
              variables: { id: `gid://shopify/Product/${productId}` },
            }),
          });

          const { data } = await response.json();
          const sellingPlanEdges = data?.product?.sellingPlanGroups?.edges?.[0]?.node?.sellingPlans?.edges;
          
          if (sellingPlanEdges && sellingPlanEdges.length > 0) {
            return sellingPlanEdges[0].node.id;
          }
          
          return null;
        } catch (error) {
          console.error('Failed to fetch selling plan:', error);
          return null;
        }
      }

      async createDirectCheckout(quantity = 1) {
        this.submitButton.disabled = true;
        this.submitButton.querySelector('span').textContent = 'Pledging...';

        const variantId = this.form.querySelector('[name=id]').value;
        const productId = this.getAttribute('product-id');
        
        if (!productId) {
          throw new Error('Product ID not found');
        }
        
        const sellingPlanId = await this.getProductSellingPlan(productId);
        
        if (!sellingPlanId) {
          throw new Error('No selling plan found for this petition product');
        }

        const lineItems = [{ merchandiseId: `gid://shopify/ProductVariant/${variantId}`, quantity: quantity, sellingPlanId: sellingPlanId }];

        try {
          const response = await fetch('/api/2025-04/graphql.json', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Storefront-Access-Token': window.storefrontToken,
            },
            body: JSON.stringify({
              query: `
                mutation cartCreate($lines: [CartLineInput!]!) {
                  cartCreate(input: { lines: $lines }) {
                    cart {
                      checkoutUrl
                    }
                    userErrors {
                      field
                      message
                    }
                  }
                }
              `,
              variables: { lines: lineItems },
            }),
          });

          const responseData = await response.json();

          if (responseData.errors) {
            throw new Error('GraphQL errors: ' + JSON.stringify(responseData.errors));
          }

          if (!responseData.data || !responseData.data.cartCreate) {
            throw new Error('Invalid response structure: ' + JSON.stringify(responseData));
          }

          if (responseData.data.cartCreate.userErrors.length > 0) {
            throw new Error('User errors: ' + JSON.stringify(responseData.data.cartCreate.userErrors));
          }

          if (!responseData.data.cartCreate.cart || !responseData.data.cartCreate.cart.checkoutUrl) {
            throw new Error('Cart creation succeeded but no checkout URL was returned. Response: ' + JSON.stringify(responseData));
          }

          this.closePetitionModal();
          window.location.href = responseData.data.cartCreate.cart.checkoutUrl;
        } catch (error) {
          console.error('Checkout creation failed:', error);
          alert('Could not create a direct checkout. Error: ' + error.message);
          this.submitButton.disabled = false;
          this.submitButton.querySelector('span').textContent = 'Pledge $2 Today';
        }
      }
    }
  );
}
