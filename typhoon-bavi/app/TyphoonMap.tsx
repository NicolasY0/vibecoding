"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { NormalizedPoint, WindRadius } from "@/lib/jma";

/**
 * 自绘地图:
 * - 大陆/海洋背景: 内置简化 GeoJSON (亚洲 + 西北太平洋) 矢量绘制
 * - 台风路径: 实况+预报连接
 * - 概率圈: 70% 概率圆
 * - 30kt 强风圈: 椭圆 (方向 + 半径)
 * - 50kt 暴风圈: 同上
 * - 节点可点击
 *
 * 设计为不依赖任何外部瓦片或地图服务, 在中国境内网络环境稳定可用.
 */

const VIEW_W = 1000;
const VIEW_H = 640;
const MIN_LON = 100; // 100°E
const MAX_LON = 165; // 165°E
const MIN_LAT = 0; // 0°N
const MAX_LAT = 55; // 55°N

function project(lon: number, lat: number): [number, number] {
  const x = ((lon - MIN_LON) / (MAX_LON - MIN_LON)) * VIEW_W;
  const y = VIEW_H - ((lat - MIN_LAT) / (MAX_LAT - MIN_LAT)) * VIEW_H;
  return [x, y];
}

function unproject(x: number, y: number): [number, number] {
  const lon = MIN_LON + (x / VIEW_W) * (MAX_LON - MIN_LON);
  const lat = MIN_LAT + ((VIEW_H - y) / VIEW_H) * (MAX_LAT - MIN_LAT);
  return [lon, lat];
}

// 1° 纬度 ≈ 111 km, 1° 经度 ≈ 111 km * cos(lat)
function degToKm(lat: number, deg: number): number {
  return 111 * deg;
}

function degLngFromKm(lat: number, km: number): number {
  return km / (111 * Math.cos((lat * Math.PI) / 180));
}

// 简化中国/日本/朝鲜半岛/俄罗斯远东/菲律宾/台湾 海岸线
// 块状多边形, 不追求完美精度, 只为深色风格背景下有明确大陆轮廓
const LANDMASS: [number, number][][] = [
  // 中国大陆 + 海南
  [
    [109, 18.5], [110.5, 21], [113, 22.5], [115, 22.8], [118, 24.5],
    [120, 26], [121.5, 28], [122, 30.5], [121, 32], [121, 33.5],
    [120, 35], [120, 37], [121, 38], [122, 39], [121, 40],
    [119.5, 40.8], [117.5, 40.5], [115, 41.5], [112, 43],
    [108, 44], [102, 42], [97, 42.5], [94, 42], [88, 47],
    [80, 47], [75, 41], [78, 35.5], [80, 32], [85, 28],
    [88, 27.5], [92, 27], [95, 25], [98, 23], [100, 22],
    [102, 22.5], [105, 22], [107, 20.5], [108, 18]
  ],
  // 海南岛
  [
    [108.5, 19.5], [110, 19], [111, 19.5], [110.5, 20.2], [109, 20], [108.5, 19.5]
  ],
  // 台湾
  [
    [120, 25.1], [121, 25.3], [122, 24.5], [121.5, 22.5], [120.5, 22], [120, 23.5], [120, 25.1]
  ],
  // 日本九州
  [
    [129.7, 31], [130.5, 31.5], [131.5, 32], [131.8, 33.5], [131, 34], [130, 33.5], [129.5, 32.5], [129.7, 31]
  ],
  // 日本本州
  [
    [130.5, 33.5], [132, 34], [134, 34.5], [136, 35], [138, 35], [140, 36], [141, 38], [141.5, 41], [142, 43.5], [144, 44], [145, 44.5], [142, 45.5], [140, 41.5], [139, 38], [137, 36.5], [135, 35.5], [132.5, 35], [131, 34.5], [130.5, 33.5]
  ],
  // 北海道
  [
    [140, 41.5], [141, 42], [144, 42.5], [145.5, 43.5], [144, 44.5], [142, 45], [140, 44], [140, 42.5], [140, 41.5]
  ],
  // 朝鲜半岛
  [
    [125, 38], [126, 38.5], [128, 39], [129, 40.5], [129.5, 42], [128, 42.5], [126, 42.5], [125, 41], [124.5, 39.5], [125, 38]
  ],
  // 菲律宾吕宋
  [
    [120, 18], [121.5, 17], [122.5, 16], [123, 14.5], [122, 13.5], [121, 13.5], [120, 14], [119.5, 15.5], [120, 17], [120, 18]
  ],
  // 菲律宾棉兰老
  [
    [121.5, 8.5], [123, 9.5], [125, 9.5], [126.5, 8], [126, 6.5], [124, 6], [122, 7], [121.5, 8.5]
  ],
  // 俄罗斯远东 (萨哈林 / 勘察加)
  [
    [141, 46], [143, 48], [142, 50], [144, 52.5], [146, 54], [143, 54.5], [141, 50.5], [141, 48], [141, 46]
  ],
  // 勘察加
  [
    [155, 53], [160, 55], [162, 57], [159, 56], [156, 54.5], [155, 53]
  ],
];

