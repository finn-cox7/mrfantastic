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
| Android | An AccessibilityService can see which screen another app is on and press Back | Full control over the native apps. Sideloaded APK, free. |
| iOS | No app can inspect or alter another app. Screen Time can only block a whole app. | Native apps get blocked entirely; filtered use goes through Safari + our script. **Snapchat has no mobile web**, so on iPhone it is either blocked or time-limited, not filtered. |

A blocker I write can also be turned off by me. Friction is part of the design (M4).

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
extension/            Chrome MV3 (also loads in Firefox); plain JS, no build step
  manifest.json
  src/rules.js        classify(): pure, unit-tested
  src/nav.js          SPA URL-change watcher + "opened from DM" token (sessionStorage)
  src/instagram.js
  src/youtube.js
  src/snapchat.js
  src/hide.css        injected at document_start so feeds never flash on screen
  options.html/.js    toggles (YouTube search, profiles, etc.)
tests/rules.test.js   Vitest: one case per URL rule above
android/              (M5, if I use Android) Kotlin AccessibilityService app
ios/                  (M5, if I use iPhone) Screen Time setup + Safari script
```

### How "opened from a DM" works
1. On `/direct/*`, `nav.js` listens for link clicks and records the target URL in
   `sessionStorage` as an allow-token.
2. On any gated URL, the content script checks for a matching token. No token → redirect.
3. The token is single-use, so swiping to the next reel produces a URL without a token,
   and that gets blocked.
4. SPA route changes are caught by wrapping `history.pushState`/`replaceState`,
   listening for `popstate`, and polling `location.href` every 250ms as a fallback.

## Milestones

| # | Deliverable | Done when |
|---|---|---|
| M1 | Extension skeleton + `rules.js` + tests + Instagram | Feed, Explore and Reels redirect to DMs; a reel sent in a DM plays; swiping past it is blocked |
| M2 | YouTube | Home/Shorts blocked; a link a friend sent plays with no sidebar or autoplay |
| M3 | Snapchat web | Chats work; Spotlight and Discover are gone |
| M4 | Friction | Disabling the extension or changing options needs a 60s wait + typed phrase; uninstall protection via a Chrome policy/managed profile where available |
| M5 | Phone | Android: AccessibilityService app that applies the same rules to the native apps. iPhone: Screen Time blocks the 3 apps (passcode held by a friend), and Safari runs `rules.js` through a userscript extension |

M1–M4 are the same no matter which phone I have. M5 depends on the phone OS.

## Risks
- **Site redesigns break DOM selectors.** Keep selectors minimal and push logic into URL rules.
- **Instagram mobile web DMs (iPhone path)**: check they still work in Safari before building M5-iOS.
- **The iOS Safari Web Extension route** needs a Mac + Xcode. A free Apple ID signature expires
  every 7 days; avoiding that costs $99/yr. The userscript-app route avoids both.
