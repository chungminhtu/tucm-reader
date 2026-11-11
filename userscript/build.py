#!/usr/bin/env python3
"""Ghép userscript Tampermonkey: public/x-adblock.js + shim + x.css + x-masonry.js + panel.
Chạy từ thư mục gốc repo: python3 userscript/build.py"""
import json, os, re, time
U = 'http://minhtu-m5max-64gb.netbird.selfhosted:7445/x-masonry.user.js'
rd = lambda p: open(p, encoding='utf-8').read()

ads = rd('public/x-adblock.js')

body = f"""(() => {{
  'use strict';
{rd('userscript/shim.js')}
  const XCSS = {json.dumps(rd('src/content/x.css'))};
  function startMasonry() {{
    const st = document.createElement('style'); st.id = 'xab-fc-css'; st.textContent = XCSS;
    (document.head || document.documentElement).appendChild(st);
    // ---- BEGIN public/x-masonry.js ----
{rd('public/x-masonry.js')}
    // ---- END public/x-masonry.js ----
  }}
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startMasonry, {{ once: true }});
  else startMasonry();
{rd('userscript/panel.js')}
}})();
"""
hdr = f"""// ==UserScript==
// @name         TUCM Reader (X)
// @name:vi      TUCM Reader (X)
// @namespace    x-adblock-edge
// @version      {time.strftime('%Y.%m%d.%H%M')}
// @description  TUCM Reader for x.com: masonry grid, per-device columns, fonts, and ad hiding (EN/VI). Network: Google Fonts + syndication.twimg.com only.
// @match        https://x.com/*
// @match        https://twitter.com/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      fonts.googleapis.com
// @connect      fonts.gstatic.com
// @connect      cdn.syndication.twimg.com
// @noframes
// @downloadURL  {U}
// @updateURL    {U}
// ==/UserScript==
"""
out = hdr + ads + body
hd, rest = out.split('// ==/UserScript==\n', 1)
rest = re.sub(r'[^\x00-\x7F]', lambda c: '\\u%04x' % ord(c.group()) if ord(c.group()) < 0x10000 else '\\u%04x\\u%04x' % (0xD800 + ((ord(c.group()) - 0x10000) >> 10), 0xDC00 + ((ord(c.group()) - 0x10000) & 0x3FF)), rest)
out = hd + '// ==/UserScript==\n' + rest
assert not re.search(r'[^\x00-\x7F]', out)
os.makedirs('userscript/dist', exist_ok=True)
open('userscript/dist/x-masonry.user.js', 'w', encoding='ascii').write(out)
print('ok', len(out))
