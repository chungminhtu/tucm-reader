// Adapter: gives the unmodified FontChanger x-masonry.js the few chrome.* APIs it calls,
// backed by GM_* (or localStorage) and GM_xmlhttpRequest. This is a port of src/background.ts.
const chrome = (() => {
  const STORE = 'xab-chrome-store-v1';
  const FONT_CACHE = 'xab-fontcss-v1:';
  const KEEP = { latin: 1, 'latin-ext': 1, vietnamese: 1 };
  const hasGM = typeof GM_getValue === 'function' && typeof GM_setValue === 'function';
  function sget(k) { try { if (hasGM) { const v = GM_getValue(k, null); return v == null ? null : v; } return localStorage.getItem(k); } catch (_) { return null; } }
  function sset(k, v) { try { if (hasGM) GM_setValue(k, v); else localStorage.setItem(k, v); } catch (_) {} }
  function readStore() { try { return JSON.parse(sget(STORE) || '{}'); } catch (_) { return {}; } }

  // Google Fonts picks the CSS by User-Agent. Edge Android ("EdgA") gets one TrueType
  // block with no /* subset */ comments, so ask as desktop Chrome to get woff2 subsets.
  const FONT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  const MIME = { woff2: 'font/woff2', woff: 'font/woff', truetype: 'font/ttf', opentype: 'font/otf' };
  function gm(url, type, headers) {
    return new Promise((res, rej) => {
      if (typeof GM_xmlhttpRequest !== 'function') return rej(new Error('no GM_xmlhttpRequest'));
      GM_xmlhttpRequest({
        method: 'GET', url, responseType: type, timeout: 20000, headers: headers || {},
        onload: (r) => (r.status >= 200 && r.status < 300 ? res(r.response) : rej(new Error('HTTP ' + r.status))),
        onerror: () => rej(new Error('network')), ontimeout: () => rej(new Error('timeout')),
      });
    });
  }
  function b64(buf) {
    const a = new Uint8Array(buf); let out = '';
    for (let i = 0; i < a.length; i += 0x8000) out += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
    return btoa(out);
  }
  // FETCH_FONT_CSS: Google Fonts CSS -> woff2 inlined as data: URIs (x.com CSP font-src allows data:).
  // Only latin, latin-ext and vietnamese subsets are kept (keeps Vietnamese diacritics, small size).
  async function fontCss(fontUrl) {
    const cached = sget(FONT_CACHE + fontUrl);
    if (cached) return cached;
    const css = await gm(fontUrl, 'text', { 'User-Agent': FONT_UA });
    async function inline(block) {
      const u = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)\s*format\('(\w+)'\)/.exec(block);
      if (!u) return null;
      return block.replace(u[1], 'data:' + (MIME[u[2]] || 'font/woff2') + ';base64,' + b64(await gm(u[1], 'arraybuffer')));
    }
    const re = /\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g; let m; const out = [];
    while ((m = re.exec(css))) {
      if (!KEEP[m[1]]) continue;
      const b = await inline(m[2]); if (b) out.push(b);
    }
    // Fallback: the UA header was not applied and Google sent whole-font blocks (no subsets).
    if (!out.length) {
      const all = css.match(/@font-face\s*\{[^}]*\}/g) || [];
      for (const blk of all) { const b = await inline(blk); if (b) out.push(b); }
    }
    if (!out.length) throw new Error('no font blocks');
    const res = out.join('\n');
    sset(FONT_CACHE + fontUrl, res);
    return res;
  }
  // FC_TWEET_JSON: public syndication JSON for in-card video (same URL/token as background.ts).
  async function tweetJson(id) {
    if (!/^\d+$/.test(id)) throw new Error('bad id');
    const token = ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
    return JSON.parse(await gm('https://cdn.syndication.twimg.com/tweet-result?id=' + id + '&token=' + token + '&lang=en', 'text'));
  }

  const listeners = [];
  const api = {
    storage: {
      local: {
        get(defaults, cb) {
          const st = readStore();
          const out = Object.assign({}, defaults || {});
          Object.keys(out).forEach((k) => { if (k in st) out[k] = st[k]; });
          setTimeout(() => cb && cb(out), 0);
        },
        set(obj, cb) {
          const st = readStore(); const ch = {};
          Object.keys(obj).forEach((k) => { ch[k] = { oldValue: st[k], newValue: obj[k] }; st[k] = obj[k]; });
          sset(STORE, JSON.stringify(st));
          setTimeout(() => { listeners.forEach((l) => { try { l(ch, 'local'); } catch (_) {} }); cb && cb(); }, 0);
        },
      },
      onChanged: { addListener(l) { listeners.push(l); } },
    },
    runtime: {
      lastError: undefined,
      getManifest: () => ({ version: 'userscript' }),
      sendMessage(msg, cb) {
        const done = (r) => { try { cb && cb(r); } catch (_) {} };
        // Font load result is kept for the Aa panel status line (evidence on phones, no console there).
        const fontStatus = (st) => { api.fontStatus = st; try { window.dispatchEvent(new CustomEvent('xab-font-status')); } catch (_) {} };
        if (msg && msg.type === 'FETCH_FONT_CSS') fontCss(msg.fontUrl).then((css) => { fontStatus({ url: msg.fontUrl, ok: true, size: css.length }); done({ success: true, css }); }, (e) => { fontStatus({ url: msg.fontUrl, ok: false, error: String(e.message) }); done({ success: false, error: String(e.message) }); });
        else if (msg && msg.type === 'FC_TWEET_JSON') tweetJson(String(msg.id)).then((tweet) => done({ success: true, tweet }), (e) => done({ success: false, error: String(e.message) }));
        else done({ success: false, error: 'unknown message' });
      },
    },
  };
  return api;
})();
