/**
 * human-model.js — Realistic human typing behavior model.
 *
 * Models:
 *  - Variable inter-key delays (log-normal distribution around base WPM)
 *  - Typo generation (adjacent-key, transposition, skip, double-tap)
 *  - Correction behavior (some typos corrected, some left alone)
 *  - Natural pauses (at punctuation, word boundaries, sentence boundaries)
 *  - Burst/coast rhythm (fast bursts followed by slight slowdowns)
 */

class HumanModel {
  /**
   * @param {Object} config
   * @param {number} config.baseWpm        - base typing speed (default 60)
   * @param {number} config.wpmVariance    - speed fluctuation ±fraction (default 0.3)
   * @param {number} config.errorRate      - probability of making a typo (default 0.02)
   * @param {number} config.correctionRate - probability of correcting a typo (default 0.7)
   * @param {number} config.correctionMinDelay - min ms before correcting (default 300)
   * @param {number} config.correctionMaxDelay - max ms before correcting (default 800)
   * @param {number} config.pauseFrequency - base probability of a micro-pause (default 0.08)
   * @param {number} config.pauseMin       - min pause ms (default 400)
   * @param {number} config.pauseMax       - max pause ms (default 3000)
   */
  constructor(config = {}) {
    this.baseWpm = config.baseWpm ?? 60;
    this.wpmVariance = config.wpmVariance ?? 0.3;
    this.errorRate = config.errorRate ?? 0.02;
    this.correctionRate = config.correctionRate ?? 0.7;
    this.correctionMinDelay = config.correctionMinDelay ?? 300;
    this.correctionMaxDelay = config.correctionMaxDelay ?? 800;
    this.pauseFrequency = config.pauseFrequency ?? 0.08;
    this.pauseMin = config.pauseMin ?? 400;
    this.pauseMax = config.pauseMax ?? 3000;

    // Internal state — burst tracking
    this._burstCount = 0;
    this._burstLength = this._nextBurstLength();
    this._isSlowChar = false;

    // Error tracking — active error that may be corrected
    this._pendingError = null; // { position, wrongChar, correctChar }
  }

  // ── Public: inter-key delay ──────────────────────────────────────

  /**
   * Returns the delay (ms) before typing `nextChar` at `position`
   * in the target text string.
   *
   * @param {string} prevChar - the previously typed character ('' for first)
   * @param {string} nextChar - the character about to be typed
   * @param {number} wordPos   - position within current word (0-indexed)
   * @param {number} sentPos   - position within current sentence (0-indexed)
   * @returns {number} delay in milliseconds
   */
  getDelay(prevChar, nextChar, wordPos, sentPos) {
    // Base interval from WPM: avg 5 chars per word
    const baseInterval = 60000 / (this.baseWpm * 5);

    // Log-normal jitter: multiply baseInterval by exp(N(0, variance))
    // Using Box-Muller-like approximation for log-normal
    const u = this._gaussianRandom();
    const jitter = Math.exp(u * this.wpmVariance);
    let delay = baseInterval * jitter;

    // ── Burst/coast rhythm ──
    this._burstCount++;
    if (this._burstCount >= this._burstLength) {
      // Slow down for 1-2 chars
      this._isSlowChar = true;
      delay *= 2.0 + Math.random() * 1.5;
      if (this._burstCount >= this._burstLength + (1 + Math.floor(Math.random() * 2))) {
        this._burstCount = 0;
        this._burstLength = this._nextBurstLength();
        this._isSlowChar = false;
      }
    }

    // ── Word boundaries ──
    if (nextChar === ' ') {
      delay *= 1.8 + Math.random() * 1.2; // 1.8-3× longer before space
    }

    // ── Punctuation ──
    if (/[.,!?;:]/.test(nextChar)) {
      delay *= 1.3 + Math.random() * 0.8;
    }

    // ── Long word acceleration ──
    if (wordPos > 5 && /[a-zA-Z]/.test(nextChar)) {
      delay *= 0.7 + Math.random() * 0.3; // speed up ~15-30% in long words
    }

    // ── Clamp ──
    delay = Math.max(30, Math.min(delay, 2000));

    return Math.round(delay);
  }

