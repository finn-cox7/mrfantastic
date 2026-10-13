// Pure URL rules. No DOM access, so everything here is unit-tested.
// Loaded as a plain script in the browser (exposes globalThis.MF.rules)
// and via require() in tests.
(function (root, factory) {
  const api = factory();
  root.MF = Object.assign(root.MF || {}, { rules: api });
  if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis, function () {
  const IG_HOSTS = new Set(['instagram.com', 'www.instagram.com']);
  const IG_INBOX = '/direct/inbox/';

  // First path segments that are never a feed: DMs, login, settings, legal.
  const IG_ALWAYS_ALLOWED = new Set([
    'direct', 'accounts', 'challenge', 'emails', 'session', 'two_factor',
    'legal', 'privacy', 'about', 'api', 'oauth', 'web',
  ]);

  // /p/ID, /reel/ID, /reels/ID, /tv/ID, optionally prefixed by /username/
  const IG_POST = /^\/(?:[^/]+\/)?(?:p|reels?|tv)\/([^/]+)\/?$/;
  // /stories/username/ID  (bare /stories/username/ is the tray, not gated)
  const IG_STORY = /^\/stories\/([^/]+)\/(\d+)\/?$/;

  function isInstagram(url) {
    return IG_HOSTS.has(url.hostname);
  }

  // Pages where clicking a link means "a friend sent me this".
  function isMessagePage(url) {
    return isInstagram(url) && url.pathname.startsWith('/direct/');
  }

  // Stable key for a single piece of content, or null if the URL isn't one.
  // Keyed by id only, because IG rewrites /p/ID to /reel/ID and adds a /username/ prefix.
  function contentKey(url) {
    if (!isInstagram(url)) return null;
    let m = url.pathname.match(IG_POST);
    if (m) return 'ig:post:' + m[1];
    m = url.pathname.match(IG_STORY);
    if (m) return 'ig:story:' + m[2];
    return null;
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
  function classify(url, ctx) {
    if (!isInstagram(url)) return { action: 'allow' };

    const first = url.pathname.split('/')[1] || '';
    if (IG_ALWAYS_ALLOWED.has(first)) return { action: 'allow' };

    if (contentKey(url)) {
      if (ctx.granted) return { action: 'allow' };
      if (ctx.initialLoad && referrerIsTrusted(ctx.referrer)) return { action: 'allow' };
      return { action: 'redirect', to: IG_INBOX };
    }

    // Home feed, Explore, Reels tab, story tray, profiles, everything else.
    return { action: 'redirect', to: IG_INBOX };
  }

  return { classify, contentKey, isMessagePage, referrerIsTrusted, IG_INBOX };
});
