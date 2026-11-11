// Small settings panel for phones (no popup there). Writes the same keys the FontChanger
// typography / columns code reads from chrome.storage.local.
(() => {
  'use strict';
  // Only families that ship the Google Fonts "vietnamese" subset (checked 2026-11-11).
  const FONTS = ['Lexend Deca', 'Plus Jakarta Sans', 'Manrope', 'Tilt Neon', 'Alata', 'Zalando Sans', 'Geologica', 'Readex Pro'];
  const DEF = { fontFamily: 'Lexend Deca', fontSize: 16, fontWeight: 400, lineHeight: 1.5, xColsMobile: 1, xColsTablet: 2, xColsDesktop: 'auto' };
  const vi = /^vi/i.test((document.documentElement && document.documentElement.lang) || navigator.language || '');
  const T = vi
    ? { font: 'Phông chữ', size: 'Cỡ chữ', weight: 'Độ đậm', lh: 'Giãn dòng', cols: 'Số cột', auto: 'Tự động', close: 'Đóng', title: 'Cài đặt chữ' }
    : { font: 'Font', size: 'Font size', weight: 'Weight', lh: 'Line height', cols: 'Columns', auto: 'Auto', close: 'Close', title: 'Text settings' };
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
  function fillCols(sel, st) {
    const b = bucket();
    const opts = b === 'mobile' ? [1, 2, 3] : b === 'tablet' ? [1, 2, 3, 4] : ['auto', 1, 2, 3, 4, 5, 6];
    sel.innerHTML = '';
    opts.forEach((o) => sel.appendChild(el('option', { value: String(o), textContent: o === 'auto' ? T.auto : String(o) })));
    sel.value = String(st[bucketKey(b)]);
  }
  function build(s) {
    if (document.getElementById('xab-panel')) return;
    const st = Object.assign({}, s);
    const fab = el('button', { id: 'xab-fab', textContent: 'Aa', title: T.title, type: 'button' });
    fab.style.cssText = 'position:fixed;right:6px;bottom:62px;z-index:2147483000;width:28px;height:28px;padding:0;border-radius:50%;border:none;background:#1d9bf0;color:#fff;opacity:.55;font:700 11px system-ui,sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.3)';
    const panel = el('div', { id: 'xab-panel' });
    panel.style.cssText = 'position:fixed;right:6px;bottom:96px;z-index:2147483000;width:min(250px,calc(100vw - 12px));padding:8px;border-radius:12px;background:#16181c;border:1px solid #2f3336;box-shadow:0 4px 20px rgba(0,0,0,.5);display:none';
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
    const cols = el('select', { id: 'xab-cols' }); cols.style.cssText = fieldCss;
    fillCols(cols, st);
    let lastBucket = bucket();
    const close = el('button', { textContent: T.close, type: 'button' });
    close.style.cssText = 'margin-top:4px;padding:4px 10px;border-radius:999px;border:1px solid #536471;background:transparent;color:#fff';
    const change = () => {
      const v = { fontFamily: sel.value, fontSize: +size.value, fontWeight: +wt.value, lineHeight: +(+lh.value).toFixed(1) };
      sizeV.textContent = ' ' + v.fontSize + 'px'; lhV.textContent = ' ' + v.lineHeight;
      Object.assign(st, v);
      chrome.storage.local.set(v);
    };
    cols.addEventListener('change', () => {
      const key = bucketKey(bucket());
      const raw = cols.value;
      const val = raw === 'auto' ? 'auto' : +raw;
      st[key] = val;
      chrome.storage.local.set({ [key]: val });
    });
    [sel, size, wt, lh].forEach((i) => i.addEventListener('input', change));
    window.addEventListener('resize', () => {
      const b = bucket();
      if (b === lastBucket) return;
      lastBucket = b;
      fillCols(cols, st);
    });
    fab.addEventListener('click', () => { panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; });
    close.addEventListener('click', () => { panel.style.display = 'none'; });
    panel.append(row(T.font, sel), row(T.size, size, sizeV), row(T.weight, wt), row(T.lh, lh, lhV), row(T.cols, cols), close);
    document.body.append(fab, panel);
    if (typeof GM_registerMenuCommand === 'function') {
      try { GM_registerMenuCommand(T.title, () => { panel.style.display = 'block'; }); } catch (_) {}
    }
  }
  function start() { chrome.storage.local.get(DEF, build); }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
