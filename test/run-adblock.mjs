// test/run-adblock.mjs — headless Playwright checks for public/x-adblock.js
import { chromium } from '/Volumes/DATA/TOOLS/x-adblock-edge/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const adblockPath = path.join(root, 'public/x-adblock.js');
const videoDir = path.join(root, 'artifacts/videos-adblock');
const exe =
  process.env.HOME +
  '/Library/Caches/ms-playwright/chromium-1252/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

fs.mkdirSync(videoDir, { recursive: true });
const adblockSrc = fs.readFileSync(adblockPath, 'utf8');

const HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>x-adblock fixture</title></head><body>
<div id="react-root">
  <div data-testid="cellInnerDiv" id="c-a">
    <article>
      <div data-testid="User-Name">
        <a href="/user">Alice</a>
        <span id="label-a">Qu\u1ea3ng c\u00e1o</span>
      </div>
      <time datetime="2024-01-01">1h</time>
      <div data-testid="tweetText">hello</div>
    </article>
  </div>
  <div data-testid="cellInnerDiv" id="c-b">
    <article>
      <div data-testid="User-Name"><a href="/bob">Bob</a></div>
      <div class="meta"><span id="label-b">Ad</span><svg width="1" height="1"></svg></div>
      <time datetime="2024-01-01">1h</time>
    </article>
  </div>
  <div data-testid="cellInnerDiv" id="c-d">
    <article>
      <div data-testid="User-Name"><a href="/promo">Promo</a></div>
      <div data-testid="tweetText">buy now</div>
    </article>
  </div>
  <div data-testid="cellInnerDiv" id="c-f">
    <article>
      <div data-testid="User-Name"><a href="/ad">Ad</a></div>
      <time datetime="2024-01-01">1h</time>
      <div data-testid="tweetText">not an ad</div>
    </article>
  </div>
  <div data-testid="cellInnerDiv" id="c-g">
    <article>
      <div data-testid="User-Name"><a href="/g">G</a></div>
      <time datetime="2024-01-01">1h</time>
      <div data-testid="tweetText">Ad</div>
    </article>
  </div>
  <div data-testid="cellInnerDiv" id="c-h">
    <article>
      <div data-testid="User-Name"><a href="/h">H</a></div>
      <time datetime="2024-01-01">1h</time>
      <div data-testid="tweetText">normal tweet</div>
    </article>
  </div>
  <div id="fc-grid">
    <div class="fc-card" id="card-e">
      <article>
        <div data-testid="User-Name"><a href="/e">E</a></div>
        <span id="label-e">Sponsored</span>
        <time datetime="2024-01-01">1h</time>
      </article>
    </div>
  </div>
