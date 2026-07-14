/**
 * typing-engine.js — Async typing orchestrator with word-level rhythm.
 *
 * Flow per word:
 *   1. Pause (thinking/reading ahead) — sentence boundaries get longer pauses
 *   2. Type each character rapidly & fluently (flow state)
 *   3. Between characters: realistic dwell time (key held before release)
 *
 * State machine:
 *   IDLE → TYPING → (ERROR → CORRECTING → TYPING) → PAUSED → TYPING → DONE
 */

class TypingEngine {
  /**
   * @param {HumanModel} humanModel
   * @param {Object} callbacks - { onProgress, onStateChange, onDone }
   */
  constructor(humanModel, callbacks = {}) {
    this._model = humanModel;
    this._callbacks = callbacks;

    this._state = 'IDLE';
    this._text = '';
    this._element = null;
    this._position = 0;
    this._abortController = null;

    // Resume support
    this._resumeTokenIndex = 0;
    this._resumeCharIndex = 0;
    this._tokens = [];

    // Timing
    this._startTime = 0;
    this._pausedDuration = 0;
    this._pauseStart = 0;
  }

  // ── Public API ───────────────────────────────────────────────────

  async start(text, element) {
    if (this._state === 'TYPING' || this._state === 'CORRECTING') {
      console.warn('[MockTyping] Already typing');
      return;
    }

    this._text = text;
    this._element = element;
    this._position = 0;
    this._startTime = Date.now();
    this._pausedDuration = 0;
    this._resumeTokenIndex = 0;
    this._resumeCharIndex = 0;
    this._tokens = this._tokenize(text);

    this._model.reset();
    this._abortController = new AbortController();
    this._setState('TYPING');

    try {
      await this._typingLoop();
    } catch (err) {
      if (err?.name === 'AbortError') { /* normal */ }
      else { console.error('[MockTyping] Engine error:', err); }
    }
  }

  pause() {
    if (this._state !== 'TYPING' && this._state !== 'CORRECTING') return;
    this._setState('PAUSED');
    this._pauseStart = Date.now();
    this._abortController?.abort('paused');
  }

  async resume() {
    if (this._state !== 'PAUSED') return;
    if (this._pauseStart) {
      this._pausedDuration += Date.now() - this._pauseStart;
      this._pauseStart = 0;
    }
    this._abortController = new AbortController();
    this._setState('TYPING');
    try {
      await this._typingLoop();
    } catch (err) {
      if (err?.name === 'AbortError') { /* okay */ }
      else { console.error('[MockTyping] Engine error:', err); }
    }
  }

  stop() {
    if (this._state === 'IDLE' || this._state === 'DONE') return;
    this._setState('DONE');
    this._abortController?.abort('stopped');
    this._notifyProgress();
    if (this._callbacks.onDone) this._callbacks.onDone();
  }

  getProgress() {
    return {
      state: this._state,
      position: this._position,
      total: this._text.length,
      elapsed: this._state === 'IDLE' ? 0
        : Date.now() - this._startTime - this._pausedDuration,
    };
  }

  // ── Main typing loop (word-rhythm) ──────────────────────────────

