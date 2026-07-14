/**
 * content.js — Content script injected into every page.
 *
 * Bridges the popup UI with the TypingEngine.
 * Finds the active input element and manages the typing lifecycle.
 */

(() => {
  // ── State ──
  let engine = null;
  let model = null;
  let currentConfig = null;

  // ── Message handler ──
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg.action) {
      case 'start':
        handleStart(msg.text, msg.config).then(sendResponse);
        return true; // Keep channel open for async

      case 'pause':
        handlePause();
        sendResponse({ success: true });
        break;

      case 'resume':
        handleResume().then(sendResponse);
        return true;

      case 'stop':
        handleStop();
        sendResponse({ success: true });
        break;

      case 'getStatus':
        sendResponse(getStatus());
        break;

      case 'ping':
        sendResponse({ pong: true });
        break;
    }
  });

  // ── Actions ──

  async function handleStart(text, config) {
    if (!text || text.trim().length === 0) {
      return { success: false, error: 'No text provided' };
    }

    // Stop any existing session
    if (engine) {
      engine.stop();
    }

    // Find the active editable element
    const element = findEditableElement();
    if (!element) {
      return { success: false, error: 'No editable element found. Click an input or textarea first.' };
    }

    // Focus it
    element.focus();

    // Build model and engine
    currentConfig = config || {};
    model = new HumanModel(currentConfig);

    engine = new TypingEngine(model, {
      onProgress: (progress) => {
        // Forward progress to popup
        chrome.runtime.sendMessage({
          action: 'progress',
          ...progress,
        }).catch(() => {}); // Popup might not be open
      },
      onStateChange: (state) => {
        updateBadge(state);
        chrome.runtime.sendMessage({
          action: 'stateChange',
          state,
        }).catch(() => {});
      },
      onDone: () => {
        updateBadge('DONE');
        chrome.runtime.sendMessage({ action: 'done' }).catch(() => {});
      },
    });

    try {
      await engine.start(text, element);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  function handlePause() {
    if (engine) {
      engine.pause();
    }
    return { success: true };
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
      engine.stop();
      engine = null;
      model = null;
    }
    return { success: true };
  }

  function getStatus() {
    if (!engine) {
      return { state: 'IDLE', position: 0, total: 0, elapsed: 0 };
    }
    return engine.getProgress();
  }

  // ── Helpers ──

  /**
   * Find the best editable element to type into.
   * Priority: focused element > first visible input/textarea > first contenteditable
   */
  function findEditableElement() {
    const active = document.activeElement;

    // Check if the focused element is editable
    if (isEditable(active)) {
      return active;
    }

    // Try to focus a visible input or textarea
    const inputs = document.querySelectorAll('input[type="text"], input:not([type]), textarea, [contenteditable="true"]');
    for (const el of inputs) {
      if (isVisible(el) && isEditable(el)) {
        return el;
      }
    }

    return null;
  }

  function isEditable(el) {
    if (!el) return false;
    const tag = el.tagName?.toLowerCase();
    if (tag === 'input') {
      const type = (el.type || '').toLowerCase();
      return type === 'text' || type === 'search' || type === 'email' ||
             type === 'url' || type === 'password' || type === 'tel' ||
             type === 'number' || type === '';
    }
    if (tag === 'textarea') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           style.opacity !== '0' &&
           el.offsetWidth > 0 &&
           el.offsetHeight > 0;
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
