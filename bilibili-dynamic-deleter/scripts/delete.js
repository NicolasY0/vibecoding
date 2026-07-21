// B站动态批量删除 v4 — 双 API 回退版
// F12 → Console 粘贴回车，刷新页面终止

(async () => {
  const csrf = document.cookie.split('; ').find(r => r.startsWith('bili_jct='))?.split('=')[1];
  if (!csrf) { console.error('❌ 未登录'); return; }
  const uid = window.location.pathname.split('/')[1];

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
    if (text.startsWith('<!DOCTYPE')) throw new Error('HTML_RESPONSE');  // 404 page
    return JSON.parse(text);
  }

  // 尝试获取动态列表 — 新 API 优先，旧 API 回退
  async function listDynamics(offset) {
    // 新 API
    try {
      const url = `https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?host_mid=${uid}&offset=${offset || ''}`;
      const resp = await api(url);
      if (resp?.data?.items) {
        return {
          items: resp.data.items.map(item => ({ id_str: item.id_str, type: item.type })),
          has_more: resp.data.has_more || false,
          offset: resp.data.offset || ''
        };
      }
    } catch (e) { console.warn('新 API 失败，尝试旧 API...'); }

    // 旧 API 回退
    const url = `https://api.vc.bilibili.com/dynamic_svr/v1/dynamic_svr/space_history?visitor_uid=${uid}&host_uid=${uid}&offset_dynamic_id=${offset || 0}`;
    const resp = await api(url);
    return {
      items: (resp?.data?.cards || []).map(card => ({ id_str: card.desc.dynamic_id_str, type: card.desc.type })),
      has_more: resp?.data?.has_more || false,
      offset: resp?.data?.cards?.length ? resp.data.cards[resp.data.cards.length - 1].desc.dynamic_id_str : offset
    };
  }

  let total = 0, offset = '', hasMore = true, speed = 60, rateHits = 0;

  while (hasMore) {
    let page;
    try {
      page = await listDynamics(offset);
    } catch (e) {
      if (e.message === 'RATE_LIMITED') { rateHits++; speed = Math.min(speed + 30, 500); await new Promise(r => setTimeout(r, rateHits * 2000)); continue; }
      if (e.message === 'IP_BANNED') { console.error('💀 IP 被封'); return; }
      console.error('获取列表失败:', e.message); break;
    }

    hasMore = page.has_more;
    offset = page.offset;
    if (!page.items?.length) break;

    console.log(`📋 ${page.items.length} 条 | 已删 ${total} | 速度 ${speed}ms`);

    for (const item of page.items) {
      try {
        const rm = await api('https://api.vc.bilibili.com/dynamic_svr/v1/dynamic_svr/rm_dynamic', {
          dynamic_id: item.id_str,
          csrf_token: csrf
        });
        if (rm.code === 0) { total++; rateHits = 0; if (speed > 60) speed = Math.max(60, speed - 5); }
        else if (rm.code === 500404) { console.log('  跳过已删除'); }
        else { console.warn('  删除失败 code:', rm.code, rm.message); }
      } catch (e) {
        if (e.message === 'RATE_LIMITED') { rateHits++; speed = Math.min(speed + 30, 500); await new Promise(r => setTimeout(r, 3000)); continue; }
        if (e.message === 'IP_BANNED') { console.error('💀 IP 被封'); return; }
        console.error('  删除异常:', e.message);
      }
      await new Promise(r => setTimeout(r, speed));
    }
  }

  console.log(`✅ 完成！共删除 ${total} 条`);
})();
