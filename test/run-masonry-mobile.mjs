// Thử userscript masonry trên giả lập điện thoại: /home + trang giả lập X, CSP thật của x.com.
import { chromium, devices } from '/Volumes/DATA/TOOLS/x-adblock-edge/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'artifacts/videos-masonry');
fs.mkdirSync(out, { recursive: true });
// Trang giả lập: thêm meta viewport, bỏ script/css test cục bộ và bỏ thanh nav trái (điện thoại không có).
const html = fs.readFileSync(path.join(__dirname, 'x-fixture.html'), 'utf8')
  .replace('<meta charset="utf-8">', '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">')
  .replace(/<script src="\/x-masonry\.test\.js"><\/script>/, '')
  .replace(/<link rel="stylesheet" href="\/x\.css">/, '')
  .replace(/<header role="banner">[\s\S]*?<\/header>/, '');
const script = fs.readFileSync(path.join(root, 'userscript/dist/x-masonry.user.js'), 'utf8');
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://*.twimg.com; " +
  "style-src-elem 'self' 'unsafe-inline' https://*.twimg.com; font-src 'self' https://*.twimg.com; " +
  "connect-src 'self' https://api.x.com https://*.twimg.com https://*.x.com; img-src 'self' data: blob: https://*.twimg.com";
const UA = 'Mozilla/5.0 (Android 14; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0';

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.XAB_CHROME || path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium-1252/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'),
});
const ctx = await browser.newContext({ ...devices['Pixel 7'], recordVideo: { dir: out, size: { width: 412, height: 700 } } });
await ctx.exposeBinding('__gmFetch', async (_s, url, type) => {
  const u = new URL(url);
  if (!['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.syndication.twimg.com'].includes(u.hostname)) throw new Error('host không được phép: ' + u.hostname);
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  const buf = Buffer.from(await r.arrayBuffer());
  return { status: r.status, text: type === 'text' ? buf.toString('utf8') : null, b64: type === 'text' ? null : buf.toString('base64') };
});
await ctx.addInitScript(() => {
  window.GM_xmlhttpRequest = (d) => {
    window.__gmFetch(d.url, d.responseType).then((r) => {
      let resp = r.text;
      if (r.b64 != null) { const bin = atob(r.b64); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); resp = a.buffer; }
      d.onload({ status: r.status, response: resp });
    }).catch(() => d.onerror && d.onerror());
  };
  // Thêm 1 tweet quảng cáo (nhãn VI, không có <time>) và đổi chữ tweet đầu sang tiếng Việt, trước khi lưới dựng.
  document.addEventListener('DOMContentLoaded', () => {
    const cells = document.querySelectorAll('[data-testid="cellInnerDiv"]');
    if (!cells.length) return;
    const first = cells[0].querySelector('[data-testid="tweetText"]');
    if (first) first.textContent = 'Tiếng Việt: ẩn quảng cáo ở Hà Nội. Được quảng bá — Ơ ư ế ộ ữ.';
    const ad = cells[0].cloneNode(true);
    ad.id = 'ad-clone';
    ad.querySelectorAll('time').forEach((t) => t.remove());
    const t = ad.querySelector('[data-testid="tweetText"]'); if (t) t.insertAdjacentHTML('afterend', '<div><span>Được quảng bá</span></div>');
    cells[cells.length - 1].after(ad);
  });
});
await ctx.addInitScript(script);
await ctx.route('https://x.com/**', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', headers: { 'content-security-policy': CSP }, body: html }));
const page = await ctx.newPage();
const csp = []; page.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) csp.push(m.text()); });
page.on('pageerror', (e) => csp.push('pageerror: ' + e.message));
await page.goto('https://x.com/home');
await page.waitForSelector('#fc-grid .fc-card', { timeout: 20000 }).catch(() => {});
await page.waitForFunction(() => { const t = document.querySelector('#fc-grid .fc-card [data-testid="tweetText"]'); return t && getComputedStyle(t).fontFamily.includes('Lexend Deca') && document.fonts.check('16px "Lexend Deca"', 'Được quảng bá ẩn ơ ư ế ộ ữ'); }, null, { timeout: 25000 }).catch(() => {});
await page.waitForTimeout(1000);
const m = () => page.evaluate(() => {
  const card = document.querySelector('#fc-grid .fc-card');
  const txt = card && card.querySelector('[data-testid="tweetText"]');
  const cr = card && card.getBoundingClientRect(), tr = txt && txt.getBoundingClientRect();
  const cs = txt && getComputedStyle(txt);
  const ov = document.getElementById('fc-masonry');
  const cards = [...document.querySelectorAll('#fc-grid .fc-card')];
  return {
    htmlClass: document.documentElement.className, masonry: !!ov,
    cols: document.querySelectorAll('#fc-grid .fc-col').length, cards: cards.length,
    adInGrid: cards.some((c) => /Được quảng bá/.test(c.textContent) && !/Tiếng Việt/.test(c.textContent)),
    leftGapCardToText: cr && tr ? Math.round(tr.left - cr.left) : null, cardLeftFromScreen: cr ? Math.round(cr.left) : null, viewport: innerWidth,
    fam: cs && cs.fontFamily.split(',')[0].replace(/['"]/g, ''), size: cs && cs.fontSize,
    viFont: document.fonts.check('16px "Lexend Deca"', 'Được quảng bá ẩn ơ ư ế ộ ữ'),
    noFullHeight: !document.getElementById('fc-fullheight'),
    hasGridToggle: !!document.getElementById('fc-gridtoggle'),
    cardsNoInnerScroll: cards.every((c) => c.scrollHeight <= c.clientHeight + 4),
    overlayPadL: ov ? getComputedStyle(ov).paddingLeft : null,
  };
});
const res = { default: await m() };
await page.screenshot({ path: path.join(out, 'masonry-1.png') });
await page.tap('#xab-fab'); await page.fill('#xab-size', '20'); await page.locator('#xab-size').dispatchEvent('input');
await page.waitForFunction(() => getComputedStyle(document.querySelector('#fc-grid .fc-card [data-testid="tweetText"]')).fontSize === '20px', null, { timeout: 5000 }).catch(() => {});
res.afterSize = await m();
await page.selectOption('#xab-cols', '2');
await page.waitForFunction(() => document.querySelectorAll('#fc-grid .fc-col').length === 2, null, { timeout: 5000 }).catch(() => {});
res.afterCols = { cols: await page.evaluate(() => document.querySelectorAll('#fc-grid .fc-col').length) };
await page.screenshot({ path: path.join(out, 'masonry-2.png') });
// Bookerly: Amazon-only font -> stack 'Bookerly','Literata', loads Literata (has Vietnamese); panel shows the load status.
await page.selectOption('#xab-font', 'Bookerly');
await page.waitForFunction(() => [...document.fonts].some((f) => f.family === 'Literata' && f.status === 'loaded'), null, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(500);
res.bookerly = await page.evaluate(() => {
  const t = document.querySelector('#fc-grid .fc-card [data-testid="tweetText"]');
  return { stack: getComputedStyle(t).fontFamily, literataCss: [...document.fonts].some((f) => f.family === 'Literata' && f.status === 'loaded'),
    literataVi: document.fonts.check('16px "Literata"', 'Được ẩn ơ ư ế ộ ữ'), status: (document.getElementById('xab-font-status') || {}).textContent || '' };
});
await page.screenshot({ path: path.join(out, 'masonry-bookerly.png') });
// Quote with condensed media (real card saved from live x.com): the [thumb | text] row must stack in a grid card.
res.condensed = await page.evaluate((html) => {
  const col = document.querySelector('#fc-grid .fc-col'); col.insertAdjacentHTML('afterbegin', html);
  const m = col.firstElementChild.querySelector('[data-testid="testCondensedMedia"]');
  return { rowDir: m && getComputedStyle(m.parentElement).flexDirection };
}, fs.readFileSync(path.join(root, 'test/fixtures/live-quote-compact-card.html'), 'utf8'));
res.errors = csp;
const v = page.video(); await ctx.close(); await browser.close();
console.log(JSON.stringify(res, null, 1));
const d = res.default;
const pass = d.masonry && d.htmlClass.includes('fc-home') && d.cols === 1 && d.cards >= 3 && !d.adInGrid && d.fam === 'Lexend Deca' && d.size === '16px' && d.viFont &&
  res.afterSize.size === '20px' && res.errors.length === 0 && d.leftGapCardToText !== null && d.leftGapCardToText <= 24 &&
  d.noFullHeight && d.hasGridToggle && d.cardsNoInnerScroll && d.overlayPadL === '0px' && res.afterCols.cols === 2 &&
  /^"?Bookerly"?, "?Literata/.test(res.bookerly.stack) && res.bookerly.literataCss && /Literata/.test(res.bookerly.status) && res.condensed.rowDir === 'column';
console.log('Video:', await v.path(), '\nẢnh:', path.join(out, 'masonry-1.png'), path.join(out, 'masonry-2.png'));
console.log(pass ? 'PASS' : 'FAIL'); process.exit(pass ? 0 : 1);
