/**
 * SmartTranslate Content Script — 最小可用版
 * 核心功能：划词翻译 + 整页翻译 + Alt+A 闪卡
 */
(function () {
  'use strict';

  console.log('[SmartTranslate] Content script loaded on:', location.hostname);

  // ========== 状态 ==========
  let selectedText = '';
  let selectionRect = null;
  let iconEl = null;
  let cardEl = null;
  let inlineEl = null;    // inline 模式下的译文元素
  let highlightEls = [];  // inline 模式下的原文高亮
  let settings = {
    targetLang: 'zh-CN', style: 'explain', selectionEnabled: true,
    altAEnabled: true, activeEngineId: 'microsoft',
    translateMode: 'card' // 'card' | 'inline'
  };

  // ========== 初始化 ==========
  try {
    chrome.runtime.sendMessage({ action: 'getSettings' }, (resp) => {
      if (resp?.success && resp.data) {
        Object.assign(settings, resp.data);
      }
    });
  } catch (e) {}

  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('keydown', onKeyDown);
  chrome.runtime.onMessage.addListener(handleMessage);

  // ========== 划词翻译 ==========
  let _lastMouseUp = 0;
  function onMouseUp(e) {
    const now = Date.now();
    if (now - _lastMouseUp < 200) return; // 防止双击/重复触发
    _lastMouseUp = now;
    setTimeout(() => {
      try {
        if (!settings.selectionEnabled) return;
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) { dismissAll(); return; }
        const text = sel.toString().trim();
        if (!text || text.length > 5000) { dismissAll(); return; }
        // 点击图标/卡片内部不处理
        if (e.target.closest('#zt-icon, #zt-card')) return;

        selectedText = text;
        const range = sel.getRangeAt(0);
        const rects = range.getClientRects();
        selectionRect = rects.length > 0 ? rects[rects.length - 1] : range.getBoundingClientRect();

        dismissAll();
        showIcon();
      } catch (err) { console.warn('[SmartTranslate] mouseup error:', err); }
    }, 80);
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') { dismissAll(); }
    if (e.altKey && (e.key === 'a' || e.key === 'A') && settings.altAEnabled && selectedText) {
      e.preventDefault();
      saveFlashcard();
    }
  }

  function handleMessage(msg, sender, sendResponse) {
    try {
      if (msg.action === 'callFullPageTranslate') { translateFullPage(); sendResponse({ ok: true }); }
      else if (msg.action === 'restoreFullPage') { restoreFullPage(); sendResponse({ ok: true }); }
      else if (msg.action === 'settingsUpdated') {
        chrome.runtime.sendMessage({ action: 'getSettings' }, (resp) => {
          if (resp?.success && resp.data) Object.assign(settings, resp.data);
        });
        sendResponse({ ok: true });
      } else { sendResponse({ ok: true }); }
    } catch (e) { sendResponse({ ok: false, error: e.message }); }
    return false;
  }

  // ========== 图标 ==========
  function showIcon() {
    dismissAll();
    iconEl = document.createElement('div');
    iconEl.id = 'zt-icon';
    iconEl.innerHTML = `
      <style>
        #zt-icon{position:fixed;z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif}
        .zt-bar{display:flex;align-items:center;gap:6px;background:#1e1e2e;border:1px solid #4a9eff;border-radius:22px;padding:5px 8px;box-shadow:0 4px 20px rgba(0,0,0,0.5)}
        .zt-tr-btn{width:30px;height:30px;background:#4a9eff;border:none;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;color:#fff;padding:0}
        .zt-tr-btn:hover{background:#3a8eef}
        .zt-cls-btn{background:none;border:none;color:#888;cursor:pointer;font-size:18px;padding:0 4px;line-height:1}
        .zt-cls-btn:hover{color:#ff6b6b}
      </style>
      <div class="zt-bar">
        <button class="zt-tr-btn" title="翻译">🌐</button>
        <button class="zt-cls-btn" title="关闭">✕</button>
      </div>`;
    iconEl.querySelector('.zt-tr-btn').onclick = (e) => { e.stopPropagation(); showCard(); };
    iconEl.querySelector('.zt-cls-btn').onclick = (e) => { e.stopPropagation(); dismissAll(); };
    document.body.appendChild(iconEl);
    positionIcon();
  }

  function positionIcon() {
    if (!iconEl || !selectionRect) return;
    let top = selectionRect.bottom + 8, left = selectionRect.right + 8;
    if (top + 40 > window.innerHeight) top = selectionRect.top - 40;
    if (left + 140 > window.innerWidth) left = window.innerWidth - 150;
    if (top < 8) top = 8; if (left < 8) left = 8;
    iconEl.style.top = top + 'px';
    iconEl.style.left = left + 'px';
  }

  // ========== 翻译卡片 / 内联模式 ==========
  function showCard() {
    if (cardEl || inlineEl) return;
    dismissIcon();
    if (settings.translateMode === 'inline') {
      showInline();
    } else {
      showCardPopup();
    }
  }

  function showCardPopup() {
    if (cardEl) return;
    cardEl = document.createElement('div');
    cardEl.id = 'zt-card';
    cardEl.innerHTML = `
      <style>
        #zt-card{position:fixed;z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif}
        .zt-card-inner{background:#1e1e2e;border:1px solid #3a3a50;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.5);max-width:420px;max-height:520px;overflow-y:auto;color:#e0e0e0;font-size:14px}
        .zt-card-hd{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid #3a3a50;font-size:12px;color:#888}
        .zt-card-bd{padding:14px;min-height:60px;line-height:1.7}
        .zt-card-ft{display:none;gap:8px;padding:8px 14px 12px;border-top:1px solid #3a3a50}
        .zt-card-ft button{padding:6px 12px;border-radius:6px;border:1px solid #3a3a50;background:#252540;color:#e0e0e0;cursor:pointer;font-size:12px}
        .zt-card-ft button:hover{border-color:#4a9eff;color:#4a9eff}
        .zt-loading{text-align:center;padding:30px;color:#888}
        .zt-loading::after{content:'';display:inline-block;width:20px;height:20px;border:3px solid #3a3a50;border-top-color:#4a9eff;border-radius:50%;animation:zt-spin 0.8s linear infinite}
        @keyframes zt-spin{to{transform:rotate(360deg)}}
        .zt-err{color:#ff6b6b;text-align:center;padding:14px}
        .zt-err a{color:#4a9eff;cursor:pointer}
      </style>
      <div class="zt-card-inner">
        <div class="zt-card-hd">
          <span>检测中...</span><span>→ ${settings.targetLang}</span>
          <span style="background:#4a9eff;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px">${settings.style==='explain'?'释义':'直译'}</span>
          <button style="background:none;border:none;color:#888;cursor:pointer;font-size:16px;margin-left:auto" title="关闭">✕</button>
        </div>
        <div class="zt-card-bd"><div class="zt-loading"></div></div>
        <div class="zt-card-ft">
          <button class="zt-copy">📋 复制</button>
          <button class="zt-star">⭐ 生词本</button>
          <button class="zt-close">✕ 关闭</button>
        </div>
      </div>`;

    // 定位
    let top, left;
    if (selectionRect && selectionRect.width > 0) {
      top = selectionRect.bottom + 40; left = selectionRect.right + 8;
    } else {
      top = Math.max(60, window.innerHeight * 0.25); left = Math.max(8, (window.innerWidth - 420) / 2);
    }
    if (top + 500 > window.innerHeight) top = Math.max(8, selectionRect ? selectionRect.top - 500 : window.innerHeight * 0.15);
    if (left + 420 > window.innerWidth) left = window.innerWidth - 428;
    if (top < 8) top = 8; if (left < 8) left = 8;
    cardEl.style.top = top + 'px';
    cardEl.style.left = left + 'px';

    // 按钮事件
    cardEl.querySelector('.zt-card-hd button').onclick = dismissAll;
    cardEl.querySelector('.zt-close').onclick = dismissAll;
    cardEl.querySelector('.zt-copy').onclick = () => {
      const t = cardEl.querySelector('.zt-card-bd').textContent.trim();
      navigator.clipboard.writeText(t).then(() => toast('✅ 已复制'));
    };
    cardEl.querySelector('.zt-star').onclick = saveFlashcard;

    document.body.appendChild(cardEl);
    doTranslate();
  }

  async function doTranslate() {
    const bd = cardEl.querySelector('.zt-card-bd');
    const hd = cardEl.querySelector('.zt-card-hd span:first-child');
    try {
      const resp = await chrome.runtime.sendMessage({
        action: 'translate', text: selectedText, sourceLang: 'auto', targetLang: settings.targetLang
      });
      if (!resp.success) throw new Error(resp.error);
      const t = resp.data.translations[0];
      hd.textContent = resp.data.detectedLang || 'auto';
      bd.textContent = t.text;
      cardEl.querySelector('.zt-card-ft').style.display = 'flex';

      // 写入历史
      chrome.runtime.sendMessage({
        action: 'saveHistory', original: selectedText, translation: t.text,
        sourceLang: resp.data.detectedLang || 'auto', targetLang: settings.targetLang,
        engineId: t.engineId, pageUrl: location.href
      }).catch(() => {});
    } catch (e) {
      bd.innerHTML = `<div class="zt-err">翻译失败: ${e.message}<br><a>🔄 重试</a></div>`;
      bd.querySelector('a').onclick = () => { bd.innerHTML = '<div class="zt-loading"></div>'; doTranslate(); };
    }
  }

  function dismissAll() { dismissIcon(); dismissCard(); dismissInline(); }
  function dismissIcon() { if (iconEl) { iconEl.remove(); iconEl = null; } }
  function dismissCard() { if (cardEl) { cardEl.remove(); cardEl = null; } }
  function dismissInline() {
    if (inlineEl) { inlineEl.remove(); inlineEl = null; }
    highlightEls.forEach(el => { el.style.backgroundColor = ''; el.style.borderRadius = ''; el.style.padding = ''; });
    highlightEls = [];
  }

  /** 内联模式：高亮原文 + 译文插入下方 */
  function showInline() {
    if (inlineEl) return;
    // 高亮选中的文本范围
    highlightSelection();
    // 创建内联译文容器
    inlineEl = document.createElement('div');
    inlineEl.id = 'zt-inline';
    inlineEl.style.cssText = 'color:#888;border-left:3px solid #4a9eff;padding:8px 14px;margin:6px 0 12px 0;font-size:0.9em;line-height:1.7;background:rgba(74,158,255,0.06);border-radius:0 6px 6px 0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif';
    inlineEl.textContent = '⏳ 翻译中...';

    // 插入到选区下方
    if (selectionRect) {
      const range = window.getSelection().getRangeAt(0);
      let insertAfter = range.endContainer;
      while (insertAfter && insertAfter.nodeType === 3) insertAfter = insertAfter.parentElement;
      if (insertAfter) {
        insertAfter.insertAdjacentElement('afterend', inlineEl);
        doTranslateInline();
        return;
      }
    }
    document.body.appendChild(inlineEl);
    doTranslateInline();
  }

  function highlightSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    // 对选区中的每个文本节点包裹高亮 span
    const spans = [];
    const textNodes = [];
    const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (range.intersectsNode(walker.currentNode)) textNodes.push(walker.currentNode);
    }
    for (const node of textNodes) {
      const start = node === range.startContainer ? range.startOffset : 0;
      const end = node === range.endContainer ? range.endOffset : node.textContent.length;
      if (start === end) continue;
      const span = document.createElement('span');
      span.style.cssText = 'background:#fff3b0;border-radius:2px;padding:1px 0';
      const before = node.textContent.slice(0, start);
      const highlighted = node.textContent.slice(start, end);
      const after = node.textContent.slice(end);
      const frag = document.createDocumentFragment();
      if (before) frag.appendChild(document.createTextNode(before));
      span.textContent = highlighted;
      frag.appendChild(span);
      if (after) frag.appendChild(document.createTextNode(after));
      node.parentNode.replaceChild(frag, node);
      spans.push(span);
    }
    highlightEls = spans;
  }

  async function doTranslateInline() {
    if (!inlineEl) return;
    try {
      const resp = await chrome.runtime.sendMessage({
        action: 'translate', text: selectedText, sourceLang: 'auto', targetLang: settings.targetLang
      });
      if (!resp.success) throw new Error(resp.error);
      const t = resp.data.translations[0];
      inlineEl.innerHTML = `<div style="font-size:0.85em;color:#999;margin-bottom:4px">🌐 ${resp.data.detectedLang || 'auto'} → ${settings.targetLang} · ${t.engineId}</div>${escapeHtml(t.text)}`;

      chrome.runtime.sendMessage({
        action: 'saveHistory', original: selectedText, translation: t.text,
        sourceLang: resp.data.detectedLang || 'auto', targetLang: settings.targetLang,
        engineId: t.engineId, pageUrl: location.href
      }).catch(() => {});
    } catch (e) {
      inlineEl.innerHTML = `<span style="color:#ff6b6b">翻译失败: ${e.message}</span> <a style="color:#4a9eff;cursor:pointer">🔄 重试</a>`;
      inlineEl.querySelector('a').onclick = () => { inlineEl.textContent = '⏳ 翻译中...'; doTranslateInline(); };
    }
  }

  function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  // ========== 整页翻译 ==========
  async function translateFullPage() {
    const existing = document.querySelectorAll('.zt-trans-page');
    if (existing.length > 0) { toast('⚠ 已翻译，请先还原'); return; }

    // 找主要内容区的块级文本（只取叶子节点，排除包含其他匹配元素的父节点）
    const container = document.querySelector('main, article, [role="main"], .content, #content, #main') || document.body;
    const TAG_SEL = 'p, li, h1, h2, h3, h4, h5, h6, td, th, blockquote, dt, dd, figcaption';
    const allElements = container.querySelectorAll(TAG_SEL);
    const seen = new Set();
    const blocks = [];

    for (const el of allElements) {
      if (el.closest('nav, footer, .nav, .navbar, .menu, .sidebar, .footer, .header, [role="navigation"], script, style, .zt-trans-page')) continue;
      if (getComputedStyle(el).display === 'none') continue;
      // 排除包含其他匹配元素的父节点（只取叶子块级元素，避免嵌套重复）
      if (el.querySelector(TAG_SEL)) continue;
      const t = el.textContent.trim();
      if (t.length >= 3 && !seen.has(t)) { seen.add(t); blocks.push(el); }
    }

    if (blocks.length === 0) { toast('⚠ 未找到可翻译段落'); return; }

    const texts = blocks.map(b => b.textContent.trim());
    toast(`⏳ 翻译中 (${texts.length} 段)...`);

    // 分批
    const BATCH = 6;
    let results = [];
    for (let i = 0; i < texts.length; i += BATCH) {
      const batch = texts.slice(i, i + BATCH);
      try {
        const resp = await chrome.runtime.sendMessage({
          action: 'translatePage', texts: batch, sourceLang: 'auto', targetLang: settings.targetLang
        });
        if (resp.success && resp.data) results.push(...resp.data);
        else results.push(...batch.map(() => ({ error: 'failed' })));
      } catch (e) {
        results.push(...batch.map(() => ({ error: e.message })));
      }
    }

    let ok = 0;
    for (let i = 0; i < blocks.length; i++) {
      const r = results[i];
      if (r && !r.error && r.text) {
        const p = document.createElement('p');
        p.className = 'zt-trans-page';
        p.style.cssText = 'color:#888;border-left:3px solid #4a9eff;padding:6px 12px;margin:2px 0 8px;font-size:0.9em;line-height:1.7';
        p.textContent = r.text;
        blocks[i].insertAdjacentElement('afterend', p);
        ok++;
      }
    }
    toast(`✅ 翻译完成 (${ok}/${texts.length})`);
  }

  function restoreFullPage() {
    document.querySelectorAll('.zt-trans-page').forEach(el => el.remove());
    toast('✅ 已还原');
  }

  // ========== 闪卡 ==========
  async function saveFlashcard() {
    try {
      const resp = await chrome.runtime.sendMessage({
        action: 'translate', text: selectedText, sourceLang: 'auto', targetLang: 'zh-CN'
      });
      let translation = '';
      if (resp.success && resp.data?.translations?.[0]) translation = resp.data.translations[0].text;
      const r = await chrome.runtime.sendMessage({
        action: 'saveFlashcard', original: selectedText, translation
      });
      toast(r.synced ? '✅ 已加入生词本' : '📦 已保存(离线)');
    } catch (e) { toast('❌ 保存失败'); }
  }

  // ========== Toast ==========
  function toast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:10px 24px;border-radius:8px;font-size:14px;z-index:2147483647;box-shadow:0 4px 16px rgba(0,0,0,0.5);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  // ========== 公开 API ==========
  window.__ztTranslator = { translateFullPage, restoreFullPage };
  console.log('[SmartTranslate] Ready ✅');
})();