  // ── Public: error generation ─────────────────────────────────────

  /**
   * Decide whether to make a typo at the given position.
   * @param {string} text - full target text
   * @param {number} position - current position
   * @returns {boolean}
   */
  shouldMakeError(text, position) {
    const char = text[position];
    // Don't make errors on spaces, punctuation, or newlines
    if (!char || /[\s.,!?;:\-()[\]{}'"]/.test(char)) return false;
    return Math.random() < this.errorRate;
  }

  /**
   * Generate a wrong character for the given correct char.
   * Uses QWERTY adjacency, transposition, skip, or double-tap.
   *
   * @param {string} correctChar - the correct character
   * @param {string} nextChar    - the next character in the text (for transposition)
   * @returns {string} the wrong character to type
   */
  generateError(correctChar, nextChar = '') {
    const roll = Math.random();
    const lower = correctChar.toLowerCase();
    const neighbors = KeyEvents.QWERTY_NEIGHBORS[lower];

    if (roll < 0.40 && neighbors && neighbors.length > 0) {
      // 40% — adjacent key
      const pick = neighbors[Math.floor(Math.random() * neighbors.length)];
      return correctChar === lower ? pick : pick.toUpperCase();
    }
    if (roll < 0.65 && nextChar && /[a-zA-Z]/.test(nextChar)) {
      // 25% — transposition: type nextChar first
      return nextChar;
    }
    if (roll < 0.85) {
      // 20% — skip: return empty string (skip this char)
      return '';
    }
    // 15% — double-tap the previous key (just repeat this char)
    return correctChar + correctChar;
  }

  /**
   * Decide whether to correct a pending error at the current position.
   * @returns {boolean}
   */
  shouldCorrect() {
    return Math.random() < this.correctionRate;
  }

  /**
   * Get the correction reaction delay (ms).
   * @returns {number}
   */
  getCorrectionDelay() {
    return this.correctionMinDelay +
      Math.floor(Math.random() * (this.correctionMaxDelay - this.correctionMinDelay));
  }

  // ── Public: pauses ───────────────────────────────────────────────

  /**
   * Decide whether to pause before typing `char`.
   * Pauses are more likely at sentence boundaries.
   *
   * @param {string} char - the character about to be typed
   * @param {string} prevChar - the previous character
   * @returns {{ pause: boolean, duration: number }}
   */
  shouldPause(char, prevChar) {
    let prob = this.pauseFrequency;

    // Sentence boundaries (after .!? followed by space)
    if (/[.!?]/.test(prevChar) && char === ' ') {
      prob = 0.5; // 50% chance of a thinking pause after a sentence
    }
    // Paragraph boundaries
    if (prevChar === '\n') {
      prob = 0.6;
    }
    // Comma / semicolon
    if (/[,;]/.test(prevChar) && char === ' ') {
      prob = 0.25;
    }

    if (Math.random() < prob) {
      const duration = this.pauseMin +
        Math.floor(Math.random() * (this.pauseMax - this.pauseMin));
      return { pause: true, duration };
    }

    return { pause: false, duration: 0 };
  }

  // ── Internal helpers ─────────────────────────────────────────────

  /**
   * Box-Muller Gaussian random (mean 0, std 1).
   */
  _gaussianRandom() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  /**
   * Log-normal random number.
   */
  _lognormalRandom(mean, stddev) {
    return Math.exp(mean + stddev * this._gaussianRandom());
  }

  /**
   * Generate a burst length (number of fast characters before a slowdown).
   * Typically 5-12 characters.
   */
  _nextBurstLength() {
    return 5 + Math.floor(Math.random() * 8);
  }
}
