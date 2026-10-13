// Entry point for instagram.com. Runs at document_start so blocked pages
// redirect before the feed renders.
(function (root) {
  // Hide nav links to the feeds. Matching on href is far more stable than IG's class names.
  const CSS = `
    a[href="/"], a[href="/explore/"], a[href="/reels/"] { display: none !important; }
  `;

  function injectCss() {
    const style = document.createElement('style');
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  injectCss();
  root.MF.nav.start();
})(globalThis);
