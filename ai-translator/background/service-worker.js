/**
 * Background Service Worker
 * 消息路由 + 翻译调度 + 认证管理 + 上下文菜单 + 快捷键
 *
 * 这是插件的核心调度中心。所有网络请求由这里发起，
 * content script 不直接访问网络。
 */
import translator from '../lib/translator.js';
import authManager from '../lib/auth/auth-manager.js';
import Storage from '../lib/storage.js';
import historyDB from '../lib/history-db.js';

// ==================== 初始化 ====================

let settings = {};
const flashcardQueue = [];  // 离线闪卡队列

async function init() {
  await Storage.initDefaults();
  await reloadSettings();

  // 注册右键菜单
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'translate-selection',
      title: '翻译选中文本',
      contexts: ['selection']
    });
  });

  // 注册快捷键
  chrome.commands.onCommand.addListener(handleCommand);

  // 监听设置变更
  Storage.onChange(async (changes) => {
    await reloadSettings();
    // 通知所有 content script 设置已更新
    broadcastToTabs({ action: 'settingsUpdated', changes });
  });

  // 监听离线队列恢复
  chrome.runtime.onMessage.addListener(handleMessage);

  // 定期同步离线闪卡
  setInterval(syncOfflineFlashcards, 30000);

  // 初始化认证模块
  await authManager.load({
    authCookie: settings.authCookie,
    authSession: settings.authSession,
    authToken: settings.authToken
  });

  // 配置翻译引擎
  await translator.configure(settings.engines);

  console.log('[SmartTranslate] Background service worker initialized');
  console.log('[SmartTranslate] Engines:', settings.engines.filter(e => e.enabled).map(e => e.id));
  console.log('[SmartTranslate] Active:', settings.activeEngineId, '| Style:', settings.style);
}

async function reloadSettings() {
  const all = await Storage.getAll();
  settings = { ...Storage.DEFAULTS, ...all };
}

// ==================== 消息路由 ====================

function handleMessage(message, sender, sendResponse) {
  const handlers = {
    'translate': handleTranslate,
    'translatePage': handleTranslatePage,
    'getSettings': handleGetSettings,
    'updateSettings': handleUpdateSettings,
    'updateAuth': handleUpdateAuth,
    'updateHistory': handleUpdateHistory,
    'updateFlashcards': handleUpdateFlashcards,
    'setActiveEngine': handleSetActiveEngine,
    'setStyle': handleSetStyle,
    'setTargetLang': handleSetTargetLang,
    'callFullPageTranslate': handleCallFullPageTranslate,
    'saveFlashcard': handleSaveFlashcard,
    'saveHistory': handleSaveHistory,
    'getHistory': handleGetHistory,
    'clearHistory': handleClearHistory,
    'getFlashcards': handleGetFlashcards,
    'clearCache': handleClearCache,
    'getCacheStats': handleGetCacheStats,
    'login': handleLogin,
    'logout': handleLogout,
    'refreshSession': handleRefreshSession,
    'testToken': handleTestToken,
    'testServer': handleTestServer
  };

  const handler = handlers[message.action];
  if (handler) {
    handler(message, sender).then(sendResponse).catch(e => sendResponse({ error: e.message }));
    return true; // 保持消息通道开放（async response）
  }
  return false;
}

// ==================== 翻译处理 ====================

async function handleTranslate(msg) {
  const { text, sourceLang, targetLang } = msg;
  try {
    const activeEngine = settings.engines.find(e => e.id === settings.activeEngineId) || settings.engines[0];
    const authHeaders = await authManager.getHeaders(activeEngine);

    const result = await translator.translate({
      text,
      sourceLang: sourceLang || 'auto',
      targetLang: targetLang || settings.targetLang,
      style: settings.style,
      activeEngineId: settings.activeEngineId,
      engines: settings.engines,
      authHeaders
    });

    return { success: true, data: result };
  } catch (e) {
    console.error('[Background] Translation failed:', e.message);
    return { success: false, error: e.message };
  }
}

