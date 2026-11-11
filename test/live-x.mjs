// READ-ONLY live test on real x.com with the built extension (dist/). Needs a logged-in
// Chrome-for-Testing profile: X_PROFILE (default ~/.cache/tucm-x-profile). It never clicks
// X controls, posts, or changes the account: it opens pages, scrolls, and reads the DOM.
// Usage: npm run build && node test/live-x.mjs [statusUrl]
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
const STATUS = process.argv[2] || 'https://x.com/jamesonhodge/status/2118733265372860826';
const DIST = path.join(root, 'dist');

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: true, executablePath: CFT,
  ignoreDefaultArgs: ['--use-mock-keychain', '--disable-extensions'], // real keychain = logged-in cookies
  args: ['--disable-extensions-except=' + DIST, '--load-extension=' + DIST],
  viewport: { width: 1280, height: 900 },
  recordVideo: { dir: out, size: { width: 1280, height: 900 } },
});
const page = ctx.pages()[0] || await ctx.newPage();
const res = {};

// 1) Ads on a normal (non-grid) page: the status page with replies.
await page.goto(STATUS, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('article', { timeout: 30000 }).catch(() => {});
let seenAds = 0;
for (let i = 0; i < 12; i++) {
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(1500);
  seenAds = Math.max(seenAds, await page.evaluate(() => document.querySelectorAll('[data-xab-hidden]').length));
}
res.status = await page.evaluate(() => ({
  hidden: [...document.querySelectorAll('[data-xab-hidden]')].map((n) => n.getAttribute('data-xab-reason') + ': ' + n.textContent.slice(0, 40)),
  visibleAdLabels: [...document.querySelectorAll('article span')].filter((s) => /^(Quảng cáo|Ad|Promoted)$/.test(s.textContent.trim()) && s.getBoundingClientRect().height > 0).length,
  adblockStyle: [...document.querySelectorAll('style')].some((s) => s.textContent.includes('[data-xab-hidden]')),
}));
await page.screenshot({ path: path.join(out, 'live-status.png') });

// 2) Desktop grid: condensed-media quote (real card fixture) keeps X's row on a wide card (stacking is for narrow cards only).
await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#fc-grid .fc-card', { timeout: 40000 }).catch(() => {});
await page.waitForTimeout(3000);
res.condensed = await page.evaluate((html) => {
  const col = document.querySelector('#fc-grid .fc-col');
  if (!col) return { error: 'no grid' };
  col.insertAdjacentHTML('afterbegin', html);
  const card = col.firstElementChild; card.scrollIntoView({ block: 'start' });
  const m = card.querySelector('[data-testid="testCondensedMedia"]');
  const t = m.parentElement.querySelector('[data-testid="tweetText"]');
  const q = m.closest('div[role="link"]').getBoundingClientRect(), mr = m.getBoundingClientRect(), tr = t.getBoundingClientRect();
  return { cardW: Math.round(card.getBoundingClientRect().width), rowDir: getComputedStyle(m.parentElement).flexDirection,
    thumb: [Math.round(mr.width), Math.round(mr.height)], textIndent: Math.round(tr.left - q.left), textW: Math.round(tr.width) };
}, fs.readFileSync(path.join(root, 'test/fixtures/live-quote-compact-card.html'), 'utf8'));
await page.waitForTimeout(1000);
await page.screenshot({ path: path.join(out, 'live-grid-condensed.png') });

const v = page.video();
await ctx.close();
console.log(JSON.stringify(res, null, 1));
console.log('Video:', v && await v.path());
// Desktop card is wide (> 320px): X's own row layout stays; the thumbnail must not blow up.
const pass = res.status.adblockStyle && res.status.visibleAdLabels === 0 && res.condensed.cardW > 320 && res.condensed.rowDir === 'row' && res.condensed.thumb[0] < 200;
console.log(pass ? 'PASS' : 'FAIL');
process.exit(pass ? 0 : 1);
