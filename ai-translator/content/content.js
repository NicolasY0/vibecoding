/**
 * Content Script
 * 文本选区监听 + Shadow DOM UI + 整页翻译 + 闪卡快捷键
 *
 * 所有 UI 组件通过 Shadow DOM 渲染，与宿主页面完全隔离 (CON-SEL-001)
 * 不直接发起网络请求，通过消息委托 background (CON-SEL-002)
 */
(function () {
  'use strict';

  // ==================== 状态管理 ====================

  let state = {
    selectionEnabled: true,
    altAEnabled: true,
    targetLang: 'zh-CN',
    style: 'explain',
    activeEngineId: 'microsoft',
    fullPageMode: 'bilingual',
    fullPageActive: false  // 当前页面是否处于双语模式
  };

  let currentIcon = null;   // 浮动图标 Shadow DOM 宿主
  let currentCard = null;   // 翻译卡片 Shadow DOM 宿主
  let selectedText = '';
  let selectionRect = null;

  // ==================== 初始化 ====================

  async function init() {
    console.log('[SmartTranslate] Content script starting on:', location.hostname);

    // SPA 延迟初始化 — 等待页面动态内容渲染完成
    await new Promise(r => setTimeout(r, 500));

    // 从 storage 加载设置
    await loadSettings();

    // 监听来自 background 的消息
    chrome.runtime.onMessage.addListener(handleMessage);

    // 初始化选区监听
    if (state.selectionEnabled) {
      document.addEventListener('mouseup', onMouseUp, { passive: true });
      console.log('[SmartTranslate] Selection listener active');
    }

    // 键盘快捷键
    document.addEventListener('keydown', onKeyDown);

    // 滚动监听
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });

    // 暴露公开 API（供 scripting.executeScript 备用调用）
    window.__ztTranslator = {
      translateFullPage,
      restoreFullPage,
      getState: () => ({ ...state }),
      getSelection: () => selectedText
    };

    console.log('[SmartTranslate] Content script ready ✅');
  }

  async function loadSettings() {
    try {
      const resp = await chrome.runtime.sendMessage({ action: 'getSettings' });
      if (resp.success && resp.data) {
        Object.assign(state, {
          selectionEnabled: resp.data.selectionEnabled,
          altAEnabled: resp.data.altAEnabled,
          targetLang: resp.data.targetLang,
          style: resp.data.style,
          activeEngineId: resp.data.activeEngineId,
          fullPageMode: resp.data.fullPageMode
        });
        // 更新选区监听状态
        if (resp.data.selectionEnabled) {
          document.addEventListener('mouseup', onMouseUp, { passive: true });
        } else {
          document.removeEventListener('mouseup', onMouseUp);
        }
      }
    } catch (e) {
      console.warn('[SmartTranslate] Failed to load settings:', e.message);
    }
  }

  function handleMessage(msg, sender, sendResponse) {
    const handlers = {
      'settingsUpdated': () => { loadSettings(); },
      'triggerSelectionTranslate': handleTriggerSelection,
      'triggerFlashcard': handleTriggerFlashcard,
      'translateProgress': handleTranslateProgress,
      'callFullPageTranslate': handleCallFullPageTranslate,
      'restoreFullPage': handleRestoreFullPage,
      'getSelection': () => { sendResponse({ text: selectedText }); return true; }
    };

    const handler = handlers[msg.action];
    if (handler) {
      const result = handler(msg);
      if (result !== true) sendResponse({ ok: true });
    } else {
      sendResponse({ ok: false, error: 'Unknown action: ' + msg.action });
    }
    return false;
  }

  // ==================== 选区监听 ====================

  function onMouseUp(e) {
    // 延迟执行，确保选区已确定
    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        removeIcon();
        return;
      }

      const text = selection.toString().trim();
      // REQ-SEL-007: 空白或超长文本不触发
      if (!text || text.length > 5000) {
        removeIcon();
        return;
      }

      // 点击的是当前图标/卡片内部，不重新触发
      if (currentIcon && e.target.closest('#zt-icon-host, #zt-card-host')) {
        return;
      }

      selectedText = text;

      // 获取选区末端位置
      const range = selection.getRangeAt(0);
      const endRect = range.getClientRects();
      selectionRect = endRect.length > 0 ? endRect[endRect.length - 1] : range.getBoundingClientRect();

      // REQ-SEL-006: 移除旧图标
      removeIcon();
      removeCard();
      showIcon();
    }, 50);
  }

  function onScroll() {
    if (currentIcon && selectionRect) {
      updateIconPosition();
    }
  }

  function onKeyDown(e) {
    // Escape 关闭
    if (e.key === 'Escape') {
      if (currentCard || currentIcon) {
        removeCard();
        removeIcon();
      }
    }
    // Alt+A 闪卡
    if (e.altKey && (e.key === 'a' || e.key === 'A') && state.altAEnabled && selectedText) {
      e.preventDefault();
      createFlashcard();
    }
  }

  // ==================== 浮动图标 ====================

  function showIcon() {
    const host = document.createElement('div');
    host.id = 'zt-icon-host';
    host.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:auto;';
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML = `
      <style>
        .zt-icon {
          width: 28px; height: 28px;
          background: #4a9eff;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          transition: transform 0.15s, box-shadow 0.15s;
          user-select: none;
        }
        .zt-icon:hover {
          transform: scale(1.15);
          box-shadow: 0 4px 16px rgba(74,158,255,0.5);
        }
        .zt-icon svg { width: 16px; height: 16px; fill: #fff; }
      </style>
      <div class="zt-icon" title="翻译选中文本">
        <svg viewBox="0 0 24 24"><path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>
      </div>
    `;

    shadow.querySelector('.zt-icon').addEventListener('click', (e) => {
      e.stopPropagation();
      showCard();
      removeIcon();
    });

    currentIcon = host;
    updateIconPosition();

    // 全局点击关闭
    setTimeout(() => document.addEventListener('click', onGlobalClick, { once: true }), 0);
  }

  function updateIconPosition() {
    if (!currentIcon || !selectionRect) return;
    const iconSize = 28;
    let top = selectionRect.bottom + 8;
    let left = selectionRect.right + 8;

    // 防止溢出
    if (left + iconSize > window.innerWidth - 8) left = window.innerWidth - iconSize - 8;
    if (top + iconSize > window.innerHeight - 8) top = selectionRect.top - iconSize - 8;
    if (top < 8) top = 8;

    currentIcon.style.top = top + 'px';
    currentIcon.style.left = left + 'px';
  }

  function removeIcon() {
    if (currentIcon) {
      currentIcon.remove();
      currentIcon = null;
    }
  }

  // ==================== 翻译卡片 ====================

  function showCard() {
    const host = document.createElement('div');
    host.id = 'zt-card-host';
    host.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:auto;';
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML = `
      <style>
        :host { --bg: #1e1e2e; --surface: #2a2a3e; --text: #e0e0e0; --text-dim: #999; --accent: #4a9eff; --border: #3a3a50; --radius: 12px; }
        .card {
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          max-width: 400px;
          max-height: 500px;
          overflow-y: auto;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
          color: var(--text);
          font-size: 14px;
          line-height: 1.6;
          user-select: text;
        }
        .card-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 16px; border-bottom: 1px solid var(--border);
          font-size: 12px; color: var(--text-dim);
        }
        .card-body { padding: 16px; }
        .card-footer {
          display: flex; gap: 8px; padding: 8px 16px 12px;
          border-top: 1px solid var(--border);
        }
        .btn {
          padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border);
          background: var(--surface); color: var(--text);
          cursor: pointer; font-size: 12px; transition: all 0.15s;
        }
        .btn:hover { border-color: var(--accent); color: var(--accent); }
        .btn-primary { background: var(--accent); color: #fff; border-color: var(--accent); }
        .btn-primary:hover { opacity: 0.85; }
        .loading { display: flex; align-items: center; justify-content: center; padding: 40px 20px; }
        .loading::after {
          content: ''; width: 24px; height: 24px; border: 3px solid var(--border);
          border-top-color: var(--accent); border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .error { padding: 16px; color: #ff6b6b; text-align: center; }
        .error .retry { color: var(--accent); cursor: pointer; margin-top: 8px; }
        .src-lang { background: var(--surface); padding: 2px 8px; border-radius: 4px; }
        .style-badge { background: var(--accent); color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
        .toast {
          position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
          background: #333; color: #fff; padding: 10px 24px; border-radius: 8px;
          font-size: 13px; z-index: 2147483647; box-shadow: 0 4px 12px rgba(0,0,0,0.4);
          animation: fadeInUp 0.3s ease;
        }
        @keyframes fadeInUp { from { opacity: 0; transform: translateX(-50%) translateY(10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
      </style>
      <div class="card">
        <div class="card-header">
          <span class="src-lang">检测中...</span>
          <span>→ ${state.targetLang}</span>
          <span class="style-badge">${state.style === 'explain' ? '释义' : '直译'}</span>
        </div>
        <div class="card-body"><div class="loading"></div></div>
        <div class="card-footer" style="display:none;">
          <button class="btn btn-copy">📋 复制</button>
          <button class="btn btn-flashcard">⭐ 加入生词本</button>
          <button class="btn btn-close">✕ 关闭</button>
        </div>
      </div>
    `;

    // 定位卡片（REQ-SEL-004）
    updateCardPosition(host);

    // 绑定按钮
    const cardEl = shadow.querySelector('.card');
    cardEl.addEventListener('click', (e) => e.stopPropagation());
    shadow.querySelector('.btn-close').addEventListener('click', () => { removeCard(); });
    shadow.querySelector('.btn-copy').addEventListener('click', () => copyTranslation(shadow));
    shadow.querySelector('.btn-flashcard').addEventListener('click', () => createFlashcard(shadow));

    currentCard = host;

    // 发起翻译请求
    doTranslate(shadow);

    // 全局点击关闭
    setTimeout(() => document.addEventListener('click', onGlobalClick, { once: true }), 0);
  }

  function updateCardPosition(host) {
    const cardW = 400, maxH = 500;
    let top, left;

    if (selectionRect && selectionRect.width > 0) {
      top = selectionRect.bottom + 36;
      left = selectionRect.right + 8;
    } else {
      // 默认在视口中央偏上
      top = Math.max(60, window.innerHeight * 0.3);
      left = Math.max(8, (window.innerWidth - cardW) / 2);
    }

    // 下方空间不足 → 向上展开
    if (top + maxH > window.innerHeight - 8) {
      top = selectionRect.top - Math.min(maxH, 400) - 8;
    }
    // 右侧越界 → 左对齐
    if (left + cardW > window.innerWidth - 8) {
      left = window.innerWidth - cardW - 8;
    }
    if (top < 8) top = 8;
    if (left < 8) left = 8;

    host.style.top = top + 'px';
    host.style.left = left + 'px';
  }

  async function doTranslate(shadow) {
    const headerEl = shadow.querySelector('.card-header');
    const bodyEl = shadow.querySelector('.card-body');
    const footerEl = shadow.querySelector('.card-footer');
    const srcLangEl = shadow.querySelector('.src-lang');

    try {
      const resp = await chrome.runtime.sendMessage({
        action: 'translate',
        text: selectedText,
        sourceLang: 'auto',
        targetLang: state.targetLang
      });

      if (!resp.success) throw new Error(resp.error);

      const result = resp.data;
      const t = result.translations[0];
      const detectedLang = result.detectedLang || t.detectedLang || 'auto';

      srcLangEl.textContent = detectedLang;
      shadow.querySelector('.style-badge').textContent = t.style === 'explain' ? '释义' : '直译';

      bodyEl.innerHTML = `<div class="translation-text">${escapeHtml(t.text)}</div>`;
      footerEl.style.display = 'flex';

      // 内联翻译：在原文所在段落下方插入译文
      injectInlineTranslation(t.text, t.engineId);

      // REQ-SEL-011: 写入翻译历史
      chrome.runtime.sendMessage({
        action: 'saveHistory',
        original: selectedText,
        translation: t.text,
        sourceLang: detectedLang,
        targetLang: state.targetLang,
        engineId: t.engineId,
        pageUrl: location.href
      }).catch(() => {});

    } catch (e) {
      bodyEl.innerHTML = `
        <div class="error">
          <div>翻译失败: ${escapeHtml(e.message)}</div>
          <div class="retry">🔄 重试</div>
        </div>
      `;
      bodyEl.querySelector('.retry')?.addEventListener('click', () => {
        bodyEl.innerHTML = '<div class="loading"></div>';
        doTranslate(shadow);
      });
      footerEl.style.display = 'none';
    }
  }

  function removeCard() {
    if (currentCard) {
      currentCard.remove();
      currentCard = null;
    }
  }

  function onGlobalClick(e) {
    const clickedOnIcon = currentIcon && e.target.closest('#zt-icon-host');
    const clickedOnCard = currentCard && e.target.closest('#zt-card-host');
    if (!clickedOnIcon && !clickedOnCard) {
      removeCard();
      removeIcon();
    } else {
      // 继续监听下次全局点击
      setTimeout(() => document.addEventListener('click', onGlobalClick, { once: true }), 0);
    }
  }

  // ==================== 右键菜单 / 快捷键触发 ====================

  function handleTriggerSelection(msg) {
    selectedText = msg.text;
    // 尝试获取当前选区的位置
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      const rect = range.getClientRects();
      selectionRect = rect.length > 0 ? rect[rect.length - 1] : range.getBoundingClientRect();
    }
    // 如果没有选区矩形，在鼠标位置显示
    if (!selectionRect || (selectionRect.width === 0 && selectionRect.height === 0)) {
      selectionRect = null;  // 使用默认位置
    }
    removeIcon();
    removeCard();
    // 如果 skipIcon 为 true，直接显示卡片
    if (msg.skipIcon) {
      showCard();
    } else {
      showIcon();
    }
  }

  async function handleTriggerFlashcard() {
    if (!selectedText) {
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) {
        selectedText = selection.toString().trim();
      }
    }
    if (!selectedText) {
      showToast('⚠ 请先选中文本');
      return;
    }
    await doCreateFlashcard();
  }

  async function handleCallFullPageTranslate() {
    await translateFullPage();
  }

  function handleRestoreFullPage() {
    restoreFullPage();
  }

  async function doCreateFlashcard() {
    try {
      // 先翻译获得译文
      const resp = await chrome.runtime.sendMessage({
        action: 'translate',
        text: selectedText,
        sourceLang: 'auto',
        targetLang: state.targetLang
      });

      let translation = '';
      if (resp.success && resp.data.translations?.[0]) {
        translation = resp.data.translations[0].text;
      }

      // 保存闪卡
      const result = await chrome.runtime.sendMessage({
        action: 'saveFlashcard',
        original: selectedText,
        translation
      });

      showToast(result.synced
        ? '✅ 已加入生词本'
        : '📦 已保存（离线，联网后自动同步）');
    } catch (e) {
      showToast('❌ 保存失败: ' + e.message);
    }
  }

  function createFlashcard(shadow) {
    // 如果有卡片，直接取翻译结果
    if (shadow) {
      const translationText = shadow.querySelector('.translation-text')?.textContent || '';
      chrome.runtime.sendMessage({
        action: 'saveFlashcard',
        original: selectedText,
        translation: translationText
      }).then(result => {
        showToast(result.synced ? '✅ 已加入生词本' : '📦 已保存');
      }).catch(e => {
        showToast('❌ 保存失败');
      });
    } else {
      handleTriggerFlashcard();
    }
  }

  function copyTranslation(shadow) {
    const text = shadow.querySelector('.translation-text')?.textContent || '';
    navigator.clipboard.writeText(text).then(() => {
      showToast('✅ 已复制');
    }).catch(() => {
      showToast('❌ 复制失败');
    });
  }

  function handleTranslateProgress(msg) {
    // 整页翻译进度（由 popup 显示，content 不做 UI）
  }

  // ==================== Toast ====================

  function showToast(message) {
    const existing = document.getElementById('zt-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'zt-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
      background:#333; color:#fff; padding:10px 24px; border-radius:8px;
      font-size:13px; z-index:2147483647; box-shadow:0 4px 12px rgba(0,0,0,0.4);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif;
    `;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 2500);
  }

  // ==================== 整页翻译 ====================

  async function translateFullPage() {
    if (state.fullPageActive) return;
    state.fullPageActive = true;

    // 提取所有段落文本节点
    const paragraphs = [];
    const textNodes = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // 跳过特殊元素
          const parent = node.parentElement;
          const tag = parent?.tagName?.toLowerCase();
          if (['script', 'style', 'pre', 'code', 'svg', 'noscript'].includes(tag)) {
            return NodeFilter.FILTER_REJECT;
          }
          // 跳过已有译文节点
          if (parent?.classList?.contains('zt-trans')) {
            return NodeFilter.FILTER_REJECT;
          }
          // 跳过空白
          if (!node.textContent.trim()) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.textContent.trim();
      if (text.length > 10) { // 只翻译有意义的段落
        textNodes.push(node);
        paragraphs.push(text);
      }
    }

    if (paragraphs.length === 0) {
      showToast('未找到可翻译的文本');
      state.fullPageActive = false;
      return;
    }

    showToast(`正在翻译 ${paragraphs.length} 个段落...`);

    try {
      const resp = await chrome.runtime.sendMessage({
        action: 'translatePage',
        texts: paragraphs,
        sourceLang: 'auto',
        targetLang: state.targetLang
      });

      if (!resp.success) throw new Error(resp.error);

      // 注入译文
      for (let i = 0; i < textNodes.length; i++) {
        const node = textNodes[i];
        const translation = resp.data[i];
        if (translation && !translation.error && translation.text) {
          const transP = document.createElement('p');
          transP.className = 'zt-trans';
          transP.style.cssText = 'color:#666;border-left:3px solid #4a9eff;padding-left:12px;margin:4px 0 8px 0;font-size:0.95em;line-height:1.6;';
          transP.textContent = translation.text;

          const parent = node.parentElement;
          // 找到包含此文本节点的块级祖先
          let insertAfter = parent;
          while (insertAfter && insertAfter.tagName !== 'P' && insertAfter.tagName !== 'DIV' && insertAfter.tagName !== 'LI' && insertAfter.tagName !== 'TD' && insertAfter !== document.body) {
            insertAfter = insertAfter.parentElement;
          }
          if (insertAfter && insertAfter !== document.body) {
            insertAfter.after(transP);
          }
        }
      }

      showToast(`✅ 翻译完成 (${paragraphs.length} 段)`);
    } catch (e) {
      showToast('❌ 整页翻译失败: ' + e.message);
      state.fullPageActive = false;
    }
  }

  /**
   * 内联翻译：在选中文本所在的块级元素下方插入译文
   * 样式与整页翻译一致（蓝色左边框 + 灰色文字）
   */
  function injectInlineTranslation(translationText, engineId) {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    try {
      const range = selection.getRangeAt(0);
      // 向上查找块级父元素
      let parent = range.commonAncestorContainer;
      while (parent && parent.nodeType !== 1) parent = parent.parentElement;
      if (!parent || parent === document.body || parent === document.documentElement) return;

      // 找最近的块级祖先（p, div, li, td, h1-h6 等）
      let block = parent;
      const blockTags = new Set(['P', 'DIV', 'LI', 'TD', 'TH', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'SECTION', 'ARTICLE']);
      while (block && !blockTags.has(block.tagName) && block !== document.body) {
        block = block.parentElement;
      }
      if (!block || block === document.body) {
        // fallback: 直接插在 parent 后面
        block = parent;
      }

      // 移除同一选区的旧译文
      const existing = block.parentElement?.querySelector('.zt-inline-trans[data-selector="true"]');
      if (existing) existing.remove();

      // 创建译文元素
      const transEl = document.createElement('div');
      transEl.className = 'zt-trans zt-inline-trans';
      transEl.setAttribute('data-selector', 'true');
      transEl.style.cssText = 'color:#888;border-left:3px solid #4a9eff;padding:6px 12px;margin:4px 0 10px 0;font-size:0.95em;line-height:1.7;background:rgba(74,158,255,0.04);border-radius:0 4px 4px 0;';
      transEl.textContent = translationText;

      // 插入到块元素后面
      block.insertAdjacentElement('afterend', transEl);
    } catch (e) {
      // 静默失败，内联翻译只是辅助功能
      console.warn('[Inline Translation] Failed:', e.message);
    }
  }

  function restoreFullPage() {
    // 移除整页翻译 (.zt-trans) 和划词内联翻译 (.zt-inline-trans)
    document.querySelectorAll('.zt-trans').forEach(el => el.remove());
    state.fullPageActive = false;
    showToast('✅ 已还原原文');
  }

  // ==================== 启动 ====================

  init();
})();
