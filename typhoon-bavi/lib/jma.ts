// 适配日本气象厅热带气旋公报数据为统一监控结构
// 数据源: https://www.data.jma.go.jp/multi/data/VPTW60/<id>_<lang>.json
// 巴威 BAVI (2609) 当前 id = 61
// 缓存策略: 5 分钟内存缓存 + 短期过期缓存(保留最后一次成功数据)

export type StormId = "61"; // 第一版只监控巴威
export const STORM_ID: StormId = "61";
export const STORM_NAME_ZH = "巴威";
export const STORM_NAME_EN = "BAVI";
export const STORM_NUMBER = "2609";
export const STORM_SEQ_ZH = "2026 年第 09 号台风";

export const JMA_BASE =
  "https://www.data.jma.go.jp/multi/data/VPTW60";

export type Lang = "cn_zs" | "cn_zt" | "en";
export const DEFAULT_LANG: Lang = "cn_zs";

// 原始 JMA 字段
export type RawJma = {
  reportDateTime: string; // "2026/07/13 15:45" JST
  targetDateTime: string; // "2026/07/13 15:00" JST
  targetDuration: string; // "PT120H"
  name: string;
  number: string;
  remark: string;
  meteorologicalInfos: RawInfo[];
};

export type RawInfo = {
  dateTime: string;
  classPart: {
    typhoonClass: string; // TY/STS/TS/TD/LOW/Hurricane
    typhoonClassName: string;
    areaClass?: string | null;
    intensityAndTyphoonClass: string;
  };
  centerPart: {
    coordinateLat?: string | null; // "34.1N"
    coordinateLon?: string | null; // "118.2E"
    probabilityCircle?: {
      basePointLat?: string | null;
      basePointLon?: string | null;
      axis?: { direction: string; radiusNm?: string; radiusKm?: string } | null;
    } | null;
    direction?: string | null;
    speedKnot?: string | null;
    speedKmH?: string | null;
    pressure?: string | null;
  };
  windPart?: {
    windSpeedKnot?: string;
    windSpeedKnotCondition?: string;
    windSpeedMS?: string;
    windSpeedMSCondition?: string;
    windGustSpeedKnot?: string;
    windGustSpeedMS?: string;
  };
  warningAreaPart50?: { direction: string; radiusNm?: string; radiusKm?: string }[] | null;
  warningAreaPart30?: { direction: string; radiusNm?: string; radiusKm?: string }[] | null;
};

// 坐标解析: "34.1N" / "118.2E" -> 数字
export function parseCoord(
  lat: string | null | undefined,
  lon: string | null | undefined
): { lat: number; lon: number } | null {
  if (!lat || !lon) return null;
  const latN = parseCoordOne(lat);
  const lonN = parseCoordOne(lon);
  if (latN == null || lonN == null) return null;
  return { lat: latN, lon: lonN };
}

function parseCoordOne(s: string): number | null {
  // 例如 "34.1N" "118.2E" "10.8N" "0.5S" "1234.5E"
  const m = /^(-?\d+(?:\.\d+)?)([NSEW])$/i.exec(s.trim());
  if (!m) return null;
  const v = parseFloat(m[1]);
  const dir = m[2].toUpperCase();
  if (Number.isNaN(v)) return null;
  if (dir === "S" || dir === "W") return -v;
  return v;
}

// JMA 时间字符串 (JST) -> UTC ISO
export function jmaTimeToUtcIso(s: string | null | undefined): string | null {
  if (!s) return null;
  // "2026/07/13 15:00" 是 JST
  const m = /^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  // 构造 JST 时间为 UTC+9
  const utcMs =
    Date.UTC(+y, +mo - 1, +d, +h - 9, +mi, 0, 0);
  return new Date(utcMs).toISOString();
}

