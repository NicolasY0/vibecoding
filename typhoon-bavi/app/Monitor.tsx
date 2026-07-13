"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ApiResponse,
  NormalizedPoint,
  WindRadius,
} from "@/lib/jma";
import { beaufortFromMs } from "@/lib/jma";
import TyphoonMap from "./TyphoonMap";
import ShareButton from "./ShareButton";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 分钟

function formatJstTime(iso: string | null | undefined) {
  if (!iso) return "--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--";
  // 展示 JST (UTC+9)
  const jst = new Date(d.getTime() + 9 * 3600 * 1000);
  const Y = jst.getUTCFullYear();
  const M = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const D = String(jst.getUTCDate()).padStart(2, "0");
  const h = String(jst.getUTCHours()).padStart(2, "0");
  const m = String(jst.getUTCMinutes()).padStart(2, "0");
  return `${Y}/${M}/${D} ${h}:${m} JST`;
}

function formatLocalTime(iso: string | null | undefined) {
  if (!iso) return "--";
  const d = new Date(iso);
  return d.toLocaleString("zh-CN", { hour12: false });
}

function dirZh(d: string | null | undefined) {
  if (!d) return "--";
  const map: Record<string, string> = {
    N: "北",
    NNE: "北东北",
    NE: "东北",
    ENE: "东北东",
    E: "东",
    ESE: "东南东",
    SE: "东南",
    SSE: "南东南",
    S: "南",
    SSW: "南西南",
    SW: "西南",
    WSW: "西南西",
    W: "西",
    WNW: "西北西",
    NW: "西北",
    NNW: "北西北",
    "Slow": "缓慢",
    "Steady": "稳定",
  };
  return map[d.toUpperCase()] || d;
}

function beaufortText(bf: number | null) {
  if (bf == null) return "--";
  // 中国气象局风力等级 (0-17)
  const labels = [
    "0 级 / 静风", "1 级 / 软风", "2 级 / 轻风", "3 级 / 微风",
    "4 级 / 和风", "5 级 / 清风", "6 级 / 强风", "7 级 / 疾风",
    "8 级 / 大风", "9 级 / 烈风", "10 级 / 狂风", "11 级 / 暴风",
    "12 级 / 台风", "13 级", "14 级", "15 级", "16 级", "17 级"
  ];
  return labels[Math.min(bf, 17)];
}