  async _typingLoop() {
    const signal = this._abortController?.signal;
    let isSentenceStart = true;

    for (let ti = this._resumeTokenIndex; ti < this._tokens.length; ti++) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      const token = this._tokens[ti];
      const isWord = /^[a-zA-Z0-9'\-]+$/.test(token);
      const isPunctEnd = /^[.!?]$/.test(token);           // sentence-ending punctuation
      const isOtherPunct = /^[,;:\-—]$/.test(token);      // mid-sentence punctuation
      const isSpace = /^\s+$/.test(token);

      if (isWord) {
        // ── WORD: pause before, then type rapidly ──
        const pauseMs = this._model.getPreWordPause(token.length, isSentenceStart, ti);
        if (pauseMs > 0) {
          await this._sleep(pauseMs, signal);
          if (signal?.aborted) return;
        }
        isSentenceStart = false;

        // Type each character in the word (fast & fluid)
        await this._typeWord(token, signal);
        if (signal?.aborted) return;

      } else if (isSpace) {
        // ── WHITESPACE: quick short tap ──
        await this._typeToken(token, signal, false);

      } else if (isPunctEnd) {
        // ── SENTENCE-END PUNCTUATION (.!?) ──
        await this._typeToken(token, signal, true);
        isSentenceStart = true; // Next word gets think-pause
        // Extra post-sentence pause — natural reflection moment
        await this._sleep(80 + Math.random() * 200, signal);

      } else if (isOtherPunct) {
        // ── OTHER PUNCTUATION — quick, then short pause ──
        await this._typeToken(token, signal, true);
        await this._sleep(30 + Math.random() * 80, signal);

      } else {
        // ── Everything else ──
        await this._typeToken(token, signal, false);
      }

      // Save resume position after each token
      this._resumeTokenIndex = ti + 1;
      this._resumeCharIndex = 0;
      this._notifyProgress();
    }

    // Done
    this._setState('DONE');
    this._notifyProgress();
    if (this._callbacks.onDone) this._callbacks.onDone();
  }

  /**
   * Type a single token (space, punctuation, or short non-word text).
   */
  async _typeToken(token, signal, isPunct) {
    for (let ci = 0; ci < token.length; ci++) {
      if (signal?.aborted) return;
      const char = token[ci];

      const delay = isPunct
        ? 30 + Math.random() * 80   // punctuation: quick
        : 25 + Math.random() * 50;  // space: very quick

      await this._sleep(delay, signal);
      if (signal?.aborted) return;

      const dwell = this._model.getDwellTime(char);
      await KeyEvents.simulateKeyPress(this._element, char, dwell);
      this._model.recordChar();
      this._position++;
    }
  }

  /**
   * Type a word with rapid, fluid character-by-character typing.
   * Uses PROBABILISTIC key rollover: on fast transitions, the next keydown
   * may fire before the previous keyup. Real typists only rollover on
   * easy/fast transitions, not every key — uniform rollover is a bot tell.
   */
  async _typeWord(word, signal) {
    let prevKeyInfo = null;

    for (let ci = 0; ci < word.length; ci++) {
      if (signal?.aborted) return;

      const char = word[ci];
      const prevChar = ci > 0 ? word[ci - 1] : '';

      // Character delay
      const delay = this._model.getCharDelay(char, prevChar, ci, word.length);
      await this._sleep(delay, signal);
      if (signal?.aborted) return;

      // ── Error injection ──
      if (this._model.shouldMakeError(word, ci)) {
        if (prevKeyInfo) {
          await KeyEvents.simulateKeyUp(this._element, prevKeyInfo);
          prevKeyInfo = null;
        }
        await this._handleError(char, prevChar, signal);
        continue;
      }

      // ── Determine if we should rollover ──
      const shouldRollover = prevKeyInfo && delay < 55 && /[a-z]/i.test(prevChar + char);

      if (shouldRollover) {
        // ROLLOVER: keydown current before keyup previous
        const keyInfo = await KeyEvents.simulateKeyDown(this._element, char);

        // Wait 15-30% of dwell (variable overlap, not uniform)
        const overlapPct = 0.15 + Math.random() * 0.15;
        const overlapDelay = Math.round(this._model.getDwellTime(char) * overlapPct);
        await this._sleep(overlapDelay, signal);
        if (signal?.aborted) return;

        await KeyEvents.simulateKeyUp(this._element, prevKeyInfo);
        prevKeyInfo = keyInfo;
      } else {
        // NO ROLLOVER — release previous normally, then type current
        if (prevKeyInfo) {
          await KeyEvents.simulateKeyUp(this._element, prevKeyInfo);
        }
        const keyInfo = await KeyEvents.simulateKeyDown(this._element, char);
        prevKeyInfo = keyInfo;
      }

      this._model.recordChar();
      this._position++;
    }

    // Release the final key
    if (prevKeyInfo) {
      const finalDwell = this._model.getDwellTime(word[word.length - 1]);
      await this._sleep(finalDwell, signal);
      if (signal?.aborted) return;
      await KeyEvents.simulateKeyUp(this._element, prevKeyInfo);
    }
  }

