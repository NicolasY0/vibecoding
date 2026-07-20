/**
 * 翻译调度器
 * 引擎选择 + fallback 链 + LRU 缓存 + 速率限制
 */
import LRUCache from './cache.js';
import MicrosoftEngine from './engines/engine-microsoft.js';
import GoogleEngine from './engines/engine-google.js';
import DeepLEngine from './engines/engine-deepl.js';
import OpenAIEngine from './engines/engine-openai.js';

class Translator {
  constructor() {
    this.cache = new LRUCache(500, 3600000);
    this.engineInstances = new Map();
    this.rateLimiters = new Map();  // engineId → { count, resetTime }
    this.defaultRateLimit = 60;     // 每引擎每分钟 60 次
    this._initBuiltinEngines();
  }

  _initBuiltinEngines() {
    // 内置免费引擎始终可用
    this.engineInstances.set('microsoft', new MicrosoftEngine());
    this.engineInstances.set('google', new GoogleEngine());
  }

  /**
   * 根据配置更新引擎列表
   * @param {Array} enginesConfig - 来自 storage 的引擎配置数组
   */
  async configure(enginesConfig) {
    for (const cfg of enginesConfig) {
      if (!cfg.enabled) {
        this.engineInstances.delete(cfg.id);
        continue;
      }
      if (cfg.type === 'deepl') {
        if (!this.engineInstances.has(cfg.id)) {
          this.engineInstances.set(cfg.id, new DeepLEngine(cfg));
        } else {
          this.engineInstances.get(cfg.id).updateConfig(cfg);
        }
      } else if (cfg.type === 'openai') {
        if (!this.engineInstances.has(cfg.id)) {
          this.engineInstances.set(cfg.id, new OpenAIEngine(cfg));
        } else {
          this.engineInstances.get(cfg.id).updateConfig(cfg);
        }
      }
    }
    // 清理已删除的引擎
    const validIds = new Set(enginesConfig.filter(c => c.enabled).map(c => c.id));
    for (const id of this.engineInstances.keys()) {
      if (id !== 'microsoft' && id !== 'google' && !validIds.has(id)) {
        this.engineInstances.delete(id);
      }
    }
  }

  /**
   * 执行翻译
   * @param {Object} options
   * @param {string} options.text
   * @param {string} options.sourceLang
   * @param {string} options.targetLang
   * @param {string} options.style - 'explain' | 'literal'
   * @param {string} options.activeEngineId
   * @param {Array} options.engines - 按优先级排序的引擎列表
   * @param {Object} options.authHeaders - 认证 headers
   */
  async translate({ text, sourceLang = 'auto', targetLang = 'zh-CN', style = 'explain', activeEngineId = 'microsoft', engines = [], authHeaders = null }) {
    // 1. 先查缓存
    const cacheKey = LRUCache.makeKey(text, sourceLang, targetLang, activeEngineId, style);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // 2. 构建 fallback 链：活跃引擎优先，其余按 priority 排序
    const sorted = [...engines]
      .filter(e => e.enabled)
      .sort((a, b) => {
        if (a.id === activeEngineId) return -1;
        if (b.id === activeEngineId) return 1;
        return (a.priority || 99) - (b.priority || 99);
      });

    // 3. 逐一尝试
    const errors = [];
    for (const engineCfg of sorted) {
      const engine = this.engineInstances.get(engineCfg.id);
      if (!engine) continue;

      // 速率限制检查
      if (!this._checkRateLimit(engineCfg.id)) {
        errors.push(`${engineCfg.id}: rate limited`);
        continue;
      }

      // 非 LLM 引擎强制直译
      const effectiveStyle = engine.supportsExplain ? style : 'literal';

      try {
        this._incrementRate(engineCfg.id);
        const result = await engine.translate({
          text,
          sourceLang,
          targetLang,
          style: effectiveStyle,
          authHeaders
        });

        // 写入缓存
        this.cache.set(cacheKey, result);
        return result;

      } catch (e) {
        console.warn(`[Translator] Engine "${engineCfg.id}" failed:`, e.message);
        errors.push(`${engineCfg.id}: ${e.message}`);
        // 继续 fallback
      }
    }

    // 4. 全部失败
    throw new Error(`所有翻译引擎均失败:\n${errors.join('\n')}`);
  }

  /** 批量翻译（用于整页翻译） */
  async translateBatch(texts, opts) {
    const results = [];
    for (const item of texts) {
      // 兼容两种格式：纯字符串 或 {text: string}
      const textStr = typeof item === 'string' ? item : item.text;
      if (!textStr || !textStr.trim()) {
        results.push({ translations: [{ text: '', engineId: opts.activeEngineId || 'unknown', style: opts.style || 'literal' }] });
        continue;
      }
      try {
        const r = await this.translate({ ...opts, text: textStr });
        results.push(r);
      } catch (e) {
        results.push({ error: e.message, text: textStr });
      }
    }
    return results;
  }

  _checkRateLimit(engineId) {
    const limiter = this.rateLimiters.get(engineId);
    if (!limiter) return true;
    if (Date.now() > limiter.resetTime) {
      this.rateLimiters.delete(engineId);
      return true;
    }
    return limiter.count < this.defaultRateLimit;
  }

  _incrementRate(engineId) {
    if (!this.rateLimiters.has(engineId)) {
      this.rateLimiters.set(engineId, { count: 0, resetTime: Date.now() + 60000 });
    }
    const limiter = this.rateLimiters.get(engineId);
    limiter.count++;
  }

  /** 清空缓存 */
  clearCache() {
    this.cache.clear();
  }

  /** 获取缓存统计 */
  cacheStats() {
    return this.cache.stats();
  }
}

// 单例
const translator = new Translator();
export default translator;
