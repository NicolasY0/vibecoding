/**
 * 微软翻译引擎（免费，Edge Microsoft Translator API）
 * 非官方接口，可能随时变化
 */
import { createResult } from './engine-interface.js';

const ENGINE_ID = 'microsoft';

class MicrosoftEngine {
  constructor() {
    this.id = ENGINE_ID;
    this.type = 'microsoft';
    this.supportsExplain = false;  // MT 引擎仅直译
    this._token = null;
    this._tokenExpiry = 0;
  }

  /**
   * 获取临时访问 token（从 Edge 公共端点）
   */
  async _getToken() {
    if (this._token && Date.now() < this._tokenExpiry) {
      return this._token;
    }
    try {
      // Edge 翻译服务的公共 token 端点
      const resp = await fetch('https://edge.microsoft.com/translate/auth', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (!resp.ok) throw new Error(`Token fetch failed: ${resp.status}`);
      this._token = await resp.text();
      this._tokenExpiry = Date.now() + 550000; // 约 9 分钟
      return this._token;
    } catch (e) {
      console.error('[Microsoft] Token fetch error:', e.message);
      throw e;
    }
  }

  /**
   * @param {import('./engine-interface.js').TranslationRequest} req
   */
  async translate(req) {
    const token = await this._getToken();
    const texts = Array.isArray(req.text) ? req.text : [req.text];

    // 语言代码转换
    const to = this._langCode(req.targetLang);
    const from = req.sourceLang && req.sourceLang !== 'auto'
      ? this._langCode(req.sourceLang) : null;

    const results = [];
    for (const text of texts) {
      if (!text.trim()) {
        results.push({ text: '', engineId: this.id, style: 'literal' });
        continue;
      }

      const params = new URLSearchParams({ to, text });
      if (from) params.set('from', from);

      const resp = await fetch(
        `https://api.microsofttranslator.com/V2/Http.svc/Translate?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'Mozilla/5.0'
          }
        }
      );

      if (!resp.ok) {
        throw new Error(`Microsoft translate error: ${resp.status} ${resp.statusText}`);
      }

      const xml = await resp.text();
      // 解析 XML: <string xmlns="...">translated text</string>
      const match = xml.match(/<string[^>]*>(.*?)<\/string>/);
      results.push({
        text: match ? this._decodeXml(match[1]) : text,
        engineId: this.id,
        style: 'literal'
      });
    }

    return createResult(results);
  }

  _langCode(lang) {
    // 微软使用标准 BCP-47 但需要小写连字符形式
    const map = { 'zh-CN': 'zh-CHS', 'zh-TW': 'zh-CHT', 'ja': 'ja', 'ko': 'ko', 'fr': 'fr', 'de': 'de', 'es': 'es', 'ru': 'ru' };
    return map[lang] || lang;
  }

  _decodeXml(str) {
    return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  }
}

export default MicrosoftEngine;
