// Entry point for instagram.com. Runs at document_start so blocked pages
// redirect before they render.
(function (root) {
  // Matching on href / tag is far more stable than IG's class names.
  // 1. The Reels tab link in the sidebar.
  // 2. Every post in the home feed (each is an <article>). The story tray above
  //    them isn't an article, so stories stay. Scoped to the home page so a
  //    post opened from a DM or profile isn't hidden.
  const CSS = `
    a[href="/reels/"] { display: none !important; }
    html[data-mf-page="home"] article { display: none !important; }
  `;

  function injectCss() {
    const style = document.createElement('style');
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  function markPage() {
    const page = location.pathname === '/' ? 'home' : '';
    if (document.documentElement.dataset.mfPage !== page) {
      document.documentElement.dataset.mfPage = page;
    }
  }

  injectCss();
  markPage();
  setInterval(markPage, 200);
  root.MF.nav.start();
})(globalThis);
