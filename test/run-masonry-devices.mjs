// Thử masonry trên nhiều thiết bị / hành vi: cột tablet-desktop, tắt lưới, menu chuột phải, ô feedback.
import { chromium, devices } from '/Volumes/DATA/TOOLS/x-adblock-edge/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'artifacts/videos-devices');
fs.mkdirSync(out, { recursive: true });
const fixturePath = path.join(__dirname, 'x-fixture.html');
const raw = fs.readFileSync(fixturePath, 'utf8');
const script = fs.readFileSync(path.join(root, 'userscript/dist/x-masonry.user.js'), 'utf8');
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://*.twimg.com; " +
  "style-src-elem 'self' 'unsafe-inline' https://*.twimg.com; font-src 'self' https://*.twimg.com data:; " +
  "connect-src 'self' https://api.x.com https://*.twimg.com https://*.x.com; img-src 'self' data: blob: https://*.twimg.com";
const UA = 'Mozilla/5.0 (Android 14; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0';
const chromePath = process.env.XAB_CHROME || path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium-1252/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');

function prepHtml({ stripHeader }) {
  let html = raw
    .replace('<meta charset="utf-8">', '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">')
    .replace(/<script src="\/x-masonry\.test\.js"><\/script>/, '')
    .replace(/<link rel="stylesheet" href="\/x\.css">/, '');
  if (stripHeader) html = html.replace(/<header role="banner">[\s\S]*?<\/header>/, '');
  return html;
}

async function makeContext(browser, opts, html, extraInits = []) {
  const ctx = await browser.newContext({ ...opts, recordVideo: { dir: out, size: opts.viewport || { width: 1280, height: 720 } } });
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
  });
  for (const fn of extraInits) await ctx.addInitScript(fn);
  await ctx.addInitScript(script);
  await ctx.route('https://x.com/**', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', headers: { 'content-security-policy': CSP }, body: html }));
  return ctx;
}

async function waitGrid(page) {
  await page.goto('https://x.com/home');
  await page.waitForSelector('#fc-grid .fc-card', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1000);
}

const browser = await chromium.launch({ headless: true, executablePath: chromePath });
const result = {};
const videos = {};
let ok = true;

// a) iPad Mini portrait
{
  const ctx = await makeContext(browser, devices['iPad Mini'], prepHtml({ stripHeader: false }));
  const page = await ctx.newPage();
  await waitGrid(page);
  const defCols = await page.evaluate(() => document.querySelectorAll('#fc-grid .fc-col').length);
  await page.tap('#xab-fab').catch(() => page.click('#xab-fab'));
  await page.selectOption('#xab-cols-tablet', '3');
  await page.waitForFunction(() => document.querySelectorAll('#fc-grid .fc-col').length === 3, null, { timeout: 5000 }).catch(() => {});
  const after = await page.evaluate(() => document.querySelectorAll('#fc-grid .fc-col').length);
  result.ipadPortrait = { defCols, afterCols: after, pass: defCols === 2 && after === 3 };
  ok = ok && result.ipadPortrait.pass;
  const vA = page.video(); await ctx.close(); videos.ipadPortrait = await vA.path();
}

// b) iPad Mini landscape
{
  const ctx = await makeContext(browser, devices['iPad Mini landscape'], prepHtml({ stripHeader: false }));
  const page = await ctx.newPage();
  await waitGrid(page);
  const defCols = await page.evaluate(() => document.querySelectorAll('#fc-grid .fc-col').length);
  result.ipadLandscape = { defCols, pass: defCols === 2 };
  ok = ok && result.ipadLandscape.pass;
  const vB = page.video(); await ctx.close(); videos.ipadLandscape = await vB.path();
}

// c) Desktop 1440x900 — giữ header
{
  const ctx = await makeContext(browser, { viewport: { width: 1440, height: 900 } }, prepHtml({ stripHeader: false }));
  const page = await ctx.newPage();
  await waitGrid(page);
  const cols = await page.evaluate(() => document.querySelectorAll('#fc-grid .fc-col').length);
  result.desktopAuto = { cols, pass: cols >= 2 };
  ok = ok && result.desktopAuto.pass;
  const vC = page.video(); await ctx.close(); videos.desktopAuto = await vC.path();
}

// d) Grid off (Pixel 7)
{
  const ctx = await makeContext(browser, devices['Pixel 7'], prepHtml({ stripHeader: true }));
  const page = await ctx.newPage();
  await waitGrid(page);
  await page.click('#fc-gridtoggle');
  await page.waitForTimeout(500);
  const gone1 = await page.evaluate(() => !document.getElementById('fc-masonry'));
  await page.waitForTimeout(3500);
  const stillGone = await page.evaluate(() => !document.getElementById('fc-masonry'));
  await page.reload();
  await page.waitForTimeout(3500);
  const goneAfterReload = await page.evaluate(() => !document.getElementById('fc-masonry'));
  // Trang giả lập rộng hơn viewport khi tắt lưới (535 > 412) nên toạ độ click của Playwright lệch; elementFromPoint vẫn trúng nút.
  await page.locator('#fc-gridtoggle').dispatchEvent('click');
  await page.waitForSelector('#fc-grid .fc-card', { timeout: 10000 }).catch(() => {});
  const back = await page.evaluate(() => !!document.querySelector('#fc-grid .fc-card'));
  result.gridOff = { gone1, stillGone, goneAfterReload, back, pass: gone1 && stillGone && goneAfterReload && back };
  ok = ok && result.gridOff.pass;
  const vD = page.video(); await ctx.close(); videos.gridOff = await vD.path();
}

