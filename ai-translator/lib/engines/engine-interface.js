/**
 * 翻译引擎接口定义（JS 文档约定 + 运行时检查）
 *
 * 所有引擎必须实现：
 *   id: string           — 唯一标识
 *   type: string         — 'microsoft' | 'google' | 'deepl' | 'openai'
 *   supportsExplain: boolean — 是否支持释义模式
 *   translate(req): Promise<TranslationResult>
 *
 * TranslationRequest:
 *   { text: string|string[], sourceLang: string, targetLang: string,
 *     style: 'explain'|'literal', authHeaders?: Record<string,string> }
 *
 * TranslationResult:
 *   { translations: [{text, engineId, style}], detectedLang?: string }
 */

/**
 * 验证引擎是否实现了必需接口
 */
export function validateEngine(engine) {
  const required = ['id', 'type', 'supportsExplain', 'translate'];
  for (const prop of required) {
    if (!(prop in engine)) {
      throw new Error(`Engine "${engine.id || 'unknown'}" missing required property: ${prop}`);
    }
  }
  if (typeof engine.translate !== 'function') {
    throw new Error(`Engine "${engine.id}" translate is not a function`);
  }
}

/**
 * 创建标准 TranslationResult
 */
export function createResult(translations, detectedLang = null) {
  return {
    translations: Array.isArray(translations) ? translations : [translations],
    detectedLang
  };
}
