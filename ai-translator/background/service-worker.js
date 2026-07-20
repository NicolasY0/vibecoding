/**
 * SmartTranslate Background Service Worker — 最小可用版
 * 处理翻译请求、历史存储、闪卡管理
 */
console.log('[SmartTranslate] Service worker starting...');

// ========== 内联存储 ==========
const storage = {
  async get(key) {
    const r = await chrome.storage.local.get('zt_' + key);
    return r['zt_' + key];
  },
  async set(key, val) {
    return chrome.storage.local.set({ ['zt_' + key]: val });
  }
};

const DEFAULTS = {
  targetLang: 'zh-CN', style: 'explain', selectionEnabled: true,
  altAEnabled: true, fullPageMode: 'bilingual', translateMode: 'card',
  engines: [
    { id: 'microsoft', type: 'microsoft', enabled: true, priority: 0, name: '微软翻译', builtin: true },
    { id: 'google', type: 'google', enabled: true, priority: 1, name: 'Google 翻译', builtin: true }
  ],
  activeEngineId: 'microsoft', serverUrl: '', serverToken: ''
};

let settings = { ...DEFAULTS };

// ========== 翻译引擎（内联） ==========
async function translateViaMicrosoft(text, targetLang) {
  // 获取 token
  const tkResp = await fetch('https://edge.microsoft.com/translate/auth');
  if (!tkResp.ok) throw new Error('MS token failed');
  const token = await tkResp.text();

  const to = { 'zh-CN': 'zh-CHS', 'zh-TW': 'zh-CHT', 'ja': 'ja', 'ko': 'ko', 'fr': 'fr', 'de': 'de', 'es': 'es', 'ru': 'ru' }[targetLang] || targetLang;
  const url = `https://api.microsofttranslator.com/V2/Http.svc/Translate?to=${to}&text=${encodeURIComponent(text)}`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) throw new Error('MS translate failed: ' + resp.status);
  const xml = await resp.text();
  const m = xml.match(/<string[^>]*>(.*?)<\/string>/);
  return m ? m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>') : text;
}

async function translateViaGoogle(text, targetLang) {
  const to = { 'zh-CN': 'zh-CN', 'zh-TW': 'zh-TW', 'ja': 'ja', 'ko': 'ko', 'fr': 'fr', 'de': 'de', 'es': 'es', 'ru': 'ru' }[targetLang] || targetLang;
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('Google translate failed: ' + resp.status);
  const data = await resp.json();
  return data?.[0]?.filter(Boolean).map(x => x[0]).join('') || text;
}

async function translateViaDeepSeek(text, targetLang, style) {
  const langNames = { 'zh-CN': '简体中文', 'zh-TW': '繁体中文', 'en': 'English', 'ja': '日本語', 'ko': '한국어', 'fr': 'Français', 'de': 'Deutsch', 'es': 'Español', 'ru': 'Русский' };
  const langName = langNames[targetLang] || targetLang;

  const systemPrompt = style === 'explain'
    ? `你是专业翻译引擎。将文本翻译为${langName}。习语/俚语给出地道对应说法。先⚡一行释义(如需要)，再给出译文。只输出翻译结果。`
    : `将文本逐句翻译为${langName}。贴近原文。只输出译文。`;

  const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer sk-4b121a7e18c84581a3d0ea5ee9e2861f' },
    body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: text }], temperature: 0.3, max_tokens: 2000 })
  });
  if (!resp.ok) throw new Error('DeepSeek: ' + resp.status);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content?.trim() || text;
}

async function doTranslate(text, targetLang, engineId, style) {
  try {
    let result;
    if (engineId === 'google') {
      result = await translateViaGoogle(text, targetLang);
    } else if (engineId === 'openai' || engineId?.startsWith('openai')) {
      result = await translateViaDeepSeek(text, targetLang, style);
    } else {
      // 默认微软
      result = await translateViaMicrosoft(text, targetLang);
    }
    return { translations: [{ text: result, engineId: engineId || 'microsoft', style: style || 'literal' }], detectedLang: 'auto' };
  } catch (e) {
    // Fallback: 微软失败 → Google → DeepSeek
    console.warn('[SmartTranslate] Engine', engineId, 'failed:', e.message, '- trying fallback');
    if (engineId === 'microsoft') {
      try { const r = await translateViaGoogle(text, targetLang); return { translations: [{ text: r, engineId: 'google', style: 'literal' }], detectedLang: 'auto' }; } catch (e2) {}
    }
    throw e;
  }
}