async function handleTranslatePage(msg) {
  const { texts, sourceLang, targetLang, tabId } = msg;
  const activeEngine = settings.engines.find(e => e.id === settings.activeEngineId) || settings.engines[0];
  const authHeaders = await authManager.getHeaders(activeEngine);

  // 分批翻译
  const batchSize = 10;
  const results = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchResults = await translator.translateBatch(batch.map(t => ({ text: t })), {
      sourceLang: sourceLang || 'auto',
      targetLang: targetLang || settings.targetLang,
      style: 'literal',  // 整页翻译默认直译
      activeEngineId: settings.activeEngineId,
      engines: settings.engines,
      authHeaders
    });

    // 转换结果格式
    for (const r of batchResults) {
      if (r.error) {
        results.push({ error: r.error });
      } else {
        results.push({
          text: r.translations?.[0]?.text || '',
          engineId: r.translations?.[0]?.engineId || ''
        });
      }
    }

    // 向 content script 报告进度
    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        action: 'translateProgress',
        done: Math.min(i + batchSize, texts.length),
        total: texts.length
      }).catch(() => {});
    }
  }

  return { success: true, data: results };
}

// ==================== 上下文菜单 & 快捷键 ====================

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'translate-selection' && info.selectionText && tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      action: 'triggerSelectionTranslate',
      text: info.selectionText,
      skipIcon: true
    }).catch(() => {});
  }
});

async function handleCommand(command) {
  if (command === 'translate-selection') {
    // Alt+A 快捷键 → 通知当前标签页创建闪卡
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'triggerFlashcard'
      }).catch(() => {});
    }
  }
}

// ==================== 闪卡与历史 ====================

async function handleSaveFlashcard(msg) {
  const { original, translation } = msg;
  const card = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    original,
    translation,
    createdAt: Date.now(),
    synced: false
  };

  // 尝试同步到服务器
  try {
    await syncFlashcardToServer(card);
    card.synced = true;
  } catch (e) {
    // 离线：加入本地队列
    card.synced = false;
  }

  // 存储到本地
  const flashcards = await Storage.get('flashcards') || [];
  flashcards.unshift(card);
  await Storage.set('flashcards', flashcards);

  return { success: true, card, synced: card.synced };
}

async function syncFlashcardToServer(card) {
  const serverUrl = settings.serverUrl;
  const serverToken = settings.serverToken;
  if (!serverUrl) throw new Error('Server not configured');

  const headers = { 'Content-Type': 'application/json' };
  if (serverToken) headers['Authorization'] = `Bearer ${serverToken}`;

  const resp = await fetch(`${serverUrl}/v1/flashcards`, {
    method: 'POST',
    headers,
    body: JSON.stringify(card)
  });
  if (!resp.ok) throw new Error(`Server error: ${resp.status}`);
}

async function syncOfflineFlashcards() {
  if (!settings.serverUrl) return;
  const flashcards = await Storage.get('flashcards') || [];
  const unsynced = flashcards.filter(c => !c.synced);
  if (unsynced.length === 0) return;

  for (const card of unsynced) {
    try {
      await syncFlashcardToServer(card);
      card.synced = true;
    } catch (e) {
      break; // 服务器不可用，停止同步
    }
  }
  await Storage.set('flashcards', flashcards);
}

async function handleGetFlashcards() {
  const flashcards = await Storage.get('flashcards') || [];
  return { success: true, data: flashcards };
}

async function handleSaveHistory(msg) {
  const { original, translation, sourceLang, targetLang, engineId, pageUrl } = msg;
  try {
    await historyDB.add({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      original,
      translation,
      sourceLang: sourceLang || 'auto',
      targetLang: targetLang || 'zh-CN',
      engineId: engineId || '',
      pageUrl: pageUrl || '',
      timestamp: Date.now()
    });
    return { success: true };
  } catch (e) {
    console.error('[History] Save failed:', e);
    return { success: false, error: e.message };
  }
}

