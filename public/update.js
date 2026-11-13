// Self-update for the unpacked extension: fetch update.json + files, write them into the
// folder the user picked (File System Access API), then reload the extension.
(function () {
  'use strict';
  var BASES = [
    'http://minhtu-m5max-64gb.netbird.selfhosted:7445/update/',
    'http://192.168.8.180:7446/update/'
  ];
  var $ = function (id) { return document.getElementById(id); };
  var log = function (s) { $('log').textContent += s + '\n'; };
  var cur = chrome.runtime.getManifest().version;
  var info = null, base = null;

  function cmp(a, b) {
    var x = a.split('.').map(Number), y = b.split('.').map(Number);
    for (var i = 0; i < 4; i++) { var d = (x[i] || 0) - (y[i] || 0); if (d) return d; }
    return 0;
  }
  function idb() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open('tucm-update', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function kv(mode, fn) {
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        var req = fn(db.transaction('kv', mode).objectStore('kv'));
        req.onsuccess = function () { res(req.result); };
        req.onerror = function () { rej(req.error); };
      });
    });
  }

  async function check() {
    for (var i = 0; i < BASES.length; i++) {
      try {
        var r = await fetch(BASES[i] + 'update.json', { cache: 'no-store' });
        if (!r.ok) continue;
        info = await r.json(); base = BASES[i]; break;
      } catch (e) { /* try next */ }
    }
    if (!info) { $('ver').textContent = 'Không kết nối được máy chủ cập nhật (bật NetBird hoặc cùng LAN).'; return; }
    var newer = cmp(info.version, cur) > 0;
    $('ver').textContent = 'Đang dùng v' + cur + ' · mới nhất v' + info.version + (newer ? ' — có bản mới.' : ' — đã mới nhất.');
    $('go').disabled = false;
    $('go').textContent = newer ? 'Cập nhật ngay' : 'Cài lại bản này';
  }

  async function writeFile(root, path, data) {
    var parts = path.split('/'), dir = root;
    for (var i = 0; i < parts.length - 1; i++) dir = await dir.getDirectoryHandle(parts[i], { create: true });
    var fh = await dir.getFileHandle(parts[parts.length - 1], { create: true });
    var w = await fh.createWritable();
    await w.write(data); await w.close();
  }

  async function run() {
    $('go').disabled = true; $('log').textContent = '';
    try {
      var root = await kv('readonly', function (s) { return s.get('dir'); });
      if (root) {
        var p = await root.queryPermission({ mode: 'readwrite' });
        if (p !== 'granted') p = await root.requestPermission({ mode: 'readwrite' });
        if (p !== 'granted') root = null;
      }
      if (!root) {
        root = await window.showDirectoryPicker({ mode: 'readwrite' });
        await kv('readwrite', function (s) { return s.put(root, 'dir'); });
      }
      var mf;
      try {
        var mh = await root.getFileHandle('manifest.json');
        mf = JSON.parse(await (await mh.getFile()).text());
      } catch (e) { mf = null; }
      if (!mf || mf.name !== 'TUCM Reader') {
        await kv('readwrite', function (s) { return s.delete('dir'); });
        throw new Error('Thư mục này không phải extension TUCM Reader (không có manifest.json đúng). Chọn lại.');
      }
      log('Tải ' + info.files.length + ' file…');
      var blobs = [];
      for (var i = 0; i < info.files.length; i++) {
        var f = info.files[i];
        var r = await fetch(base + f.split('/').map(encodeURIComponent).join('/'), { cache: 'no-store' });
        if (!r.ok) throw new Error('Lỗi tải ' + f + ' (' + r.status + ')');
        blobs.push(await r.blob());
      }
      log('Ghi vào thư mục…');
      // manifest.json last, so a failed write never leaves a half-new manifest.
      var order = info.files.map(function (f, i) { return i; }).sort(function (a, b) {
        return (info.files[a] === 'manifest.json') - (info.files[b] === 'manifest.json');
      });
      for (var k = 0; k < order.length; k++) await writeFile(root, info.files[order[k]], blobs[order[k]]);
      log('Xong v' + info.version + '. Đang nạp lại extension…');
      setTimeout(function () { chrome.runtime.reload(); }, 600);
    } catch (e) {
      log('Lỗi: ' + (e && e.message ? e.message : e));
      $('go').disabled = false;
    }
  }

  $('go').addEventListener('click', run);
  check();
})();
