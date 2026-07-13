// 通过 Node 端拉取 JMA 数据, 用 sharp/canvas 生成静态分享图
// 使用方式: node scripts/gen-share.js
// 注意: 我们在客户端 ShareButton 已可生成, 此脚本是兜底.

const fs = require("fs");
const path = require("path");

const URL = "https://www.data.jma.go.jp/multi/data/VPTW60/61_cn_zs.json";

function parseCoord(v) {
  if (v == null) return null;
  const s = String(v).trim();
  const num = parseFloat(s);
  if (Number.isNaN(num)) return null;
  if (s.endsWith("S") || s.endsWith("W")) return -num;
  return num;
}

function parseNumber(v) {
  if (v == null) return null;
  const n = Number(String(v).trim());
  return Number.isNaN(n) ? null : n;
}

function buildMiniPath(infos) {
  const points = infos
    .filter((info) => info?.centerPart?.coordinateLat && info?.centerPart?.coordinateLon)
    .map((info) => ({
      lat: parseCoord(info.centerPart.coordinateLat),
      lon: parseCoord(info.centerPart.coordinateLon),
    }))
    .filter((p) => p.lat != null && p.lon != null);

  if (points.length === 0) return "";

  const minLat = Math.min(...points.map((p) => p.lat)) - 2;
  const maxLat = Math.max(...points.map((p) => p.lat)) + 2;
  const minLon = Math.min(...points.map((p) => p.lon)) - 2;
  const maxLon = Math.max(...points.map((p) => p.lon)) + 2;
  const W = 320, H = 180;
  function proj(lon, lat) {
    const x = ((lon - minLon) / (maxLon - minLon)) * W;
    const y = H - ((lat - minLat) / (maxLat - minLat)) * H;
    return [x, y];
  }
  const pts = points.map((p, i) => {
    const [x, y] = proj(p.lon, p.lat);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${i === 0 ? 6 : 3.5}" fill="${i === 0 ? "#e6312c" : "#1890ff"}" stroke="#fff" stroke-width="1.2"/>`;
  });
  const dStr = points
    .map((p, i) => {
      const [x, y] = proj(p.lon, p.lat);
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

(async () => {
  let raw;
  try {
    const res = await fetch(URL, { headers: { "User-Agent": "typhoon-bavi-monitor/0.1" } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    raw = await res.json();
  } catch (e) {
    console.error("拉取数据失败", e);
    process.exit(1);
  }

  const cur = raw.meteorologicalInfos[0];
  const lat = cur.centerPart.coordinateLat;
  const lon = cur.centerPart.coordinateLon;
  const wind = cur.windPart.windSpeedMS;
  const pressure = cur.centerPart.pressure;
  const cls = cur.classPart.typhoonClassName;
  const dir = cur.centerPart.direction;
  const speed = cur.centerPart.speedKmH;
  const fcCount = raw.meteorologicalInfos.length;
  const issued = raw.reportDateTime;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
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

  <rect x="40" y="40" width="60" height="60" rx="10" fill="url(#brand)"/>
  <text x="70" y="80" font-size="22" font-weight="800" fill="#fff" text-anchor="middle" font-family="sans-serif">BV</text>
  <text x="120" y="64" font-size="14" fill="#8895a7" font-family="sans-serif" letter-spacing="2">TYPHOON WATCH · 台风监测</text>
  <text x="120" y="86" font-size="14" fill="#4a5568" font-family="sans-serif">公开数据 · 仅供信息参考</text>

  <g transform="translate(40,200)">
    <text font-size="110" font-weight="800" fill="url(#titleG)" font-family="sans-serif" letter-spacing="6">巴威</text>
    <text x="280" y="-6" font-size="32" font-weight="600" fill="#1890ff" font-family="sans-serif" letter-spacing="6">BAVI</text>
    <text x="280" y="32" font-size="22" fill="#096dd9" font-family="sans-serif">2026 年第 09 号台风</text>
    <rect x="280" y="50" width="120" height="32" rx="16" fill="rgba(24,144,255,0.08)" stroke="rgba(24,144,255,0.3)"/>
    <text x="340" y="71" font-size="16" fill="#1890ff" text-anchor="middle" font-family="sans-serif">${cls}</text>
  </g>

  <g transform="translate(40,400)">
    <text font-size="14" fill="#8895a7" font-family="sans-serif">中心气压</text>
    <text y="42" font-size="42" font-weight="700" fill="#1a1a2e" font-family="sans-serif">${pressure} hPa</text>
    <g transform="translate(220,0)">
      <text font-size="14" fill="#8895a7" font-family="sans-serif">最大风速</text>
      <text y="42" font-size="42" font-weight="700" fill="#e6312c" font-family="sans-serif">${wind} m/s</text>
    </g>
    <g transform="translate(440,0)">
      <text font-size="14" fill="#8895a7" font-family="sans-serif">中心位置</text>
      <text y="42" font-size="32" font-weight="700" fill="#1a1a2e" font-family="sans-serif">${lat} ${lon}</text>
    </g>
    <g transform="translate(760,0)">
      <text font-size="14" fill="#8895a7" font-family="sans-serif">移向 / 移速</text>
      <text y="42" font-size="32" font-weight="700" fill="#1a1a2e" font-family="sans-serif">${dir} · ${speed} km/h</text>
    </g>
  </g>

  <g transform="translate(820,190)">
    <rect x="-20" y="-30" width="360" height="240" rx="14" fill="rgba(255,255,255,0.6)" stroke="rgba(224,230,236,0.8)"/>
    <text x="0" y="0" font-size="12" fill="#8895a7" font-family="sans-serif">${fcCount} 个预报点 (120h)</text>
    ${buildMiniPath(raw.meteorologicalInfos)}
  </g>

  <g transform="translate(40,560)">
    <text font-size="13" fill="#8895a7" font-family="sans-serif">数据来源: 日本气象厅 JMA · ${issued} JST</text>
    <text y="22" font-size="11" fill="#b0bcc9" font-family="sans-serif">仅供信息参考，请以当地主管部门正式预警为准</text>
  </g>

  <text x="1160" y="600" font-size="10" fill="#b0bcc9" text-anchor="end" font-family="sans-serif">typhoon-bavi · ${new Date().getFullYear()}</text>
</svg>`;

  const outDir = path.join(process.cwd(), "public");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "share.svg"), svg, "utf8");
  console.log("OK", path.join(outDir, "share.svg"));
})();
