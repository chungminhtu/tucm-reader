/* public/x-adblock.js — shared X ad hider (extension + userscript) */
(function () {
  'use strict';
  if (window.__xabAdblock) return;

  var LABELS = {
    'promoted': 1,
    'ad': 1,
    'ads': 1,
    'sponsored': 1,
    'qu\u1ea3ng c\u00e1o': 1,
    '\u0111\u01b0\u1ee3c qu\u1ea3ng b\u00e1': 1,
    '\u0111\u01b0\u1ee3c t\u00e0i tr\u1ee3': 1
  };
  var PREFIXES = [
    'promoted by',
    '\u0111\u01b0\u1ee3c qu\u1ea3ng b\u00e1 b\u1edfi',
    'qu\u1ea3ng c\u00e1o b\u1edfi',
    'ad from',
    'qu\u1ea3ng c\u00e1o t\u1eeb'
  ];

  var queue = [];
  var queued = new Set();
  var rafPending = false;
  var styleInjected = false;

  function normalize(s) {
    return String(s || '')
      .normalize('NFC')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  function ensureStyle() {
    if (styleInjected) return;
    var css = '[data-xab-hidden]{display:none !important}';
    var root = document.documentElement || document.head || document.body;
    if (!root) return;
    var el = document.createElement('style');
    el.textContent = css;
    (document.head || document.documentElement || document.body).appendChild(el);
    styleInjected = true;
  }

  function directText(el) {
    var parts = [];
    var nodes = el.childNodes;
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].nodeType === 3) parts.push(nodes[i].nodeValue || '');
    }
    return normalize(parts.join(''));
  }

  function isLabelText(t) {
    if (!t) return false;
    if (LABELS[t]) return true;
    for (var i = 0; i < PREFIXES.length; i++) {
      var pf = PREFIXES[i];
      if (t.indexOf(pf) === 0 && (t.length === pf.length || t.charAt(pf.length) === ' ')) return true;
    }
    return false;
  }

  function shouldSkip(el) {
    if (el.closest('[data-testid="tweetText"]')) return true;
    if (el.closest('[contenteditable="true"]')) return true;
    if (el.closest('[data-testid="UserName"]')) return true;
    var a = el.closest('a[href]');
    if (a && a.closest('[data-testid="User-Name"]')) return true;
    return false;
  }

  function hideContainer(from, reason) {
    var node = from;
    while (node && node !== document && node !== document.documentElement) {
      if (node.classList && node.classList.contains('fc-card')) {
        node.setAttribute('data-xab-hidden', '1');
        node.setAttribute('data-xab-reason', reason);
        return;
      }
      node = node.parentElement;
    }
    node = from;
    while (node && node !== document && node !== document.documentElement) {
      if (node.getAttribute && node.getAttribute('data-testid') === 'cellInnerDiv') {
        node.setAttribute('data-xab-hidden', '1');
        node.setAttribute('data-xab-reason', reason);
        return;
      }
      node = node.parentElement;
    }
    node = from;
    while (node && node !== document && node !== document.documentElement) {
      if (node.tagName === 'ARTICLE') {
        node.setAttribute('data-xab-hidden', '1');
        node.setAttribute('data-xab-reason', reason);
        return;
      }
      node = node.parentElement;
    }
  }

  function scanElement(el) {
    if (!el || el.nodeType !== 1) return;
    if (el.hasAttribute && el.hasAttribute('data-xab-hidden')) return;
    if (!shouldSkip(el) && isLabelText(directText(el))) {
      ensureStyle();
      hideContainer(el, 'label');
      return;
    }
    var kids = el.children;
    if (!kids) return;
    for (var i = 0; i < kids.length; i++) scanElement(kids[i]);
  }

  function checkNoTime(cell) {
    if (!cell || cell.nodeType !== 1) return;
    if (cell.hasAttribute('data-xab-hidden')) return;
    var art = cell.querySelector('article');
    if (!art) return;
    if (art.querySelector('[data-testid="User-Name"]') && !art.querySelector('time')) {
      ensureStyle();
      cell.setAttribute('data-xab-hidden', '1');
      cell.setAttribute('data-xab-reason', 'notime');
    }
  }

  function processNode(node) {
    if (!node) return;
    if (node.nodeType === 3) {
      var p = node.parentElement;
      if (p) scanElement(p);
      return;
    }
    if (node.nodeType !== 1) return;
    scanElement(node);
    if (node.getAttribute && node.getAttribute('data-testid') === 'cellInnerDiv') {
      checkNoTime(node);
    } else {
      var cells = node.querySelectorAll ? node.querySelectorAll('[data-testid="cellInnerDiv"]') : [];
      for (var i = 0; i < cells.length; i++) checkNoTime(cells[i]);
    }
  }

  function flush() {
    rafPending = false;
    var batch = queue;
    queue = [];
    queued.clear();
    for (var i = 0; i < batch.length; i++) processNode(batch[i]);
  }

  function enqueue(node) {
    if (!node) return;
    if (queued.has(node)) return;
    queued.add(node);
    queue.push(node);
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(flush);
    }
  }

  function sweep() {
    ensureStyle();
    var cells = document.querySelectorAll('[data-testid="cellInnerDiv"]');
    for (var i = 0; i < cells.length; i++) {
      scanElement(cells[i]);
      checkNoTime(cells[i]);
    }
    var cards = document.querySelectorAll('#fc-grid .fc-card');
    for (var j = 0; j < cards.length; j++) {
      scanElement(cards[j]);
    }
  }

  function onMutations(muts) {
    for (var i = 0; i < muts.length; i++) {
      var m = muts[i];
      if (m.type === 'characterData') {
        enqueue(m.target && m.target.parentElement ? m.target.parentElement : m.target);
        continue;
      }
      if (m.type === 'childList') {
        var added = m.addedNodes;
        for (var j = 0; j < added.length; j++) enqueue(added[j]);
        if (m.target) enqueue(m.target);
      }
    }
  }

  function start() {
    ensureStyle();
    var root = document.documentElement || document;
    try {
      var mo = new MutationObserver(onMutations);
      mo.observe(root, { childList: true, subtree: true, characterData: true });
    } catch (e) { /* ignore */ }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', sweep);
    } else {
      sweep();
    }
    setInterval(sweep, 1000);
  }

  window.__xabAdblock = { sweep: sweep, version: 1 };
  start();
})();
