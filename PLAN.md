# mrfantastic — plan

## Goal

Block feed-scrolling on Instagram, YouTube and Snapchat on both laptop and phone,
while still letting me open the individual posts, reels, stories and videos that
friends send me.

**Core rule:** short-video content (Reels, Shorts, Spotlight) and single post/reel pages
are allowed only if I reached them from a *source*: a DM, an external link, and on
Instagram also a profile. Never from the feed, Explore or another post.
Swipe-to-next and autoplay-next are blocked. On Instagram the home feed's posts are
hidden; stories, search, Explore and profiles stay usable.

## Hard constraints (these decide the architecture)

| Platform | What's possible | Consequence |
|---|---|---|
| Desktop browser | Content scripts can read the URL and the page and rewrite both | Full control. Build this first. |
| iOS | No app can inspect or alter another app. Screen Time can only block a whole app. | Native apps get blocked entirely; filtered use goes through Safari + our script. **Snapchat has no mobile web**, so on iPhone it is either blocked or time-limited, not filtered. |

A blocker I write can also be turned off by me. Friction is part of the design (M4).

## My devices: iPhone 15 Pro + M4 MacBook

- **Mac:** the same code runs as a Chrome/Firefox extension (load unpacked) and as a
  Safari userscript.
- **iPhone:** Screen Time blocks the Instagram, YouTube and Snapchat apps (1-minute App
  Limit, "Block at End of Limit", Screen Time passcode held by a friend). Instagram and
  YouTube are used in Safari with the userscript instead.
- **Safari on both:** the free **Userscripts** app (App Store / Mac App Store) runs
  `dist/mrfantastic.user.js`. No Xcode, no $99/yr, nothing that expires every 7 days.
- **Snapchat:** blocked on the iPhone (no mobile web exists); use it on the Mac at
  web.snapchat.com. Check which browsers Snapchat web supports before M3.

## Rule engine (shared by every platform)

A pure function, `classify(url, context) -> allow | block | redirect(to)`, where
`context` records whether this navigation started from a DM or an external link.
URL-based rules come first because URLs change far less often than CSS class names.
DOM hiding is only for leftovers that a URL can't express (sidebars, "up next").

### Instagram (`instagram.com`)
- Allow: everything not listed below (stories, search, Explore, profiles, DMs).
- Home feed: the page loads, but every post (`article`) is hidden, so only the story
  tray shows. Not redirected, because the story tray lives there.
- Redirect to `/`: the Reels tab (`/reels/`).
- `/p/<id>`, `/reel/<id>`, `/reels/<id>`, `/tv/<id>` (also with a `/<user>/` prefix):
  allowed only when clicked on a **source page** (DMs or a profile) or
  loaded from an outside link; otherwise redirect to `/`.
- So these are blocked: anything opened from Explore, the next/previous arrows on a
  post, and swiping from one reel to the next.
- Hide the Reels link in the sidebar.

### YouTube (`youtube.com`, `m.youtube.com`)
- Allow `/watch?v=` and `/shorts/<id>` only when opened from an external link
  (external `document.referrer`, or a click out of an IG/Snapchat DM).
- Redirect `/`, `/feed/*` and `/shorts` navigation that isn't from a link → blank page.
- Hide the related sidebar, end screens, the Shorts shelf and autoplay; force autoplay off.
- Block SPA navigation from one Short to the next.
- Search: off by default (toggle in options).

### Snapchat (`web.snapchat.com`, desktop only)
- Allow chats, plus snaps and stories opened from a chat.
- Hide or redirect Spotlight, Discover and the stories of accounts I don't know.
- Needs DOM inspection first; Snapchat web is the least stable target.

## Repo layout

```
manifest.json               MV3 extension (Chrome / Firefox); plain JS, no build step
src/rules.js                classify(): pure, unit-tested
src/nav.js                  SPA URL-change watcher + "opened from DM" grants (sessionStorage)
src/instagram.js            entry point; injects CSS at document_start
src/youtube.js              (M2)
src/snapchat.js             (M3)
scripts/build-userscript.js bundles src/ into dist/mrfantastic.user.js for Safari
tests/rules.test.js         node:test, one case per URL rule (npm test)
```

### How "opened from a source page" works
1. On a source page, `nav.js` listens for link clicks and records the target post id in
   `sessionStorage` as an allow-token. A click on any other link clears the token.
2. On any gated URL, the content script checks for a matching token. No token → redirect.
3. The token is single-use, so swiping to the next reel produces a URL without a token,
   and that gets blocked.
4. SPA route changes are caught by polling `location.href` every 200ms plus `popstate`.
   (Content scripts run in an isolated world, so wrapping the page's `history.pushState` won't work.)
5. A click on a source page that isn't on a link (e.g. a DM card) gives a 3-second grant
   for the next item opened. Landing on a non-source page (Explore) drops it.
6. A full page load of a post is allowed (it came from a link, e.g. iMessage) unless the
   referrer is a non-DM Instagram page, which is what cmd-click from a grid would produce.

## Milestones

Status: **M1 working on iPhone Safari (Reels blocked, confirmed Oct 14).** Feed hiding
not yet confirmed on the phone. Safari's "Open in app" banner can't be removed: Safari
reads its meta tag before userscripts run.

| # | Deliverable | Done when |
|---|---|---|
| M1 | Extension skeleton + `rules.js` + tests + Instagram | Feed, Explore and Reels redirect to DMs; a reel sent in a DM plays; swiping past it is blocked |
| M2 | YouTube | Home/Shorts blocked; a link a friend sent plays with no sidebar or autoplay |
| M3 | Snapchat web | Chats work; Spotlight and Discover are gone |
| M4 | Friction | Disabling the extension or changing options needs a 60s wait + typed phrase |
| M5 | iPhone | Screen Time blocks the 3 apps; the userscript works in iPhone Safari on IG + YouTube |

**Known gap:** on the iPhone, nothing stops me from switching the script off in the
Userscripts app. Screen Time can't lock that, so the friend-held passcode only protects the app block.

## Risks
- **Site redesigns break DOM selectors.** Keep selectors minimal and push logic into URL rules.
- **Instagram mobile web DMs (iPhone path)**: check they still work in Safari before building M5-iOS.
- **Native Safari Web Extension** (rejected): needs Xcode, and a free Apple ID signature
  expires every 7 days unless I pay $99/yr. The Userscripts route avoids both.
