/**
 * content.js — Content script injected into supported pages.
 *
 * Bridges the popup UI with the TypingEngine.
 * Finds the active input element and manages the typing lifecycle.
 *
 * All code is wrapped defensively to avoid interfering with
 * the host page's JavaScript execution (e.g. SPA frameworks).
 */

(() => {
  // Guard: bail out immediately if the extension context is invalid
  if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return;

  // Allow a tiny settle delay for SPA pages to finish hydration
  const SETTLE_MS = 300;

  // ── State ──
  let engine = null;
  let model = null;
  let currentConfig = null;
  let ready = false;

  // ── Deferred init ──
  setTimeout(() => {
    try {
      initMessageHandler();
      ready = true;
    } catch (e) {
      // Silently fail — never break the host page
      console.debug('[MockTyping] Init deferred:', e.message);
    }
  }, SETTLE_MS);

  // ── Message handler setup ──

  function initMessageHandler() {
    if (!chrome.runtime?.onMessage) return;
    chrome.runtime.onMessage.addListener(wrapListener);
  }

  function wrapListener(msg, sender, sendResponse) {
    try {
      return messageHandler(msg, sender, sendResponse);
    } catch (e) {
      // Catch synchronous throws from the handler
      try { sendResponse({ success: false, error: e.message }); } catch (_) {}
      return false;
    }
  }

  function messageHandler(msg, sender, sendResponse) {
    switch (msg.action) {
      case 'start':
        handleStart(msg.text, msg.config).then(
          (r) => { try { sendResponse(r); } catch (_) {} },
          (e) => { try { sendResponse({ success: false, error: e?.message || 'Unknown' }); } catch (_) {} }
        );
        return true; // Keep channel open for async

      case 'pause':
        handlePause();
        try { sendResponse({ success: true }); } catch (_) {}
        break;

      case 'resume':
        handleResume().then(
          (r) => { try { sendResponse(r); } catch (_) {} },
          (e) => { try { sendResponse({ success: false, error: e?.message || 'Unknown' }); } catch (_) {} }
        );
        return true;

      case 'stop':
        handleStop();
        try { sendResponse({ success: true }); } catch (_) {}
        break;

      case 'getStatus':
        try { sendResponse(getStatus()); } catch (_) {}
        break;

      case 'ping':
        try { sendResponse({ pong: true, ready }); } catch (_) {}
        break;
    }
  }

  // ── Actions ──

  async function handleStart(text, config) {
    if (!text || text.trim().length === 0) {
      return { success: false, error: 'No text provided' };
    }

    // Stop any existing session
    if (engine) {
      try { engine.stop(); } catch (_) {}
    }

    // Find the active editable element
    const element = findEditableElement();
    if (!element) {
      return { success: false, error: 'No editable element found. Click an input or textarea first.' };
    }

    // Focus it
    try { element.focus(); } catch (_) {}

    // Build model and engine (these globals come from lib/*.js)
    currentConfig = config || {};
    try {
      model = new HumanModel(currentConfig);
    } catch (e) {
      return { success: false, error: 'Failed to create HumanModel: ' + e.message };
    }

    try {
      engine = new TypingEngine(model, {
        onProgress: (progress) => {
          chrome.runtime.sendMessage({ action: 'progress', ...progress }).catch(() => {});
        },
        onStateChange: (state) => {
          updateBadge(state);
          chrome.runtime.sendMessage({ action: 'stateChange', state }).catch(() => {});
        },
        onDone: () => {
          updateBadge('DONE');
          chrome.runtime.sendMessage({ action: 'done' }).catch(() => {});
        },
      });
    } catch (e) {
      return { success: false, error: 'Failed to create TypingEngine: ' + e.message };
    }

    try {
      await engine.start(text, element);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  function handlePause() {
    if (engine) {
      try { engine.pause(); } catch (_) {}
    }
  }

  async function handleResume() {
    if (!engine) {
      return { success: false, error: 'No active session' };
    }
    try {
      await engine.resume();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  function handleStop() {
    if (engine) {
      try { engine.stop(); } catch (_) {}
      engine = null;
      model = null;
    }
  }

  function getStatus() {
    if (!engine) {
      return { state: 'IDLE', position: 0, total: 0, elapsed: 0 };
    }
    return engine.getProgress();
  }

  // ── Helpers ──

  function findEditableElement() {
    try {
      const active = document.activeElement;
      if (isEditable(active)) return active;
    } catch (_) {}

    try {
      // Broad search: standard inputs + ARIA roles used by Google/Baidu/DeepL etc.
      const inputs = document.querySelectorAll(
        'input[type="text"], input:not([type]), textarea, ' +
        '[contenteditable="true"], [role="textbox"], [role="combobox"]'
      );
      for (const el of inputs) {
        if (isVisible(el) && isEditable(el)) return el;
      }
    } catch (_) {}

    return null;
  }

  function isEditable(el) {
    if (!el) return false;
    try {
      const tag = el.tagName?.toLowerCase();
      if (tag === 'input') {
        const type = (el.type || '').toLowerCase();
        return type === 'text' || type === 'search' || type === 'email' ||
               type === 'url' || type === 'password' || type === 'tel' ||
               type === 'number' || type === '';
      }
      if (tag === 'textarea') return true;
      if (el.isContentEditable) return true;
      // Google Translate / modern SPA inputs use ARIA roles
      const role = el.getAttribute('role');
      if (role === 'textbox' || role === 'combobox' || role === 'searchbox') {
        return tag === 'textarea' || tag === 'input' || el.isContentEditable;
      }
    } catch (_) {}
    return false;
  }

  function isVisible(el) {
    if (!el) return false;
    try {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' &&
             style.visibility !== 'hidden' &&
             style.opacity !== '0' &&
             el.offsetWidth > 0 &&
             el.offsetHeight > 0;
    } catch (_) {}
    return false;
  }

  function updateBadge(state) {
    const badgeMap = {
      'TYPING':     { text: '▶',  color: '#0ea5a0' },
      'ERROR':      { text: '✗',  color: '#f59e0b' },
      'CORRECTING': { text: '⌫', color: '#f59e0b' },
      'PAUSED':     { text: '⏸',  color: '#6b7280' },
      'DONE':       { text: '✓',  color: '#10b981' },
      'IDLE':       { text: '',   color: '#6b7280' },
    };
    const badge = badgeMap[state] || { text: '', color: '#6b7280' };
    chrome.runtime.sendMessage({
      action: 'setBadge',
      text: badge.text,
      color: badge.color,
    }).catch(() => {});
  }
})();