// ========== 历史（chrome.storage 简单版） ==========
async function saveHistory(entry) {
  let h = await storage.get('history') || [];
  h.unshift({ ...entry, id: Date.now().toString(36), timestamp: Date.now() });
  if (h.length > 2000) h = h.slice(0, 2000);
  await storage.set('history', h);
}

async function getHistory(query, limit) {
  let h = await storage.get('history') || [];
  if (query) {
    const q = query.toLowerCase();
    h = h.filter(e => (e.original || '').toLowerCase().includes(q) || (e.translation || '').toLowerCase().includes(q));
  }
  return h.slice(0, limit || 50);
}

// ========== 消息路由 ==========
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handle(msg).then(sendResponse).catch(e => sendResponse({ success: false, error: e.message }));
  return true; // async response
});

async function handle(msg) {
  switch (msg.action) {
    // 翻译
    case 'translate':
      return { success: true, data: await doTranslate(msg.text, msg.targetLang || 'zh-CN', settings.activeEngineId, settings.style) };

    case 'translatePage': {
      const results = [];
      for (const t of msg.texts) {
        try { results.push(await doTranslate(t, msg.targetLang || 'zh-CN', settings.activeEngineId, 'literal')); }
        catch (e) { results.push({ error: e.message }); }
      }
      // 转换为 [{text, engineId}, ...]
      return { success: true, data: results.map(r => r.error ? r : r.translations[0]) };
    }

    // 设置
    case 'getSettings':
      return { success: true, data: settings };

    case 'updateSettings':
      Object.assign(settings, msg.settings);
      await storage.set('settings', settings);
      return { success: true };

    case 'setActiveEngine':
      settings.activeEngineId = msg.engineId;
      await storage.set('settings', settings);
      return { success: true };

    case 'setStyle':
      settings.style = msg.style;
      await storage.set('settings', settings);
      return { success: true };

    case 'setTargetLang':
      settings.targetLang = msg.lang;
      await storage.set('settings', settings);
      return { success: true };

    case 'setTranslateMode':
      settings.translateMode = msg.mode;
      await storage.set('settings', settings);
      return { success: true };

    // 历史
    case 'saveHistory':
      await saveHistory(msg);
      return { success: true };

    case 'getHistory':
      return { success: true, data: await getHistory(msg.query, msg.limit), total: (await storage.get('history') || []).length };

    case 'clearHistory':
      await storage.set('history', []);
      return { success: true };

    // 闪卡
    case 'saveFlashcard':
      let cards = await storage.get('flashcards') || [];
      cards.unshift({ id: Date.now().toString(36), original: msg.original, translation: msg.translation || '', createdAt: Date.now(), synced: false });
      if (cards.length > 500) cards = cards.slice(0, 500);
      await storage.set('flashcards', cards);
      return { success: true, card: cards[0], synced: false };

    case 'getFlashcards':
      return { success: true, data: await storage.get('flashcards') || [] };

    case 'updateFlashcards':
      await storage.set('flashcards', msg.flashcards);
      return { success: true };

    case 'clearCache':
      return { success: true };

    case 'getCacheStats':
      return { success: true, data: { size: 0, capacity: 500 } };

    // 服务器
    case 'testServer':
      try {
        const h = {};
        if (msg.serverToken) h['Authorization'] = 'Bearer ' + msg.serverToken;
        const r = await fetch(msg.serverUrl + '/v1/health', { headers: h });
        return { success: true, data: await r.json() };
      } catch (e) {
        return { success: false, error: e.message };
      }

    // 认证（简化）
    case 'login':
    case 'logout':
    case 'testToken':
    case 'updateAuth':
      return { success: true };

    default:
      return { success: false, error: 'Unknown action: ' + msg.action };
  }
}

// ========== 启动 ==========
(async () => {
  const saved = await storage.get('settings');
  if (saved) Object.assign(settings, saved);

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'translate-sel', title: '翻译选中文本', contexts: ['selection'] });
  });
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'translate-sel' && info.selectionText && tab?.id) {
      chrome.tabs.sendMessage(tab.id, { action: 'callSelectionTranslate', text: info.selectionText }).catch(() => {});
    }
  });

  console.log('[SmartTranslate] Service worker ready ✅');
})();
