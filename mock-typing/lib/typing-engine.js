/**
 * typing-engine.js — Async typing orchestrator.
 *
 * State machine:
 *   IDLE → TYPING → (ERROR → CORRECTING → TYPING) → PAUSED → TYPING → DONE
 *
 * Uses HumanModel for timing/behavior decisions and KeyEvents for DOM dispatch.
 */

class TypingEngine {
  /**
   * @param {HumanModel} humanModel
   * @param {Object} callbacks - { onProgress, onStateChange, onDone }
   */
  constructor(humanModel, callbacks = {}) {
    this._model = humanModel;
    this._callbacks = callbacks;

    // State
    this._state = 'IDLE';       // IDLE | TYPING | CORRECTING | PAUSED | DONE
    this._text = '';
    this._element = null;
    this._position = 0;
    this._abortController = null;

    // Error tracking — only one pending correction at a time
    this._pendingError = null;  // { wrongChars: [], correctChar } or null
    this._lastTypedChar = '';

    // Progress tracking
    this._totalChars = 0;
    this._startTime = 0;
    this._pausedDuration = 0;
    this._pauseStart = 0;
  }

  // ── Public API ───────────────────────────────────────────────────

  /**
   * Start typing `text` into `element`.
   * @param {string} text - the text to type
   * @param {HTMLElement} element - target <input>, <textarea>, or contenteditable
   */
  async start(text, element) {
    if (this._state === 'TYPING' || this._state === 'CORRECTING') {
      console.warn('[MockTyping] Already typing — call stop() first');
      return;
    }

    this._text = text;
    this._element = element;
    this._position = 0;
    this._totalChars = text.length;
    this._startTime = Date.now();
    this._pausedDuration = 0;
    this._pendingError = null;
    this._lastTypedChar = '';

    this._abortController = new AbortController();
    this._setState('TYPING');

    try {
      await this._typingLoop();
    } catch (err) {
      if (err?.name === 'AbortError') {
        // Normal stop/pause — no error
      } else {
        console.error('[MockTyping] Engine error:', err);
      }
    }
  }

  /** Pause typing after the current character completes. */
  pause() {
    if (this._state !== 'TYPING' && this._state !== 'CORRECTING') return;
    this._setState('PAUSED');
    this._pauseStart = Date.now();
    this._abortController?.abort('paused');
  }

  /** Resume typing after a pause. */
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

  /** Immediately stop typing. */
  stop() {
    if (this._state === 'IDLE' || this._state === 'DONE') return;
    this._setState('DONE');
    this._abortController?.abort('stopped');
    this._notifyProgress();
    if (this._callbacks.onDone) this._callbacks.onDone();
  }

  /** @returns {{ state: string, position: number, total: number, elapsed: number }} */
  getProgress() {
    return {
      state: this._state,
      position: this._position,
      total: this._totalChars,
      elapsed: this._state === 'IDLE' ? 0
        : Date.now() - this._startTime - this._pausedDuration,
    };
  }

  // ── Internal: main typing loop ───────────────────────────────────

  async _typingLoop() {
    const signal = this._abortController?.signal;

    while (this._position < this._text.length) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      if (this._state === 'PAUSED') return; // Wait for resume()

      const char = this._text[this._position];
      const prevChar = this._position > 0 ? this._text[this._position - 1] : '';

      // Compute word/sentence position for the model
      const wordPos = this._getWordPosition();
      const sentPos = this._getSentencePosition();

      // ── Check for pause ──
      const pauseInfo = this._model.shouldPause(char, prevChar);
      if (pauseInfo.pause) {
        await this._sleep(pauseInfo.duration, signal);
        if (signal?.aborted) return;
      }

      // ── Check for error ──
      if (this._model.shouldMakeError(this._text, this._position)) {
        await this._handleError(char, prevChar, signal);
        if (signal?.aborted) return;
        continue; // Skip the normal type — error handler advances position
      }

      // ── Get delay ──
      const delay = this._model.getDelay(prevChar, char, wordPos, sentPos);
      await this._sleep(delay, signal);
      if (signal?.aborted) return;

      // ── Type the character ──
      KeyEvents.simulateKeyPress(this._element, char);
      this._lastTypedChar = char;
      this._position++;
      this._notifyProgress();
    }

