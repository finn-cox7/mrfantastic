// Entry point for instagram.com. Runs at document_start so blocked pages
// redirect before they render.
(function (root) {
  // Matching on href / tag is far more stable than IG's class names.
  // 1. The Reels tab link in the sidebar.
  // 2. Every post in the home feed (each is an <article>). The story tray above
  //    them isn't an article, so stories stay. Scoped to the home page so a
  //    post opened from a DM or profile isn't hidden.
  const CSS = `
    a[href^="/reels/"] { display: none !important; }
    html[data-mf-page="home"] article { display: none !important; }
  `;

  // Two routes, because Safari can apply the page's CSP to a <style> element a
  // content script inserts. A constructed stylesheet isn't subject to that.
  function injectCss() {
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(CSS);
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    } catch {}
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

  // Safari's "Open in the Instagram app" banner comes from this meta tag. Safari
  // reads it while parsing <head>, so remove it the moment it's inserted.
  function removeAppBanner() {
    const SELECTOR = 'meta[name="apple-itunes-app"]';
    const strip = () => document.querySelectorAll(SELECTOR).forEach((m) => m.remove());
    strip();
    const observer = new MutationObserver(strip);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    addEventListener('DOMContentLoaded', () => { strip(); observer.disconnect(); });
  }

  const debug = root.MF.debug || { set() {} };
  try {
    removeAppBanner();
    injectCss();
    markPage();
    setInterval(markPage, 200);
    root.MF.nav.start();
  } catch (e) {
    debug.set({ error: String(e) });
  }
})(globalThis);