</div>
</body></html>`;

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: exe,
  });
  const context = await browser.newContext({
    recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  await page.addInitScript(adblockSrc);
  await page.route('https://x.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: HTML,
    });
  });

  const results = [];
  let failed = false;

  function record(id, ok, detail) {
    results.push({ id, ok, ...detail });
    console.log(JSON.stringify({ id, ok, ...detail }));
    console.log(ok ? 'PASS' : 'FAIL');
    if (!ok) failed = true;
  }

  await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__xabAdblock && window.__xabAdblock.version === 1);
  await page.evaluate(() => window.__xabAdblock.sweep());

  // a
  {
    const r = await page.evaluate(() => {
      const c = document.getElementById('c-a');
      return {
        hidden: c.getAttribute('data-xab-hidden'),
        reason: c.getAttribute('data-xab-reason'),
      };
    });
    record('a', r.hidden === '1' && r.reason === 'label', r);
  }

  // b
  {
    const r = await page.evaluate(() => {
      const c = document.getElementById('c-b');
      return {
        hidden: c.getAttribute('data-xab-hidden'),
        reason: c.getAttribute('data-xab-reason'),
      };
    });
    record('b', r.hidden === '1' && r.reason === 'label', r);
  }

  // d
  {
    const r = await page.evaluate(() => {
      const c = document.getElementById('c-d');
      return {
        hidden: c.getAttribute('data-xab-hidden'),
        reason: c.getAttribute('data-xab-reason'),
      };
    });
    record('d', r.hidden === '1' && r.reason === 'notime', r);
  }

  // e
  {
    const r = await page.evaluate(() => {
      const c = document.getElementById('card-e');
      return {
        hidden: c.getAttribute('data-xab-hidden'),
        reason: c.getAttribute('data-xab-reason'),
      };
    });
    record('e', r.hidden === '1' && r.reason === 'label', r);
  }

  // f negative
  {
    const r = await page.evaluate(() => {
      const c = document.getElementById('c-f');
      return { hidden: c.getAttribute('data-xab-hidden') };
    });
    record('f', r.hidden !== '1', r);
  }

  // g negative
  {
    const r = await page.evaluate(() => {
      const c = document.getElementById('c-g');
      return { hidden: c.getAttribute('data-xab-hidden') };
    });
    record('g', r.hidden !== '1', r);
  }

  // h negative
  {
    const r = await page.evaluate(() => {
      const c = document.getElementById('c-h');
      return { hidden: c.getAttribute('data-xab-hidden') };
    });
    record('h', r.hidden !== '1', r);
  }

  // c: late insert + characterData
  {
    await page.evaluate(() => {
      const cell = document.createElement('div');
      cell.setAttribute('data-testid', 'cellInnerDiv');
      cell.id = 'c-c';
      const art = document.createElement('article');
      art.innerHTML =
        '<div data-testid="User-Name"><a href="/c">C</a></div><time datetime="2024-01-01">1h</time>';
      const span = document.createElement('span');
      span.id = 'label-c';
      span.appendChild(document.createTextNode(''));
      art.insertBefore(span, art.querySelector('time'));
      cell.appendChild(art);
      document.getElementById('react-root').appendChild(cell);
      setTimeout(() => {
        document.getElementById('label-c').firstChild.nodeValue = 'Promoted';
      }, 1500);
    });
    const ok = await page.waitForFunction(
      () => {
        const c = document.getElementById('c-c');
        return c && c.getAttribute('data-xab-hidden') === '1' && c.getAttribute('data-xab-reason') === 'label';
      },
      { timeout: 2500 }
    ).then(() => true).catch(() => false);
    const r = await page.evaluate(() => {
      const c = document.getElementById('c-c');
      return c
        ? { hidden: c.getAttribute('data-xab-hidden'), reason: c.getAttribute('data-xab-reason') }
        : { hidden: null };
    });
    record('c', ok && r.hidden === '1' && r.reason === 'label', r);
  }

  // live: the real ad cell captured (read-only) from x.com on 2026-11-11
  // (status page, label "Quảng cáo" = leaf SPAN outside User-Name, no <time>, under placementTracking).
  {
    const live = fs.readFileSync(new URL('./fixtures/live-ad-cell.html', import.meta.url), 'utf8');
    await page.evaluate((html) => {
      const w = document.createElement('div'); w.innerHTML = html;
      const cell = w.firstElementChild; cell.id = 'c-live';
      document.getElementById('react-root').appendChild(cell);
    }, live);
    const ok = await page.waitForFunction(() => { const c = document.getElementById('c-live'); return c && c.getAttribute('data-xab-hidden') === '1'; }, null, { timeout: 2500 }).then(() => true).catch(() => false);
    const r = await page.evaluate(() => { const c = document.getElementById('c-live'); return { hidden: c.getAttribute('data-xab-hidden'), reason: c.getAttribute('data-xab-reason'), visible: c.getBoundingClientRect().height > 0 }; });
    record('live', ok && r.reason === 'label' && !r.visible, r);
  }

  const videoPath = await page.video()?.path();
  await context.close();
  await browser.close();

  console.log(JSON.stringify({ summary: results, video: videoPath }));
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
