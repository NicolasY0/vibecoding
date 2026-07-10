import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "garbage 学术底刊 — Truth fades, garbage lasts.",
  description:
    "社区驱动的学术垃圾回收与分类平台。扔下你的学术垃圾，让嗅探兽来闻一闻，社区来分类。",
  keywords: ["学术底刊", "garbage", "社区投稿", "垃圾期刊", "学术垃圾"],
  openGraph: {
    title: "garbage 学术底刊",
    description: "社区驱动的学术垃圾回收与分类平台",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-amber-50/30">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
