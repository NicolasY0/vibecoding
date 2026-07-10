"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SlideMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const MENU_SECTIONS = [
  {
    title: "垃圾分类",
    items: [
      { href: "/zone/trash", label: "垃圾桶", emoji: "🗑️", desc: "新投稿待分类" },
      { href: "/zone/recycle", label: "回收站", emoji: "♻️", desc: "可回收的好垃圾" },
      { href: "/zone/palace", label: "垃圾宝殿", emoji: "👑", desc: "永恒的垃圾之王" },
      { href: "/zone/landfill", label: "填埋场", emoji: "🪦", desc: "沉睡的垃圾" },
    ],
  },
  {
    title: "功能",
    items: [
      { href: "/topics", label: "培养皿", emoji: "🧫", desc: "浏览社区课题" },
      { href: "/submit", label: "扔垃圾", emoji: "🫳", desc: "投稿论文或提出课题" },
      { href: "/rankings", label: "排行榜", emoji: "🏆", desc: "拾荒者贡献排名" },
      { href: "/search", label: "翻垃圾堆", emoji: "🔍", desc: "搜索文章" },
      { href: "/feedback", label: "意见箱", emoji: "📮", desc: "给我们提建议" },
    ],
  },
  {
    title: "更多",
    items: [
      { href: "/about", label: "关于 garbage", emoji: "📜", desc: "了解这个项目" },
      { href: "/review", label: "审核中心", emoji: "🐾", desc: "嗅探兽工作台" },
      { href: "/apply-reviewer", label: "申请嗅探兽", emoji: "🐾", desc: "加入审核团队" },
      { href: "/login", label: "登录", emoji: "🔑", desc: "登录账户" },
    ],
  },
];

const FOOTER_LINKS = [
  { href: "/about", label: "关于" },
  { href: "/feedback", label: "反馈与建议" },
  { href: "/about", label: "投稿规则" },
  { href: "/about", label: "联系我们" },
];

export default function SlideMenu({ isOpen, onClose }: SlideMenuProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Slide Panel */}
      <div
        className={`fixed top-0 left-0 h-full w-80 sm:w-96 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out overflow-y-auto ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🗑️</span>
            <span className="font-extrabold text-gray-800 text-lg">garbage</span>
            <span className="text-xs text-gray-400 border border-gray-300 rounded-full px-2 py-0.5">
              学术底刊
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Menu Sections */}
        <div className="p-4 space-y-6">
          {MENU_SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">
                {section.title}
              </h3>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${
                        isActive
                          ? "bg-amber-100 text-amber-800"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span className="text-xl flex-shrink-0">{item.emoji}</span>
                      <div className="min-w-0">
                        <div className="font-medium text-sm">{item.label}</div>
                        <div className="text-xs text-gray-400 truncate">{item.desc}</div>
                      </div>
                      {isActive && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Links */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400">
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={onClose}
                className="hover:text-gray-600 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <p className="text-xs text-gray-300 mt-3">
            &ldquo;Truth fades, garbage lasts.&rdquo;
          </p>
        </div>
      </div>
    </>
  );
}
