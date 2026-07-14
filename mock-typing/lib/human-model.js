/**
 * human-model.js — Realistic human typing behavior model.
 *
 * Models a trained typist (~85 WPM) with:
 *  - Word-rhythm typing: fast & fluid within words, pause before next word
 *  - Digraph muscle memory: consistent timing for repeated letter pairs
 *  - Realistic dwell time: keys held 40-130ms (critical anti-bot signal)
 *  - Fatigue: gradual slowdown + more errors over long texts
 *  - Log-normal keystroke interval distribution
 *  - Four error types: adjacent-key, transposition, skip, double-tap
 *
 * Tuned against justhuman.app's nine detection signals:
 *  Rhythm Variability, Error Corrections, Paste Content (N/A),
 *  Think Pauses, Timing Distribution, Digraph Timing,
 *  Dwell Time, Burst-Pause Patterns, Fatigue.
 */

class HumanModel {
  /**
   * @param {Object} config
   */
  constructor(config = {}) {
    // ── Speed (trained typist: 80-100 WPM) ──
    this.baseWpm = config.baseWpm ?? 85;
    this.wpmVariance = config.wpmVariance ?? 0.25;

    // ── Word rhythm ──
    this.preWordPauseMin = config.preWordPauseMin ?? 120;
    this.preWordPauseMax = config.preWordPauseMax ?? 400;
    this.preSentencePauseMin = config.preSentencePauseMin ?? 350;
    this.preSentencePauseMax = config.preSentencePauseMax ?? 2000;
    this.postPunctPause = config.postPunctPause ?? 80; // Short pause after punctuation

    // ── Dwell time (key hold duration) — CRITICAL anti-detection ──
    this.dwellMin = config.dwellMin ?? 40;
    this.dwellMax = config.dwellMax ?? 130;

    // ── Error behavior ──
    this.errorRate = config.errorRate ?? 0.015; // 1.5% — trained typists
    this.correctionRate = config.correctionRate ?? 0.78;
    this.correctionMinDelay = config.correctionMinDelay ?? 250;
    this.correctionMaxDelay = config.correctionMaxDelay ?? 700;

    // ── Fatigue ──
    this.fatigueThreshold = config.fatigueThreshold ?? 500;

    // ── Internal state ──
    this._totalChars = 0;
    this._digraphCache = new Map();      // "th" → { avgDelay, count }
    this._burstCount = 0;
    this._burstTarget = 4 + Math.floor(Math.random() * 6);
  }

  // ── Word-level API ──────────────────────────────────────────────

  /**
   * Pause before starting a new word.
   * Longer at sentence boundaries, moderate between regular words.
   *
   * @param {number}  wordLength      - length of the upcoming word
   * @param {boolean} isSentenceStart - is this word the start of a new sentence?
   * @param {number}  wordIndex       - 0-based index in the text
   * @returns {number} pause duration in ms
   */
  getPreWordPause(wordLength, isSentenceStart, wordIndex) {
    if (wordLength <= 0) return 0;

    if (isSentenceStart && wordIndex > 0) {
      // Sentence boundary: think-pause (critical for justhuman.app "Think Pauses" signal)
      return this._range(this.preSentencePauseMin, this.preSentencePauseMax);
    }

    if (wordIndex === 0) {
      // First word: short positioning pause
      return 100 + Math.random() * 180;
    }

    // Normal pre-word pause — the "burst-pause" rhythm
    // Shorter for short words (typing "a", "is", "the"), longer for long words
    const factor = wordLength > 6 ? 1.2 : (wordLength < 3 ? 0.6 : 1.0);
    return this._range(
      Math.round(this.preWordPauseMin * factor),
      Math.round(this.preWordPauseMax * factor)
    );
  }

  // ── Character-level API ─────────────────────────────────────────

