// Entry point for instagram.com. Runs at document_start so blocked pages
// redirect before they render.
(function (root) {
  // Matching on href is far more stable than IG's class names.
  // 1. The Reels tab link in the sidebar.
  // 2. Reels mixed into the home feed: feed posts link to /p/ID, reels to /reel/ID.
  //    Scoped to the home feed so a reel opened from a DM isn't hidden.
  const CSS = `
    a[href="/reels/"] { display: none !important; }
    html[data-mf-page="home"] article:has(a[href*="/reel/"]) { display: none !important; }
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
