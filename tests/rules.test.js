const { test } = require('node:test');
const assert = require('node:assert');
const { classify, contentKey, IG_HOME } = require('../src/rules.js');

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

test('post and reel pages clicked in a DM are allowed', () => {
  for (const p of ['/p/ABC/', '/reel/ABC/', '/reels/ABC/', '/tv/ABC/', '/user/p/ABC/', '/user/reel/ABC/']) {
    allowed(p, granted);
  }
});

test('in-app navigation to a post or reel without a DM click is blocked (feed click, swipe to next reel)', () => {
  for (const p of ['/p/ABC/', '/reel/XYZ/', '/reels/XYZ/']) blocked(p, spa);
});

test('opening a link from outside Instagram is allowed', () => {
  allowed('/reel/ABC/', load());
  allowed('/reel/ABC/', load('https://www.youtube.com/'));
  allowed('/p/ABC/', load(IG + '/direct/t/123/'));
});

test('opening a post in a new tab from elsewhere on Instagram is blocked', () => {
  blocked('/p/ABC/', load(IG + '/'));
  blocked('/p/ABC/', load(IG + '/someuser/'));
});

test('contentKey ignores type, username prefix and query string', () => {
  const key = (p) => contentKey(new URL(IG + p));
  assert.strictEqual(key('/p/ABC/'), key('/reel/ABC/?igsh=xyz'));
  assert.strictEqual(key('/p/ABC/'), key('/someuser/reel/ABC'));
  assert.strictEqual(key('/reels/'), null);
  assert.strictEqual(key('/stories/friend/123/'), null);
  assert.strictEqual(contentKey(new URL('https://example.com/p/ABC/')), null);
});
