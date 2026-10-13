// Tracks SPA navigation and "opened from a DM" grants, then enforces rules.classify.
// State lives in sessionStorage, so it is per-tab and dies with the tab.
(function (root) {
  const { rules } = root.MF;
  const GRANT_KEY = 'mf:grant';     // { key, at } written on a click inside DMs
  const ALLOWED_KEY = 'mf:allowed'; // key of the content currently being viewed
  const GRANT_WINDOW_MS = 3000;     // for DM cards that aren't plain <a href> links
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
    if (!rules.isMessagePage(new URL(location.href))) return;
    const a = e.target.closest && e.target.closest('a[href]');
    const key = a ? rules.contentKey(new URL(a.href, location.href)) : null;
    write(GRANT_KEY, { key, at: Date.now() });
  }

  function enforce(initialLoad) {
    const url = new URL(location.href);
    const key = rules.contentKey(url);
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
