document.addEventListener('DOMContentLoaded', () => {
  const img = document.getElementById('main-image');
  const lightbox = document.getElementById('lightbox');
  if (img && lightbox) {
    img.addEventListener('click', () => {
      lightbox.classList.remove('hidden');
    });
    lightbox.addEventListener('click', () => {
      lightbox.classList.add('hidden');
    });
  }

  const tabDescription = document.getElementById('tab-description');
  const tabDetails = document.getElementById('tab-details');
  const contentDescription = document.getElementById('content-description');
  const contentDetails = document.getElementById('content-details');

  const showContent = (el) => {
    el.classList.remove('hidden');
    requestAnimationFrame(() => {
      el.classList.remove('opacity-0');
    });
  };

  const hideContent = (el) => {
    el.classList.add('opacity-0');
    el.addEventListener('transitionend', () => {
      el.classList.add('hidden');
    }, { once: true });
  };

  if (tabDescription && tabDetails && contentDescription && contentDetails) {
    tabDescription.addEventListener('click', () => {
      tabDescription.classList.add('font-bold', 'border-black');
      tabDescription.classList.remove('text-gray-500', 'border-transparent');
      tabDetails.classList.remove('font-bold', 'border-black');
      tabDetails.classList.add('text-gray-500', 'border-transparent');
      showContent(contentDescription);
      hideContent(contentDetails);
    });
    tabDetails.addEventListener('click', () => {
      tabDetails.classList.add('font-bold', 'border-black');
      tabDetails.classList.remove('text-gray-500', 'border-transparent');
      tabDescription.classList.remove('font-bold', 'border-black');
      tabDescription.classList.add('text-gray-500', 'border-transparent');
      showContent(contentDetails);
      hideContent(contentDescription);
    });
  }

  // Wishlist, bookmark, and cart buttons
  const artworkId = document.body.dataset.artworkId;
  const wishlistBtn = document.getElementById('wishlist-btn');
  const bookmarkBtn = document.getElementById('bookmark-btn');
  const cartBtn = document.getElementById('cart-btn');

  const toggleStored = (key) => {
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    const idx = list.indexOf(artworkId);
    if (idx > -1) {
      list.splice(idx, 1);
      localStorage.setItem(key, JSON.stringify(list));
      return false;
    }
    list.push(artworkId);
    localStorage.setItem(key, JSON.stringify(list));
    return true;
  };

  const initActive = (btn, key, activeClass) => {
    if (!btn) return;
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    if (list.includes(artworkId)) {
      btn.classList.add(activeClass);
    }
    btn.addEventListener('click', () => {
      const active = toggleStored(key);
      btn.classList.toggle(activeClass, active);
    });
  };

  initActive(wishlistBtn, 'wishlist', 'text-red-500');
  initActive(bookmarkBtn, 'bookmarks', 'text-blue-500');
  initActive(cartBtn, 'cart', 'text-green-500');
});