export default function Monitor() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState<number>(REFRESH_INTERVAL_MS);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [requestError, setRequestError] = useState<string | null>(null);
  const lastFetchRef = useRef<number>(0);

  const fetchData = async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15_000);
      const res = await fetch(`/api/typhoon`, {
        cache: "no-store",
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        setRequestError(`接口返回 ${res.status}`);
      } else {
        setRequestError(null);
      }
      const json: ApiResponse = await res.json();
      setData(json);
      lastFetchRef.current = Date.now();
      setCountdown(REFRESH_INTERVAL_MS);
      setActiveIndex(0);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setRequestError(`请求失败: ${msg}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 首次加载
  useEffect(() => {
    fetchData();
  }, []);

  // 5 分钟自动刷新
  useEffect(() => {
    const t = setInterval(() => {
      fetchData();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(t);
  }, []);

  // 倒计时
  useEffect(() => {
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1000) return REFRESH_INTERVAL_MS;
        return c - 1000;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const current = data?.current ?? null;
  const forecast = data?.forecast ?? [];
  const allPoints: NormalizedPoint[] = useMemo(
    () => (current ? [current, ...forecast] : []),
    [current, forecast]
  );

  // 当前展示节点 (activeIndex: 0=current, 1..n=forecast)
  const activePoint: NormalizedPoint | null =
    allPoints.length > 0 ? allPoints[Math.min(activeIndex, allPoints.length - 1)] : null;

  // 状态卡数据
  const bf = beaufortFromMs(activePoint?.windMs ?? null);
  const pressureHpa = activePoint?.pressureHpa ?? null;
  const windMs = activePoint?.windMs ?? null;
  const speedKmh = activePoint?.speedKmh ?? null;

  // 当前风圈 (30kt, 强风圈) - 扁平展示
  const curWind = data?.windRadii ?? [];

  return (
    <div>
      <header className="header">
        <div className="header-row">
          <div className="brand">
            <div className="brand-logo">BAVI</div>
            <div className="brand-text">
              <div className="brand-title">Typhoon Watch · 台风监测</div>
              <div className="brand-name">公开数据 · 仅供信息参考</div>
            </div>
          </div>

          <div className="storm-title">
            <span className="storm-name-cn">巴威</span>
            <span className="storm-name-en">BAVI</span>
            <span className="storm-seq">热带风暴</span>
          </div>

          <div className="header-meta">
            <div>
              数据来源:{" "}
              <a
                href="https://www.data.jma.go.jp/multi/cyclone/"
                target="_blank"
                rel="noreferrer"
              >
                日本气象厅 JMA
              </a>
            </div>
            <div>
              {data?.source?.issuedAt
                ? `JMA 发布: ${formatJstTime(data.source.issuedAt)}`
                : "JMA 发布: --"}
            </div>
          </div>
        </div>
        <div className="header-desc">
          本页面每 5 分钟自动从日本气象厅同步一次"巴威"当前位置、中心气压、近中心最大风速、未来
          120 小时路径、概率圈与风圈半径。中国境内风险信息请以应急管理部、各省气象台和当地主管部门正式预警为准。
        </div>
      </header>

      {/* 状态卡 */}
      <div className="status-grid">
        <div className="status-card">
          <div className="status-label">
            <span className="status-dot" />
            中心气压
          </div>
          <div className="status-value">
            {pressureHpa ?? "--"}
            <span className="unit">hPa</span>
          </div>
          <div className="status-sub">
            <span className="hl">JMA 实况 / 预报值</span>
          </div>
        </div>
        <div className={`status-card ${bf != null && bf >= 8 ? "warn" : ""}`}>
          <div className="status-label">
            <span className="status-dot" style={{ background: bf && bf >= 8 ? "var(--warn)" : undefined, boxShadow: bf && bf >= 8 ? "0 0 8px var(--warn)" : undefined }} />
            最大风速
          </div>
          <div className="status-value">
            {windMs ?? "--"}
            <span className="unit">m/s</span>
          </div>
          <div className="status-sub">{beaufortText(bf)}</div>
        </div>
        <div className="status-card">
          <div className="status-label">强度等级</div>
          <div className="status-value" style={{ fontSize: 18 }}>
            {activePoint?.className ?? "--"}
          </div>
          <div className="status-sub">
            移向: {dirZh(activePoint?.direction)} · 移速:{" "}
            {activePoint?.speedKmh ?? "--"} km/h
          </div>
        </div>
        <div className="status-card">
          <div className="status-label">发布时间 / 倒计时</div>
          <div className="status-value" style={{ fontSize: 18 }}>
            {data?.source?.targetAt ? formatJstTime(data.source.targetAt) : "--"}
          </div>
          <div className="status-sub">
            下次刷新{" "}
            <span className="hl">
              {String(Math.floor(countdown / 60000)).padStart(2, "0")}:
              {String(Math.floor((countdown % 60000) / 1000)).padStart(2, "0")}
            </span>
          </div>
        </div>
      </div>

      <div className="main">
        {/* 左：地图 */}
        <section className="section" aria-label="实时路径地图">
          <div className="section-head">
            <div className="section-title">
              <span className="dot" />
              实时路径
            </div>
            <div className="toolbar">
              <span className="countdown">
                下次刷新{" "}
                <span className="v">
                  {String(Math.floor(countdown / 60000)).padStart(2, "0")}:
                  {String(Math.floor((countdown % 60000) / 1000)).padStart(2, "0")}
                </span>
              </span>
              <button
                className="btn-primary"
                onClick={() => fetchData(true)}
                disabled={refreshing}
                aria-label="手动刷新数据"
              >
                {refreshing ? "刷新中…" : "立即刷新"}
              </button>
              <ShareButton data={data} />
            </div>
          </div>

          {data?.stale && (
            <div style={{ padding: "8px 16px 0" }}>
              <div className="stale-banner">
                <span className="ic">更新失败</span>
                <span>
                  数据可能已过期 · 上次成功: {formatLocalTime(data.fetchedAt)} · 错误: {data.error}
                </span>
              </div>
            </div>
          )}
          {requestError && !data?.stale && (
            <div style={{ padding: "8px 16px 0" }}>
              <div className="stale-banner">
                <span className="ic">请求异常</span>
                <span>{requestError}</span>
              </div>
            </div>
          )}

          <div className="map-wrap">
            <TyphoonMap
              points={allPoints}
              activeIndex={activeIndex}
              onSelect={(i) => setActiveIndex(i)}
            />
          </div>

          {/* 文字列表备援 */}
          <div style={{ padding: "12px 16px 16px" }}>
            <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 6 }}>
              文字列表 (无障碍备援)
            </div>
            <div className="text-list" role="list">
              {allPoints.length === 0 ? (
                <div className="timeline-empty">暂无数据</div>
              ) : (
                allPoints.map((p, i) => (
                  <button
                    key={i}
                    className="text-list-row"
                    onClick={() => setActiveIndex(i)}
                    style={{
                      cursor: "pointer",
                      borderColor: i === activeIndex ? "var(--accent)" : undefined,
                    }}
                    aria-label={`查看 ${formatJstTime(p.timeUtc)} 时段详情`}
                  >
                    <span className="t">{p.offsetHours === 0 ? "实况" : `+${p.offsetHours}h`}</span>
                    <span className="cls">{p.className}</span>
                    <span className="pos">
                      {p.lat != null ? `${p.lat.toFixed(1)}°N ` : "-- "}
                      {p.lon != null ? `${p.lon.toFixed(1)}°E` : "--"}
                      {p.probRadiusKm ? ` · 概率圈 ${p.probRadiusKm}km` : ""}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </section>

        {/* 右：详情 */}
        <aside className="side">
          <section className="section">
            <div className="section-head">
              <div className="section-title">
                <span className="dot" />
                {activeIndex === 0 ? "实况详情" : `+${(activePoint?.offsetHours ?? 0)}h 预报`}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                {activePoint ? formatJstTime(activePoint.timeUtc) : ""}
              </div>
            </div>
            <div className="section-body">
              {!activePoint ? (
                <div className="empty-card">暂无数据</div>
              ) : (
                <>
                  <div className="info-list">
                    <div className="info-row">
                      <span className="label">中心位置</span>
                      <span className="val">
                        {activePoint.lat != null
                          ? `${activePoint.lat.toFixed(1)}°N`
                          : "--"}{" "}
                        {activePoint.lon != null
                          ? `${activePoint.lon.toFixed(1)}°E`
                          : "--"}
                      </span>
                    </div>
                    <div className="info-row">
                      <span className="label">移向 / 移速</span>
                      <span className="val">
                        {dirZh(activePoint.direction)} ·{" "}
                        {activePoint.speedKmh ?? "--"} km/h
                      </span>
                    </div>
                    <div className="info-row">
                      <span className="label">中心气压</span>
                      <span className="val">{activePoint.pressureHpa ?? "--"} hPa</span>
                    </div>
                    <div className="info-row">
                      <span className="label">最大风速</span>
                      <span className="val">
                        {activePoint.windMs ?? "--"} m/s ({activePoint.windKt ?? "--"} kt)
                      </span>
                    </div>
                    <div className="info-row">
                      <span className="label">最大阵风</span>
                      <span className="val">
                        {activePoint.gustMs ?? "--"} m/s ({activePoint.gustKt ?? "--"} kt)
                      </span>
                    </div>
                    <div className="info-row">
                      <span className="label">强度等级</span>
                      <span className="val">{activePoint.className}</span>
                    </div>
                    <div className="info-row">
                      <span className="label">概率圈</span>
                      <span className="val">
                        {activePoint.probRadiusKm
                          ? `${activePoint.probRadiusKm} km`
                          : "无"}
                      </span>
                    </div>
                    <div className="info-row">
                      <span className="label">风圈 (30kt)</span>
                      <span className="val">
                        {renderWindRadii(curWind.filter((w) => w.type === "30kt"))}
                      </span>
                    </div>
                    <div className="info-row">
                      <span className="label">暴风圈 (50kt)</span>
                      <span className="val">
                        {renderWindRadii(curWind.filter((w) => w.type === "50kt"))}
                      </span>
                    </div>
                    <div className="info-row">
                      <span className="label">预报有效</span>
                      <span className="val">{formatJstTime(activePoint.timeUtc)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>
        </aside>
      </div>

      {/* 强度趋势时间轴 */}
      <div className="main" style={{ gridTemplateColumns: "1fr" }}>
        <section className="section">
          <div className="section-head">
            <div className="section-title">
              <span className="dot" />
              强度趋势 (实况 + 120h 预报)
            </div>
            <div style={{ fontSize: 11, color: "var(--text-3)" }}>
              点击时间轴或地图节点查看对应时刻
            </div>
          </div>
          <div className="section-body">
            {allPoints.length === 0 ? (
              <div className="timeline-empty">暂无数据</div>
            ) : (
              <div className="timeline">
                <div className="timeline-row" style={{ background: "transparent", borderColor: "transparent", cursor: "default" }}>
                  <span className="timeline-time">
                    <span className="sub">时间 (JST)</span>
                  </span>
                  <span className="timeline-cell">
                    <span className="k">强度</span>
                    <span className="v" style={{ fontSize: 11, color: "var(--text-2)" }}>类别</span>
                  </span>
                  <span className="timeline-cell">
                    <span className="k">风速</span>
                    <span className="v" style={{ fontSize: 11, color: "var(--text-2)" }}>m/s</span>
                  </span>
                  <span className="timeline-cell">
                    <span className="k">气压</span>
                    <span className="v" style={{ fontSize: 11, color: "var(--text-2)" }}>hPa</span>
                  </span>
                  <span className="timeline-cell">
                    <span className="k">移向 / 速</span>
                    <span className="v" style={{ fontSize: 11, color: "var(--text-2)" }}>km/h</span>
                  </span>
                </div>
                {allPoints.map((p, i) => (
                  <div
                    key={i}
                    className={`timeline-row ${i === 0 ? "current" : ""} ${
                      i === activeIndex ? "active" : ""
                    }`}
                    onClick={() => setActiveIndex(i)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveIndex(i);
                      }
                    }}
                    aria-label={`${i === 0 ? "实况" : `+${p.offsetHours}小时预报`} 强度详情`}
                  >
                    <span className="timeline-time">
                      {p.timeJst}
                      <span className="sub">
                        {i === 0 ? "实况" : `+${p.offsetHours}h`}
                      </span>
                    </span>
                    <span className="timeline-cell">
                      <span className="v">{p.className}</span>
                    </span>
                    <span className="timeline-cell">
                      <span className="v">{p.windMs ?? "--"}</span>
                    </span>
                    <span className="timeline-cell">
                      <span className="v">{p.pressureHpa ?? "--"}</span>
                    </span>
                    <span className="timeline-cell">
                      <span className="v">
                        {dirZh(p.direction)} {p.speedKmh ?? "--"}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="main" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <section className="section">
          <div className="section-head">
            <div className="section-title">
              <span className="dot" />
              官方预警入口
            </div>
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>
              实时与历史分别标注
            </span>
          </div>
          <div className="section-body">
            <div className="advisory">
              <div className="advisory-row">
                <div>
                  <div className="ttl">应急管理部</div>
                  <div className="ts">官方权威信息发布渠道</div>
                </div>
                <a className="btn" href="https://www.mem.gov.cn/" target="_blank" rel="noreferrer">
                  进入官网
                </a>
              </div>
              <div className="advisory-row">
                <div>
                  <div className="ttl">中央气象台</div>
                  <div className="ts">中国气象局 CMA · 台风公报与预警</div>
                </div>
                <a className="btn" href="http://www.nmc.cn/publish/typhoon/typhoon_new.html" target="_blank" rel="noreferrer">
                  台风网
                </a>
              </div>
              <div className="advisory-row">
                <div>
                  <div className="ttl">国家预警发布</div>
                  <div className="ts">气象灾害预警 · 各省气象台汇总</div>
                </div>
                <a className="btn" href="https://www.12379.cn/" target="_blank" rel="noreferrer">
                  国家预警
                </a>
              </div>
              <div className="advisory-row">
                <div>
                  <div className="ttl">JMA 多语言页 (实时)</div>
                  <div className="ts">
                    {data?.source?.issuedAt
                      ? `报告时间: ${formatJstTime(data.source.issuedAt)}`
                      : "未获取到发布时间"}
                  </div>
                </div>
                <a
                  className="btn"
                  href={`https://www.data.jma.go.jp/multi/cyclone/cyclone_detail.html?id=61&lang=cn_zs`}
                  target="_blank"
                  rel="noreferrer"
                >
                  JMA 中文
                </a>
              </div>
              <div className="advisory-row">
                <div>
                  <div className="ttl">JMA 多语言页 (历史/复核)</div>
                  <div className="ts">
                    历史公报与最佳路径查询
                  </div>
                </div>
                <a
                  className="btn"
                  href="https://www.jma.go.jp/jma/jma-eng/jma-center/rsmc-hp-pub-eg/besttrack.html"
                  target="_blank"
                  rel="noreferrer"
                >
                  Best Track
                </a>
              </div>
            </div>
            <div className="tips" style={{ marginTop: 8 }}>
              <strong>重要：</strong>
              中国境内的台风影响、登陆结论和风险等级，<strong>请以应急管理部、中央气象台与地方气象台正式预警为准</strong>。本页面数据来源于日本气象厅，仅供信息参考。
            </div>
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <div className="section-title">
              <span className="dot" />
              防灾提示
            </div>
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>公众通用建议</span>
          </div>
          <div className="section-body">
            <div className="tips">
              <strong>关注预警：</strong>
              持续关注当地气象台的最新预报和预警信息，留意应急广播与短信。
            </div>
            <div className="tips">
              <strong>远离危险：</strong>
              远离海边、河边、山区、低洼地带；停止高空、水上作业与户外大型活动。
            </div>
            <div className="tips">
              <strong>居家准备：</strong>
              提前检查门窗、电路与燃气；备好手电、饮水、药品和充电宝。
            </div>
            <div className="tips">
              <strong>出行：</strong>
              受影响地区飞机、铁路、轮渡可能延误或取消，建议提前查询。
            </div>
            <div className="tips">
              <strong>紧急联络：</strong>
              紧急情况拨打 110/119/120；海上事故 118；外交部全球领事保护 +86-10-12308。
            </div>
          </div>
        </section>
      </div>

      <div className="disclaimer">
        本页面数据来自日本气象厅公开数据接口，
        <a
          href="https://www.data.jma.go.jp/multi/cyclone/"
          target="_blank"
          rel="noreferrer"
        >
          https://www.data.jma.go.jp/multi/cyclone/
        </a>
        ；地图底图采用亮色风格自绘矢量绘制。
        <br />
        仅供信息参考，请以当地主管部门正式预警为准。© 2026 巴威 BAVI 实时监控。
      </div>
    </div>
  );
}

function renderWindRadii(arr: WindRadius[]) {
  if (arr.length === 0) return <span style={{ color: "var(--text-3)" }}>无</span>;
  return (
    <span>
      {arr.map((w, i) => (
        <span key={i}>
          {i > 0 ? " / " : ""}
          {w.direction === "ALL" ? "全域" : w.direction} {w.radiusKm ?? "--"}km
        </span>
      ))}
    </span>
  );
}
