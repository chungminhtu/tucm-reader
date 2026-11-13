// test/run-update.mjs — headless: extension self-update (update.html) writes new files into a folder + reloads
import { chromium } from '/Volumes/DATA/TOOLS/x-adblock-edge/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const videoDir = path.join(root, 'artifacts/videos-update');
const exe = process.env.HOME +
  '/Library/Caches/ms-playwright/chromium-1252/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
fs.mkdirSync(videoDir, { recursive: true });
const info = JSON.parse(fs.readFileSync(path.join(dist, 'update.json'), 'utf8'));

const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'tucm-upd-')), {
  headless: false, executablePath: exe,
  args: ['--headless=new', `--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
  recordVideo: { dir: videoDir, size: { width: 1000, height: 700 } },
});
let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent('serviceworker');
const id = new URL(sw.url()).host;
const page = await ctx.newPage();
await page.route('http://minhtu-m5max-64gb.netbird.selfhosted:7445/update/**', async (route) => {
  const rel = decodeURIComponent(new URL(route.request().url()).pathname.replace('/update/', ''));
  const file = path.join(dist, rel);
  if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: 'x' });
  await route.fulfill({ status: 200, body: fs.readFileSync(file), headers: { 'access-control-allow-origin': '*' } });
});
await page.goto(`chrome-extension://${id}/update.html`);
// stub the folder picker with an OPFS folder that looks like an old install
await page.evaluate(async () => {
  const d = await navigator.storage.getDirectory();
  const w = await (await d.getFileHandle('manifest.json', { create: true })).createWritable();
  await w.write(JSON.stringify({ name: 'TUCM Reader', version: '0.0.1' })); await w.close();
  window.showDirectoryPicker = async () => d;
});
await page.waitForFunction(() => document.getElementById('go') && !document.getElementById('go').disabled, null, { timeout: 15000 });
const verText = await page.textContent('#ver');
let ok = true;
const rec = (n, c, d) => { console.log(JSON.stringify({ n, ok: !!c, d })); console.log(c ? 'PASS' : 'FAIL'); if (!c) ok = false; };
rec('version-line', verText.includes(info.version), verText);
await page.evaluate(() => { chrome.runtime.reload = () => { window.__reloaded = true; }; });
await page.click('#go');
await page.waitForFunction(() => window.__reloaded === true, null, { timeout: 20000 }).catch(() => {});
const r = await page.evaluate(async (files) => {
  const d = await navigator.storage.getDirectory();
  const miss = [];
  for (const f of files) {
    try {
      let dir = d; const p = f.split('/');
      for (const s of p.slice(0, -1)) dir = await dir.getDirectoryHandle(s);
      await dir.getFileHandle(p[p.length - 1]);
    } catch { miss.push(f); }
  }
  const m = JSON.parse(await (await (await d.getFileHandle('manifest.json')).getFile()).text());
  return { miss, version: m.version, reloaded: !!window.__reloaded, log: document.getElementById('log').textContent };
}, info.files);
rec('files-written', r.miss.length === 0, r.miss);
rec('manifest-new', r.version === info.version, r.version);
rec('reload-called', r.reloaded, r.log);
// popup shows the button
const pop = await ctx.newPage();
await pop.goto(`chrome-extension://${id}/src/popup/popup.html`);
await pop.waitForSelector('#update-btn', { timeout: 10000 }).then(() => rec('popup-button', true, ''), () => rec('popup-button', false, ''));
await page.waitForTimeout(500);
await ctx.close();
console.log(ok ? 'ALL PASS' : 'SOME FAIL');
process.exit(ok ? 0 : 1);
