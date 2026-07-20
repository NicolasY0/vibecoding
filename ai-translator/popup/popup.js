/**
 * Popup 控制面板 — 引擎切换 + 历史记录 + 页面翻译
 */
document.addEventListener('DOMContentLoaded', async () => {
  let settings = {};
  let historyTotal = 0;

  // ==================== 加载 ====================
  async function loadSettings() {
    try {
      const resp = await chrome.runtime.sendMessage({ action: 'getSettings' });
      if (resp.success) { settings = resp.data; render(); }
    } catch (e) { console.error('Failed to load settings:', e); }
  }

  function render() {
    // 引擎
    const sel = document.getElementById('engineSelect');
    sel.innerHTML = '';
    const enabled = (settings.engines || []).filter(e => e.enabled);
    for (const eng of enabled) {
      const opt = document.createElement('option');
      opt.value = eng.id; opt.textContent = eng.name || eng.id;
      if (eng.id === settings.activeEngineId) opt.selected = true;
      sel.appendChild(opt);
    }
    document.getElementById('styleSelect').value = settings.style || 'explain';
    document.getElementById('langSelect').value = settings.targetLang || 'zh-CN';
    loadHistory();
    loadCacheStats();
  }

  // ==================== 历史 ====================
  async function loadHistory() {
    const list = document.getElementById('historyList');
    const countEl = document.getElementById('historyCount');
    const badge = document.getElementById('historyBadge');
    try {
      const resp = await chrome.runtime.sendMessage({ action: 'getHistory', limit: 10 });
      if (resp.success) {
        historyTotal = resp.total || resp.data.length;
        badge.textContent = historyTotal > 99 ? '99+' : historyTotal;
        countEl.textContent = `(${historyTotal})`;
        if (resp.data.length > 0) {
          list.innerHTML = resp.data.map(h => `
            <div class="history-item" data-id="${h.id}" data-original="${escapeAttr(h.original)}" data-translation="${escapeAttr(h.translation)}">
              <div class="history-original">${escapeHtml(h.original.slice(0, 80))}${h.original.length > 80 ? '...' : ''}</div>
              <div class="history-translation">→ ${escapeHtml(h.translation.slice(0, 80))}${h.translation.length > 80 ? '...' : ''}</div>
              <div class="history-meta">
                <span>${h.engineId || ''} · ${h.sourceLang || 'auto'}→${h.targetLang || ''}</span>
                <span>${formatDate(h.timestamp)}</span>
              </div>
            </div>
          `).join('');

          // 点击历史条目复制译文
          list.querySelectorAll('.history-item').forEach(el => {
            el.addEventListener('click', () => {
              const text = el.dataset.translation;
              navigator.clipboard.writeText(text).then(() => showToast('✅ 已复制译文'));
            });
          });
        } else {
          list.innerHTML = '<div class="empty-state">暂无翻译记录<br><small>选中文本翻译后会自动保存</small></div>';
        }
      }
    } catch (e) {
      list.innerHTML = '<div class="empty-state">加载失败</div>';
    }
  }

  async function loadCacheStats() {
    try {
      const resp = await chrome.runtime.sendMessage({ action: 'getCacheStats' });
      if (resp.success) {
        document.getElementById('cacheStats').textContent = `缓存: ${resp.data.size}/${resp.data.capacity}`;
      }
    } catch (e) { /* ignore */ }
  }

  // ==================== 事件 ====================

  document.getElementById('engineSelect').addEventListener('change', async (e) => {
    await chrome.runtime.sendMessage({ action: 'setActiveEngine', engineId: e.target.value });
    // 更新界面提示激活引擎已切换
    loadCacheStats();
  });

  document.getElementById('styleSelect').addEventListener('change', async (e) => {
    await chrome.runtime.sendMessage({ action: 'setStyle', style: e.target.value });
  });

  document.getElementById('langSelect').addEventListener('change', async (e) => {
    await chrome.runtime.sendMessage({ action: 'setTargetLang', lang: e.target.value });
  });

  document.getElementById('translatePageBtn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    // 优先消息通道
    try { await chrome.tabs.sendMessage(tab.id, { action: 'callFullPageTranslate' }); }
    catch {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => { window.__ztTranslator?.translateFullPage(); }
        });
      } catch (e2) { console.error('Page translate failed:', e2); }
    }
    window.close();
  });

  document.getElementById('restorePageBtn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      try { await chrome.tabs.sendMessage(tab.id, { action: 'restoreFullPage' }); }
      catch {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => { window.__ztTranslator?.restoreFullPage(); }
          });
        } catch (e2) {}
      }
      window.close();
    }
  });

  document.getElementById('openOptions').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  document.getElementById('viewAllHistory').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  document.getElementById('clearHistoryBtn').addEventListener('click', async () => {
    if (!confirm(`确定清空全部 ${historyTotal} 条翻译历史？此操作不可恢复。`)) return;
    await chrome.runtime.sendMessage({ action: 'clearHistory' });
    historyTotal = 0;
    loadHistory();
  });

  document.getElementById('refreshBtn').addEventListener('click', () => {
    loadHistory(); loadCacheStats();
  });

  // ==================== Toast ====================
  function showToast(msg) {
    const existing = document.querySelector('.popup-toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.className = 'popup-toast';
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:12px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:6px 16px;border-radius:6px;font-size:12px;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,0.4);';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2000);
  }

  function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function escapeAttr(s) { return (s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/`/g, '&#96;'); }
  function formatDate(ts) { if (!ts) return ''; const d = new Date(ts); return d.toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }); }

  // ==================== 初始化 ====================
  await loadSettings();
});