  /**
   * Inter-key delay within a word. Characters flow quickly with slight
   * acceleration mid-word and deceleration at word end.
   *
   * @param {string} char      - the character being typed
   * @param {string} prevChar  - previous character ('' for first)
   * @param {number} wordPos   - position within the word (0-indexed)
   * @param {number} wordLength
   * @returns {number} delay in ms
   */
  getCharDelay(char, prevChar, wordPos, wordLength) {
    let baseInterval = 60000 / (this.baseWpm * 5);

    // ── Within-word position effect ──
    if (wordPos === 0) {
      // First char: slight positioning delay (move hand to first key)
      baseInterval *= 1.1;
    } else if (wordPos === wordLength - 1) {
      // Last char: slight deceleration
      baseInterval *= 1.05;
    } else {
      // Middle chars: flow state — fastest
      baseInterval *= 0.82;
    }

    // ── Digraph muscle memory ──
    // Trained typists have consistent, fast timing for common letter pairs.
    // This is a KEY signal for justhuman.app ("Digraph Timing").
    if (prevChar && wordPos > 0) {
      const dg = (prevChar + char).toLowerCase();
      const cached = this._digraphCache.get(dg);
      if (cached) {
        // Practiced digraph: fast + consistent
        baseInterval = cached.avgDelay * (0.88 + Math.random() * 0.24);
        cached.hits++;
      } else if (/^[a-z]{2}$/i.test(dg)) {
        // First encounter: record for future use
        this._digraphCache.set(dg, { avgDelay: baseInterval, hits: 1 });
      }
    }

    // ── Case switching slowdown ──
    // Shift-modified keys take slightly longer
    if (char !== char.toLowerCase() && char === char.toUpperCase() && /[a-zA-Z]/.test(char)) {
      baseInterval *= 1.12;
    }

    // ── Burst micro-rhythm ──
    this._burstCount++;
    if (this._burstCount >= this._burstTarget) {
      baseInterval *= 1.25; // Micro-slowdown after a burst
      this._burstCount = 0;
      this._burstTarget = 4 + Math.floor(Math.random() * 6);
    }

    // ── Log-normal jitter (small within words for consistent rhythm) ──
    const jitter = Math.exp(this._gaussianRandom() * 0.12);
    let delay = baseInterval * jitter;

    // ── Fatigue slowdown ──
    if (this._totalChars > this.fatigueThreshold) {
      const ratio = Math.min((this._totalChars - this.fatigueThreshold) / 2000, 0.35);
      delay *= (1 + ratio);
    }

    return Math.max(18, Math.min(Math.round(delay), 350));
  }

  // ── Dwell time API ──────────────────────────────────────────────

  /**
   * How long the key is physically held down.
   * Humans: 40-200ms (varies by key). Bots: 0-2ms.
   * This is arguably the single most important anti-detection signal.
   *
   * @param {string} char - the character being typed
   * @returns {number} dwell time in ms
   */
  getDwellTime(char = '') {
    let base = this._range(this.dwellMin, this.dwellMax);

    // Space bar held longer (stronger thumb press)
    if (char === ' ') base *= 1.4;
    // Shift-modified: slightly longer
    if (char !== char.toLowerCase() && /[A-Z]/.test(char)) base *= 1.15;
    // Punctuation: quick tap
    if (/[.,;:'"!?]/.test(char)) base *= 0.8;

    return Math.round(base);
  }

  // ── Error API ───────────────────────────────────────────────────

  shouldMakeError(text, position) {
    const char = text[position];
    if (!char || /[\s.,!?;:\-()[\]{}'"\n]/.test(char)) return false;

    const fatigueExtra = this._totalChars > this.fatigueThreshold
      ? ((this._totalChars - this.fatigueThreshold) / 5000) * 0.012
      : 0;
    return Math.random() < (this.errorRate + fatigueExtra);
  }

  generateError(correctChar, nextChar = '') {
    const roll = Math.random();
    const lower = correctChar.toLowerCase();
    const neighbors = KeyEvents.QWERTY_NEIGHBORS[lower];

    if (roll < 0.35 && neighbors?.length) {
      const pick = neighbors[Math.floor(Math.random() * neighbors.length)];
      return correctChar === lower ? pick : pick.toUpperCase();
    }
    if (roll < 0.60 && nextChar && /[a-zA-Z]/.test(nextChar)) {
      return nextChar; // Transposition
    }
    if (roll < 0.82) {
      return ''; // Skip
    }
    return correctChar + correctChar; // Double-tap
  }

  shouldCorrect() {
    return Math.random() < this.correctionRate;
  }

  getCorrectionDelay() {
    return this._range(this.correctionMinDelay, this.correctionMaxDelay);
  }

  // ── State tracking ──────────────────────────────────────────────

  /** Call after each character is typed (for fatigue tracking). */
  recordChar() { this._totalChars++; }

  /** Reset internal state for a new typing session. */
  reset() {
    this._totalChars = 0;
    this._digraphCache.clear();
    this._burstCount = 0;
    this._burstTarget = 4 + Math.floor(Math.random() * 6);
  }

  // ── Internal helpers ────────────────────────────────────────────

  _range(min, max) {
    return min + Math.random() * (max - min);
  }

  /** Box-Muller Gaussian (mean 0, std 1). */
  _gaussianRandom() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }
}
