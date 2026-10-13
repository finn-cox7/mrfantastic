// ==UserScript==
// @name        mrfantastic
// @version     0.1.0
// @description See what friends send you without the feed.
// @match       https://www.instagram.com/*
// @match       https://instagram.com/*
// @run-at      document-start
// @inject-into content
// ==/UserScript==
// --- src/rules.js ---
// Pure URL rules. No DOM access, so everything here is unit-tested.
// Loaded as a plain script in the browser (exposes globalThis.MF.rules)
// and via require() in tests.
(function (root, factory) {
  const api = factory();
  root.MF = Object.assign(root.MF || {}, { rules: api });
  if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis, function () {
  const IG_HOSTS = new Set(['instagram.com', 'www.instagram.com']);
  const IG_HOME = '/';
  // The Reels tab, with or without a trailing slash or query string.
  const IG_REELS_TAB = /^\/reels\/?$/;

  // /p/ID, /reel/ID, /reels/ID, /tv/ID, optionally prefixed by /username/
  const IG_POST = /^\/(?:[^/]+\/)?(?:p|reels?|tv)\/([^/]+)\/?$/;

  function isInstagram(url) {
    return IG_HOSTS.has(url.hostname);
  }

  // First path segments that are Instagram pages, not usernames.
  const IG_RESERVED = new Set([
    'explore', 'p', 'reel', 'reels', 'tv', 'stories', 'direct', 'accounts',
    'challenge', 'emails', 'session', 'two_factor', 'legal', 'privacy', 'about',
    'api', 'oauth', 'web', 'notifications',
  ]);
  // /username/, /username/reels/, /username/tagged/, /username/saved/
  const IG_PROFILE = /^\/([^/]+)\/(?:(?:reels|tagged|saved)\/)?$/;

  function isProfilePage(url) {
    const m = url.pathname.match(IG_PROFILE);
    return !!m && !IG_RESERVED.has(m[1]);
  }

  // Pages that may open a post or reel: DMs, profiles and the home feed.
  // Not Explore, and not another post (that's the arrow / swipe-to-next loop).
  function isSourcePage(url) {
    if (!isInstagram(url)) return false;
    return url.pathname === '/' || url.pathname.startsWith('/direct/') || isProfilePage(url);
  }

  // Stable key for a single post or reel page, or null if the URL isn't one.
  // Keyed by id only, because IG rewrites /p/ID to /reel/ID and adds a /username/ prefix.
  function contentKey(url) {
    if (!isInstagram(url)) return null;
    const m = url.pathname.match(IG_POST);
    return m ? 'ig:post:' + m[1] : null;
  }

  // A full page load counts as "opened from a link" if it came from outside
  // Instagram or from a source page (e.g. cmd-clicking a profile grid), but not
  // from Explore or another post.
  function referrerIsTrusted(referrer) {
    if (!referrer) return true;
    let ref;
    try { ref = new URL(referrer); } catch { return true; }
    if (!isInstagram(ref)) return true;
    return isSourcePage(ref);
  }

  // ctx: { initialLoad: bool, referrer: string, granted: bool }
  //   granted = the user clicked this item on a source page (tracked by nav.js)
  // returns { action: 'allow' } | { action: 'redirect', to }
  // Only the Reels tab and post/reel pages are gated; feed, stories, search,
  // Explore, profiles and DMs are all allowed. Post/reel pages need to be
  // opened from a source page.
  function classify(url, ctx) {
    if (!isInstagram(url)) return { action: 'allow' };

    if (IG_REELS_TAB.test(url.pathname)) return { action: 'redirect', to: IG_HOME };

    if (contentKey(url)) {
      if (ctx.granted) return { action: 'allow' };
      if (ctx.initialLoad && referrerIsTrusted(ctx.referrer)) return { action: 'allow' };
      return { action: 'redirect', to: IG_HOME };
    }

    return { action: 'allow' };
  }

  return { classify, contentKey, isSourcePage, referrerIsTrusted, IG_HOME };
});

// --- src/nav.js ---
// Tracks SPA navigation and "opened from a source page" grants, then enforces rules.classify.
// State lives in sessionStorage, so it is per-tab and dies with the tab.
(function (root) {
  const { rules } = root.MF;
  const GRANT_KEY = 'mf:grant';     // { key, at } written on a click on a source page
  const ALLOWED_KEY = 'mf:allowed'; // key of the content currently being viewed
  const GRANT_WINDOW_MS = 3000;     // for DM cards etc. that aren't plain <a href> links
  const POLL_MS = 200;

  function read(k) {
    try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; }
  }
  function write(k, v) {
    try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {}
  }
  function remove(k) {
    try { sessionStorage.removeItem(k); } catch {}
  }

  // Single-use: the grant is consumed by the first gated page it unlocks, so
  // swiping to the next reel lands on a new key with no grant and gets blocked.
  function consumeGrant(key) {
    if (read(ALLOWED_KEY) === key) return true;
    const grant = read(GRANT_KEY);
    if (!grant) return false;
    const fresh = Date.now() - grant.at < GRANT_WINDOW_MS;
    if (grant.key === key || (!grant.key && fresh)) {
      remove(GRANT_KEY);
      write(ALLOWED_KEY, key);
      return true;
    }
    return false;
  }

  function onClick(e) {
    if (!rules.isSourcePage(new URL(location.href))) return;
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a) {
      // Not a link (e.g. a DM card): unlock whatever opens in the next few seconds.
      write(GRANT_KEY, { key: null, at: Date.now() });
      return;
    }
    // A link: unlock only that post or reel. A link elsewhere (Explore, a profile)
    // clears any grant so it can't be carried onto the next page.
    const key = rules.contentKey(new URL(a.href, location.href));
    if (key) write(GRANT_KEY, { key, at: Date.now() });
    else remove(GRANT_KEY);
  }

  function enforce(initialLoad) {
    const url = new URL(location.href);
    const key = rules.contentKey(url);
    // Landing on Explore (or anywhere that isn't a source) drops an unused grant.
    if (!key && !rules.isSourcePage(url)) remove(GRANT_KEY);
    const granted = key ? consumeGrant(key) : false;
    const verdict = rules.classify(url, {
      initialLoad,
      referrer: document.referrer,
      granted,
    });
    if (verdict.action === 'redirect') {
      document.querySelectorAll('video, audio').forEach((m) => m.pause());
      location.replace(verdict.to);
      return;
    }
    // A direct link load is allowed once; pin it so IG's own replaceState
    // on the same item doesn't count as a new navigation.
    if (key && !granted) write(ALLOWED_KEY, key);
  }

  function start() {
    enforce(true);
    let last = location.href;
    const check = () => {
      if (location.href === last) return;
      last = location.href;
      enforce(false);
    };
    setInterval(check, POLL_MS);
    addEventListener('popstate', check);
    addEventListener('click', onClick, true);
  }

  root.MF.nav = { start };
})(globalThis);

// --- src/instagram.js ---
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
