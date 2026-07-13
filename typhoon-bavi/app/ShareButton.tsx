"use client";

/**
 * 分享预览图 - 通过 SVG 渲染, 在客户端转 PNG 下载
 * 尺寸 1200x630
 */

import { useState } from "react";
import type { ApiResponse } from "@/lib/jma";

export default function ShareButton({ data }: { data: ApiResponse | null }) {
  const [busy, setBusy] = useState(false);

  async function generate() {
    if (!data) return;
    setBusy(true);
    try {
      const svg = buildSvg(data);
      // 通过 canvas 转换
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = url;
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("image load fail"));
      });
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 630;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, 1200, 630);
      const png = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = png;
      a.download = "bavi-share.png";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("分享图生成失败: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      className="btn-ghost"
      onClick={generate}
      disabled={busy || !data}
      aria-label="生成分享预览图"
    >
      {busy ? "生成中…" : "生成分享图"}
    </button>
  );
}

function buildSvg(d: ApiResponse): string {
  const cur = d.current;
  const lat = cur?.lat != null ? `${cur.lat.toFixed(1)}°N` : "--";
  const lon = cur?.lon != null ? `${cur.lon.toFixed(1)}°E` : "--";
  const wind = cur?.windMs != null ? `${cur.windMs} m/s` : "--";
  const pressure = cur?.pressureHpa != null ? `${cur.pressureHpa} hPa` : "--";
  const cls = cur?.className ?? "--";
  const dir = cur?.direction ?? "--";
  const speed = cur?.speedKmh != null ? `${cur.speedKmh} km/h` : "--";
  const fcCount = d.forecast?.length ?? 0;
  const issued = d.source.issuedAt
    ? new Date(d.source.issuedAt).toLocaleString("zh-CN", { hour12: false, timeZone: "Asia/Tokyo" })
    : "--";
  const issuedLabel = issued ? `${issued} JST` : "--";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f5f7fa"/>
      <stop offset="100%" stop-color="#e8eef5"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.18" cy="0.55" r="0.5">
      <stop offset="0%" stop-color="#e6312c" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#e6312c" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="titleG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1a1a2e"/>
      <stop offset="100%" stop-color="#4a5568"/>
    </linearGradient>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1890ff"/>
      <stop offset="100%" stop-color="#096dd9"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>

  <!-- 顶部品牌 -->
  <g>
    <rect x="40" y="40" width="60" height="60" rx="10" fill="url(#brand)"/>
    <text x="70" y="80" font-size="22" font-weight="800" fill="#fff" text-anchor="middle" font-family="sans-serif">BV</text>
    <text x="120" y="64" font-size="14" fill="#8895a7" font-family="sans-serif" letter-spacing="2">TYPHOON WATCH · 台风监测</text>
    <text x="120" y="86" font-size="14" fill="#4a5568" font-family="sans-serif">公开数据 · 仅供信息参考</text>
  </g>

  <!-- 风暴名称 -->
  <g transform="translate(40,200)">
    <text font-size="110" font-weight="800" fill="url(#titleG)" font-family="sans-serif" letter-spacing="6">巴威</text>
    <text x="280" y="-6" font-size="32" font-weight="600" fill="#1890ff" font-family="sans-serif" letter-spacing="6">BAVI</text>
    <text x="280" y="32" font-size="22" fill="#096dd9" font-family="sans-serif">2026 年第 09 号台风</text>
    <rect x="280" y="50" width="120" height="32" rx="16" fill="rgba(24,144,255,0.08)" stroke="rgba(24,144,255,0.3)"/>
    <text x="340" y="71" font-size="16" fill="#1890ff" text-anchor="middle" font-family="sans-serif">${cls}</text>
  </g>

  <!-- 关键指标 -->
  <g transform="translate(40,400)">
    <g>
      <text font-size="14" fill="#8895a7" font-family="sans-serif">中心气压</text>
      <text y="42" font-size="42" font-weight="700" fill="#1a1a2e" font-family="sans-serif">${pressure}</text>
    </g>
    <g transform="translate(220,0)">
      <text font-size="14" fill="#8895a7" font-family="sans-serif">最大风速</text>
      <text y="42" font-size="42" font-weight="700" fill="#e6312c" font-family="sans-serif">${wind}</text>
    </g>
    <g transform="translate(440,0)">
      <text font-size="14" fill="#8895a7" font-family="sans-serif">中心位置</text>
      <text y="42" font-size="32" font-weight="700" fill="#1a1a2e" font-family="sans-serif">${lat} ${lon}</text>
    </g>
    <g transform="translate(760,0)">
      <text font-size="14" fill="#8895a7" font-family="sans-serif">移向 / 移速</text>
      <text y="42" font-size="32" font-weight="700" fill="#1a1a2e" font-family="sans-serif">${dir} · ${speed}</text>
    </g>
  </g>

  <!-- 路径示意 (右侧) -->
  <g transform="translate(820,190)">
    <rect x="-20" y="-30" width="360" height="240" rx="14" fill="rgba(255,255,255,0.6)" stroke="rgba(224,230,236,0.8)"/>
    <text x="0" y="0" font-size="12" fill="#8895a7" font-family="sans-serif">${fcCount} 个预报点 (120h)</text>
    ${buildMiniPath(d)}
  </g>

  <!-- 底部来源与免责声明 -->
  <g transform="translate(40,560)">
    <text font-size="13" fill="#8895a7" font-family="sans-serif">数据来源: 日本气象厅 JMA · ${issuedLabel}</text>
    <text y="22" font-size="11" fill="#b0bcc9" font-family="sans-serif">仅供信息参考，请以当地主管部门正式预警为准</text>
  </g>

  <text x="1160" y="600" font-size="10" fill="#b0bcc9" text-anchor="end" font-family="sans-serif">typhoon-bavi · ${new Date().getFullYear()}</text>
</svg>`;
}

function buildMiniPath(d: ApiResponse): string {
  const all = [d.current, ...(d.forecast || [])].filter(
    (p): p is NonNullable<typeof p> => !!p && p.lat != null && p.lon != null
  );
  if (all.length === 0) return "";
  const minLat = Math.min(...all.map((p) => p.lat as number)) - 2;
  const maxLat = Math.max(...all.map((p) => p.lat as number)) + 2;
  const minLon = Math.min(...all.map((p) => p.lon as number)) - 2;
  const maxLon = Math.max(...all.map((p) => p.lon as number)) + 2;
  const W = 320, H = 180;
  function proj(lon: number, lat: number) {
    const x = ((lon - minLon) / (maxLon - minLon)) * W;
    const y = H - ((lat - minLat) / (maxLat - minLat)) * H;
    return [x, y];
  }
  const pts = all.map((p, i) => {
    const [x, y] = proj(p.lon as number, p.lat as number);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${
      i === 0 ? 6 : 3.5
    }" fill="${i === 0 ? "#e6312c" : "#1890ff"}" stroke="#fff" stroke-width="1.2"/>`;
  });
  const dStr = all
    .map((p, i) => {
      const [x, y] = proj(p.lon as number, p.lat as number);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return `
    <g transform="translate(0,20)">
      <path d="${dStr}" fill="none" stroke="#1890ff" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity="0.8"/>
      ${pts.join("")}
    </g>
  `;
}