  // ── Error handling ──────────────────────────────────────────────

  async _handleError(correctChar, prevChar, signal) {
    const nextChar = this._position + 1 < this._text.length
      ? this._text[this._position + 1] : '';

    this._setState('ERROR');

    const wrongChar = this._model.generateError(correctChar, nextChar);

    if (wrongChar === '') {
      // Skip error — char is missed
      this._position++;
      this._notifyProgress();
      this._setState('TYPING');
      return;
    }

    // Hesitate slightly before error
    await this._sleep(40 + Math.random() * 120, signal);
    if (signal?.aborted) return;

    // Type wrong chars
    const typedWrong = [];
    for (const ch of wrongChar) {
      await this._sleep(25 + Math.random() * 80, signal);
      if (signal?.aborted) return;
      const dwell = this._model.getDwellTime(ch);
      await KeyEvents.simulateKeyPress(this._element, ch, dwell);
      typedWrong.push(ch);
    }

    this._position++;
    this._model.recordChar();

    // Correct or leave it
    if (this._model.shouldCorrect()) {
      this._setState('CORRECTING');
      await this._sleep(this._model.getCorrectionDelay(), signal);
      if (signal?.aborted) return;
      await this._correctSingleError(typedWrong, correctChar, signal);
    }

    this._notifyProgress();
    this._setState('TYPING');
  }

  async _correctSingleError(wrongChars, correctChar, signal) {
    const totalToDelete = wrongChars.length;

    if (totalToDelete >= 3 && Math.random() < 0.68) {
      // Ctrl+Backspace for longer errors (common human behavior)
      await this._sleep(50 + Math.random() * 120, signal);
      if (signal?.aborted) return;
      const dwell = this._model.getDwellTime();
      await KeyEvents.simulateCtrlBackspace(this._element, dwell);
    } else {
      // Individual backspaces with realistic timing
      for (let i = 0; i < totalToDelete; i++) {
        await this._sleep(50 + Math.random() * 160, signal);
        if (signal?.aborted) return;
        const dwell = this._model.getDwellTime();
        await KeyEvents.simulateBackspace(this._element, 1, dwell);
      }
    }

    // Brief pause after deleting — "finding the right key again"
    await this._sleep(70 + Math.random() * 200, signal);
    if (signal?.aborted) return;

    // Retype correct character (slightly faster — "fixing it quickly")
    await this._sleep(25 + Math.random() * 70, signal);
    if (signal?.aborted) return;
    const dwell = this._model.getDwellTime(correctChar);
    await KeyEvents.simulateKeyPress(this._element, correctChar, dwell);
  }

  // ── Helpers ─────────────────────────────────────────────────────

  async _sleep(ms, signal) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
      }
    });
  }

  _setState(state) {
    this._state = state;
    if (this._callbacks.onStateChange) {
      this._callbacks.onStateChange(state);
    }
  }

  _notifyProgress() {
    if (this._callbacks.onProgress) {
      this._callbacks.onProgress(this.getProgress());
    }
  }

  /**
   * Tokenize text into words, spaces, and punctuation.
   * "Hello, world!" → ["Hello", ",", " ", "world", "!"]
   */
  _tokenize(text) {
    const tokens = [];
    let i = 0;
    while (i < text.length) {
      const ch = text[i];

      // Whitespace
      if (/\s/.test(ch)) {
        let ws = '';
        while (i < text.length && /\s/.test(text[i])) {
          ws += text[i]; i++;
        }
        tokens.push(ws);
        continue;
      }

      // Punctuation (single char each for natural rhythm)
      if (/[.,!?;:\-—'"]/.test(ch)) {
        tokens.push(ch);
        i++;
        continue;
      }

      // Word characters (letters, digits, and word-internal punctuation)
      let word = '';
      while (i < text.length && !/[\s.,!?;:\-—]/.test(text[i])) {
        word += text[i]; i++;
      }
      if (word) tokens.push(word);
    }
    return tokens;
  }
}