// 中文强度标签(展示)
export function classNameZh(cls: string): string {
  switch (cls) {
    case "TY":
      return "台风";
    case "STS":
      return "强热带风暴";
    case "TS":
      return "热带风暴";
    case "TD":
      return "热带低压";
    case "LOW":
      return "温带气旋 / 低压";
    case "Hurricane":
      return "飓风";
    case "Tropical Storm":
      return "热带风暴";
    case "Tropical Cyclone":
      return "热带气旋";
    default:
      return cls;
  }
}

// 强度(中国气象局标准) -> 风力等级近似
// 中心附近最大风速 m/s 映射 (蒲福 0-17)
// 仅做展示, 实际风力等级请以官方公报为准
export function beaufortFromMs(ms: number | null): number | null {
  if (ms == null || Number.isNaN(ms)) return null;
  if (ms < 0.3) return 0;
  if (ms < 1.6) return 1;
  if (ms < 3.4) return 2;
  if (ms < 5.5) return 3;
  if (ms < 8.0) return 4;
  if (ms < 10.8) return 5;
  if (ms < 13.9) return 6;
  if (ms < 17.2) return 7;
  if (ms < 20.8) return 8;
  if (ms < 24.5) return 9;
  if (ms < 28.5) return 10;
  if (ms < 32.7) return 11;
  if (ms < 37.0) return 12;
  if (ms < 41.5) return 13;
  if (ms < 46.2) return 14;
  if (ms < 51.0) return 15;
  if (ms < 56.1) return 16;
  return 17;
}

export function toNumber(s: string | null | undefined): number | null {
  if (s == null) return null;
  const t = String(s).trim();
  if (!t) return null;
  const n = parseFloat(t);
  return Number.isNaN(n) ? null : n;
}

// 解析单个 info -> 标准化点
export type NormalizedPoint = {
  timeUtc: string; // ISO UTC
  timeJst: string; // "2026/07/13 15:00"
  type: "current" | "forecast";
  // 中心点: 第一个 (实况) 直接给出, 后续 (预报) 通过 probabilityCircle.basePoint + probabilityCircle.radius 表示概率圈中心
  lat: number | null;
  lon: number | null;
  probRadiusKm: number | null; // 概率圈半径 (km)
  probRadiusNm: number | null;
  direction: string | null; // 移向
  speedKt: number | null;
  speedKmh: number | null;
  pressureHpa: number | null;
  windKt: number | null;
  windMs: number | null;
  gustKt: number | null;
  gustMs: number | null;
  classCode: string;
  className: string;
  // 风圈 (暴风 50kt / 强风 30kt)
  windRadii: WindRadius[];
  // 与起始时间差 (小时, 0 表示当前实况)
  offsetHours: number;
};

export type WindRadius = {
  type: "50kt" | "30kt";
  direction: string; // N/NNE/NE/.../ALL
  radiusKm: number | null;
  radiusNm: number | null;
};

export function parseRadius(w: { direction: string; radiusNm?: string; radiusKm?: string }[] | null | undefined): WindRadius[] {
  if (!w) return [];
  return w
    .map((it) => ({
      type: (["50kt", "30kt"] as const)[
        // 父级会指定 type
        0
      ],
      direction: it.direction || "ALL",
      radiusKm: toNumber(it.radiusKm),
      radiusNm: toNumber(it.radiusNm),
    }))
    .filter((x) => x.radiusKm != null || x.radiusNm != null);
}

export type ApiResponse = {
  ok: boolean;
  stale?: boolean;
  error?: string;
  fetchedAt: string; // 服务端拉取时间 (UTC ISO)
  source: {
    jma: string;
    issuedAt: string; // JMA 报告发布时间
    targetAt: string; // 报告目标时间
    targetDurationH: number;
  };
  storm: {
    id: string;
    name: string;
    nameZh: string;
    number: string;
    seqZh: string;
    remark: string;
  };
  current: NormalizedPoint | null;
  forecast: NormalizedPoint[];
  windRadii: WindRadius[]; // 当前的 50kt/30kt 半径 (扁平)
};

