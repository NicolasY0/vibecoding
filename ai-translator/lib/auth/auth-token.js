/**
 * Token 认证模块
 * 支持 Bearer Token (JWT) 和 API Key 两种格式
 * Token 使用 Web Crypto API AES-GCM 加密存储
 *
 * REQ-AUTH-TK-001 ~ REQ-AUTH-TK-004
 */

const TOKEN_TYPES = {
  BEARER: 'bearer',
  API_KEY: 'apikey'
};

class TokenAuth {
  constructor() {
    this.config = {
      tokenType: 'bearer',
      headerName: 'X-API-Key',  // API Key 模式的自定义 header 名
      token: null,               // 原始 token（非加密的内存中）
      encrypted: false
    };
    // 加密密钥，存储在 session 级别
    this._encryptionKey = null;
  }

  /**
   * 从 storage 加载配置（解密）
   */
  async load(config) {
    Object.assign(this.config, config);
    if (this.config.encrypted && this.config.token?.ciphertext) {
      this.config.token = await this._decrypt(this.config.token);
    }
  }

  /**
   * 设置 Token 并加密存储准备
   */
  async setToken(token, tokenType = 'bearer', headerName = 'X-API-Key') {
    this.config.token = token;
    this.config.tokenType = tokenType;
    this.config.headerName = headerName;
  }

  /**
   * 获取认证 headers
   */
  getHeaders() {
    if (!this.config.token) return {};

    if (this.config.tokenType === TOKEN_TYPES.BEARER) {
      return { 'Authorization': `Bearer ${this.config.token}` };
    } else {
      // API Key 模式
      return { [this.config.headerName]: this.config.token };
    }
  }

  /**
   * 解析 JWT payload（不验证签名）
   * @returns {Object|null} { payload, header: {...}, expiresAt, remaining }
   */
  parseJWT() {
    if (!this.config.token) return null;

    const parts = this.config.token.split('.');
    if (parts.length !== 3) return null; // 不是标准 JWT

    try {
      const header = JSON.parse(this._base64UrlDecode(parts[0]));
      const payload = JSON.parse(this._base64UrlDecode(parts[1]));

      const result = { header, payload };
      if (payload.exp) {
        result.expiresAt = payload.exp * 1000; // 秒 → 毫秒
        result.remainingMs = Math.max(0, result.expiresAt - Date.now());
        result.expired = result.remainingMs === 0;
      }
      return result;
    } catch (e) {
      return null; // 解析失败，不是有效 JWT
    }
  }

  /**
   * 检查 Token 是否有效
   */
  isValid() {
    if (!this.config.token) return false;
    const jwt = this.parseJWT();
    if (!jwt) return true; // 非 JWT 格式（API Key）默认有效
    return !jwt.expired;
  }

  /**
   * 测试 Token 有效性（向指定 URL 发送测试请求）
   */
  async testToken(testUrl) {
    if (!this.config.token || !testUrl) {
      throw new Error('Token 或测试 URL 未配置');
    }

    const headers = this.getHeaders();
    const resp = await fetch(testUrl, { method: 'GET', headers });
    if (!resp.ok) {
      throw new Error(`Token 验证失败: HTTP ${resp.status}`);
    }
    return true;
  }

  /**
   * 序列化配置用于存储（加密 token）
   */
  async serialize() {
    const data = {
      tokenType: this.config.tokenType,
      headerName: this.config.headerName,
      token: this.config.token ? await this._encrypt(this.config.token) : null,
      encrypted: !!this.config.token
    };
    return data;
  }

  // ========== 加密方法 ==========

  async _getEncryptionKey() {
    if (this._encryptionKey) return this._encryptionKey;

    // 使用固定 salt 派生密钥（生产环境应使用随机 salt）
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode('ai-translator-token-encryption-v1'),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    this._encryptionKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: new TextEncoder().encode('ai-translator-salt'),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    return this._encryptionKey;
  }

  async _encrypt(plaintext) {
    const key = await this._getEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );

    // 返回 iv + ciphertext 的 base64url 编码
    const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);
    return this._arrayBufferToBase64Url(combined.buffer);
  }

  async _decrypt(encryptedData) {
    try {
      const key = await this._getEncryptionKey();
      const combined = this._base64UrlToArrayBuffer(encryptedData);
      const iv = combined.slice(0, 12);
      const ciphertext = combined.slice(12);
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        key,
        ciphertext
      );
      return new TextDecoder().decode(decrypted);
    } catch (e) {
      console.error('[TokenAuth] Decryption failed:', e.message);
      return null;
    }
  }

  // ========== 工具方法 ==========

  _base64UrlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    try {
      return atob(str);
    } catch {
      return '';
    }
  }

  _base64UrlToArrayBuffer(base64url) {
    let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  _arrayBufferToBase64Url(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
}

export { TOKEN_TYPES };
export default TokenAuth;
