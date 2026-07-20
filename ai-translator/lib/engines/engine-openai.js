/**
 * OpenAI 兼容翻译引擎（DeepSeek / OpenAI / Claude 等）
 * 支持释义(explain)和直译(literal)两种模式
 */
import { createResult } from './engine-interface.js';

const ENGINE_ID = 'openai';

class OpenAIEngine {
  constructor(config = {}) {
    this.id = config.id || ENGINE_ID;
    this.type = 'openai';
    this.supportsExplain = true;
    this.apiUrl = config.apiUrl || 'https://api.deepseek.com/v1/chat/completions';
    this.apiKey = config.apiKey || '';
    this.model = config.model || 'deepseek-chat';
    this.name = config.name || 'DeepSeek';
  }

  updateConfig(config) {
    if (config.apiUrl !== undefined) this.apiUrl = config.apiUrl;
    if (config.apiKey !== undefined) this.apiKey = config.apiKey;
    if (config.model !== undefined) this.model = config.model;
    if (config.name !== undefined) this.name = config.name;
  }

  /**
   * @param {import('./engine-interface.js').TranslationRequest} req
   */
  async translate(req) {
    if (!this.apiKey) {
      throw new Error(`${this.name}: API Key 未配置`);
    }

    const texts = Array.isArray(req.text) ? req.text : [req.text];
    const targetLangName = this._langName(req.targetLang);
    const style = req.style || 'explain';

    // 构建系统 prompt
    const systemPrompt = style === 'explain'
      ? this._explainPrompt(targetLangName)
      : this._literalPrompt(targetLangName);

    const results = [];
    for (const text of texts) {
      if (!text.trim()) {
        results.push({ text: '', engineId: this.id, style });
        continue;
      }

      const headers = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      };
      // 注入自定义认证 headers（Cookie/Session/Token）
      if (req.authHeaders) {
        Object.assign(headers, req.authHeaders);
      }

      const body = JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        temperature: 0.3,
        max_tokens: 2000
      });

      const resp = await fetch(this.apiUrl, { method: 'POST', headers, body });

      if (resp.status === 401 || resp.status === 403) {
        throw new Error(`${this.name}: 认证失败，请检查 API Key`);
      }
      if (resp.status === 429) {
        throw new Error(`${this.name}: 请求频率超限，请稍后重试`);
      }
      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        throw new Error(`${this.name} error ${resp.status}: ${errText.slice(0, 200)}`);
      }

      const data = await resp.json();
      const translated = data.choices?.[0]?.message?.content?.trim() || text;

      results.push({
        text: translated,
        engineId: this.id,
        style
      });
    }

    return createResult(results);
  }

  _explainPrompt(targetLang) {
    return `你是一个专业翻译引擎。将用户输入翻译为${targetLang}。

要求：
1. 用目标语言的习惯表达方式，不要逐字直译
2. 对习语、俚语、文化特定表达，给出地道的对应说法
3. 先用一行 ⚡ 给出简洁的释义/解释（如果原文有隐含含义）
4. 然后给出翻译结果
5. 只输出翻译结果，不要添加额外说明

格式：
⚡ [一句话释义，如需要]
[翻译结果]`;
  }

  _literalPrompt(targetLang) {
    return `你是一个翻译引擎。将用户输入逐句翻译为${targetLang}。

要求：
1. 贴近原文结构和字面含义
2. 保留原文的段落和换行
3. 只输出翻译结果，不要添加任何额外说明`;
  }

  _langName(lang) {
    const map = { 'zh-CN': '简体中文', 'zh-TW': '繁体中文', 'en': 'English', 'ja': '日本語', 'ko': '한국어', 'fr': 'Français', 'de': 'Deutsch', 'es': 'Español', 'ru': 'Русский' };
    return map[lang] || lang;
  }
}

export default OpenAIEngine;
