import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "巴威 BAVI 实时监控 | 2026 年第 09 号台风",
  description:
    "腾讯地图亮色风格的台风巴威实时监控页。每 5 分钟自动从日本气象厅同步当前位置、中心气压、风速、120 小时路径与概率圈、风圈半径。数据仅供信息参考。",
  metadataBase: new URL("https://typhoon-bavi.example.com"),
  openGraph: {
    title: "巴威 BAVI 实时监控",
    description:
      "2026 年第 09 号台风「巴威」实时位置、强度、120h 路径、概率圈与风圈。每 5 分钟自动同步。",
    type: "website",
  },
  robots: { index: false, follow: false },
  other: {
    "data-source":
      "Japan Meteorological Agency (JMA) 热带气旋公报 (https://www.data.jma.go.jp/multi/cyclone/)",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#f5f7fa",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head>
        {/* 地图样式 CSS (亮色腾讯地图风格) */}
      </head>
      <body>
        <div className="app">{children}</div>
      </body>
    </html>
  );
}
