/**
 * LRU 内存缓存
 * 用于翻译结果缓存，跨页面共享（background 单例）
 * Key = 原文+源语言+目标语言+引擎+风格
 * 容量 500 条，TTL 1 小时
 */
class LRUCache {
  constructor(capacity = 500, ttlMs = 3600000) {
    this.capacity = capacity;
    this.ttlMs = ttlMs;
    this.map = new Map();  // key → { value, timestamp }
  }

  /**
   * 生成缓存 key
   * @param {string} text
   * @param {string} sourceLang
   * @param {string} targetLang
   * @param {string} engineId
   * @param {string} style
   */
  static makeKey(text, sourceLang, targetLang, engineId, style) {
    return `${sourceLang}:${targetLang}:${engineId}:${style}:${text}`;
  }

  get(key) {
    if (!this.map.has(key)) return null;
    const entry = this.map.get(key);
    // TTL 检查
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.map.delete(key);
      return null;
    }
    // LRU: 移到末尾
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key, value) {
    // 淘汰最早
    if (this.map.size >= this.capacity) {
      const first = this.map.keys().next().value;
      this.map.delete(first);
    }
    this.map.set(key, { value, timestamp: Date.now() });
  }

  has(key) {
    return this.get(key) !== null;
  }

  delete(key) {
    return this.map.delete(key);
  }

  clear() {
    this.map.clear();
  }

  get size() {
    return this.map.size;
  }

  /** 获取统计信息 */
  stats() {
    return { size: this.size, capacity: this.capacity, ttlMs: this.ttlMs };
  }
}

export default LRUCache;
