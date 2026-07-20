/**
 * DeepL 翻译引擎（付费，需 API Key）
 * API 文档: https://www.deepl.com/docs-api
 */
import { createResult } from './engine-interface.js';

const ENGINE_ID = 'deepl';

class DeepLEngine {
  constructor(config = {}) {
    this.id = config.id || ENGINE_ID;
    this.type = 'deepl';
    this.supportsExplain = false;
    this.apiKey = config.apiKey || '';
    this.apiUrl = config.apiUrl || 'https://api-free.deepl.com/v2/translate';
  }

  updateConfig(config) {
    if (config.apiKey !== undefined) this.apiKey = config.apiKey;
    if (config.apiUrl !== undefined) this.apiUrl = config.apiUrl;
  }

  /**
   * @param {import('./engine-interface.js').TranslationRequest} req
   */
  async translate(req) {
    if (!this.apiKey) {
      throw new Error('DeepL API Key 未配置');
    }

    const texts = Array.isArray(req.text) ? req.text : [req.text];
    const targetLang = this._langCode(req.targetLang);
    const sourceLang = req.sourceLang && req.sourceLang !== 'auto'
      ? this._langCode(req.sourceLang) : undefined;

    const body = new URLSearchParams();
    body.append('target_lang', targetLang);
    texts.forEach(t => body.append('text', t));
    if (sourceLang) body.append('source_lang', sourceLang);

    const headers = {
      'Authorization': `DeepL-Auth-Key ${this.apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    };
    // 注入自定义认证 headers（Cookie/Session/Token）
    if (req.authHeaders) {
      Object.assign(headers, req.authHeaders);
    }

    const resp = await fetch(this.apiUrl, { method: 'POST', headers, body });

    if (resp.status === 401 || resp.status === 403) {
      throw new Error('DeepL: 认证失败，请检查 API Key');
    }
    if (!resp.ok) {
      throw new Error(`DeepL error: ${resp.status} ${resp.statusText}`);
    }

    const data = await resp.json();
    const translations = data.translations.map(t => ({
      text: t.text,
      engineId: this.id,
      style: 'literal'
    }));

    return createResult(translations, data.translations[0]?.detected_source_language || null);
  }

  _langCode(lang) {
    const map = { 'zh-CN': 'ZH', 'zh-TW': 'ZH', 'en': 'EN-US', 'ja': 'JA', 'ko': 'KO', 'fr': 'FR', 'de': 'DE', 'es': 'ES', 'ru': 'RU' };
    return map[lang] || lang.toUpperCase();
  }
}

export default DeepLEngine;
