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

  const tabAbout = document.getElementById('tab-about');
  const tabDetails = document.getElementById('tab-details');
  const contentAbout = document.getElementById('content-about');
  const contentDetails = document.getElementById('content-details');
  if (tabAbout && tabDetails && contentAbout && contentDetails) {
    tabAbout.addEventListener('click', () => {
      tabAbout.classList.add('border-black');
      tabAbout.classList.remove('text-gray-500');
      tabDetails.classList.remove('border-black');
      tabDetails.classList.add('text-gray-500');
      contentAbout.classList.remove('hidden');
      contentDetails.classList.add('hidden');
    });
    tabDetails.addEventListener('click', () => {
      tabDetails.classList.add('border-black');
      tabDetails.classList.remove('text-gray-500');
      tabAbout.classList.remove('border-black');
      tabAbout.classList.add('text-gray-500');
      contentDetails.classList.remove('hidden');
      contentAbout.classList.add('hidden');
    });
  }
});
