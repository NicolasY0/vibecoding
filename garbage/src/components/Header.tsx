"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SlideMenu from "./SlideMenu";

const NAV_LINKS = [
  { href: "/", label: "首页", emoji: "🏠" },
  { href: "/zone/trash", label: "垃圾桶", emoji: "🗑️" },
  { href: "/zone/recycle", label: "回收站", emoji: "♻️" },
  { href: "/zone/palace", label: "垃圾宝殿", emoji: "👑" },
  { href: "/zone/landfill", label: "填埋场", emoji: "🪦" },
];

export default function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b-2 border-amber-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Menu + Logo */}
            <div className="flex items-center gap-1">
              {/* Hamburger Menu */}
              <button
                onClick={() => setMenuOpen(true)}
                className="p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                aria-label="菜单"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <Link href="/" className="flex items-center gap-2 group flex-shrink-0">
                <span className="text-3xl">🗑️</span>
                <span className="text-2xl font-extrabold text-gray-800 group-hover:text-amber-500 transition-colors">
                  garbage
                </span>
                <span className="hidden sm:inline text-xs text-gray-400 border border-gray-300 rounded-full px-2 py-0.5">
                  学术底刊
                </span>
              </Link>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-1">
              {NAV_LINKS.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? "bg-amber-100 text-amber-800"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <span className="mr-1">{link.emoji}</span>
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* Right Side Actions */}
            <div className="flex items-center gap-2">
              {/* Search */}
              <Link
                href="/search"
                className="p-2 rounded-lg text-gray-500 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                title="翻垃圾堆"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </Link>

              {/* Submit */}
              <Link
                href="/submit"
                className="hidden sm:inline px-4 py-2 bg-amber-400 hover:bg-amber-500 text-gray-800 rounded-full font-bold text-sm transition-all shadow-sm hover:shadow-md"
              >
                🫳 扔垃圾
              </Link>

              <Link
                href="/login"
                className="hidden sm:inline px-3 py-2 text-gray-500 hover:text-gray-800 text-sm transition-colors"
              >
                登录
              </Link>
            </div>
          </div>

          {/* Mobile Nav */}
          <nav className="lg:hidden flex overflow-x-auto gap-1 pb-2 -mx-2 px-2">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? "bg-amber-100 text-amber-800"
                      : "text-gray-500 bg-gray-50 hover:bg-gray-100"
                  }`}
                >
                  {link.emoji} {link.label}
                </Link>
              );
            })}
            <Link
              href="/submit"
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-400 text-gray-800 whitespace-nowrap"
            >
              🫳 扔垃圾
            </Link>
          </nav>
        </div>
      </header>

      {/* Slide Menu */}
      <SlideMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
