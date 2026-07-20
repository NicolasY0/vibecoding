/**
 * 认证统一调度器
 * 根据引擎配置的 authMethod 自动选择对应认证模块
 *
 * REQ-AUTH-MGR-001 ~ REQ-AUTH-MGR-002
 */
import CookieAuth from './auth-cookie.js';
import SessionAuth from './auth-session.js';
import TokenAuth from './auth-token.js';

class AuthManager {
  constructor() {
    this.cookieAuth = CookieAuth;
    this.sessionAuth = new SessionAuth();
    this.tokenAuth = new TokenAuth();
  }

  /**
   * 从 storage 加载所有认证配置
   */
  async load(authConfigs) {
    if (authConfigs.authCookie) {
      // Cookie 不需要加载，直接使用配置
    }
    if (authConfigs.authSession) {
      this.sessionAuth.load(authConfigs.authSession);
    }
    if (authConfigs.authToken) {
      await this.tokenAuth.load(authConfigs.authToken);
    }
  }

  /**
   * 根据引擎配置获取认证 headers
   * @param {Object} engineConfig - 引擎配置，包含 authMethod 和相关凭据
   * @returns {Promise<Object>} headers 对象
   */
  async getHeaders(engineConfig) {
    const method = engineConfig.authMethod || 'none';
    const headers = {};

    switch (method) {
      case 'cookie': {
        const cookies = engineConfig.authCookie?.cookies || [];
        Object.assign(headers, this.cookieAuth.getHeaders(cookies));
        break;
      }
      case 'session': {
        Object.assign(headers, await this.sessionAuth.getHeaders());
        break;
      }
      case 'token': {
        Object.assign(headers, this.tokenAuth.getHeaders());
        break;
      }
      case 'all': {
        // 组合全部三种认证
        const cookies = engineConfig.authCookie?.cookies || [];
        Object.assign(headers, this.cookieAuth.getHeaders(cookies));
        Object.assign(headers, await this.sessionAuth.getHeaders());
        Object.assign(headers, this.tokenAuth.getHeaders());
        break;
      }
      default:
        break;
    }

    return headers;
  }

  /**
   * 处理 401 响应
   * @returns 是否需要用户介入
   */
  async handleUnauthorized(engineConfig) {
    const method = engineConfig.authMethod || 'none';

    switch (method) {
      case 'session': {
        // 尝试刷新 session
        try {
          await this.sessionAuth.refresh();
          return { recovered: true, message: 'Session 已刷新' };
        } catch (e) {
          return { recovered: false, message: 'Session 已过期，请重新登录' };
        }
      }
      case 'token': {
        return { recovered: false, message: 'Token 已失效，请更新 Token' };
      }
      case 'cookie': {
        return { recovered: false, message: 'Cookie 已过期，请更新 Cookie' };
      }
      default:
        return { recovered: false, message: '认证失败' };
    }
  }

  /**
   * 获取各认证模块的状态摘要（用于 Options UI）
   */
  getStatusSummary() {
    return {
      session: this.sessionAuth.getStatus(),
      token: {
        configured: !!this.tokenAuth.config.token,
        valid: this.tokenAuth.isValid(),
        jwt: this.tokenAuth.parseJWT()
      },
      cookie: {
        configured: CookieAuth.validate(this.cookieAuth._lastCookies || [])
      }
    };
  }
}

// 单例
const authManager = new AuthManager();
export default authManager;