// e) Context menu (desktop 1440) — fixture không có caret/#layers: inject
{
  const caretInit = () => {
    document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('[data-testid="cellInnerDiv"] article').forEach((art) => {
        if (art.querySelector('[data-testid="caret"]')) return;
        const btn = document.createElement('button');
        btn.setAttribute('data-testid', 'caret');
        btn.type = 'button';
        btn.textContent = '⋯';
        btn.addEventListener('click', () => {
          let layers = document.getElementById('layers');
          if (!layers) { layers = document.createElement('div'); layers.id = 'layers'; document.body.appendChild(layers); }
          layers.innerHTML = '<div role="menu"><div role="menuitem">Not interested</div></div>';
          // Giống X: bấm "Not interested" thay bài trong ô thật bằng thông báo + nút Undo; Undo trả bài lại.
          const cell = art.closest('[data-testid="cellInnerDiv"]');
          layers.querySelector('[role="menuitem"]').addEventListener('click', () => {
            layers.innerHTML = '';
            const saved = art;
            const fb = document.createElement('div');
            fb.innerHTML = '<span>This post won\'t show up</span><button type="button">Undo</button>';
            fb.querySelector('button').addEventListener('click', () => { fb.replaceWith(saved); });
            saved.replaceWith(fb);
          });
        });
        art.appendChild(btn);
      });
    });
  };
  const ctx = await makeContext(browser, { viewport: { width: 1440, height: 900 } }, prepHtml({ stripHeader: false }), [caretInit]);
  const page = await ctx.newPage();
  await waitGrid(page);
  await page.evaluate(() => {
    window.__xabTextCtx = null;
    window.addEventListener('contextmenu', (e) => {
      setTimeout(() => { window.__xabTextCtx = !!e.defaultPrevented; }, 0);
    }, true);
  });
  const avatar = page.locator('#fc-grid .fc-card [data-testid="Tweet-User-Avatar"]').first();
  await avatar.click({ button: 'right' });
  await page.waitForSelector('#layers [role="menu"]', { timeout: 5000 }).catch(() => {});
  const menuOk = await page.evaluate(() => !!document.querySelector('#layers [role="menu"]'));
  await page.locator('#fc-grid .fc-card [data-testid="tweetText"]').first().click({ button: 'right' });
  await page.waitForTimeout(100);
  const textNotPrevented = await page.evaluate(() => window.__xabTextCtx === false);
  // Luồng "Không quan tâm": bấm mục menu -> card hiện thông báo; bấm Undo trong card -> card hiện lại bài.
  const cardsBefore = await page.evaluate(() => document.querySelectorAll('#fc-grid .fc-card').length);
  const fid = await page.evaluate(() => document.querySelector('#fc-grid .fc-card').getAttribute('data-fc-id'));
  // #layers của trang giả lập nằm dưới overlay (X thật đặt overlay trong #layers), nên bấm bằng dispatchEvent.
  await page.locator('#layers [role="menuitem"]').dispatchEvent('click');
  const cardSel = '#fc-grid .fc-card[data-fc-id="' + fid + '"]';
  await page.waitForFunction((sel) => /won't show up/.test((document.querySelector(sel) || {}).textContent || ''), cardSel, { timeout: 3000 }).catch(() => {});
  const feedbackShown = await page.evaluate((sel) => /won't show up/.test(document.querySelector(sel).textContent), cardSel);
  await page.waitForTimeout(800);
  await page.locator(cardSel + ' button', { hasText: 'Undo' }).click();
  await page.waitForFunction((sel) => { const c = document.querySelector(sel); return c && c.querySelector('[data-testid="tweetText"]'); }, cardSel, { timeout: 6000 }).catch(() => {});
  const undoRestored = await page.evaluate((sel) => !!document.querySelector(sel + ' [data-testid="tweetText"]') && !/won't show up/.test(document.querySelector(sel).textContent), cardSel);
  const cardsAfter = await page.evaluate(() => document.querySelectorAll('#fc-grid .fc-card').length);
  await page.waitForTimeout(1000);
  result.contextMenu = { menuOk, textNotPrevented, feedbackShown, undoRestored, cardsBefore, cardsAfter,
    pass: menuOk && textNotPrevented && feedbackShown && undoRestored && cardsBefore === cardsAfter };
  ok = ok && result.contextMenu.pass;
  const vE = page.video(); await ctx.close(); videos.contextMenu = await vE.path();
}

// f) Feedback cell survives ad filter
{
  const feedbackInit = () => {
    document.addEventListener('DOMContentLoaded', () => {
      const pc = document.getElementById('pc') || document.querySelector('[data-testid="primaryColumn"]');
      if (!pc) return;
      const cell = document.createElement('div');
      cell.setAttribute('data-testid', 'cellInnerDiv');
      cell.id = 'xab-feedback-cell';
      cell.innerHTML = '<div>This post won\'t show up</div>';
      pc.appendChild(cell);
    });
  };
  const ctx = await makeContext(browser, devices['Pixel 7'], prepHtml({ stripHeader: true }), [feedbackInit]);
  const page = await ctx.newPage();
  await page.goto('https://x.com/home');
  await page.waitForTimeout(2000);
  const alive = await page.evaluate(() => !!document.getElementById('xab-feedback-cell') ||
    [...document.querySelectorAll('[data-testid="cellInnerDiv"]')].some((c) => /This post won't show up/.test(c.textContent)));
  result.feedback = { alive, pass: alive };
  ok = ok && result.feedback.pass;
  const vF = page.video(); await ctx.close(); videos.feedback = await vF.path();
}

await browser.close();
console.log(JSON.stringify({ result, videos }, null, 1));
console.log('Videos:', videos);
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
