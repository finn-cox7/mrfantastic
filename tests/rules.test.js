const { test } = require('node:test');
const assert = require('node:assert');
const { classify, contentKey, isSourcePage, IG_HOME } = require('../src/rules.js');

const IG = 'https://www.instagram.com';
const spa = { initialLoad: false, referrer: '', granted: false };
const load = (referrer = '') => ({ initialLoad: true, referrer, granted: false });
const granted = { initialLoad: false, referrer: '', granted: true };

const run = (path, ctx) => classify(new URL(IG + path), ctx);
const allowed = (path, ctx) => assert.deepStrictEqual(run(path, ctx), { action: 'allow' }, path);
const blocked = (path, ctx) =>
  assert.deepStrictEqual(run(path, ctx), { action: 'redirect', to: IG_HOME }, path);

test('Reels tab is blocked', () => {
  for (const p of ['/reels/', '/reels', '/reels/?x=1']) {
    blocked(p, spa);
    blocked(p, load());
  }
});

test('feed, stories, search, explore, profiles and DMs are allowed', () => {
  const pages = [
    '/', '/?variant=following', '/explore/', '/explore/search/', '/explore/tags/cats/',
    '/stories/someone/', '/stories/someone/3141592653/', '/someuser/', '/someuser/reels/',
    '/direct/inbox/', '/direct/t/123456/', '/accounts/login/',
  ];
  for (const p of pages) {
    allowed(p, spa);
    allowed(p, load(IG + '/'));
  }
});

test('post and reel pages clicked on a source page are allowed', () => {
  for (const p of ['/p/ABC/', '/reel/ABC/', '/reels/ABC/', '/tv/ABC/', '/user/p/ABC/', '/user/reel/ABC/']) {
    allowed(p, granted);
  }
});

test('in-app navigation to a post or reel without a source click is blocked (Explore, next-post arrows, swipe)', () => {
  for (const p of ['/p/ABC/', '/reel/XYZ/', '/reels/XYZ/']) blocked(p, spa);
});

test('opening a link from outside Instagram is allowed', () => {
  allowed('/reel/ABC/', load());
  allowed('/reel/ABC/', load('https://www.youtube.com/'));
  allowed('/p/ABC/', load(IG + '/direct/t/123/'));
});

test('opening a post in a new tab: allowed from a source page, blocked from feed, Explore or another post', () => {
  blocked('/p/ABC/', load(IG + '/'));
  allowed('/p/ABC/', load(IG + '/someuser/'));
  allowed('/p/ABC/', load(IG + '/someuser/reels/'));
  blocked('/p/ABC/', load(IG + '/explore/'));
  blocked('/p/ABC/', load(IG + '/explore/tags/cats/'));
  blocked('/p/ABC/', load(IG + '/p/PREV/'));
  blocked('/p/ABC/', load(IG + '/someuser/p/PREV/'));
});

test('source pages are DMs and profiles only', () => {
  const src = (p) => isSourcePage(new URL(IG + p));
  for (const p of ['/direct/inbox/', '/direct/t/1/', '/someuser/', '/someuser/reels/', '/someuser/tagged/']) {
    assert.ok(src(p), p);
  }
  for (const p of ['/', '/?variant=following', '/explore/', '/explore/search/', '/reels/', '/p/ABC/', '/someuser/p/ABC/', '/reel/ABC/', '/stories/a/1/', '/accounts/edit/']) {
    assert.ok(!src(p), p);
  }
  assert.ok(!isSourcePage(new URL('https://example.com/')));
});

test('contentKey ignores type, username prefix and query string', () => {
  const key = (p) => contentKey(new URL(IG + p));
  assert.strictEqual(key('/p/ABC/'), key('/reel/ABC/?igsh=xyz'));
  assert.strictEqual(key('/p/ABC/'), key('/someuser/reel/ABC'));
  assert.strictEqual(key('/reels/'), null);
  assert.strictEqual(key('/stories/friend/123/'), null);
  assert.strictEqual(contentKey(new URL('https://example.com/p/ABC/')), null);
});