    // Done!
    this._setState('DONE');
    this._notifyProgress();
    if (this._callbacks.onDone) this._callbacks.onDone();
  }

  // ── Internal: error handling ─────────────────────────────────────

  /**
   * Handle a typing error at the current position.
   * 1. Generate the wrong character(s)
   * 2. Type them
   * 3. Optionally correct (backspace and retype correctly)
   */
  async _handleError(correctChar, prevChar, signal) {
    const nextChar = this._position + 1 < this._text.length
      ? this._text[this._position + 1] : '';

    this._setState('ERROR');

    const wrongChar = this._model.generateError(correctChar, nextChar);

    // ── Type the wrong character(s) ──
    if (wrongChar === '') {
      // "Skip" error — just don't type this char, effectively a miss
      this._position++;
      this._notifyProgress();
      this._setState('TYPING');
      return;
    }

    // Small hesitation before error (subtle tell — real people sometimes hesitate)
    const hesitation = 40 + Math.floor(Math.random() * 150);
    await this._sleep(hesitation, signal);
    if (signal?.aborted) return;

    // Type each wrong char
    const typedWrong = [];
    for (const ch of wrongChar) {
      const errDelay = 30 + Math.floor(Math.random() * 120);
      await this._sleep(errDelay, signal);
      if (signal?.aborted) return;

      KeyEvents.simulateKeyPress(this._element, ch);
      typedWrong.push(ch);
    }

    // Advance position past the correct char (we typed wrong chars instead)
    this._position++;
    this._lastTypedChar = wrongChar[wrongChar.length - 1];

    // ── Correct or leave it ──
    if (this._model.shouldCorrect()) {
      this._setState('CORRECTING');

      // Reaction delay — "notice" the mistake
      const correctionDelay = this._model.getCorrectionDelay();
      await this._sleep(correctionDelay, signal);
      if (signal?.aborted) return;

      // Backspace the wrong chars and retype the correct one
      await this._correctSingleError(typedWrong, correctChar, signal);
    }
    // If not correcting, the wrong chars stay on the page — realistic human behavior

    this._notifyProgress();
    this._setState('TYPING');
  }

  /**
   * Backspace the wrong chars and retype the correct one.
   * @param {string[]} wrongChars - characters typed by mistake
   * @param {string} correctChar - the character that should have been typed
   */
  async _correctSingleError(wrongChars, correctChar, signal) {
    const totalToDelete = wrongChars.length;

    // Occasionally use Ctrl+Backspace for whole-word errors (~20% chance)
    if (totalToDelete >= 3 && Math.random() < 0.2) {
      await this._sleep(50 + Math.floor(Math.random() * 150), signal);
      if (signal?.aborted) return;
      KeyEvents.simulateCtrlBackspace(this._element);
    } else {
      // Individual backspaces with realistic timing
      for (let i = 0; i < totalToDelete; i++) {
        const bsDelay = 60 + Math.floor(Math.random() * 200);
        await this._sleep(bsDelay, signal);
        if (signal?.aborted) return;
        KeyEvents.simulateBackspace(this._element, 1);
      }
    }

    // Small pause after backspacing before retyping
    await this._sleep(80 + Math.floor(Math.random() * 250), signal);
    if (signal?.aborted) return;

    // Retype correct character (slightly faster — "fixing it quickly")
    const retypeDelay = 30 + Math.floor(Math.random() * 100);
    await this._sleep(retypeDelay, signal);
    if (signal?.aborted) return;
    KeyEvents.simulateKeyPress(this._element, correctChar);
  }

  // ── Internal: helpers ────────────────────────────────────────────

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

  /** Find the position within the current word. */
  _getWordPosition() {
    let pos = 0;
    for (let i = this._position - 1; i >= 0; i--) {
      if (this._text[i] === ' ' || this._text[i] === '\n') break;
      pos++;
    }
    return pos;
  }

  /** Find the position within the current sentence. */
  _getSentencePosition() {
    let pos = 0;
    for (let i = this._position - 1; i >= 0; i--) {
      if (/[.!?\n]/.test(this._text[i])) break;
      pos++;
    }
    return pos;
  }
}
