# mrfantastic

See what friends send you on Instagram (soon YouTube and Snapchat) without the feed.
Plan and design: [PLAN.md](PLAN.md).

## Install

**Chrome on Mac:** `chrome://extensions` → turn on Developer mode → Load unpacked → pick this folder.

**Safari (Mac and iPhone):**
1. Install the free **Userscripts** app (Mac App Store and iOS App Store).
2. Mac: Safari → Settings → Extensions → enable Userscripts. iPhone: Settings → Apps → Safari → Extensions → Userscripts → allow on instagram.com.
3. Put `dist/mrfantastic.user.js` in the Userscripts folder (on iPhone, AirDrop it and save it to that folder in Files).

**iPhone apps:** Settings → Screen Time → App Limits → add Instagram, YouTube and Snapchat → 1 min, Block at End of Limit.
Have a friend set the Screen Time passcode.

## Develop

```
npm test        # rule tests
npm run build   # regenerate dist/mrfantastic.user.js after editing src/
```
