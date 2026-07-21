// B站动态批量删除 v5 — API 直驱 + 条件筛选
// 打开 https://space.bilibili.com/你的UID/dynamic → F12 → Console → 贴入回车
// 刷新页面即可终止

(async () => {
  // ══════════════════════════════════════
  // 🔧 配置区 — 按需修改
  // ══════════════════════════════════════

  const CONFIG = {
    // 要删除的动态类型（留空 = 全部）
    // 可选值: 1=转发 2=图文 8=视频 16=小视频 64=专栏 256=音乐 4200=直播
    // 填 ['all'] 或 [] 表示全部
    targetType: 'all',  // 改成 1 只删转发，改成 8 只删视频...

    // 保留点赞最高的 N 条（0 = 不保留）
    preserveTopLiked: 0,

    // 保留包含这些文字的动态（空数组 = 不保留）
    preserveKeywords: [],  // 如 ['抽奖', '福利', '转发']

    // 每秒大概删多少条（60 = 1条/60ms，B站限流时自动降速）
    baseSpeed: 60,
  };

  // ══════════════════════════════════════
  // 以下无需修改
  // ══════════════════════════════════════

  const csrf = document.cookie.split('; ').find(r => r.startsWith('bili_jct='))?.split('=')[1];
  if (!csrf) { console.error('❌ 未登录 B 站'); return; }
  const uid = window.location.pathname.split('/')[1];

  async function api(url, data) {
    const res = await fetch(url, {
      method: data ? 'POST' : 'GET', credentials: 'include',
      headers: data ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {},
      body: data ? Object.entries(data).map(([k,v]) => `${k}=${encodeURIComponent(v)}`).join('&') : undefined
    });
    if (res.status === 412) throw new Error('IP_BANNED');
    if (res.status === 429) throw new Error('RATE_LIMITED');
    const text = await res.text();
    if (text.startsWith('<!DOCTYPE')) throw new Error('HTML');
    return JSON.parse(text);
  }

  // 收集所有动态
  console.log('⏳ 正在获取动态列表...');
  let all = [], offset = '', hasMore = true;

  while (hasMore) {
    let resp;
    try {
      resp = await api(`https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?host_mid=${uid}${offset?'&offset='+offset:''}`);
      if (resp?.data?.items) {
        hasMore = resp.data.has_more; offset = resp.data.offset;
        for (const item of resp.data.items) {
          if (CONFIG.targetType === 'all' || Number(item.type) === CONFIG.targetType) {
            all.push({ id_str: item.id_str, likes: item.modules?.module_stat?.like?.count || 0, content: item.modules?.module_dynamic?.desc?.text || '' });
          }
        }
        continue;
      }
    } catch(e) {}

    resp = await api(`https://api.vc.bilibili.com/dynamic_svr/v1/dynamic_svr/space_history?visitor_uid=${uid}&host_uid=${uid}&offset_dynamic_id=${offset||0}`);
    const cards = resp?.data?.cards || [];
    hasMore = resp?.data?.has_more; offset = cards.length ? cards[cards.length-1].desc.dynamic_id_str : offset;
    for (const card of cards) {
      if (CONFIG.targetType === 'all' || Number(card.desc.type) === CONFIG.targetType) {
        let content = '';
        try { const c = JSON.parse(card.card); content = c?.item?.content || c?.item?.description || ''; } catch(e) {}
        all.push({ id_str: card.desc.dynamic_id_str, likes: card.desc.like || 0, content });
      }
    }
    console.log(`  扫描中... 已找到 ${all.length} 条`);
  }

  console.log(`📋 共找到 ${all.length} 条匹配动态`);

  // 应用保留规则
  let toDelete = [...all];
  const skipped = [];

  if (CONFIG.preserveTopLiked > 0) {
    const topIds = new Set(all.sort((a,b) => b.likes - a.likes).slice(0, CONFIG.preserveTopLiked).map(d => d.id_str));
    skipped.push(...toDelete.filter(d => topIds.has(d.id_str)));
    toDelete = toDelete.filter(d => !topIds.has(d.id_str));
  }

  if (CONFIG.preserveKeywords.length > 0) {
    skipped.push(...toDelete.filter(d => CONFIG.preserveKeywords.some(kw => d.content && d.content.includes(kw))));
    toDelete = toDelete.filter(d => !CONFIG.preserveKeywords.some(kw => d.content && d.content.includes(kw)));
  }

  if (skipped.length) console.log(`⏭ 跳过 ${skipped.length} 条（保留规则匹配）`);
  console.log(`🎯 将删除 ${toDelete.length} 条`);

  if (toDelete.length === 0) { console.log('✅ 无需删除'); return; }

  // 删除
  let deleted = 0, speed = CONFIG.baseSpeed, rateHits = 0;

  for (const item of toDelete) {
    try {
      const rm = await api('https://api.vc.bilibili.com/dynamic_svr/v1/dynamic_svr/rm_dynamic', { dynamic_id: item.id_str, csrf_token: csrf });
      if (rm.code === 0) { deleted++; rateHits = 0; if (speed > CONFIG.baseSpeed) speed = Math.max(CONFIG.baseSpeed, speed - 5); }
      else if (rm.code === 500404) { /* 已删 */ }
      else { console.warn('⚠️', rm.code, rm.message); }
    } catch (e) {
      if (e.message === 'RATE_LIMITED') { rateHits++; speed = Math.min(speed + 30, 500); await new Promise(r => setTimeout(r, 3000)); continue; }
      if (e.message === 'IP_BANNED') { console.error('💀 IP 被封'); return; }
    }
    if (deleted % 10 === 0) console.log(`🗑 ${deleted}/${toDelete.length} | ${speed}ms/条`);
    await new Promise(r => setTimeout(r, speed));
  }

  console.log(`✅ 完成！共删除 ${deleted} 条动态`);
})();
