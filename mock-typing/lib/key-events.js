/**
 * key-events.js — Realistic keyboard event generation.
 *
 * Every character typed produces a full event cascade:
 *   keydown → keypress → (DOM mutation) → input → keyup
 *
 * Supports <input>, <textarea>, and contenteditable elements.
 */

const KeyEvents = (() => {
  // ── Key metadata lookup ──────────────────────────────────────────

  /**
   * Returns { key, code, keyCode, which, charCode, shiftKey, ctrlKey }
   * for a given character or special key name.
   */
  function getKeyInfo(char) {
    const info = {
      key: char,
      code: '',
      keyCode: 0,
      which: 0,
      charCode: char.charCodeAt(0),
      shiftKey: false,
      ctrlKey: false,
    };

    // ── Letters ──
    if (/[a-zA-Z]/.test(char)) {
      const upper = char.toUpperCase();
      info.code = 'Key' + upper;
      info.keyCode = upper.charCodeAt(0);
      info.shiftKey = char === upper && char !== char.toLowerCase();
      info.which = info.keyCode;
      return info;
    }

    // ── Digits ──
    if (/[0-9]/.test(char)) {
      info.code = 'Digit' + char;
      info.keyCode = char.charCodeAt(0);
      info.which = info.keyCode;
      return info;
    }

    // ── Whitespace ──
    if (char === ' ') {
      info.code = 'Space';
      info.keyCode = 32;
      info.which = 32;
      return info;
    }
    if (char === '\n') {
      info.code = 'Enter';
      info.key = 'Enter';
      info.keyCode = 13;
      info.which = 13;
      return info;
    }
    if (char === '\t') {
      info.code = 'Tab';
      info.key = 'Tab';
      info.keyCode = 9;
      info.which = 9;
      return info;
    }

    // ── Punctuation / symbols ──
    const map = {
      '.':  ['Period',     190], ',':  ['Comma',       188],
      '/':  ['Slash',      191], '\\': ['Backslash',   220],
      ';':  ['Semicolon',  186], "'":  ['Quote',       222],
      '[':  ['BracketLeft',219], ']':  ['BracketRight',221],
      '-':  ['Minus',      189], '=':  ['Equal',       187],
      '`':  ['Backquote',  192],
      '!':  ['Digit1',      49, true], '@': ['Digit2',  50, true],
      '#':  ['Digit3',      51, true], '$': ['Digit4',  52, true],
      '%':  ['Digit5',      53, true], '^': ['Digit6',  54, true],
      '&':  ['Digit7',      55, true], '*': ['Digit8',  56, true],
      '(':  ['Digit9',      57, true], ')': ['Digit0',  48, true],
      '_':  ['Minus',      189, true], '+': ['Equal',  187, true],
      '{':  ['BracketLeft',219, true], '}': ['BracketRight',221,true],
      '|':  ['Backslash',  220, true], ':': ['Semicolon',186,true],
      '"':  ['Quote',      222, true], '<': ['Comma',  188, true],
      '>':  ['Period',     190, true], '?': ['Slash',  191, true],
      '~':  ['Backquote',  192, true],
    };

    const entry = map[char];
    if (entry) {
      info.code = entry[0];
      info.keyCode = entry[1];
      info.shiftKey = !!entry[2];
      info.which = info.keyCode;
      return info;
    }

    // Fallback: use char code as-is
    info.code = '';
    info.keyCode = info.charCode;
    info.which = info.charCode;
    return info;
  }

  // ── Event constructors ───────────────────────────────────────────

  function buildKeyEvent(type, keyInfo, opts = {}) {
    const init = {
      key: keyInfo.key,
      code: keyInfo.code,
      keyCode: keyInfo.keyCode,
      which: keyInfo.which,
      shiftKey: keyInfo.shiftKey,
      ctrlKey: keyInfo.ctrlKey || false,
      altKey: false,
      metaKey: false,
      repeat: opts.repeat || false,
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      ...opts.overrides,
    };
    return new KeyboardEvent(type, init);
  }

  function buildInputEvent(inputType, data, target) {
    return new InputEvent('input', {
      data: data,
      inputType: inputType,
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }

  // ── DOM mutation helpers ─────────────────────────────────────────

  /**
   * Insert `text` at the current cursor position for <input> / <textarea>.
   */
  function insertText(element, text) {
    if (element.isContentEditable) {
      // contenteditable
      const sel = window.getSelection();
      if (sel.rangeCount) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(text));
        // Move cursor after inserted text
        range.setStartAfter(range.endContainer);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } else {
      // <input> / <textarea>
      const start = element.selectionStart;
      const end = element.selectionEnd;
      const val = element.value;
      element.value = val.slice(0, start) + text + val.slice(end);
      // Move cursor after inserted text
      const newPos = start + text.length;
      element.setSelectionRange(newPos, newPos);
    }
  }

  /**
   * Delete `count` characters before the cursor.
   */
  function deleteText(element, count) {
    if (element.isContentEditable) {
      const sel = window.getSelection();
      if (sel.rangeCount) {
        const range = sel.getRangeAt(0);
        for (let i = 0; i < count && range.startOffset > 0; i++) {
          // Extend backward by one character
          range.setStart(range.startContainer, Math.max(0, range.startOffset - 1));
        }
        range.deleteContents();
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } else {
      const start = element.selectionStart;
      const val = element.value;
      const delStart = Math.max(0, start - count);
      element.value = val.slice(0, delStart) + val.slice(start);
      element.setSelectionRange(delStart, delStart);
    }
  }

  // ── Public API ───────────────────────────────────────────────────

  /**
   * Simulate typing a single character into an element.
   * Dispatches: keydown → keypress → (DOM insert) → input → keyup
   */
  function simulateKeyPress(element, char) {
    const keyInfo = getKeyInfo(char);

    // 1. keydown
    element.dispatchEvent(buildKeyEvent('keydown', keyInfo));

    // 2. keypress (legacy, but many detection scripts check it)
    element.dispatchEvent(buildKeyEvent('keypress', keyInfo));

    // 3. Insert the character into the DOM
    insertText(element, char);

    // 4. input event
    element.dispatchEvent(buildInputEvent('insertText', char, element));

    // 5. keyup
    element.dispatchEvent(buildKeyEvent('keyup', keyInfo));

    // Also dispatch a change-like event for frameworks (React, Vue, etc.)
    // React listens to the `input` event's target.value, so the DOM mutation above covers it.

    return keyInfo;
  }

  /**
   * Simulate pressing Backspace `count` times.
   * Dispatches: keydown → (DOM delete) → input → keyup   (× count)
   */
  function simulateBackspace(element, count = 1) {
    for (let i = 0; i < count; i++) {
      const keyInfo = {
        key: 'Backspace',
        code: 'Backspace',
        keyCode: 8,
        which: 8,
        charCode: 0,
        shiftKey: false,
        ctrlKey: false,
      };

      // keydown
      element.dispatchEvent(buildKeyEvent('keydown', keyInfo));

      // Delete one character
      deleteText(element, 1);

      // input event
      element.dispatchEvent(buildInputEvent('deleteContentBackward', null, element));

      // keyup
      element.dispatchEvent(buildKeyEvent('keyup', keyInfo));
    }
  }

  /**
   * Simulate Ctrl+Backspace — delete the last word.
   */
  function simulateCtrlBackspace(element) {
    const keyInfo = {
      key: 'Backspace',
      code: 'Backspace',
      keyCode: 8,
      which: 8,
      charCode: 0,
      shiftKey: false,
      ctrlKey: true,
    };

    element.dispatchEvent(buildKeyEvent('keydown', keyInfo));

    // Delete last word
    const text = element.isContentEditable
      ? (element.textContent || '')
      : (element.value || '');
    const cursorPos = element.isContentEditable
      ? (window.getSelection().rangeCount ? window.getSelection().getRangeAt(0).startOffset : 0)
      : element.selectionStart;
    const before = text.slice(0, cursorPos);
    const wordMatch = before.match(/(\S+\s*)$/);
    const deleteLen = wordMatch ? wordMatch[1].length : 1;
    deleteText(element, deleteLen);

    element.dispatchEvent(buildInputEvent('deleteWordBackward', null, element));
    element.dispatchEvent(buildKeyEvent('keyup', keyInfo));
  }

  // ── QWERTY adjacent-key map (used by human-model.js) ─────────────

  /**
   * Map from character → array of neighboring keys on a QWERTY keyboard.
   * Used by HumanModel to generate realistic adjacent-key typos.
   */
  const QWERTY_NEIGHBORS = {
    // Top row
    'q': ['w','a','1','2'],
    'w': ['q','e','a','s','d','2','3'],
    'e': ['w','r','s','d','f','3','4'],
    'r': ['e','t','d','f','g','4','5'],
    't': ['r','y','f','g','h','5','6'],
    'y': ['t','u','g','h','j','6','7'],
    'u': ['y','i','h','j','k','7','8'],
    'i': ['u','o','j','k','l','8','9'],
    'o': ['i','p','k','l','9','0'],
    'p': ['o','[',']','l',';','0','-'],
    // Home row
    'a': ['q','w','s','z','x'],
    's': ['a','w','e','d','z','x','c'],
    'd': ['s','e','r','f','x','c','v'],
    'f': ['d','r','t','g','c','v','b'],
    'g': ['f','t','y','h','v','b','n'],
    'h': ['g','y','u','j','b','n','m'],
    'j': ['h','u','i','k','n','m'],
    'k': ['j','i','o','l','m',','],
    'l': ['k','o','p',';',',','.'],
    // Bottom row
    'z': ['a','s','x'],
    'x': ['z','s','d','c'],
    'c': ['x','d','f','v'],
    'v': ['c','f','g','b'],
    'b': ['v','g','h','n'],
    'n': ['b','h','j','m'],
    'm': ['n','j','k',','],
  };

  return {
    getKeyInfo,
    simulateKeyPress,
    simulateBackspace,
    simulateCtrlBackspace,
    QWERTY_NEIGHBORS,
  };
})();
