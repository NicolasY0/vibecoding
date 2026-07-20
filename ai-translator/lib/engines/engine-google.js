/**
 * Google 翻译引擎（免费）
 * 非官方接口，可能随时变化
 */
import { createResult } from './engine-interface.js';

const ENGINE_ID = 'google';

class GoogleEngine {
  constructor() {
    this.id = ENGINE_ID;
    this.type = 'google';
    this.supportsExplain = false;
  }

  /**
   * @param {import('./engine-interface.js').TranslationRequest} req
   */
  async translate(req) {
    const texts = Array.isArray(req.text) ? req.text : [req.text];
    const targetLang = this._langCode(req.targetLang);
    const sourceLang = req.sourceLang && req.sourceLang !== 'auto'
      ? this._langCode(req.sourceLang) : 'auto';

    const results = [];
    for (const text of texts) {
      if (!text.trim()) {
        results.push({ text: '', engineId: this.id, style: 'literal' });
        continue;
      }

      try {
        const url = new URL('https://translate.googleapis.com/translate_a/single');
        url.searchParams.set('client', 'gtx');
        url.searchParams.set('sl', sourceLang);
        url.searchParams.set('tl', targetLang);
        url.searchParams.set('dt', 't');
        url.searchParams.set('q', text);

        const resp = await fetch(url.toString(), {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        if (!resp.ok) throw new Error(`Google translate error: ${resp.status}`);

        const data = await resp.json();
        // 格式: [[["translated","original",...],null,...],null,"en"]
        let translated = '';
        if (Array.isArray(data) && Array.isArray(data[0])) {
          translated = data[0].filter(Boolean).map(x => x[0]).join('');
        }

        results.push({
          text: translated || text,
          engineId: this.id,
          style: 'literal'
        });
      } catch (e) {
        console.error('[Google] Translate error:', e.message);
        throw e;
      }
    }

    return createResult(results);
  }

  _langCode(lang) {
    const map = { 'zh-CN': 'zh-CN', 'zh-TW': 'zh-TW', 'ja': 'ja', 'ko': 'ko', 'fr': 'fr', 'de': 'de', 'es': 'es', 'ru': 'ru' };
    return map[lang] || lang;
  }
}

export default GoogleEngine;
