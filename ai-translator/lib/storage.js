/**
 * chrome.storage.local CRUD 封装
 * 所有扩展设置统一从此读写，支持变更监听
 */
const Storage = {
  _prefix: 'zt_',

  async get(key) {
    const fullKey = this._prefix + key;
    const result = await chrome.storage.local.get(fullKey);
    return result[fullKey];
  },

  async set(key, value) {
    const fullKey = this._prefix + key;
    return chrome.storage.local.set({ [fullKey]: value });
  },

  async remove(key) {
    const fullKey = this._prefix + key;
    return chrome.storage.local.remove(fullKey);
  },

  async getAll() {
    const all = await chrome.storage.local.get(null);
    const filtered = {};
    for (const [k, v] of Object.entries(all)) {
      if (k.startsWith(this._prefix)) {
        filtered[k.slice(this._prefix.length)] = v;
      }
    }
    return filtered;
  },

  /** 批量设置 */
  async setMany(obj) {
    const prefixed = {};
    for (const [k, v] of Object.entries(obj)) {
      prefixed[this._prefix + k] = v;
    }
    return chrome.storage.local.set(prefixed);
  },

  /** 监听变更，调用 callback(changes) where changes 是去掉前缀的映射 */
  onChange(callback) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      const filtered = {};
      for (const [k, v] of Object.entries(changes)) {
        if (k.startsWith(this._prefix)) {
          filtered[k.slice(this._prefix.length)] = v;
        }
      }
      if (Object.keys(filtered).length > 0) callback(filtered);
    });
  },

  // ========== 默认值 ==========
  DEFAULTS: {
    targetLang: 'zh-CN',
    style: 'explain',
    selectionEnabled: true,
    altAEnabled: true,
    fullPageMode: 'bilingual',
    engines: [
      { id: 'microsoft', type: 'microsoft', enabled: true, priority: 0, name: '微软翻译', builtin: true },
      { id: 'google', type: 'google', enabled: true, priority: 1, name: 'Google 翻译', builtin: true }
    ],
    activeEngineId: 'microsoft',
    authCookie: { cookies: [] },
    authSession: { loginUrl: '', username: '', password: '', sessionId: null, expiresAt: null, refreshToken: null, refreshUrl: '' },
    authToken: { tokenType: 'bearer', headerName: 'X-API-Key', token: null, encrypted: false },
    serverUrl: '',
    serverToken: ''
  },

  /** 初始化默认值（仅当 key 不存在时写入） */
  async initDefaults() {
    for (const [key, value] of Object.entries(this.DEFAULTS)) {
      const existing = await this.get(key);
      if (existing === undefined) {
        await this.set(key, value);
      }
    }
  }
};

export default Storage;
