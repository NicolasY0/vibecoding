// 内存缓存: 5 分钟内复用, 过期保留最后一次成功数据
// SWR 风格, 避免上游短暂故障导致用户看不到任何数据

import {
  ApiResponse,
  DEFAULT_LANG,
  JMA_BASE,
  Lang,
  STORM_ID,
  normalize,
  type RawJma,
} from "./jma";

type CacheEntry = {
  value: ApiResponse | null;
  fetchedAt: number; // ms
  inflight?: Promise<ApiResponse>;
  lastError?: { message: string; at: string };
};

const FRESH_MS = 5 * 60 * 1000; // 5 分钟

// 导出 cache 引用, 供测试和调试使用
export const __cache = (() => {
  const g = globalThis as unknown as { __baviCache?: Map<string, CacheEntry> };
  if (!g.__baviCache) g.__baviCache = new Map();
  return g.__baviCache;
})();
const cache = __cache;

const TIMEOUT_MS = 10_000;

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "typhoon-bavi-monitor/0.1 (+JMA public data)" },
      signal: ctrl.signal,
      // Vercel 默认会缓存 fetch, 我们使用 no-store 自己控制
      cache: "no-store",
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function getTyphoonBavi(
  lang: Lang = DEFAULT_LANG
): Promise<ApiResponse> {
  const key = lang;
  const now = Date.now();
  let entry = cache.get(key);
  if (!entry) {
    entry = { value: null, fetchedAt: 0 };
    cache.set(key, entry);
  }

  // 1) 新鲜 & 健康: 直接返回
  if (entry.value && !entry.value.stale && now - entry.fetchedAt < FRESH_MS) {
    return entry.value;
  }

  // 2) 并发去重
  if (entry.inflight) {
    return entry.inflight;
  }

  const inflight = (async (): Promise<ApiResponse> => {
    const url = `${JMA_BASE}/${STORM_ID}_${lang}.json`;
    try {
      const res = await fetchWithTimeout(url, TIMEOUT_MS);
      if (!res.ok) {
        throw new Error(`JMA HTTP ${res.status}`);
      }
      const text = await res.text();
      let raw: RawJma;
      try {
        raw = JSON.parse(text) as RawJma;
      } catch (e) {
        throw new Error("JMA 返回非 JSON");
      }
      // 简单字段校验
      if (!raw || !Array.isArray(raw.meteorologicalInfos)) {
        throw new Error("JMA 缺少 meteorologicalInfos 字段");
      }
      const normalized = normalize(raw);
      // 写入 value (注意: 不要清掉 inflight 引用, 允许并发)
      entry!.value = normalized;
      entry!.fetchedAt = Date.now();
      entry!.lastError = undefined;
      return normalized;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const at = new Date().toISOString();
      // 保留最后一次成功数据
      if (entry!.value && !entry!.value.stale) {
        const stale: ApiResponse = {
          ...entry!.value,
          stale: true,
          error: `更新失败 / 数据可能已过期: ${message}`,
        };
        entry!.value = stale;
        // fetchedAt 保留原始时间, 让前端可以显示原始时间
        entry!.lastError = { message, at };
        return stale;
      }
      // 首次加载失败: 不展示虚假默认数值
      const empty: ApiResponse = {
        ok: false,
        stale: true,
        error: `首次加载失败: ${message}`,
        fetchedAt: new Date().toISOString(),
        source: {
          jma: `${JMA_BASE}/${STORM_ID}_<lang>.json`,
          issuedAt: "",
          targetAt: "",
          targetDurationH: 120,
        },
        storm: {
          id: STORM_ID,
          name: "BAVI",
          nameZh: "巴威",
          number: "2609",
          seqZh: "2026 年第 09 号台风",
          remark: "",
        },
        current: null,
        forecast: [],
        windRadii: [],
      };
      entry!.value = empty;
      entry!.fetchedAt = 0; // 永远算"过期", 下次还会尝试
      entry!.lastError = { message, at };
      return empty;
    } finally {
      entry!.inflight = undefined;
    }
  })();

  entry.inflight = inflight;
  return inflight;
}
