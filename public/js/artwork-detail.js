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
});
