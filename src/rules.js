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