async function handleGetHistory(msg) {
  try {
    const { query = '', limit = 50, offset = 0 } = msg || {};
    const data = await historyDB.list({ query, limit, offset });
    const total = await historyDB.count();
    return { success: true, data, total };
  } catch (e) {
    console.error('[History] Get failed:', e);
    return { success: true, data: [], total: 0 };
  }
}

async function handleClearHistory() {
  try {
    await historyDB.clear();
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function handleUpdateHistory(msg) {
  const { id } = msg;
  if (id) {
    try { await historyDB.delete(id); } catch (e) { /* ignore */ }
  }
  return { success: true };
}

// ==================== 认证相关 ====================

async function handleLogin(msg) {
  try {
    const result = await authManager.sessionAuth.login();
    // 更新 storage
    await Storage.set('authSession', authManager.sessionAuth.serialize());
    return { success: true, ...result };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function handleLogout() {
  await authManager.sessionAuth.logout();
  await Storage.set('authSession', authManager.sessionAuth.serialize());
  return { success: true };
}

async function handleRefreshSession() {
  try {
    await authManager.sessionAuth.refresh();
    await Storage.set('authSession', authManager.sessionAuth.serialize());
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function handleTestToken(msg) {
  try {
    await authManager.tokenAuth.testToken(msg.testUrl);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function handleTestServer(msg) {
  try {
    const { serverUrl, serverToken } = msg;
    const headers = {};
    if (serverToken) headers['Authorization'] = `Bearer ${serverToken}`;
    const resp = await fetch(`${serverUrl}/v1/health`, { headers });
    if (resp.ok) {
      const data = await resp.json();
      return { success: true, data };
    }
    return { success: false, error: `HTTP ${resp.status}` };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ==================== 缓存管理 ====================

async function handleClearCache() {
  translator.clearCache();
  return { success: true };
}

async function handleGetCacheStats() {
  return { success: true, data: translator.cacheStats() };
}

// ==================== 设置更新 ====================

async function handleUpdateSettings(msg) {
  const { settings: newSettings } = msg;
  Object.assign(settings, newSettings);
  await Storage.setMany(newSettings);
  await translator.configure(settings.engines);
  broadcastToTabs({ action: 'settingsUpdated', changes: newSettings });
  return { success: true };
}

async function handleUpdateAuth(msg) {
  const { authCookie, authSession, authToken } = msg;
  if (authCookie) await Storage.set('authCookie', authCookie);
  if (authSession) await Storage.set('authSession', authSession);
  if (authToken) await Storage.set('authToken', authToken);
  settings.authCookie = authCookie || settings.authCookie;
  settings.authSession = authSession || settings.authSession;
  settings.authToken = authToken || settings.authToken;
  await authManager.load({ authCookie, authSession, authToken });
  return { success: true };
}

async function handleUpdateHistory(msg) {
  const { history } = msg;
  await Storage.set('translationHistory', history);
  return { success: true };
}

async function handleUpdateFlashcards(msg) {
  const { flashcards } = msg;
  await Storage.set('flashcards', flashcards);
  return { success: true };
}

async function handleSetActiveEngine(msg) {
  settings.activeEngineId = msg.engineId;
  await Storage.set('activeEngineId', msg.engineId);
  return { success: true };
}

async function handleSetStyle(msg) {
  settings.style = msg.style;
  await Storage.set('style', msg.style);
  return { success: true };
}

async function handleSetTargetLang(msg) {
  settings.targetLang = msg.lang;
  await Storage.set('targetLang', msg.lang);
  return { success: true };
}

async function handleCallFullPageTranslate(msg) {
  // 通知当前活跃标签页执行整页翻译
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]?.id) {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'callFullPageTranslate' }).catch(() => {});
    // 备用方案：通过 scripting API 调用
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: () => { window.__ztTranslator?.translateFullPage(); }
    }).catch(() => {});
  }
  return { success: true };
}

// ==================== 工具方法 ====================

function broadcastToTabs(message) {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {});
      }
    }
  });
}

async function handleGetSettings() {
  return { success: true, data: settings };
}

// ==================== 启动 ====================

init();
