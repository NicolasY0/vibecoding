/**
 * IndexedDB 翻译历史存储
 * 支持 5000 条记录，按时间倒序，关键词搜索，批量操作
 */
const DB_NAME = 'ai_translator_db';
const DB_VERSION = 1;
const STORE_NAME = 'history';
const MAX_RECORDS = 5000;

class HistoryDB {
  constructor() {
    this._db = null;
    this._ready = this._open();
  }

  async _open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('original', 'original', { unique: false });
          store.createIndex('translation', 'translation', { unique: false });
        }
      };
      req.onsuccess = (e) => { this._db = e.target.result; resolve(this._db); };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async _ensureDB() {
    if (this._db) return this._db;
    return this._ready;
  }

  /** 添加一条历史记录 */
  async add(record) {
    await this._ensureDB();
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.add({
        id: record.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        original: record.original,
        translation: record.translation,
        sourceLang: record.sourceLang || 'auto',
        targetLang: record.targetLang || 'zh-CN',
        engineId: record.engineId || '',
        pageUrl: record.pageUrl || '',
        timestamp: record.timestamp || Date.now()
      });
      tx.oncomplete = () => {
        // 自动淘汰超出上限的记录
        this._evict();
        resolve(true);
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  /** 获取历史列表 */
  async list({ query = '', limit = 50, offset = 0 } = {}) {
    await this._ensureDB();
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      const results = [];
      let count = 0;
      let skipped = 0;

      index.openCursor(null, 'prev').onsuccess = (e) => {
        const cursor = e.target.result;
        if (!cursor) return resolve(results);

        const record = cursor.value;
        // 关键词过滤
        if (query) {
          const q = query.toLowerCase();
          const matchOrig = record.original?.toLowerCase().includes(q);
          const matchTrans = record.translation?.toLowerCase().includes(q);
          if (!matchOrig && !matchTrans) {
            cursor.continue();
            return;
          }
        }

        if (skipped < offset) {
          skipped++;
          cursor.continue();
          return;
        }

        results.push(record);
        count++;
        if (count >= limit) return resolve(results);
        cursor.continue();
      };
    });
  }

  /** 删除一条记录 */
  async delete(id) {
    await this._ensureDB();
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  /** 清空全部 */
  async clear() {
    await this._ensureDB();
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  /** 获取记录总数 */
  async count() {
    await this._ensureDB();
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /** 获取最近 N 条（快速路径，不需要分页） */
  async recent(n = 5) {
    return this.list({ limit: n, offset: 0 });
  }

  /** 自动淘汰最旧记录 */
  async _evict() {
    const total = await this.count();
    if (total <= MAX_RECORDS) return;

    const excess = total - MAX_RECORDS;
    return new Promise((resolve) => {
      const tx = this._db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      let deleted = 0;

      index.openCursor(null, 'next').onsuccess = (e) => {
        const cursor = e.target.result;
        if (!cursor || deleted >= excess) return resolve(true);
        cursor.delete();
        deleted++;
        cursor.continue();
      };
    });
  }
}

// 单例
const historyDB = new HistoryDB();
export default historyDB;
