/* Petition Checkout Modal Handler */

class PetitionCheckout {
  constructor() {
    this.modal = document.querySelector('#petition-checkout-modal');
    this.init();
  }

  init() {
    if (!this.modal) return;

    const closeButtons = this.modal.querySelectorAll('.petition-modal-close');
    closeButtons.forEach(button => {
      button.addEventListener('click', () => this.hideModal());
    });

    const overlay = this.modal.querySelector('.petition-modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => this.hideModal());
    }

    const pledgeButton = this.modal.querySelector('#petition-direct-checkout-btn');
    if (pledgeButton) {
      pledgeButton.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleDirectCheckout();
      });
    }
  }

  populateModal(productData) {
    if (!this.modal) return;

    const { title, price, image, variantId } = productData;

    const titleEl = this.modal.querySelector('.petition-modal-product-title');
    const priceEl = this.modal.querySelector('.petition-modal-product-price');
    const imageEl = this.modal.querySelector('.petition-modal-product-image');
    const variantInput = this.modal.querySelector('#petition-variant-id');

    if (titleEl) titleEl.textContent = title;
    if (priceEl) priceEl.textContent = price;
    if (imageEl) {
      imageEl.src = image;
      imageEl.alt = title;
    }
    if (variantInput) variantInput.value = variantId;
  }

  showModal() {
    if (!this.modal) return;
    this.modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  hideModal() {
    if (!this.modal) return;
    this.modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  handleDirectCheckout() {
    const variantInput = this.modal.querySelector('#petition-variant-id');
    if (!variantInput || !variantInput.value) {
      console.error('Petition product variant ID not found.');
      alert('Could not process pledge. Please try again.');
      return;
    }
    const variantId = variantInput.value;
    
    // Construct the direct checkout URL
    const checkoutUrl = `/cart/${variantId}:1`;
    
    // Redirect the user
    window.location.href = checkoutUrl;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('petition-checkout-modal')) {
    if (!window.petitionCheckout) {
      window.petitionCheckout = new PetitionCheckout();
    }
  }
});
