/**
 * Cookie 认证模块
 * 用户在 Options 页面配置 Cookie 名称和值
 * 翻译时注入 HTTP Cookie header
 *
 * REQ-AUTH-CK-001 ~ REQ-AUTH-CK-004
 */

const CookieAuth = {
  /**
   * 获取 Cookie 认证 headers
   * @param {Array} cookies - [{name, value}, ...]
   * @returns {Object} headers 对象
   */
  getHeaders(cookies) {
    if (!cookies || cookies.length === 0) return {};

    const cookieString = cookies
      .filter(c => c.name && c.value)
      .map(c => `${encodeURIComponent(c.name)}=${encodeURIComponent(c.value)}`)
      .join('; ');

    return cookieString ? { 'Cookie': cookieString } : {};
  },

  /**
   * 验证 Cookie 配置是否有效
   */
  validate(cookies) {
    if (!Array.isArray(cookies)) return false;
    return cookies.some(c => c.name && c.value);
  },

  /**
   * 格式化 Cookie 用于存储
   * @param {string} rawString - 原始 Cookie 字符串 "name1=value1; name2=value2"
   * @returns {Array} 解析后的 Cookie 数组
   */
  parse(rawString) {
    if (!rawString || !rawString.trim()) return [];
    return rawString.split(';').map(pair => {
      const [name, ...rest] = pair.trim().split('=');
      return { name: name?.trim() || '', value: rest.join('=').trim() };
    }).filter(c => c.name);
  },

  /**
   * 将 Cookie 数组序列化为字符串用于显示
   */
  serialize(cookies) {
    if (!Array.isArray(cookies)) return '';
    return cookies.filter(c => c.name && c.value)
      .map(c => `${c.name}=${c.value}`).join('; ');
  }
};

export default CookieAuth;
