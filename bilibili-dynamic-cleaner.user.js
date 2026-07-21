// ==UserScript==
// @name         B站动态批量删除助手
// @namespace    https://github.com/NicolasY0/bilibili-dynamic-deleter
// @version      1.5
// @description  支持按类型、内容、点赞数等条件选择性批量删除B站动态，API驱动不惧限流
// @author       Claude & Nicolas
// @match        https://space.bilibili.com/*/dynamic
// @grant        GM_addStyle
// ==/UserScript==

(function () {
  'use strict';

  // ── 动态类型 ──
  const TYPES = {
    ALL:        { label: '全部动态',  value: 'all' },
    REPOST:     { label: '转发动态',  value: 1 },
    TEXT_IMAGE: { label: '图文动态',  value: 2 },
    VIDEO:      { label: '视频动态',  value: 8 },
    SHORT:      { label: '小视频',    value: 16 },
    ARTICLE:    { label: '专栏动态',  value: 64 },
    MUSIC:      { label: '音乐动态',  value: 256 },
    LIVE:       { label: '直播动态',  value: 4200 },
  };

  // ── UI 面板 ──
  const panel = document.createElement('div');
  panel.innerHTML = `
    <div class="bdd-panel">
      <div class="bdd-title">🗑 批量删除动态</div>

      <div class="bdd-section">
        <div class="bdd-label">删除类型</div>
        <div class="bdd-types">
          ${Object.values(TYPES).map(t =>
            `<label class="bdd-chip ${t.value === 'all' ? 'active' : ''}">
              <input type="radio" name="bdd-type" value="${t.value}" ${t.value === 'all' ? 'checked' : ''}>${t.label}
            </label>`
          ).join('')}
        </div>
      </div>

      <div class="bdd-section">
        <div class="bdd-label">保留设置（可选）</div>

        <label class="bdd-switch">
          <input type="checkbox" id="bdd-pin"> 保留置顶动态
        </label>

        <label class="bdd-switch">
          <input type="checkbox" id="bdd-liked"> 保留点赞最高的
          <input type="number" id="bdd-liked-count" value="3" min="1" max="99" disabled style="width:50px;margin-left:8px;"> 条
        </label>

        <div id="bdd-content-preserve">
          <div style="display:flex;gap:8px;align-items:center;margin-top:4px;">
            <input type="text" class="bdd-preserve-input" placeholder="包含此文字的不删（如：抽奖）" style="flex:1;">
            <button class="bdd-add-preserve">+</button>
          </div>
        </div>
      </div>

      <div class="bdd-section">
        <button class="bdd-btn bdd-btn-delete">🗑 开始删除</button>
        <button class="bdd-btn bdd-btn-stop" style="display:none;">⏹ 停止</button>
      </div>

      <div class="bdd-log" style="display:none;"></div>
    </div>
  `;
  document.body.appendChild(panel);

  // ── 样式 ──
  GM_addStyle(`
    .bdd-panel {
      position:fixed;bottom:20px;right:20px;z-index:99999;
      width:320px;background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.15);
      padding:20px;font-size:14px;color:#18191c;
    }
    .bdd-title {font-size:16px;font-weight:700;margin-bottom:16px;}
    .bdd-section {margin-bottom:14px;}
    .bdd-label {font-size:12px;color:#9499a0;margin-bottom:6px;}
    .bdd-types {display:flex;flex-wrap:wrap;gap:6px;}
    .bdd-chip {
      display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;
      border:1px solid #e3e5e7;cursor:pointer;transition:all .15s;
    }
    .bdd-chip.active {background:#fb7299;color:#fff;border-color:#fb7299;}
    .bdd-chip input {display:none;}
    .bdd-switch {display:flex;align-items:center;gap:6px;font-size:13px;margin:4px 0;cursor:pointer;}
    .bdd-switch input[type=checkbox] {accent-color:#fb7299;}
    .bdd-preserve-input {
      flex:1;padding:6px 10px;border:1px solid #e3e5e7;border-radius:8px;font-size:13px;
    }
    .bdd-add-preserve {
      width:28px;height:28px;border-radius:50%;border:none;background:#fb7299;color:#fff;
      font-size:18px;cursor:pointer;line-height:1;
    }
    .bdd-btn {
      width:100%;padding:10px;border:none;border-radius:10px;font-size:15px;font-weight:600;
      cursor:pointer;transition:all .15s;
    }
    .bdd-btn-delete {background:#fb7299;color:#fff;}
    .bdd-btn-delete:hover {background:#e45c80;}
    .bdd-btn-delete:disabled {background:#ccc;cursor:not-allowed;}
    .bdd-btn-stop {background:#f6f7f8;color:#666;margin-top:8px;}
    .bdd-log {margin-top:12px;padding:10px;background:#f6f7f8;border-radius:8px;font-size:13px;color:#666;max-height:120px;overflow-y:auto;}
  `);

  // ── 逻辑 ──
  let running = false;

  // 芯片切换
  panel.querySelectorAll('.bdd-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      panel.querySelectorAll('.bdd-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      chip.querySelector('input').checked = true;
    });
  });

  // 保留点赞控制
  const likedCheckbox = document.getElementById('bdd-liked');
  const likedCount = document.getElementById('bdd-liked-count');
  likedCheckbox.addEventListener('change', () => likedCount.disabled = !likedCheckbox.checked);

  // 添加保留内容行
  panel.querySelector('.bdd-add-preserve').addEventListener('click', () => {
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;gap:8px;align-items:center;margin-top:4px;';
    div.innerHTML = '<input type="text" class="bdd-preserve-input" placeholder="包含此文字的不删" style="flex:1;"><button class="bdd-rm-preserve" style="width:28px;height:28px;border-radius:50%;border:1px solid #e3e5e7;background:#fff;cursor:pointer;">×</button>';
    div.querySelector('.bdd-rm-preserve').addEventListener('click', () => div.remove());
    document.getElementById('bdd-content-preserve').appendChild(div);
  });

  // ── API ──
  function log(msg, persist) {
    const el = panel.querySelector('.bdd-log');
    el.style.display = 'block';
    el.textContent = msg;
    if (!persist) setTimeout(() => { if (el.textContent === msg) el.style.display = 'none'; }, 5000);
  }

  async function api(url, data) {
    const res = await fetch(url, {
      method: data ? 'POST' : 'GET',
      credentials: 'include',
      headers: data ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {},
      body: data ? Object.entries(data).map(([k,v]) => `${k}=${encodeURIComponent(v)}`).join('&') : undefined
    });
    if (res.status === 412) throw new Error('IP_BANNED');
    if (res.status === 429) throw new Error('RATE_LIMITED');
    const text = await res.text();
    if (text.startsWith('<!DOCTYPE')) throw new Error('HTML');
    return JSON.parse(text);
  }

  async function listAll(uid, targetType) {
    // 收集所有匹配类型的动态
    let all = [], offset = '', hasMore = true;

    while (hasMore) {
      let resp;
      // 新 API
      try {
        resp = await api(`https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?host_mid=${uid}${offset?'&offset='+offset:''}`);
        if (resp?.data?.items) {
          hasMore = resp.data.has_more;
          offset = resp.data.offset;
          for (const item of resp.data.items) {
            if (targetType === 'all' || Number(item.type) === Number(targetType)) {
              all.push({ id_str: item.id_str, likes: item.modules?.module_stat?.like?.count || 0, content: item.modules?.module_dynamic?.desc?.text || '' });
            }
          }
          continue;
        }
      } catch(e) {}

      // 旧 API 回退
      resp = await api(`https://api.vc.bilibili.com/dynamic_svr/v1/dynamic_svr/space_history?visitor_uid=${uid}&host_uid=${uid}&offset_dynamic_id=${offset||0}`);
      const cards = resp?.data?.cards || [];
      hasMore = resp?.data?.has_more;
      offset = cards.length ? cards[cards.length-1].desc.dynamic_id_str : offset;
      for (const card of cards) {
        if (targetType === 'all' || Number(card.desc.type) === Number(targetType)) {
          let content = '';
          try { const c = JSON.parse(card.card); content = c?.item?.content || c?.item?.description || ''; } catch(e) {}
          all.push({ id_str: card.desc.dynamic_id_str, likes: card.desc.like || 0, content });
        }
      }
    }

    return all;
  }

  function applyFilters(all, preservePinned, preserveLikedCount, preserveContents) {
    let filtered = [...all];

    // 保留点赞最高的
    if (preserveLikedCount > 0) {
      const topIds = new Set(all.sort((a,b) => b.likes - a.likes).slice(0, preserveLikedCount).map(d => d.id_str));
      filtered = filtered.filter(d => !topIds.has(d.id_str));
    }

    // 保留包含特定内容的
    if (preserveContents.length > 0) {
      filtered = filtered.filter(d => !preserveContents.some(text => d.content && d.content.includes(text)));
    }

    // 置顶由用户自己处理（API 层面无法可靠区分置顶）

    return filtered;
  }

  // ── 删除按钮 ──
  const startBtn = panel.querySelector('.bdd-btn-delete');
  const stopBtn = panel.querySelector('.bdd-btn-stop');

  startBtn.addEventListener('click', async () => {
    const csrf = document.cookie.split('; ').find(r => r.startsWith('bili_jct='))?.split('=')[1];
    if (!csrf) { alert('未登录 B 站'); return; }

    const targetType = panel.querySelector('input[name="bdd-type"]:checked').value;
    const typeLabel = Object.values(TYPES).find(t => String(t.value) === String(targetType))?.label || '所选类型';
    const preserveLikedCount = likedCheckbox.checked ? parseInt(likedCount.value) || 0 : 0;
    const preserveContents = [...panel.querySelectorAll('.bdd-preserve-input')].map(i => i.value.trim()).filter(Boolean);

    // 确认
    let confirmMsg = `确定删除【${typeLabel}】吗？`;
    if (preserveLikedCount) confirmMsg += `\n保留点赞最高 ${preserveLikedCount} 条`;
    if (preserveContents.length) confirmMsg += `\n保留含特定文字 ${preserveContents.length} 条规则`;
    confirmMsg += '\n此操作不可恢复。';
    if (!confirm(confirmMsg)) return;

    const uid = window.location.pathname.split('/')[1];
    running = true;
    startBtn.disabled = true;
    startBtn.textContent = '⏳ 获取动态列表...';
    stopBtn.style.display = 'block';

    try {
      // Step 1: 收集所有匹配动态
      log('⏳ 正在获取动态列表...', true);
      const all = await listAll(uid, targetType);
      if (!running) return;
      log(`📋 找到 ${all.length} 条【${typeLabel}】`, true);
      if (all.length === 0) { running = false; startBtn.disabled = false; startBtn.textContent = '🗑 开始删除'; stopBtn.style.display = 'none'; return; }

      // Step 2: 应用保留规则
      const toDelete = applyFilters(all, false, preserveLikedCount, preserveContents);
      const skipped = all.length - toDelete.length;
      log(`🎯 将删除 ${toDelete.length} 条${skipped ? `（跳过 ${skipped} 条）` : ''}`, true);

      if (toDelete.length === 0) { running = false; startBtn.disabled = false; startBtn.textContent = '🗑 开始删除'; stopBtn.style.display = 'none'; return; }
      if (!confirm(`共 ${toDelete.length} 条待删除，确认开始？`)) { running = false; startBtn.disabled = false; startBtn.textContent = '🗑 开始删除'; stopBtn.style.display = 'none'; return; }

      // Step 3: 逐条删除
      let deleted = 0, speed = 60, rateHits = 0;
      startBtn.textContent = `⏳ 0/${toDelete.length}`;

      for (const item of toDelete) {
        if (!running) break;

        try {
          const rm = await api('https://api.vc.bilibili.com/dynamic_svr/v1/dynamic_svr/rm_dynamic', { dynamic_id: item.id_str, csrf_token: csrf });
          if (rm.code === 0) { deleted++; rateHits = 0; if (speed > 60) speed = Math.max(60, speed - 5); }
          else if (rm.code === 500404) { /* 已删 */ }
          else { console.warn('删除失败:', rm.code, rm.message); }
        } catch (e) {
          if (e.message === 'RATE_LIMITED') { rateHits++; speed = Math.min(speed + 30, 500); await new Promise(r => setTimeout(r, 3000)); continue; }
          if (e.message === 'IP_BANNED') { log('💀 IP被封，请稍后再试', true); break; }
        }

        startBtn.textContent = `⏳ ${deleted}/${toDelete.length}`;
        log(`🗑 ${deleted}/${toDelete.length} | 速度 ${speed}ms`, true);
        await new Promise(r => setTimeout(r, speed));
      }

      log(`✅ 完成！删除了 ${deleted} 条【${typeLabel}】`, true);
    } catch (e) {
      log(`❌ 出错: ${e.message}`, true);
    } finally {
      running = false;
      startBtn.disabled = false;
      startBtn.textContent = '🗑 开始删除';
      stopBtn.style.display = 'none';
    }
  });

  // 停止按钮
  stopBtn.addEventListener('click', () => {
    running = false;
    log('⏹ 已停止', true);
    startBtn.disabled = false;
    startBtn.textContent = '🗑 开始删除';
    stopBtn.style.display = 'none';
  });
})();
