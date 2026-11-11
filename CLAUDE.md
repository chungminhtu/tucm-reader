# ⚠️ ALWAYS BUMP + BUILD + COMMIT + PUSH — NEVER ASK. Every code change, every time. Non-negotiable. See "Ship on finish" below.

# 🚨 CRITICAL — ONE SOURCE, TWO TARGETS (owner rule, 2026-11-11)

This repo (TUCM Reader, github.com/chungminhtu/tucm-reader) is the ONLY home of
the X code. It ships the SAME code to two targets:

1. **Chrome extension** (crxjs, `npm run build` → `dist/`, `release/*.zip`).
2. **Tampermonkey userscript** for phones/Edge mobile (`python3 userscript/build.py`
   → `userscript/dist/x-masonry.user.js`, served at
   NetBird `http://minhtu-m5max-64gb.netbird.selfhosted:7445/x-masonry.user.js` and
   LAN `http://192.168.8.180:7446/x-masonry.user.js`).

Shared files — the ONLY copies. Both targets load them UNCHANGED (no string surgery):

| File | What |
|------|------|
| `public/x-adblock.js` | ad hiding: label scan + no-`<time>` signal, active MutationObserver + 1 s sweep, hides with `data-xab-hidden` (never `.remove()`) — on EVERY x.com page, grid or not |
| `public/x-masonry.js` | masonry grid, reader, menus, columns, grid on/off |
| `src/content/x.css` | grid layout |

Userscript-only glue: `userscript/shim.js` (chrome.* → GM_*), `userscript/panel.js` (Aa panel).

**Every change to any shared file MUST, in the same commit:**

1. Bump `version` in `package.json`.
2. `npm run build` AND `python3 userscript/build.py` (commit `userscript/dist/x-masonry.user.js`).
3. Run BOTH test suites (headless, real-time video): `node test/run-adblock.mjs`,
   `node test/run-masonry-mobile.mjs`, `node test/run-masonry-devices.mjs`.
   When X itself is involved, also `node test/live-x.mjs` (real x.com, READ-ONLY, logged-in
   test profile `~/.cache/tucm-x-profile`; never click X controls or post).
4. Commit + push.

NEVER edit a copy of this code anywhere else (the old copy in
`/Volumes/DATA/TOOLS/x-adblock-edge/masonry-tampermonkey` was removed; that repo only
points here). NEVER fix one target only.

# Project rules — tucm-reader

## Ship on finish (ALWAYS — never ask)

When any code change is finished, ALWAYS do this automatically, without asking:

1. Bump the `version` in `package.json` (the crxjs manifest reads it).
2. `npm run build` (and `python3 userscript/build.py` — see CRITICAL above).
3. `git commit` the changed source (not the unrelated pre-existing
   `package-lock.json` unless asked).
4. `git push`.

The user does not want to be asked each time. "bump build and commit push always."

## X (Twitter) masonry reader

- Behaviour lives in `public/x-masonry.js` (a plain classic content script — CSP
  exempt, isolated world). Layout in `src/content/x.css`. `src/content/main.ts`
  is CSP-blocked on x.com, so X typography is re-implemented inside
  `x-masonry.js`.
- Test it on live x.com over CDP (no Playwright): see `HANDOFF.md` and `test/`.
  Launch Chrome with `--remote-debugging-port=9222`, then
  `node test/live-cdp-inject.js` and READ the screenshots.
- x.com is fully lazy/virtualized: images, media, and avatars only load when a
  cell enters X's viewport. Harvest waits for readiness and scrolls the
  background timeline gently so media loads before cloning.
