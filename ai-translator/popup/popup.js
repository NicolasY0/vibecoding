let settings = {};
async function load() {
  try {
    const r = await chrome.runtime.sendMessage({ action: 'getSettings' });
    if (r.success) settings = r.data;
    const sel = document.getElementById('engineSelect');
    sel.innerHTML = '';
    (settings.engines || []).filter(e => e.enabled).forEach(e => {
      const o = document.createElement('option'); o.value = e.id; o.textContent = e.name || e.id;
      if (e.id === settings.activeEngineId) o.selected = true;
      sel.appendChild(o);
    });
    document.getElementById('styleSelect').value = settings.style || 'explain';
    document.getElementById('langSelect').value = settings.targetLang || 'zh-CN';
    loadHistory();
  } catch (e) { document.getElementById('status').textContent = '错误'; }
}

async function loadHistory() {
  try {
    const r = await chrome.runtime.sendMessage({ action: 'getHistory', limit: 10 });
    const list = document.getElementById('historyList');
    const count = document.getElementById('historyCount');
    if (r.success && r.data.length > 0) {
      count.textContent = `(${r.total || r.data.length})`;
      list.innerHTML = r.data.map(h => `<div class="history-item"><div class="h-o">${esc(h.original.slice(0,60))}</div><div class="h-t">→ ${esc(h.translation.slice(0,60))}</div></div>`).join('');
      list.querySelectorAll('.history-item').forEach(el => {
        el.onclick = () => { const t = el.querySelector('.h-t').textContent.slice(2); navigator.clipboard.writeText(t); };
      });
    } else { count.textContent = '(0)'; list.innerHTML = '<div class="empty-state">暂无记录</div>'; }
  } catch (e) {}
}

document.getElementById('engineSelect').onchange = async (e) => {
  await chrome.runtime.sendMessage({ action: 'setActiveEngine', engineId: e.target.value });
};
document.getElementById('styleSelect').onchange = async (e) => {
  await chrome.runtime.sendMessage({ action: 'setStyle', style: e.target.value });
};
document.getElementById('langSelect').onchange = async (e) => {
  await chrome.runtime.sendMessage({ action: 'setTargetLang', lang: e.target.value });
};
document.getElementById('translatePageBtn').onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    try { await chrome.tabs.sendMessage(tab.id, { action: 'callFullPageTranslate' }); }
    catch { /* fallback */ try { await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => { window.__ztTranslator?.translateFullPage(); } }); } catch(e){} }
    window.close();
  }
};
document.getElementById('restorePageBtn').onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    try { await chrome.tabs.sendMessage(tab.id, { action: 'restoreFullPage' }); }
    catch { try { await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => { window.__ztTranslator?.restoreFullPage(); } }); } catch(e){} }
    window.close();
  }
};
document.getElementById('openOptions').onclick = () => chrome.runtime.openOptionsPage();

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
load();