// 城市参考点 (经度, 纬度, 名称)
const CITIES: { lon: number; lat: number; name: string }[] = [
  { lon: 116.4, lat: 39.9, name: "北京" },
  { lon: 121.5, lat: 31.2, name: "上海" },
  { lon: 113.3, lat: 23.1, name: "广州" },
  { lon: 121.6, lat: 25.1, name: "台北" },
  { lon: 114.2, lat: 22.3, name: "香港" },
  { lon: 113.5, lat: 22.2, name: "澳门" },
  { lon: 108.9, lat: 34.3, name: "西安" },
  { lon: 104.1, lat: 30.7, name: "成都" },
  { lon: 120.2, lat: 30.3, name: "杭州" },
  { lon: 118.1, lat: 24.5, name: "厦门" },
  { lon: 110.3, lat: 20, name: "海口" },
  { lon: 109.5, lat: 18.2, name: "三亚" },
  { lon: 126.6, lat: 45.7, name: "哈尔滨" },
  { lon: 125.3, lat: 43.9, name: "长春" },
  { lon: 123.4, lat: 41.8, name: "沈阳" },
  { lon: 117.2, lat: 39.1, name: "天津" },
  { lon: 120.4, lat: 36.1, name: "青岛" },
  { lon: 122.1, lat: 37.5, name: "烟台/威海" },
  { lon: 122.5, lat: 40.7, name: "大连" },
  { lon: 129.5, lat: 35.5, name: "釜山" },
  { lon: 126.9, lat: 37.5, name: "首尔" },
  { lon: 139.7, lat: 35.7, name: "东京" },
  { lon: 135.5, lat: 34.6, name: "大阪" },
  { lon: 130.4, lat: 33.6, name: "福冈" },
  { lon: 121.0, lat: 14.6, name: "马尼拉" },
];

// 简化网格线 (10° 经纬)
const GRID_STEP_DEG = 10;

