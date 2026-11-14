// READ-ONLY live test on real x.com (phone viewport + touch) with the built extension (dist/).
// Checks: reload button, button bar at the bottom, gray quoted posts, no pull-to-refresh
// (a touch pull at the top must NOT fire X's HomeTimeline request), finger scroll still works,
// and the grid overlay has overscroll-behavior:none. Never clicks X controls or posts.
// Usage: npm run build && node test/live-mobile-ptr.mjs   (video: artifacts/videos-live/)
import { chromium } from '/Volumes/DATA/TOOLS/x-adblock-edge/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'artifacts/videos-live');
fs.mkdirSync(out, { recursive: true });
const PROFILE = process.env.X_PROFILE || path.join(os.homedir(), '.cache/tucm-x-profile');
const CFT = process.env.XAB_CHROME || path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium-1252/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const DIST = path.join(root, 'dist');
const VW = { width: 412, height: 860 };

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: true, executablePath: CFT,
  ignoreDefaultArgs: ['--use-mock-keychain', '--disable-extensions'],
  args: ['--disable-extensions-except=' + DIST, '--load-extension=' + DIST],
  viewport: VW, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36 EdgA/140.0.0.0',
  recordVideo: { dir: out, size: VW },
});
const page = ctx.pages()[0] || await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
let tl = 0;
page.on('request', (r) => { if (/HomeTimeline|HomeLatestTimeline/.test(r.url())) tl++; });
async function drag(y0, y1) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: y0 }] });
  for (let i = 1; i <= 15; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y: y0 + (y1 - y0) * i / 15 }] });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(400);
}
const toggleGrid = async (on) => {
  const isOn = await page.evaluate(() => !!document.getElementById('fc-grid'));
  if (isOn !== on) { await page.click('#fc-gridtoggle'); await page.waitForTimeout(2500); }
};
const res = {};
await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('article', { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(3000);

// 1) Normal page (grid off).
await toggleGrid(false);
res.ui = await page.evaluate(() => {
  const b = document.getElementById('fc-fabbar'), r = b.getBoundingClientRect();
  const bb = document.querySelector('[data-testid="BottomBar"]');
  const quotes = [...document.querySelectorAll('article div[role="link"]')].filter((e) => e.querySelector('[data-testid="User-Name"]'));
  return {
    reload: !!document.getElementById('fc-reload'),
    barGap: Math.round(innerHeight - r.bottom),
    bottomBarTop: bb ? Math.round(bb.getBoundingClientRect().top) : null,
    barOverBottomBar: bb ? r.bottom > bb.getBoundingClientRect().top + 1 : false,
    quoteBg: quotes.map((e) => getComputedStyle(e).backgroundColor),
    rootOverscroll: getComputedStyle(document.documentElement).overscrollBehaviorY,
  };
});
await page.screenshot({ path: path.join(out, 'ptr-1-normal.png') });
for (let i = 0; i < 3; i++) await drag(700, 200);
res.afterDown = await page.evaluate(() => scrollY);
await page.waitForTimeout(800);
res.barGapAfterScrollDown = await page.evaluate(() => Math.round(innerHeight - document.getElementById('fc-fabbar').getBoundingClientRect().bottom));
await page.screenshot({ path: path.join(out, 'ptr-1b-scrolled.png') });
// Quoted post: inject the real captured quote card into the feed and read its box colour.
res.quote = await page.evaluate((html) => {
  const cell = document.querySelector('[data-testid="cellInnerDiv"]');
  const box = document.createElement('div'); box.innerHTML = html; cell.parentElement.prepend(box);
  const q = [...box.querySelectorAll('article div[role="link"]')].filter((e) => e.querySelector('[data-testid="User-Name"]'));
  const main = box.querySelector('article');
  const out = { quotes: q.map((e) => getComputedStyle(e).backgroundColor), mainBg: getComputedStyle(main).backgroundColor };
  box.remove();
  return out;
}, fs.readFileSync(path.join(root, 'test/fixtures/live-quote-compact-card.html'), 'utf8'));
await drag(200, 600);
res.afterFingerUp = await page.evaluate(() => scrollY);
await page.evaluate(() => scrollTo(0, 0));
await page.waitForTimeout(3000);
tl = 0;
await drag(200, 700); await drag(200, 700);
await page.waitForTimeout(5000);
res.pullAtTopTimelineRequests = tl;
res.barGapScrolled = await page.evaluate(() => Math.round(innerHeight - document.getElementById('fc-fabbar').getBoundingClientRect().bottom));

// 2) Grid on: overlay must not chain overscroll to the page.
await toggleGrid(true);
await page.waitForSelector('#fc-grid .fc-card', { timeout: 40000 }).catch(() => {});
await page.waitForTimeout(4000);
await page.evaluate(() => { window.__mark = 1; });
for (let i = 0; i < 3; i++) await drag(700, 200);
const ovDown = await page.evaluate(() => document.getElementById('fc-masonry').scrollTop);
await drag(200, 600);
res.grid = await page.evaluate((ovDown) => {
  const o = document.getElementById('fc-masonry');
  return o ? { overscroll: getComputedStyle(o).overscrollBehaviorY, reload: getComputedStyle(document.getElementById('fc-reload')).display,
    ovDown, ovAfterFingerUp: o.scrollTop, noReload: window.__mark === 1 } : null;
}, ovDown);
await drag(200, 800); await drag(200, 800); await page.waitForTimeout(1500);
res.grid.noReloadAfterTopPull = await page.evaluate(() => window.__mark === 1);
await page.screenshot({ path: path.join(out, 'ptr-2-grid.png') });

const v = page.video();
await ctx.close();
console.log(JSON.stringify(res, null, 1));
console.log('Video:', v && await v.path());
const pass = res.ui.reload && !res.ui.barOverBottomBar && res.ui.rootOverscroll === 'none' &&
  res.barGapAfterScrollDown <= 12 && res.quote.quotes.length > 0 &&
  res.quote.quotes.every((c) => c === 'rgba(128, 128, 128, 0.12)') && res.quote.mainBg !== 'rgba(128, 128, 128, 0.12)' &&
  res.afterDown > 500 && res.afterFingerUp < res.afterDown &&
  res.pullAtTopTimelineRequests === 0 && res.grid && res.grid.overscroll === 'none' && res.grid.reload !== 'none' &&
  res.grid.ovDown > 300 && res.grid.ovAfterFingerUp < res.grid.ovDown && res.grid.noReload && res.grid.noReloadAfterTopPull;
console.log(pass ? 'PASS' : 'FAIL');
process.exit(pass ? 0 : 1);
