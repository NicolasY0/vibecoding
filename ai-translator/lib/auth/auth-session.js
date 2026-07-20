/**
 * Session 认证模块
 * 用户配置登录端点 → background 发送登录请求 → 获取 sessionId
 * 自动刷新过期 session
 *
 * REQ-AUTH-SS-001 ~ REQ-AUTH-SS-005
 *
 * 状态机: UNAUTHENTICATED → LOGGING_IN → AUTHENTICATED → REFRESHING → EXPIRED
 */

const SESSION_STATES = {
  UNAUTHENTICATED: 'unauthenticated',
  LOGGING_IN: 'logging_in',
  AUTHENTICATED: 'authenticated',
  REFRESHING: 'refreshing',
  EXPIRED: 'expired'
};

class SessionAuth {
  constructor() {
    this.state = SESSION_STATES.UNAUTHENTICATED;
    this.config = {
      loginUrl: '',
      username: '',
      password: '',
      sessionId: null,
      createdAt: null,
      expiresAt: null,
      refreshToken: null,
      refreshUrl: ''
    };
  }

  /**
   * 从 storage 加载配置
   */
  load(config) {
    Object.assign(this.config, config);
    if (this.config.sessionId) {
      if (this._isExpired()) {
        this.state = SESSION_STATES.EXPIRED;
      } else {
        this.state = SESSION_STATES.AUTHENTICATED;
      }
    } else {
      this.state = SESSION_STATES.UNAUTHENTICATED;
    }
  }

  /**
   * 执行登录
   * @returns {Promise<Object>} { success, sessionId, expiresAt, error? }
   */
  async login() {
    if (!this.config.loginUrl) {
      throw new Error('登录 URL 未配置');
    }

    this.state = SESSION_STATES.LOGGING_IN;

    try {
      const resp = await fetch(this.config.loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          username: this.config.username,
          password: this.config.password
        })
      });

      if (!resp.ok) {
        throw new Error(`登录失败: HTTP ${resp.status}`);
      }

      const data = await resp.json();
      // 兼容多种后端响应格式
      const sessionId = data.sessionId || data.session_id || data.token;
      const expiresAt = data.expiresAt || data.expires_at || data.exp;
      const refreshToken = data.refreshToken || data.refresh_token || null;
      const refreshUrl = data.refreshUrl || data.refresh_url || this.config.loginUrl;

      if (!sessionId) {
        throw new Error('登录响应中未找到 sessionId');
      }

      this.config.sessionId = sessionId;
      this.config.createdAt = Date.now();
      this.config.expiresAt = typeof expiresAt === 'number'
        ? expiresAt * 1000  // 兼容秒级时间戳
        : expiresAt ? new Date(expiresAt).getTime() : Date.now() + 3600000;  // 默认 1h
      this.config.refreshToken = refreshToken;
      this.config.refreshUrl = refreshUrl;
      this.state = SESSION_STATES.AUTHENTICATED;

      return {
        success: true,
        sessionId,
        expiresAt: this.config.expiresAt,
        refreshToken
      };
    } catch (e) {
      this.state = SESSION_STATES.UNAUTHENTICATED;
      throw e;
    }
  }

  /**
   * 获取认证 headers
   * 如果 session 已过期，尝试自动刷新
   */
  async getHeaders() {
    if (this.state === SESSION_STATES.UNAUTHENTICATED) return {};
    if (this.state === SESSION_STATES.EXPIRED) {
      // 尝试刷新
      if (this.config.refreshToken) {
        try {
          await this.refresh();
        } catch (e) {
          console.warn('[Session] Refresh failed:', e.message);
          return {};
        }
      } else {
        return {};
      }
    }

    // 检查即将过期（5 分钟内），自动刷新
    if (this.config.expiresAt && Date.now() > this.config.expiresAt - 300000) {
      if (this.config.refreshToken) {
        try {
          await this.refresh();
        } catch (e) {
          // 继续使用现有 session
          console.warn('[Session] Preemptive refresh failed:', e.message);
        }
      }
    }

    return { 'X-Session-Id': this.config.sessionId };
  }

  /**
   * 刷新 session
   */
  async refresh() {
    if (!this.config.refreshUrl || !this.config.refreshToken) {
      throw new Error('刷新 URL 或 refreshToken 未配置');
    }

    this.state = SESSION_STATES.REFRESHING;

    try {
      const resp = await fetch(this.config.refreshUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          refreshToken: this.config.refreshToken,
          sessionId: this.config.sessionId
        })
      });

      if (!resp.ok) throw new Error(`刷新失败: HTTP ${resp.status}`);

      const data = await resp.json();
      const sessionId = data.sessionId || data.session_id || data.token || this.config.sessionId;
      const expiresAt = data.expiresAt || data.expires_at || (Date.now() / 1000 + 3600);
      const refreshToken = data.refreshToken || data.refresh_token || this.config.refreshToken;

      this.config.sessionId = sessionId;
      this.config.expiresAt = typeof expiresAt === 'number' && expiresAt < 9999999999
        ? expiresAt * 1000 : expiresAt;
      this.config.refreshToken = refreshToken;
      this.state = SESSION_STATES.AUTHENTICATED;
    } catch (e) {
      this.state = SESSION_STATES.EXPIRED;
      throw e;
    }
  }

  /**
   * 登出
   */
  async logout(logoutUrl = '') {
    const url = logoutUrl || this.config.loginUrl?.replace('/login', '/logout') || '';
    if (url && this.config.sessionId) {
      try {
        await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Id': this.config.sessionId
          }
        });
      } catch (e) {
        // 忽略登出请求失败
      }
    }

    this.config.sessionId = null;
    this.config.createdAt = null;
    this.config.expiresAt = null;
    this.config.refreshToken = null;
    this.state = SESSION_STATES.UNAUTHENTICATED;
  }

  /**
   * 获取当前状态用于 UI 显示
   */
  getStatus() {
    return {
      state: this.state,
      sessionId: this.config.sessionId ? this.config.sessionId.slice(0, 10) + '...' : null,
      expiresAt: this.config.expiresAt,
      remainingMs: this.config.expiresAt ? Math.max(0, this.config.expiresAt - Date.now()) : 0
    };
  }

  /**
   * 序列化配置用于存储
   */
  serialize() {
    return {
      loginUrl: this.config.loginUrl,
      username: this.config.username,
      password: '', // 不保存密码明文，用户每次需要重新输入
      sessionId: this.config.sessionId,
      createdAt: this.config.createdAt,
      expiresAt: this.config.expiresAt,
      refreshToken: this.config.refreshToken,
      refreshUrl: this.config.refreshUrl
    };
  }

  _isExpired() {
    return this.config.expiresAt && Date.now() > this.config.expiresAt;
  }
}

export { SESSION_STATES };
export default SessionAuth;