export function normalize(raw: RawJma): ApiResponse {
  const infos = raw.meteorologicalInfos || [];
  const targetH = parseInt(
    (raw.targetDuration || "PT120H").replace(/[^0-9]/g, ""),
    10
  ) || 120;
  const issuedAtUtc = jmaTimeToUtcIso(raw.reportDateTime) || new Date().toISOString();
  const targetAtUtc = jmaTimeToUtcIso(raw.targetDateTime) || new Date().toISOString();

  const points: NormalizedPoint[] = infos.map((info, i) => {
    const cp = info.centerPart || {};
    const wp = info.windPart || {};
    const cls = info.classPart || ({} as RawInfo["classPart"]);

    // 中心: 实况直接给; 预报通过 probabilityCircle.basePoint
    let lat: number | null = null;
    let lon: number | null = null;
    let probRKm: number | null = null;
    let probRNm: number | null = null;
    if (i === 0) {
      const c = parseCoord(cp.coordinateLat, cp.coordinateLon);
      lat = c?.lat ?? null;
      lon = c?.lon ?? null;
    } else {
      const pc = cp.probabilityCircle || null;
      if (pc) {
        const c = parseCoord(pc.basePointLat, pc.basePointLon);
        lat = c?.lat ?? null;
        lon = c?.lon ?? null;
        const ax = pc.axis;
        if (ax) {
          probRKm = toNumber(ax.radiusKm);
          probRNm = toNumber(ax.radiusNm);
        }
      }
    }

    // 风圈
    const w50 = (info.warningAreaPart50 || [])
      .map((it) => ({ type: "50kt" as const, direction: it.direction || "ALL", radiusKm: toNumber(it.radiusKm), radiusNm: toNumber(it.radiusNm) }))
      .filter((x) => x.radiusKm != null || x.radiusNm != null);
    const w30 = (info.warningAreaPart30 || [])
      .map((it) => ({ type: "30kt" as const, direction: it.direction || "ALL", radiusKm: toNumber(it.radiusKm), radiusNm: toNumber(it.radiusNm) }))
      .filter((x) => x.radiusKm != null || x.radiusNm != null);
    const windRadii = [...w50, ...w30];

    const timeUtc = jmaTimeToUtcIso(info.dateTime) || new Date().toISOString();
    const offsetMs = new Date(timeUtc).getTime() - new Date(targetAtUtc).getTime();
    const offsetHours = Math.round(offsetMs / 3600000);

    return {
      timeUtc,
      timeJst: info.dateTime,
      type: i === 0 ? "current" : "forecast",
      lat,
      lon,
      probRadiusKm: probRKm,
      probRadiusNm: probRNm,
      direction: cp.direction ?? null,
      speedKt: toNumber(cp.speedKnot),
      speedKmh: toNumber(cp.speedKmH),
      pressureHpa: toNumber(cp.pressure),
      windKt: toNumber(wp.windSpeedKnot),
      windMs: toNumber(wp.windSpeedMS),
      gustKt: toNumber(wp.windGustSpeedKnot),
      gustMs: toNumber(wp.windGustSpeedMS),
      classCode: cls.typhoonClass,
      className: classNameZh(cls.typhoonClass),
      windRadii,
      offsetHours,
    };
  });

  const current = points[0] || null;
  const forecast = points.slice(1);

  // 展开当前风圈, 供前端单独显示
  const windRadii = current ? current.windRadii : [];

  return {
    ok: true,
    stale: false,
    fetchedAt: new Date().toISOString(),
    source: {
      jma: `${JMA_BASE}/${STORM_ID}_<lang>.json`,
      issuedAt: issuedAtUtc,
      targetAt: targetAtUtc,
      targetDurationH: targetH,
    },
    storm: {
      id: STORM_ID,
      name: raw.name || STORM_NAME_EN,
      nameZh: STORM_NAME_ZH,
      number: raw.number || STORM_NUMBER,
      seqZh: STORM_SEQ_ZH,
      remark: raw.remark || "",
    },
    current,
    forecast,
    windRadii,
  };
}
