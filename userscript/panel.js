// Small settings panel for phones (no popup there). Writes the same keys the FontChanger
// typography / columns code reads from chrome.storage.local.
(() => {
  'use strict';
  // Only families that ship the Google Fonts "vietnamese" subset (checked 2026-11-11).
  const FONTS = ['Lexend Deca', 'Plus Jakarta Sans', 'Manrope', 'Tilt Neon', 'Alata', 'Zalando Sans', 'Geologica', 'Readex Pro', 'Literata', 'Bookerly'];
  const DEF = { fontFamily: 'Lexend Deca', fontSize: 16, fontWeight: 400, lineHeight: 1.5, xColsMobile: 1, xColsTablet: 2, xColsDesktop: 'auto' };
  const vi = /^vi/i.test((document.documentElement && document.documentElement.lang) || navigator.language || '');
  const T = vi
    ? { font: 'Phông chữ', size: 'Cỡ chữ', weight: 'Độ đậm', lh: 'Giãn dòng', cols: 'Số cột', mobile: 'Điện thoại', tablet: 'Máy tính bảng', desktop: 'Máy tính', now: 'đang dùng', auto: 'Tự động', close: 'Đóng', title: 'Cài đặt chữ' }
    : { font: 'Font', size: 'Font size', weight: 'Weight', lh: 'Line height', cols: 'Columns', mobile: 'Phone', tablet: 'Tablet', desktop: 'Desktop', now: 'in use', auto: 'Auto', close: 'Close', title: 'Text settings' };
  function bucket() {
    const w = window.innerWidth;
    if (w < 600) return 'mobile';
    if (w <= 1200) return 'tablet';
    return 'desktop';
  }
  function bucketKey(b) {
    return b === 'mobile' ? 'xColsMobile' : b === 'tablet' ? 'xColsTablet' : 'xColsDesktop';
  }
  function el(tag, props, kids) {
    const e = document.createElement(tag);
    Object.assign(e, props || {});
    (kids || []).forEach((k) => e.appendChild(typeof k === 'string' ? document.createTextNode(k) : k));
    return e;
  }
  function row(label, input, valueEl) {
    const r = el('label', {}, [el('span', { textContent: label }), input]);
    r.style.cssText = 'display:flex;flex-direction:column;gap:3px;margin:4px 0;font:13px system-ui,sans-serif;color:#e7e9ea';
    if (valueEl) r.firstChild.appendChild(valueEl);
    return r;
  }
  // One column select per device size (same keys and ranges as the extension popup).
  const COL_BUCKETS = [
    { b: 'mobile', range: '<600px', opts: [1, 2, 3] },
    { b: 'tablet', range: '600-1200px', opts: [1, 2, 3, 4] },
    { b: 'desktop', range: '>1200px', opts: ['auto', 1, 2, 3, 4, 5, 6] },
  ];
  function build(s) {
    if (document.getElementById('xab-panel')) return;
    const st = Object.assign({}, s);
    const fab = el('button', { id: 'xab-fab', textContent: 'Aa', title: T.title, type: 'button' });
    const panel = el('div', { id: 'xab-panel' });
    panel.style.cssText = 'position:fixed;right:12px;bottom:106px;z-index:2147483000;width:min(250px,calc(100vw - 12px));padding:8px;border-radius:12px;background:#16181c;border:1px solid #2f3336;box-shadow:0 4px 20px rgba(0,0,0,.5);display:none';
    const fieldCss = 'padding:6px;border-radius:6px;background:#000;color:#fff;border:1px solid #536471;font-size:14px';
    const sel = el('select', { id: 'xab-font' }); sel.style.cssText = fieldCss;
    FONTS.forEach((f) => sel.appendChild(el('option', { value: f, textContent: f })));
    sel.value = st.fontFamily;
    const size = el('input', { id: 'xab-size', type: 'range', min: 12, max: 28, step: 1, value: st.fontSize });
    const sizeV = el('b', { textContent: ' ' + st.fontSize + 'px' });
    const wt = el('select', { id: 'xab-weight' }); wt.style.cssText = fieldCss;
    [300, 400, 500, 600, 700].forEach((w) => wt.appendChild(el('option', { value: w, textContent: String(w) })));
    wt.value = String(st.fontWeight);
    const lh = el('input', { id: 'xab-lh', type: 'range', min: 1.2, max: 2.0, step: 0.1, value: st.lineHeight });
    const lhV = el('b', { textContent: ' ' + st.lineHeight });
    const colRows = COL_BUCKETS.map((c) => {
      const key = bucketKey(c.b);
      const s2 = el('select', { id: 'xab-cols-' + c.b }); s2.style.cssText = fieldCss;
      c.opts.forEach((o) => s2.appendChild(el('option', { value: String(o), textContent: o === 'auto' ? T.auto : String(o) })));
      s2.value = String(st[key]);
      s2.addEventListener('change', () => {
        const val = s2.value === 'auto' ? 'auto' : +s2.value;
        st[key] = val;
        chrome.storage.local.set({ [key]: val });
      });
      const tag = el('b', { textContent: '' });
      tag.style.color = '#1d9bf0';
      return { b: c.b, tag, row: row(T.cols + ' · ' + T[c.b] + ' (' + c.range + ')', s2, tag) };
    });
    // Mark the select that applies to the current screen width.
    const markBucket = () => { const b = bucket(); colRows.forEach((r) => { r.tag.textContent = r.b === b ? ' · ' + T.now : ''; }); };
    markBucket();
    const close = el('button', { textContent: T.close, type: 'button' });
    close.style.cssText = 'margin-top:4px;padding:4px 10px;border-radius:999px;border:1px solid #536471;background:transparent;color:#fff';
    const change = () => {
      const v = { fontFamily: sel.value, fontSize: +size.value, fontWeight: +wt.value, lineHeight: +(+lh.value).toFixed(1) };
      sizeV.textContent = ' ' + v.fontSize + 'px'; lhV.textContent = ' ' + v.lineHeight;
      Object.assign(st, v);
      chrome.storage.local.set(v);
    };
    [sel, size, wt, lh].forEach((i) => i.addEventListener('input', change));
    window.addEventListener('resize', markBucket);
    fab.addEventListener('click', () => { panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; });
    close.addEventListener('click', () => { panel.style.display = 'none'; });
    // Status line: shows whether the chosen font really loaded (evidence on phones).
    const fst = el('div', { id: 'xab-font-status' });
    fst.style.cssText = 'font:11px system-ui,sans-serif;color:#8b98a5;margin:2px 0 4px;word-break:break-word';
    const showStatus = () => {
      const f = chrome.fontStatus;
      if (!f) { fst.textContent = ''; return; }
      const fam = decodeURIComponent((/family=([^&:]+)/.exec(f.url) || [])[1] || '').replace(/\+/g, ' ');
      fst.textContent = f.ok ? (vi ? 'Đã tải phông: ' : 'Font loaded: ') + fam : (vi ? 'Lỗi tải phông ' : 'Font load error ') + fam + ': ' + f.error;
      fst.style.color = f.ok ? '#00ba7c' : '#f4212e';
    };
    window.addEventListener('xab-font-status', showStatus);
    showStatus();
    panel.append(row(T.font, sel), fst, row(T.size, size, sizeV), row(T.weight, wt), row(T.lh, lh, lhV), ...colRows.map((r) => r.row), close);
    let bar = document.getElementById('fc-fabbar');
    if (!bar) { bar = el('div', { id: 'fc-fabbar' }); document.body.appendChild(bar); }
    fab.setAttribute('aria-label', T.title);
    bar.appendChild(fab);
    document.body.appendChild(panel);
    if (typeof GM_registerMenuCommand === 'function') {
      try { GM_registerMenuCommand(T.title, () => { panel.style.display = 'block'; }); } catch (_) {}
    }
  }
  function start() { chrome.storage.local.get(DEF, build); }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
