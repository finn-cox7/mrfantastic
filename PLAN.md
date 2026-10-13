# mrfantastic — plan

## Goal

Block feed-scrolling on Instagram, YouTube and Snapchat on both laptop and phone,
while still letting me open the individual posts, reels, stories and videos that
friends send me.

**Core rule:** content is allowed only if I reached it *from a message* (a DM or an
external link). Anything the platform pushes at me — home feed, Explore, Reels tab,
Shorts, Spotlight, recommendations, autoplay-next, swipe-to-next — is blocked.

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
- Allow: `/direct/*` (DMs).
- Allow only when opened from a DM: `/p/<id>`, `/reel/<id>`, `/stories/<user>/<id>`.
- Redirect to `/direct/inbox/`: `/` (feed), `/explore/*`, `/reels/*`, a profile grid
  (`/<user>/`), and story tray auto-advance into a story nobody sent me.
- Block navigating from one reel to another that wasn't sent (that's the scroll loop).

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

### How "opened from a DM" works
1. On `/direct/*`, `nav.js` listens for link clicks and records the target URL in
   `sessionStorage` as an allow-token.
2. On any gated URL, the content script checks for a matching token. No token → redirect.
3. The token is single-use, so swiping to the next reel produces a URL without a token,
   and that gets blocked.
4. SPA route changes are caught by polling `location.href` every 200ms plus `popstate`.
   (Content scripts run in an isolated world, so wrapping the page's `history.pushState` won't work.)
5. A DM card that isn't a plain `<a href>` gives a 3-second grant for the next item opened.
6. A full page load of a post is allowed (it came from a link, e.g. iMessage) unless the
   referrer is a non-DM Instagram page, which is what cmd-click from a grid would produce.

## Milestones

Status: **M1 built and unit-tested; not yet checked against live instagram.com.**

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
