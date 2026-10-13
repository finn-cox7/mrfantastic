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

  // Pages where clicking a link means "a friend sent me this".
  function isMessagePage(url) {
    return isInstagram(url) && url.pathname.startsWith('/direct/');
  }

  // Stable key for a single post or reel page, or null if the URL isn't one.
  // Keyed by id only, because IG rewrites /p/ID to /reel/ID and adds a /username/ prefix.
  function contentKey(url) {
    if (!isInstagram(url)) return null;
    const m = url.pathname.match(IG_POST);
    return m ? 'ig:post:' + m[1] : null;
  }

  // A full page load counts as "opened from a link" unless it came from
  // elsewhere on Instagram (e.g. cmd-clicking a "more posts" grid).
  function referrerIsTrusted(referrer) {
    if (!referrer) return true;
    let ref;
    try { ref = new URL(referrer); } catch { return true; }
    if (!isInstagram(ref)) return true;
    return isMessagePage(ref);
  }

  // ctx: { initialLoad: bool, referrer: string, granted: bool }
  //   granted = the user clicked this item in a DM (tracked by nav.js)
  // returns { action: 'allow' } | { action: 'redirect', to }
  // Only the Reels tab and post/reel pages are gated; feed, stories, search,
  // Explore, profiles and DMs are all allowed.
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

  return { classify, contentKey, isMessagePage, referrerIsTrusted, IG_HOME };
});
