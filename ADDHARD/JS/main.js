const menuButton = document.querySelector('.menu-button');
const navigation = document.querySelector('.navigation');
const navigationLinks = document.querySelectorAll('.navigation a');
const header = document.querySelector('.header');
const mobileMenuQuery = window.matchMedia('(max-width: 760px)');

function toggleMenu(forceClose = false) {
  const isOpen = forceClose ? false : !navigation.classList.contains('open');

  navigation.classList.toggle('open', isOpen);
  navigation.inert = mobileMenuQuery.matches && !isOpen;
  menuButton.classList.toggle('active', isOpen);
  header.classList.toggle('mobile-menu-open', isOpen);
  document.body.classList.toggle('menu-open', isOpen);
  menuButton.setAttribute('aria-expanded', String(isOpen));
  menuButton.setAttribute('aria-label', isOpen ? 'メニューを閉じる' : 'メニューを開く');
  document.body.style.overflow = isOpen ? 'hidden' : '';

  if (isOpen) navigationLinks[0].focus();
}

menuButton.addEventListener('click', () => toggleMenu());
navigationLinks.forEach((link) => link.addEventListener('click', () => toggleMenu(true)));

navigation.inert = mobileMenuQuery.matches;
mobileMenuQuery.addEventListener('change', (event) => {
  if (!event.matches && navigation.classList.contains('open')) toggleMenu(true);
  navigation.inert = event.matches && !navigation.classList.contains('open');
});

document.addEventListener('keydown', (event) => {
  if (!navigation.classList.contains('open')) return;

  if (event.key === 'Escape') {
    toggleMenu(true);
    menuButton.focus();
    return;
  }

  if (event.key !== 'Tab') return;
  const focusableItems = [menuButton, ...navigationLinks];
  const currentIndex = focusableItems.indexOf(document.activeElement);
  const nextIndex = event.shiftKey
    ? (currentIndex - 1 + focusableItems.length) % focusableItems.length
    : (currentIndex + 1) % focusableItems.length;
  event.preventDefault();
  focusableItems[nextIndex].focus();
});

document.querySelector('#year').textContent = new Date().getFullYear();

