document.addEventListener('DOMContentLoaded', () => {
  const images = document.querySelectorAll('img[data-fade]');
  images.forEach(img => {
    const show = () => img.classList.remove('opacity-0');
    if (img.complete) {
      show();
    } else {
      img.addEventListener('load', show, { once: true });
    }
  });
});