export default function TyphoonMap({
  points,
  activeIndex,
  onSelect,
}: {
  points: NormalizedPoint[];
  activeIndex: number;
  onSelect: (i: number) => void;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<[number, number]>([0, 0]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // 计算地图视野中心 - 根据当前实况+预报点位置
  const viewCenter = useMemo(() => {
    const valid = points.filter((p) => p.lat != null && p.lon != null);
    if (valid.length === 0) return { lon: 130, lat: 30 };
    const avgLat = valid.reduce((s, p) => s + (p.lat ?? 0), 0) / valid.length;
    const avgLon = valid.reduce((s, p) => s + (p.lon ?? 0), 0) / valid.length;
    return { lon: avgLon, lat: avgLat };
  }, [points]);

  // 计算动态视野 - 让所有点都在视口内, 至少 8° 边距
  const viewBounds = useMemo(() => {
    const valid = points.filter((p) => p.lat != null && p.lon != null);
    if (valid.length === 0)
      return { minLon: 105, maxLon: 150, minLat: 10, maxLat: 50 };
    let minLon = Infinity,
      maxLon = -Infinity,
      minLat = Infinity,
      maxLat = -Infinity;
    for (const p of valid) {
      const lat = p.lat ?? 0;
      const lon = p.lon ?? 0;
      // 把概率圈半径也纳入
      if (p.probRadiusKm) {
        const dLat = p.probRadiusKm / 111;
        const dLon = p.probRadiusKm / (111 * Math.cos((lat * Math.PI) / 180));
        minLon = Math.min(minLon, lon - dLon);
        maxLon = Math.max(maxLon, lon + dLon);
        minLat = Math.min(minLat, lat - dLat);
        maxLat = Math.max(maxLat, lat + dLat);
      } else {
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      }
    }
    // 加 30% 边距, 至少 8° 边距
    const padLon = Math.max(8, (maxLon - minLon) * 0.4);
    const padLat = Math.max(6, (maxLat - minLat) * 0.4);
    return {
      minLon: Math.max(100, minLon - padLon),
      maxLon: Math.min(165, maxLon + padLon),
      minLat: Math.max(0, minLat - padLat),
      maxLat: Math.min(55, maxLat + padLat),
    };
  }, [points]);

  // 内部投影 (根据 viewBounds)
  function projLB(lon: number, lat: number): [number, number] {
    const x = ((lon - viewBounds.minLon) / (viewBounds.maxLon - viewBounds.minLon)) * VIEW_W;
    const y = VIEW_H - ((lat - viewBounds.minLat) / (viewBounds.maxLat - viewBounds.minLat)) * VIEW_H;
    return [x, y];
  }
  function unprojLB(x: number, y: number): [number, number] {
    const lon = viewBounds.minLon + (x / VIEW_W) * (viewBounds.maxLon - viewBounds.minLon);
    const lat = viewBounds.minLat + ((VIEW_H - y) / VIEW_H) * (viewBounds.maxLat - viewBounds.minLat);
    return [lon, lat];
  }

  const landPaths = useMemo(() => {
    return LANDMASS.map((ring) => {
      const d = ring
        .map(([lon, lat], i) => {
          const [x, y] = projLB(lon, lat);
          return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ") + " Z";
      return d;
    });
  }, [viewBounds]);

  // 网格线
  const gridLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number; label: string; pos: "top" | "bottom" | "left" | "right" }[] = [];
    for (let lon = Math.ceil(viewBounds.minLon / GRID_STEP_DEG) * GRID_STEP_DEG; lon <= viewBounds.maxLon; lon += GRID_STEP_DEG) {
      const [x, y1] = projLB(lon, viewBounds.minLat);
      const [, y2] = projLB(lon, viewBounds.maxLat);
      lines.push({ x1: x, y1, x2: x, y2, label: `${lon}°E`, pos: "top" });
    }
    for (let lat = Math.ceil(viewBounds.minLat / GRID_STEP_DEG) * GRID_STEP_DEG; lat <= viewBounds.maxLat; lat += GRID_STEP_DEG) {
      const [x1, y] = projLB(viewBounds.minLon, lat);
      const [x2] = projLB(viewBounds.maxLon, lat);
      lines.push({ x1, y1: y, x2, y2: y, label: `${lat}°N`, pos: "right" });
    }
    return lines;
  }, [viewBounds]);

  // 路径字符串 - 拆分实况段与预报段
  const paths = useMemo(() => {
    const valid = points
      .map((p, i) => {
        if (p.lat == null || p.lon == null) return null;
        const [x, y] = projLB(p.lon, p.lat);
        return { x, y, i };
      })
      .filter(Boolean) as { x: number; y: number; i: number }[];
    if (valid.length === 0) return { real: "", forecast: "" };
    if (valid.length === 1) return { real: "", forecast: "" };
    const real = `M${valid[0].x.toFixed(1)},${valid[0].y.toFixed(1)} L${valid[1].x.toFixed(1)},${valid[1].y.toFixed(1)}`;
    const fcSegs = valid.slice(1).map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`);
    const forecast = `M${valid[1].x.toFixed(1)},${valid[1].y.toFixed(1)} ${fcSegs.join(" ")}`;
    return { real, forecast };
  }, [points, viewBounds]);

  // 拖动平移
  const onMouseDown = (e: React.MouseEvent) => {
    dragRef.current = { x: e.clientX, y: e.clientY, ox: pan[0], oy: pan[1] };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setPan([dragRef.current.ox + dx, dragRef.current.oy + dy]);
  };
  const onMouseUp = () => {
    dragRef.current = null;
  };
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.min(4, Math.max(0.6, z * (e.deltaY < 0 ? 1.1 : 0.9))));
  };

  // 渲染风圈椭圆
  function renderWindRing(p: NormalizedPoint) {
    if (p.lat == null || p.lon == null) return null;
    if (!p.windRadii || p.windRadii.length === 0) return null;
    const [cx, cy] = projLB(p.lon, p.lat);
    // 由于 view 是非等距投影 (lat/lon 比例不同), 我们把 km 换算回 deg 后再投
    const lat = p.lat;
    const elems: React.ReactElement[] = [];
    for (const w of p.windRadii) {
      const rKm = w.radiusKm;
      if (!rKm) continue;
      const dLat = rKm / 111;
      const dLon = rKm / (111 * Math.cos((lat * Math.PI) / 180));
      // 椭圆包围盒 (考虑投影)
      const [xl, yt] = projLB(p.lon - dLon, p.lat + dLat);
      const [xr, yb] = projLB(p.lon + dLon, p.lat - dLat);
      const rx = Math.abs(xr - xl) / 2;
      const ry = Math.abs(yb - yt) / 2;
      const fill = w.type === "50kt" ? "rgba(230, 49, 44, 0.12)" : "rgba(24, 144, 255, 0.1)";
      const stroke = w.type === "50kt" ? "rgba(230, 49, 44, 0.55)" : "rgba(24, 144, 255, 0.5)";
      const isOval = w.direction !== "ALL" && w.direction !== "全円";
      elems.push(
        <g key={w.type + w.direction}>
          {isOval ? (
            <ellipse
              cx={cx}
              cy={cy}
              rx={rx}
              ry={ry}
              fill={fill}
              stroke={stroke}
              strokeWidth={1.2}
              strokeDasharray="3 3"
              transform={`rotate(${directionToAngle(w.direction)} ${cx} ${cy})`}
            />
          ) : (
            <ellipse
              cx={cx}
              cy={cy}
              rx={rx}
              ry={ry}
              fill={fill}
              stroke={stroke}
              strokeWidth={1.2}
              strokeDasharray="3 3"
            />
          )}
        </g>
      );
    }
    return elems;
  }

  return (
    <div
      style={{ position: "relative", width: "100%", height: "100%" }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          cursor: dragRef.current ? "grabbing" : "grab",
          userSelect: "none",
        }}
        onWheel={onWheel}
        role="img"
        aria-label="台风路径与位置地图"
      >
        <defs>
          <linearGradient id="ocean" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d4e6f1" />
            <stop offset="100%" stopColor="#c4dbed" />
          </linearGradient>
          <radialGradient id="typhoonGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#e6312c" stopOpacity="0.4" />
            <stop offset="60%" stopColor="#e6312c" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#e6312c" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="pathReal" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#e6312c" />
            <stop offset="100%" stopColor="#fa8c16" />
          </linearGradient>
          <linearGradient id="pathFc" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fa8c16" />
            <stop offset="100%" stopColor="#1890ff" />
          </linearGradient>
        </defs>

        {/* 海洋背景 */}
        <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="url(#ocean)" />

        {/* 网格 */}
        <g pointerEvents="none">
          {gridLines.map((g, i) => (
            <g key={i}>
              <line
                x1={g.x1}
                y1={g.y1}
                x2={g.x2}
                y2={g.y2}
                stroke="rgba(180, 195, 210, 0.5)"
                strokeWidth={0.5}
              />
              {g.pos === "top" && (
                <text
                  x={g.x1}
                  y={10}
                  fill="rgba(136, 149, 167, 0.7)"
                  fontSize={9}
                  textAnchor="middle"
                >
                  {g.label}
                </text>
              )}
              {g.pos === "right" && (
                <text
                  x={VIEW_W - 4}
                  y={g.y1 - 2}
                  fill="rgba(136, 149, 167, 0.7)"
                  fontSize={9}
                  textAnchor="end"
                >
                  {g.label}
                </text>
              )}
            </g>
          ))}
        </g>

        {/* 大陆 */}
        <g
          transform={`translate(${pan[0]} ${pan[1]}) scale(${zoom}) translate(${-pan[0] / (zoom - 1 + 1e-6)} ${-pan[1] / (zoom - 1 + 1e-6)})`}
        >
          {landPaths.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="#f0ede8"
              stroke="#d9d4cc"
              strokeWidth={0.8}
            />
          ))}

          {/* 城市 */}
          {CITIES.filter((c) =>
            c.lon >= viewBounds.minLon &&
            c.lon <= viewBounds.maxLon &&
            c.lat >= viewBounds.minLat &&
            c.lat <= viewBounds.maxLat
          ).map((c, i) => {
            const [x, y] = projLB(c.lon, c.lat);
            return (
              <g key={i} pointerEvents="none">
                <circle cx={x} cy={y} r={2.5} fill="#8895a7" />
                <text
                  x={x + 4}
                  y={y - 4}
                  fill="rgba(74, 85, 104, 0.8)"
                  fontSize={9}
                >
                  {c.name}
                </text>
              </g>
            );
          })}

          {/* 风圈 */}
          {points.map((p, i) => (
            <g key={`w${i}`}>{renderWindRing(p)}</g>
          ))}

          {/* 概率圈 */}
          {points.map((p, i) => {
            if (p.lat == null || p.lon == null || !p.probRadiusKm) return null;
            const dLat = p.probRadiusKm / 111;
            const dLon =
              p.probRadiusKm / (111 * Math.cos((p.lat * Math.PI) / 180));
            const [xl, yt] = projLB(p.lon - dLon, p.lat + dLat);
            const [xr, yb] = projLB(p.lon + dLon, p.lat - dLat);
            const cx = (xl + xr) / 2;
            const cy = (yt + yb) / 2;
            const rx = Math.abs(xr - xl) / 2;
            const ry = Math.abs(yb - yt) / 2;
            return (
              <g key={`pc${i}`}>
                <ellipse
                  cx={cx}
                  cy={cy}
                  rx={rx}
                  ry={ry}
                  fill="rgba(250, 140, 22, 0.08)"
                  stroke="rgba(250, 140, 22, 0.6)"
                  strokeWidth={1.2}
                  strokeDasharray="4 3"
                />
                <text
                  x={cx + rx + 4}
                  y={cy}
                  fill="rgba(250, 140, 22, 0.85)"
                  fontSize={9}
                >
                  {p.probRadiusKm}km
                </text>
              </g>
            );
          })}

          {/* 路径 - 实况段(红色实线) + 预报段(蓝色虚线) */}
          {paths.real && (
            <path
              d={paths.real}
              fill="none"
              stroke="#e6312c"
              strokeWidth={2.4}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {paths.forecast && (
            <path
              d={paths.forecast}
              fill="none"
              stroke="#1890ff"
              strokeWidth={2.2}
              strokeDasharray="6 4"
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={0.85}
            />
          )}

          {/* 节点 */}
          {points.map((p, i) => {
            if (p.lat == null || p.lon == null) return null;
            const [x, y] = projLB(p.lon, p.lat);
            const isCurrent = i === 0;
            const isActive = i === activeIndex;
            const laterOffset = p.offsetHours;
            // 越远越淡
            const opacity = isCurrent
              ? 1
              : Math.max(0.4, 1 - laterOffset / 140);
            return (
              <g
                key={`p${i}`}
                style={{ cursor: "pointer", opacity }}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(i);
                }}
                tabIndex={0}
                role="button"
                aria-label={`${isCurrent ? "实况" : `+${laterOffset}小时预报`}: ${p.className} 中心 ${p.lat?.toFixed(1)}°N ${p.lon?.toFixed(1)}°E`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(i);
                  }
                }}
              >
                {isCurrent && (
                  <circle
                    cx={x}
                    cy={y}
                    r={28}
                    fill="url(#typhoonGlow)"
                    style={{ pointerEvents: "none" }}
                  />
                )}
                {isCurrent ? (
                  <g style={{ pointerEvents: "none" }}>
                    <circle
                      cx={x}
                      cy={y}
                      r={11}
                      fill="none"
                      stroke="rgba(230, 49, 44, 0.7)"
                      strokeWidth={1.4}
                    >
                      <animate
                        attributeName="r"
                        values="11;18;11"
                        dur="2.4s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        values="1;0.3;1"
                        dur="2.4s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    <circle
                      cx={x}
                      cy={y}
                      r={6}
                      fill="#e6312c"
                      stroke="#fff"
                      strokeWidth={1.5}
                    />
                  </g>
                ) : (
                  <circle
                    cx={x}
                    cy={y}
                    r={isActive ? 7 : 4.5}
                    fill={isActive ? "#096dd9" : "#1890ff"}
                    stroke="#fff"
                    strokeWidth={1.5}
                    style={{ pointerEvents: "none" }}
                  />
                )}

                {/* 节点标签 */}
                {(isCurrent || isActive || hoverIdx === i) && (
                  <g pointerEvents="none">
                    <rect
                      x={x + 12}
                      y={y - 16}
                      width={64}
                      height={32}
                      rx={3}
                      fill="rgba(255, 255, 255, 0.95)"
                      stroke="rgba(24, 144, 255, 0.35)"
                      strokeWidth={0.6}
                    />
                    <text
                      x={x + 18}
                      y={y - 4}
                      fill={isCurrent ? "#e6312c" : "#1890ff"}
                      fontSize={9}
                      fontWeight={700}
                    >
                      {isCurrent ? "实况" : `+${laterOffset}h`}
                    </text>
                    <text
                      x={x + 18}
                      y={y + 8}
                      fill="#1a1a2e"
                      fontSize={10}
                      fontWeight={600}
                    >
                      {p.windMs ?? "--"} m/s
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* 控制按钮 */}
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          zIndex: 1000,
        }}
      >
        <button
          className="btn-ghost"
          onClick={() => setZoom((z) => Math.min(4, z * 1.2))}
          aria-label="放大"
          style={{ padding: "4px 8px", minWidth: 28 }}
        >
          +
        </button>
        <button
          className="btn-ghost"
          onClick={() => setZoom((z) => Math.max(0.6, z * 0.85))}
          aria-label="缩小"
          style={{ padding: "4px 8px", minWidth: 28 }}
        >
          −
        </button>
        <button
          className="btn-ghost"
          onClick={() => {
            setZoom(1);
            setPan([0, 0]);
          }}
          aria-label="重置视图"
          style={{ padding: "4px 8px", minWidth: 28, fontSize: 10 }}
        >
          ⟲
        </button>
      </div>

      {/* 图例 */}
      <div className="legend" role="region" aria-label="地图图例">
        <div className="legend-row">
          <span
            className="legend-swatch"
            style={{ background: "#e6312c", borderRadius: 100 }}
          />
          台风中心 (实况)
        </div>
        <div className="legend-row">
          <span
            className="legend-swatch"
            style={{ background: "#1890ff" }}
          />
          预报点
        </div>
        <div className="legend-row">
          <span
            className="legend-swatch"
            style={{ background: "rgba(250, 140, 22, 0.15)", border: "1px dashed rgba(250, 140, 22, 0.6)" }}
          />
          70% 概率圈
        </div>
        <div className="legend-row">
          <span
            className="legend-swatch"
            style={{ background: "rgba(24, 144, 255, 0.12)", border: "1px dashed rgba(24, 144, 255, 0.5)" }}
          />
          强风圈 (30kt)
        </div>
        <div className="legend-row">
          <span
            className="legend-swatch"
            style={{ background: "rgba(230, 49, 44, 0.12)", border: "1px dashed rgba(230, 49, 44, 0.55)" }}
          />
          暴风圈 (50kt)
        </div>
      </div>
    </div>
  );
}

function directionToAngle(d: string): number {
  // N=0°, E=90°, S=180°, W=270°
  const map: Record<string, number> = {
    N: 0,
    NNE: 22.5,
    NE: 45,
    ENE: 67.5,
    E: 90,
    ESE: 112.5,
    SE: 135,
    SSE: 157.5,
    S: 180,
    SSW: 202.5,
    SW: 225,
    WSW: 247.5,
    W: 270,
    WNW: 292.5,
    NW: 315,
    NNW: 337.5,
  };
  return map[d.toUpperCase()] ?? 0;
}
