/**
 * AI Translator Options — Vue3 应用
 */
const { createApp, ref, computed, onMounted } = Vue;

createApp({
  setup() {
    // ============ Tab 导航 ============
    const tabs = [
      { id: 'general', icon: '⚙', label: '通用设置' },
      { id: 'features', icon: '🔧', label: '功能开关' },
      { id: 'engines', icon: '🚀', label: '翻译引擎' },
      { id: 'auth', icon: '🔑', label: '认证配置' },
      { id: 'server', icon: '🖥', label: '自建服务器' },
      { id: 'data', icon: '📊', label: '数据管理' }
    ];
    const activeTab = ref('general');

    const authSubTabs = [
      { id: 'cookie', label: '🍪 Cookie' },
      { id: 'session', label: '🔐 Session' },
      { id: 'token', label: '🎫 Token' }
    ];
    const authTab = ref('cookie');

    // ============ 设置 ============
    const settings = ref({
      targetLang: 'zh-CN', style: 'explain', selectionEnabled: true,
      altAEnabled: true, fullPageMode: 'bilingual', activeEngineId: 'microsoft',
      engines: [], serverUrl: '', serverToken: ''
    });
    const theme = ref('system');

    // ============ 引擎 ============
    const newEngineType = ref('');
    const newEngineName = ref('');
    const dragIdx = ref(null);

    const enginesSorted = computed(() =>
      [...settings.value.engines].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
    );

    // ============ 认证 ============
    const authCookie = ref({ cookies: [] });
    const authSession = ref({ loginUrl: '', username: '', sessionId: null, expiresAt: null, refreshToken: null, refreshUrl: '' });
    const authSessionPassword = ref('');
    const authToken = ref({ tokenType: 'bearer', headerName: 'X-API-Key', token: null, encrypted: false });
    const authTokenInput = ref('');
    const tokenTestUrl = ref('');
    const authLoading = ref(false);

    const jwtInfo = computed(() => {
      if (!authTokenInput.value || authToken.value.tokenType !== 'bearer') return null;
      const parts = authTokenInput.value.split('.');
      if (parts.length !== 3) return null;
      try {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        const info = { payload };
        if (payload.exp) {
          info.expiresAt = payload.exp * 1000;
          info.remainingMs = Math.max(0, info.expiresAt - Date.now());
          info.expired = info.remainingMs === 0;
        }
        return info;
      } catch { return null; }
    });

    const sessionStatusClass = computed(() => {
      if (!authSession.value.sessionId) return 'unauthenticated';
      if (!authSession.value.expiresAt) return 'authenticated';
      const r = authSession.value.expiresAt - Date.now();
      if (r <= 0) return 'expired';
      if (r < 300000) return 'refreshing';
      return 'authenticated';
    });
    const sessionRemaining = computed(() =>
      authSession.value.expiresAt ? Math.max(0, authSession.value.expiresAt - Date.now()) : 0
    );

    // ============ 数据 ============
    const history = ref([]);
    const historyQuery = ref('');
    let _searchTimer;
    const filteredHistory = computed(() => {
      if (!historyQuery.value.trim()) return history.value;
      const q = historyQuery.value.toLowerCase();
      return history.value.filter(h =>
        h.original?.toLowerCase().includes(q) || h.translation?.toLowerCase().includes(q)
      );
    });
    const flashcards = ref([]);

    // ============ 服务器 ============
    const serverTesting = ref(false);
    const serverResult = ref(null);

    // ============ 加载 ============
    async function loadAll() {
      try {
        const resp = await chrome.runtime.sendMessage({ action: 'getSettings' });
        if (resp.success) {
          const s = resp.data;
          settings.value = {
            targetLang: s.targetLang || 'zh-CN', style: s.style || 'explain',
            selectionEnabled: s.selectionEnabled !== false, altAEnabled: s.altAEnabled !== false,
            fullPageMode: s.fullPageMode || 'bilingual', activeEngineId: s.activeEngineId || 'microsoft',
            engines: s.engines || [], serverUrl: s.serverUrl || '', serverToken: s.serverToken || ''
          };
          if (s.authCookie) authCookie.value = { cookies: s.authCookie.cookies || [] };
          if (s.authSession) Object.assign(authSession.value, s.authSession);
          if (s.authToken) Object.assign(authToken.value, s.authToken);
        }
        theme.value = (await chrome.storage.local.get('zt_theme'))?.zt_theme || 'system';
      } catch (e) { console.error('Load settings:', e); }
      loadHistory();
      loadFlashcards();
    }

    async function loadHistory() {
      try {
        const resp = await chrome.runtime.sendMessage({ action: 'getHistory', query: historyQuery.value, limit: 200 });
        if (resp.success) history.value = resp.data;
      } catch (e) { /* ignore */ }
    }
    async function loadFlashcards() {
      try {
        const resp = await chrome.runtime.sendMessage({ action: 'getFlashcards' });
        if (resp.success) flashcards.value = resp.data;
      } catch (e) { /* ignore */ }
    }

    // ============ 保存 ============
    async function save() {
      await chrome.runtime.sendMessage({
        action: 'updateSettings',
        settings: JSON.parse(JSON.stringify(settings.value))
      });
    }
    async function saveEngines() { settings.value.engines = [...settings.value.engines]; await save(); }
    async function saveAuth() {
      await chrome.runtime.sendMessage({
        action: 'updateAuth',
        authCookie: JSON.parse(JSON.stringify(authCookie.value)),
        authSession: JSON.parse(JSON.stringify(authSession.value)),
        authToken: JSON.parse(JSON.stringify(authToken.value))
      });
    }
    async function saveTheme() {
      await chrome.storage.local.set({ zt_theme: theme.value });
    }

    // ============ 引擎操作 ============
    function toggleEngine(eng) { eng.enabled = !eng.enabled; saveEngines(); }
    function setActive(eng) { settings.value.activeEngineId = eng.id; save(); }
    function deleteEngine(eng) {
      if (eng.builtin) return;
      settings.value.engines = settings.value.engines.filter(e => e.id !== eng.id);
      if (settings.value.activeEngineId === eng.id) {
        const first = settings.value.engines.find(e => e.enabled);
        settings.value.activeEngineId = first ? first.id : 'microsoft';
      }
      saveEngines();
    }
    function addEngine() {
      if (!newEngineType.value || !newEngineName.value) return;
      const id = newEngineType.value + '_' + Date.now();
      const eng = { id, type: newEngineType.value, name: newEngineName.value, enabled: true, priority: settings.value.engines.length, builtin: false, apiKey: '', apiUrl: '', model: '', authMethod: 'none' };
      if (newEngineType.value === 'openai') { eng.apiUrl = 'https://api.deepseek.com/v1/chat/completions'; eng.model = 'deepseek-chat'; }
      if (newEngineType.value === 'deepl') { eng.apiUrl = 'https://api-free.deepl.com/v2/translate'; }
      settings.value.engines.push(eng);
      newEngineType.value = ''; newEngineName.value = '';
      saveEngines();
    }
    function onDragStart(e, idx) { e.dataTransfer.setData('text/plain', String(idx)); }
    function onDrop(e, targetIdx) {
      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
      const arr = [...enginesSorted.value];
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(targetIdx, 0, moved);
      arr.forEach((eng, i) => { eng.priority = i; });
      settings.value.engines = arr;
      saveEngines();
    }

    // ============ 认证操作 ============
    function addCookie() { authCookie.value.cookies.push({ name: '', value: '' }); saveAuth(); }
    function removeCookie(idx) { authCookie.value.cookies.splice(idx, 1); saveAuth(); }
    async function doLogin() {
      authLoading.value = true;
      try {
        const resp = await chrome.runtime.sendMessage({ action: 'login', username: authSession.value.username, password: authSessionPassword.value });
        if (resp.success) {
          authSession.value.sessionId = resp.sessionId; authSession.value.expiresAt = resp.expiresAt;
          authSession.value.refreshToken = resp.refreshToken; authSessionPassword.value = '';
          saveAuth();
        } else alert('登录失败: ' + resp.error);
      } catch (e) { alert('登录错误: ' + e.message); }
      finally { authLoading.value = false; }
    }
    async function doLogout() {
      await chrome.runtime.sendMessage({ action: 'logout' });
      authSession.value.sessionId = null; authSession.value.expiresAt = null;
      authSession.value.refreshToken = null; saveAuth();
    }
    function onTokenInput() { authToken.value.token = authTokenInput.value; saveAuth(); }
    async function testToken() {
      if (!tokenTestUrl.value || !authTokenInput.value) return;
      authLoading.value = true;
      try { await chrome.runtime.sendMessage({ action: 'testToken', testUrl: tokenTestUrl.value }); alert('✅ Token 验证通过'); }
      catch (e) { alert('❌ Token 验证失败: ' + e.message); }
      finally { authLoading.value = false; }
    }

    // ============ 服务器 ============
    async function testServer() {
      serverTesting.value = true; serverResult.value = null;
      try {
        const resp = await chrome.runtime.sendMessage({ action: 'testServer', serverUrl: settings.value.serverUrl, serverToken: settings.value.serverToken });
        serverResult.value = resp.success ? { success: true, data: resp.data } : { success: false, error: resp.error };
      } catch (e) { serverResult.value = { success: false, error: e.message }; }
      finally { serverTesting.value = false; }
    }

    // ============ 历史 ============
    function searchHistory() { clearTimeout(_searchTimer); _searchTimer = setTimeout(loadHistory, 300); }
    async function deleteHistory(id) { await chrome.runtime.sendMessage({ action: 'updateHistory', id }); history.value = history.value.filter(h => h.id !== id); }
    async function clearHistory() { if (!confirm('确定清空全部翻译历史？')) return; await chrome.runtime.sendMessage({ action: 'clearHistory' }); history.value = []; }
    async function deleteFlashcard(id) { flashcards.value = flashcards.value.filter(c => c.id !== id); await chrome.runtime.sendMessage({ action: 'updateFlashcards', flashcards: flashcards.value }); }
    function exportCSV() {
      const BOM = '﻿'; let csv = BOM + '原文,译文,时间,同步\n';
      for (const c of flashcards.value) csv += `"${c.original.replace(/"/g, '""')}","${c.translation.replace(/"/g, '""')}","${new Date(c.createdAt).toLocaleString('zh-CN')}","${c.synced ? '已同步' : '离线'}"\n`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = `生词闪卡_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
    }

    function formatTime(ms) {
      if (ms <= 0) return '已过期';
      const m = Math.floor(ms / 60000);
      return m < 60 ? `${m}分钟` : `${Math.floor(m/60)}小时${m%60}分钟`;
    }
    function formatDate(ts) {
      if (!ts) return '';
      return new Date(ts).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
    }

    onMounted(loadAll);

    return {
      tabs, activeTab, authSubTabs, authTab,
      settings, theme, enginesSorted, newEngineType, newEngineName, dragIdx,
      authCookie, authSession, authSessionPassword, authToken, authTokenInput,
      tokenTestUrl, authLoading, jwtInfo, sessionStatusClass, sessionRemaining,
      history, historyQuery, filteredHistory, flashcards,
      serverTesting, serverResult,
      save, saveEngines, saveAuth, saveTheme,
      toggleEngine, setActive, deleteEngine, addEngine, onDragStart, onDrop,
      addCookie, removeCookie, doLogin, doLogout, onTokenInput, testToken,
      testServer, searchHistory, deleteHistory, clearHistory, deleteFlashcard, exportCSV,
      formatTime, formatDate
    };
  }
}).mount('#app');
