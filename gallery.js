const galleries = {
  jenny: {
    title: "Jenny's Gallery",
    description: "A collection from Jenny.",
    images: ["/images/jenny1.jpg", "/images/jenny2.jpg"]
  },
  leo: {
    title: "Leo's Gallery",
    description: "A collection from Leo.",
    images: ["/images/leo1.jpg", "/images/leo2.jpg"]
  }
};

function loadGallery() {
  const slug = window.location.pathname.replace(/^\//, '').trim();
  if (!slug || !galleries[slug]) {
    return;
  }

  const gallery = galleries[slug];
  const main = document.querySelector('main');
  main.innerHTML = `
    <h1 id="gallery-title">${gallery.title}</h1>
    <p>${gallery.description}</p>
    <div id="gallery-images"></div>
  `;
  const container = document.getElementById('gallery-images');
  gallery.images.forEach(src => {
    const img = document.createElement('img');
    img.src = src;
    img.alt = slug;
    img.style.maxWidth = '150px';
    img.style.margin = '0.5rem';
    container.appendChild(img);
  });
}

document.addEventListener('DOMContentLoaded', loadGallery);