const revealTargets = document.querySelectorAll('.section, .contact');
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.animate(
        [
          { opacity: 0, transform: 'translateY(35px)' },
          { opacity: 1, transform: 'translateY(0)' }
        ],
        { duration: 700, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' }
      );
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

revealTargets.forEach((target) => observer.observe(target));

const productTrack = document.querySelector('.product-track');
const productPages = document.querySelectorAll('.product-page');
const previousButton = document.querySelector('.carousel-prev');
const nextButton = document.querySelector('.carousel-next');
const currentPageLabel = document.querySelector('.current-page');
const totalPagesLabel = document.querySelector('.total-pages');
let currentProductPage = 0;
let touchStartX = 0;

function updateProductCarousel() {
  productTrack.style.transform = `translateX(-${currentProductPage * 100}%)`;
  currentPageLabel.textContent = String(currentProductPage + 1).padStart(2, '0');
  previousButton.disabled = currentProductPage === 0;
  nextButton.disabled = currentProductPage === productPages.length - 1;
}

if (productTrack) {
  totalPagesLabel.textContent = String(productPages.length).padStart(2, '0');
  previousButton.addEventListener('click', () => {
    currentProductPage = Math.max(0, currentProductPage - 1);
    updateProductCarousel();
  });
  nextButton.addEventListener('click', () => {
    currentProductPage = Math.min(productPages.length - 1, currentProductPage + 1);
    updateProductCarousel();
  });
  productTrack.addEventListener('touchstart', (event) => {
    touchStartX = event.touches[0].clientX;
  }, { passive: true });
  productTrack.addEventListener('touchend', (event) => {
    const distance = touchStartX - event.changedTouches[0].clientX;
    if (Math.abs(distance) < 50) return;
    currentProductPage = distance > 0
      ? Math.min(productPages.length - 1, currentProductPage + 1)
      : Math.max(0, currentProductPage - 1);
    updateProductCarousel();
  }, { passive: true });
  updateProductCarousel();
}

const eyeTextures = [
  { name: 'Kuuta', id: '7127682', image: 'https://booth.pximg.net/c/620x620/f313133c-b9b8-4ba8-ab01-5762d38d9371/i/7127682/98e50649-4d7d-468d-9966-b5a78114dcce_base_resized.jpg' },
  { name: 'Milltina', id: '7218968', image: 'https://booth.pximg.net/c/620x620/f313133c-b9b8-4ba8-ab01-5762d38d9371/i/7218968/10562262-0685-46a7-ae5d-21f90f1cc5ac_base_resized.jpg' },
  { name: 'Hanka', id: '7218973', image: 'https://booth.pximg.net/c/620x620/f313133c-b9b8-4ba8-ab01-5762d38d9371/i/7218973/9567b25f-d3c3-40eb-9872-4c7fba9c6f75_base_resized.jpg' },
  { name: 'Chocolat', id: '7219117', image: 'https://booth.pximg.net/c/620x620/f313133c-b9b8-4ba8-ab01-5762d38d9371/i/7219117/272158a2-a093-4be2-b85b-248925036efe_base_resized.jpg' },
  { name: 'Bokusei', id: '7253717', image: 'https://booth.pximg.net/c/620x620/f313133c-b9b8-4ba8-ab01-5762d38d9371/i/7253717/4dec0989-94b5-4ec7-b20a-775d191bd320_base_resized.jpg' },
  { name: 'Alue', id: '7265097', image: 'https://booth.pximg.net/c/620x620/f313133c-b9b8-4ba8-ab01-5762d38d9371/i/7265097/919c2281-28e7-4c9f-b0e8-037ab6b6e668_base_resized.jpg' },
  { name: 'Lunina — Shattercore', id: '7556950', image: 'https://booth.pximg.net/c/620x620/f313133c-b9b8-4ba8-ab01-5762d38d9371/i/7556950/6f0aba5b-e9ee-4862-af56-b9c6e17b0b80_base_resized.jpg' },
  { name: 'Kuuta — Key', id: '6919104', image: 'https://booth.pximg.net/c/620x620/f313133c-b9b8-4ba8-ab01-5762d38d9371/i/6919104/4b1506aa-360f-4f8d-b3f3-bd891c2df7e3_base_resized.jpg' },
  { name: 'Kuuta — Conceal', id: '6961855', image: 'https://booth.pximg.net/c/620x620/f313133c-b9b8-4ba8-ab01-5762d38d9371/i/6961855/cc5769c9-583f-4e81-ad55-8d1347233aa8_base_resized.jpg' },
  { name: 'Shinano — Lava', id: '7008194', image: 'https://booth.pximg.net/c/620x620/f313133c-b9b8-4ba8-ab01-5762d38d9371/i/7008194/c2e780d5-419b-4fc5-9e30-68981ad82924_base_resized.jpg' },
  { name: 'Minase — Lava', id: '7008618', image: 'https://booth.pximg.net/c/620x620/f313133c-b9b8-4ba8-ab01-5762d38d9371/i/7008618/cbf8b5dc-f775-4212-9294-60872f7d5e8b_base_resized.jpg' },
  { name: 'Shinra — Lava', id: '7008629', image: 'https://booth.pximg.net/c/620x620/f313133c-b9b8-4ba8-ab01-5762d38d9371/i/7008629/a21f9f13-dc51-4b79-b45a-b95a0bd95111_base_resized.jpg' },
  { name: 'Kuuta — Lava', id: '7008634', image: 'https://booth.pximg.net/c/620x620/f313133c-b9b8-4ba8-ab01-5762d38d9371/i/7008634/37304a81-3c78-4e85-9069-cfc40e1b62c6_base_resized.jpg' },
  { name: 'Komano — Lava', id: '7009152', image: 'https://booth.pximg.net/c/620x620/f313133c-b9b8-4ba8-ab01-5762d38d9371/i/7009152/dc46e89a-6766-4705-88f3-d9f657e3668f_base_resized.jpg' },
  { name: 'Shinra — Conceal', id: '7041274', image: 'https://booth.pximg.net/c/620x620/f313133c-b9b8-4ba8-ab01-5762d38d9371/i/7041274/fc980ff3-71da-4349-b4ac-0a7f71b571df_base_resized.jpg' },
  { name: 'Komano — Shattercore', id: '7127664', image: 'https://booth.pximg.net/c/620x620/f313133c-b9b8-4ba8-ab01-5762d38d9371/i/7127664/13e6adfa-c1f8-4e27-abba-53998ae7ea10_base_resized.jpg' },
  { name: 'Shinano — Shattercore', id: '7127671', image: 'https://booth.pximg.net/c/620x620/f313133c-b9b8-4ba8-ab01-5762d38d9371/i/7127671/4db87c0d-2b90-4766-8127-8b55b8d57cdd_base_resized.jpg' },
  { name: 'Minase — Shattercore', id: '7127676', image: 'https://booth.pximg.net/c/620x620/f313133c-b9b8-4ba8-ab01-5762d38d9371/i/7127676/0d3d5c9a-df09-4407-87c7-9ebceb0c6fb2_base_resized.jpg' },
  { name: 'Shinra — Shattercore', id: '7127687', image: 'https://booth.pximg.net/c/620x620/f313133c-b9b8-4ba8-ab01-5762d38d9371/i/7127687/ecca818f-5aa5-4424-abe7-0942aef7f11e_base_resized.jpg' },
  { name: 'Kipufel — Lava', id: '7165339', image: 'https://booth.pximg.net/c/620x620/f313133c-b9b8-4ba8-ab01-5762d38d9371/i/7165339/cadc635f-1efb-40bf-8b44-ac231000a476_base_resized.jpg' },
  { name: 'Rurune — Lava', id: '7378352', image: 'https://booth.pximg.net/c/620x620/f313133c-b9b8-4ba8-ab01-5762d38d9371/i/7378352/ecd6f6cc-deef-4426-8851-c654b58966dc_base_resized.jpg' },
  { name: 'Kuuta — Vol.1', id: '6427471', image: 'https://booth.pximg.net/c/620x620/f313133c-b9b8-4ba8-ab01-5762d38d9371/i/6427471/12849aa3-61a7-475e-b9cf-c547de2ad44e_base_resized.jpg' },
  { name: 'Kuuta — Vol.2', id: '6489745', image: 'https://booth.pximg.net/c/620x620/f313133c-b9b8-4ba8-ab01-5762d38d9371/i/6489745/1b099677-9a92-48c4-86b9-09d7c8c9a30a_base_resized.jpg' },
  { name: 'Shinra — Vol.2', id: '6498977', image: 'https://booth.pximg.net/c/620x620/f313133c-b9b8-4ba8-ab01-5762d38d9371/i/6498977/e984bad6-5293-4a45-8ff5-8370d31bfcd9_base_resized.jpg' },
  { name: 'Minase — Vol.2', id: '6549249', image: 'https://booth.pximg.net/c/620x620/f313133c-b9b8-4ba8-ab01-5762d38d9371/i/6549249/1f6c4039-f577-4fb2-9883-36dfe3ed7988_base_resized.jpg' },
  { name: 'Birthday Edition — A', id: '6683842', image: 'https://booth.pximg.net/c/620x620/f313133c-b9b8-4ba8-ab01-5762d38d9371/i/6683842/a036e44e-8ee3-45de-b185-92ae4bec1928_base_resized.jpg' },
  { name: 'Birthday Edition — B', id: '6691448', image: 'https://booth.pximg.net/c/620x620/f313133c-b9b8-4ba8-ab01-5762d38d9371/i/6691448/a78e1f82-1f1d-44d3-bd75-6d3008abf4dd_base_resized.jpg' },
  { name: 'Minase — Distortion', id: '6692442', image: 'https://booth.pximg.net/c/620x620/f313133c-b9b8-4ba8-ab01-5762d38d9371/i/6692442/eb7e105d-0384-4953-ba98-bdd24e6beb67_base_resized.jpg' },
  { name: 'Kuuta — Distortion', id: '6696482', image: 'https://booth.pximg.net/c/620x620/f313133c-b9b8-4ba8-ab01-5762d38d9371/i/6696482/2c3d7457-e47e-4581-a8fd-183129e9a1df_base_resized.jpg' },
  { name: 'Shinra — Distortion', id: '6718014', image: 'https://booth.pximg.net/c/620x620/f313133c-b9b8-4ba8-ab01-5762d38d9371/i/6718014/f10a4ff8-58c0-4331-b3fe-673b5270ad9c_base_resized.jpg' },
  { name: 'Minase — Key', id: '6869302', image: 'https://booth.pximg.net/c/620x620/f313133c-b9b8-4ba8-ab01-5762d38d9371/i/6869302/34992930-4884-4f16-968c-0e2fb5235577_base_resized.jpg' },
  { name: 'Shinano — Key', id: '6882254', image: 'https://booth.pximg.net/c/620x620/f313133c-b9b8-4ba8-ab01-5762d38d9371/i/6882254/64bcf256-dd1d-4b33-8744-ec96131073dc_base_resized.jpg' },
  { name: 'Shinra — Key', id: '6925915', image: 'https://booth.pximg.net/c/620x620/f313133c-b9b8-4ba8-ab01-5762d38d9371/i/6925915/1736375b-37fb-4ba0-ab9d-72f7424c4525_base_resized.jpg' },
  { name: 'Shattercore — Full Pack', id: '7161356', image: 'https://booth.pximg.net/c/620x620/f313133c-b9b8-4ba8-ab01-5762d38d9371/i/7161356/bff8075a-35e6-4666-8fcf-3b3e330809d1_base_resized.jpg' },
  { name: 'Velnica — Eye & Makeup', id: '7360585', image: 'https://booth.pximg.net/c/620x620/f313133c-b9b8-4ba8-ab01-5762d38d9371/i/7360585/080cbb5b-52fa-40dd-ba01-8a7cae2af4c8_base_resized.jpg' }
];
const eyeReleaseOrder = [
  '7556950', '7265097', '7253717', '7219117', '7218968', '7218973', '7127682',
  '7127664', '7127676', '7127687', '7127671', '7161356', '7360585', '7041274',
  '6961855', '7378352', '7165339', '7008634', '7009152', '7008618', '7008629',
  '7008194', '6919104', '6925915', '6869302', '6882254', '6696482', '6718014',
  '6692442', '6683842', '6691448', '6489745', '6498977', '6549249', '6427471'
];
const eyeReleaseRank = new Map(eyeReleaseOrder.map((id, index) => [id, index]));
eyeTextures.sort((first, second) => eyeReleaseRank.get(first.id) - eyeReleaseRank.get(second.id));
const eyeNameOverrides = new Map([
  ['7556950', 'Lumina'],
  ['6683842', 'Birthday Edition'],
  ['6691448', 'Birthday Edition'],
  ['7161356', 'Full Pack'],
  ['7360585', 'Velnica']
]);

function getEyeDisplayName(item) {
  return eyeNameOverrides.get(item.id) || item.name.split(' — ')[0];
}
const eyeTrack = document.querySelector('.eye-track');
const eyePreviousButton = document.querySelector('.eye-prev');
const eyeNextButton = document.querySelector('.eye-next');
const eyeCurrentPageLabel = document.querySelector('.eye-current-page');
const eyeTotalPagesLabel = document.querySelector('.eye-total-pages');
const eyePageSize = 6;
const eyePageCount = Math.ceil(eyeTextures.length / eyePageSize);
let currentEyePage = 0;
let eyeTouchStartX = 0;

function loadEyePage(pageIndex) {
  const page = eyeTrack.querySelector(`.eye-page:nth-child(${pageIndex + 1})`);
  if (!page) return;

  page.querySelectorAll('img[data-src]').forEach((image) => {
    image.src = image.dataset.src;
    image.removeAttribute('data-src');
  });
}

function updateEyeCarousel() {
  loadEyePage(currentEyePage);
  eyeTrack.style.transform = `translateX(-${currentEyePage * 100}%)`;
  eyeCurrentPageLabel.textContent = String(currentEyePage + 1).padStart(2, '0');
  eyePreviousButton.disabled = currentEyePage === 0;
  eyeNextButton.disabled = currentEyePage === eyePageCount - 1;
}

if (eyeTrack) {
  eyeTrack.innerHTML = Array.from({ length: eyePageCount }, (_, pageIndex) => {
    const pageItems = eyeTextures.slice(pageIndex * eyePageSize, (pageIndex + 1) * eyePageSize);
    return `<div class="eye-page" aria-label="アイテクスチャ ${pageIndex + 1}ページ目">${pageItems.map((item, itemIndex) => `
      <a class="product-card" href="https://addhard.booth.pm/items/${item.id}" target="_blank" rel="noopener noreferrer">
        <div class="product-image"><img ${pageIndex === 0 ? `src="${item.image}"` : `data-src="${item.image}"`} alt="${getEyeDisplayName(item)} eye texture" loading="lazy" decoding="async" referrerpolicy="no-referrer"></div>
        <div class="product-meta"><div><span>EYE TEXTURE / ${String(pageIndex * eyePageSize + itemIndex + 1).padStart(2, '0')}</span><h3>${getEyeDisplayName(item)}</h3></div><i>↗</i></div>
      </a>
    `).join('')}</div>`;
  }).join('');

  eyeTotalPagesLabel.textContent = String(eyePageCount).padStart(2, '0');
  eyePreviousButton.addEventListener('click', () => {
    currentEyePage = Math.max(0, currentEyePage - 1);
    updateEyeCarousel();
  });
  eyeNextButton.addEventListener('click', () => {
    currentEyePage = Math.min(eyePageCount - 1, currentEyePage + 1);
    updateEyeCarousel();
  });
  eyeTrack.addEventListener('touchstart', (event) => {
    eyeTouchStartX = event.touches[0].clientX;
  }, { passive: true });
  eyeTrack.addEventListener('touchend', (event) => {
    const distance = eyeTouchStartX - event.changedTouches[0].clientX;
    if (Math.abs(distance) < 50) return;
    currentEyePage = distance > 0
      ? Math.min(eyePageCount - 1, currentEyePage + 1)
      : Math.max(0, currentEyePage - 1);
    updateEyeCarousel();
  }, { passive: true });
  updateEyeCarousel();
}
