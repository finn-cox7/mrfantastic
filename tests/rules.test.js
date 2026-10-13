const { test } = require('node:test');
const assert = require('node:assert');
const { classify, contentKey, IG_INBOX } = require('../src/rules.js');

const IG = 'https://www.instagram.com';
const spa = { initialLoad: false, referrer: '', granted: false };
const load = (referrer = '') => ({ initialLoad: true, referrer, granted: false });
const granted = { initialLoad: false, referrer: '', granted: true };

const run = (path, ctx) => classify(new URL(IG + path), ctx);
const allowed = (path, ctx) => assert.deepStrictEqual(run(path, ctx), { action: 'allow' }, path);
const blocked = (path, ctx) =>
  assert.deepStrictEqual(run(path, ctx), { action: 'redirect', to: IG_INBOX }, path);

test('feeds redirect to DMs', () => {
  for (const p of ['/', '/?variant=following', '/explore/', '/explore/tags/cats/', '/reels/', '/stories/someone/']) {
    blocked(p, spa);
    blocked(p, load());
  }
});

test('profiles redirect to DMs', () => {
  blocked('/someuser/', spa);
  blocked('/someuser/', load());
});

test('DMs, login and settings are always allowed', () => {
  for (const p of ['/direct/inbox/', '/direct/t/123456/', '/accounts/login/', '/accounts/edit/', '/challenge/']) {
    allowed(p, spa);
  }
});

test('content clicked in a DM is allowed', () => {
  for (const p of ['/p/ABC/', '/reel/ABC/', '/reels/ABC/', '/tv/ABC/', '/user/p/ABC/', '/user/reel/ABC/', '/stories/friend/3141592653/']) {
    allowed(p, granted);
  }
});

test('in-app navigation to content without a DM click is blocked (swipe to next reel)', () => {
  for (const p of ['/p/ABC/', '/reel/XYZ/', '/stories/friend/3141592653/']) blocked(p, spa);
});

test('opening a link from outside Instagram is allowed', () => {
  allowed('/reel/ABC/', load());
  allowed('/reel/ABC/', load('https://www.youtube.com/'));
  allowed('/p/ABC/', load(IG + '/direct/t/123/'));
});

test('opening content in a new tab from elsewhere on Instagram is blocked', () => {
  blocked('/p/ABC/', load(IG + '/'));
  blocked('/p/ABC/', load(IG + '/someuser/'));
});

test('contentKey ignores type, username prefix and query string', () => {
  const key = (p) => contentKey(new URL(IG + p));
  assert.strictEqual(key('/p/ABC/'), key('/reel/ABC/?igsh=xyz'));
  assert.strictEqual(key('/p/ABC/'), key('/someuser/reel/ABC'));
  assert.strictEqual(key('/explore/'), null);
  assert.strictEqual(key('/stories/friend/'), null);
  assert.strictEqual(contentKey(new URL('https://example.com/p/ABC/')), null);
});
