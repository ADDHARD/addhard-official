function renderNewsArchivePage() {
  const normalizedPath = window.location.pathname.replace(/\\/g, '/');
  const isNewsArchivePath = normalizedPath.endsWith('/news.html') || normalizedPath.endsWith('/CSS/news');
  if (!isNewsArchivePath) return;

  const isHtmlFolderPage = normalizedPath.endsWith('/HTML/news.html');
  const isCssFolderPage = normalizedPath.endsWith('/CSS/news.html') || normalizedPath.endsWith('/CSS/news');
  const homePath = isHtmlFolderPage ? './index.html' : isCssFolderPage ? '../HTML/index.html' : './HTML/index.html';

  document.title = 'NEWS ARCHIVE | ADDHARD公式サイト';
  const description = document.querySelector('meta[name="description"]');
  if (description) {
    description.setAttribute('content', 'ADDHARD公式サイトのお知らせ履歴。販売情報、キャンペーン、更新情報をまとめています。');
  }

  document.body.innerHTML = `
    <header class="header archive-header">
      <a class="wordmark" href="${homePath}#home" aria-label="ADDHARD ホーム">𝐀𝐃𝐃𝐇𝐀𝐑𝐃</a>

      <button class="menu-button" type="button" aria-label="メニューを開く" aria-expanded="false">
        <span></span><span></span>
      </button>

      <nav class="navigation" aria-label="メインナビゲーション">
        <a href="${homePath}#about">ABOUT</a>
        <a href="${homePath}#news">NEWS</a>
        <a href="${homePath}#item">ITEM</a>
        <a href="${homePath}#tools">Tools</a>
        <a href="${homePath}#qa">Q&amp;A</a>
        <a href="https://discord.com/invite/wA6N35jYB5" target="_blank" rel="noopener noreferrer">CONTACT ↗</a>
        <a href="https://addhard.booth.pm/" target="_blank" rel="noopener noreferrer">BOOTH ↗</a>
        <a href="${homePath}#links">LINKS</a>
      </nav>
    </header>

    <main class="archive-main">
      <section class="archive-hero">
        <div class="archive-copy">
          <p class="section-label">NEWS ARCHIVE</p>
          <h1>ALL<br>NEWS.</h1>
          <p>ADDHARDの販売情報、キャンペーン、サイト更新のお知らせを時系列でまとめています。</p>
          <a href="${homePath}#news">トップのお知らせへ戻る <span>↗</span></a>
        </div>
      </section>

      <section class="archive-list" aria-label="お知らせ履歴">
        <article class="archive-item">
          <time datetime="2026-09-25">2026.09.25</time>
          <div>
            <h2>ADDHARD-Milltina Shapekeyの販売開始！！</h2>
            <p>Milltina向け追加シェイプキーの販売を開始しました。対応内容や商品詳細はBOOTHから確認できます。</p>
            <a href="https://addhard.booth.pm/items/8821073" target="_blank" rel="noopener noreferrer">BOOTHで見る <span>↗</span></a>
          </div>
        </article>

        <article class="archive-item">
          <time datetime="2026-09-14">2026.09.14</time>
          <div>
            <h2>ADDHARD-Milltina Shapekey 予告開始！！</h2>
            <p>Milltina向け追加シェイプキーの商品ページを公開しました。商品内容や販売情報はBOOTHから確認できます。</p>
            <a href="https://addhard.booth.pm/items/8821073" target="_blank" rel="noopener noreferrer">BOOTHで見る <span>↗</span></a>
          </div>
        </article>

        <article class="archive-item">
          <time datetime="2026-06-25">2026.06.25</time>
          <div>
            <h2>Q&amp;Aページを追加しました。</h2>
            <p>導入時によくある質問を確認できるQ&amp;Aセクションを追加しました。今後も問い合わせ内容に合わせて更新していきます。</p>
            <a href="${homePath}#qa">Q&amp;Aを見る <span>↓</span></a>
          </div>
        </article>

        <article class="archive-item">
          <time datetime="2026-06-25">2026.06.25</time>
          <div>
            <h2>ADDHARD-Chocolat Shapekeyの販売開始！！</h2>
            <p>Chocolat向け追加シェイプキーの販売を開始しました。対応内容や商品詳細はBOOTHから確認できます。</p>
            <a href="https://addhard.booth.pm/items/8511130" target="_blank" rel="noopener noreferrer">BOOTHで見る <span>↗</span></a>
          </div>
        </article>

        <article class="archive-item">
          <time datetime="2026-06-22">2026.06.22</time>
          <div>
            <h2>ADDHARD ウェブサイトをオープンしました。</h2>
            <p>ADDHARDの公式サイトを公開しました。商品情報、導入方法、メンバー情報、リンクをこのサイトにまとめています。</p>
            <a href="${homePath}#home">トップへ戻る <span>↗</span></a>
          </div>
        </article>

        <article class="archive-item">
          <time datetime="2026-06-19">2026.06.19</time>
          <div>
            <h2>ADDHARD-Chocolat Shapekey 販売前キャンペーン開催！！</h2>
            <p>Chocolat Shapekeyの販売前キャンペーンを開催しました。キャンペーン投稿はXから確認できます。</p>
            <a href="https://x.com/garyu311/status/2067729316805222594?s=20" target="_blank" rel="noopener noreferrer">Xで詳細を見る <span>↗</span></a>
          </div>
        </article>
      </section>
    </main>

    <footer>
      <a class="footer-logo" href="${homePath}#home">𝐀𝐃𝐃𝐇𝐀𝐑𝐃</a>
      <div><p>© <span id="year"></span> ADDHARD</p></div>
    </footer>
  `;
}

renderNewsArchivePage();

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

const revealTargets = document.querySelectorAll('.section, .item-catalog, .install-guide, .team, .qa, .contact-links');
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
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
}

// Catalog markup is generated from the shared editable content at build time.
// This controller changes pages only; it never rebuilds or reorders cards.
function setupCatalogCarousel(trackSelector, pageSelector, previousSelector, nextSelector, currentSelector, totalSelector) {
  const track=document.querySelector(trackSelector);
  if(!track) return;
  const pages=track.querySelectorAll(pageSelector);
  const previous=document.querySelector(previousSelector);
  const next=document.querySelector(nextSelector);
  const current=document.querySelector(currentSelector);
  const total=document.querySelector(totalSelector);
  if(!previous || !next || !current || !total) return;
  let page=0;
  let touchStart=0;
  const last=Math.max(0,pages.length-1);
  function update() {
    track.style.transform=`translateX(-${page*100}%)`;
    current.textContent=String(pages.length?page+1:0).padStart(2,'0');
    total.textContent=String(pages.length).padStart(2,'0');
    previous.disabled=pages.length===0 || page===0;
    next.disabled=pages.length===0 || page===last;
  }
  previous.addEventListener('click',()=>{page=Math.max(0,page-1);update()});
  next.addEventListener('click',()=>{page=Math.min(last,page+1);update()});
  track.addEventListener('touchstart',event=>{touchStart=event.touches[0].clientX},{passive:true});
  track.addEventListener('touchend',event=>{
    const distance=touchStart-event.changedTouches[0].clientX;
    if(Math.abs(distance)<50) return;
    page=distance>0?Math.min(last,page+1):Math.max(0,page-1);
    update();
  },{passive:true});
  update();
}

setupCatalogCarousel('.product-track','.product-page','.carousel-prev','.carousel-next','.current-page','.total-pages');
setupCatalogCarousel('.eye-track','.eye-page','.eye-prev','.eye-next','.eye-current-page','.eye-total-pages');
