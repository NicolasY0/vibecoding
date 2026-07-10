import { prisma } from "@/lib/prisma";
import { ZONES } from "@/lib/zones";
import type { ArticleData } from "@/types";
import HeroSection from "@/components/HeroSection";
import EditorialSection from "@/components/EditorialSection";
import HomeCTA from "@/components/HomeCTA";
import ArticleList from "@/components/ArticleList";
import ZoneNav from "@/components/ZoneNav";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Fetch recent articles from each zone
  const results = await Promise.all([
    prisma.article.findMany({
      where: { zoneId: ZONES.TRASH.id, reviewStatus: "approved" },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.article.findMany({
      where: { zoneId: ZONES.RECYCLE.id },
      orderBy: { wilsonScore: "desc" },
      take: 3,
    }),
    prisma.article.findMany({
      where: { zoneId: ZONES.PALACE.id },
      orderBy: { wilsonScore: "desc" },
      take: 3,
    }),
    prisma.article.count({ where: { reviewStatus: "approved" } }),
    prisma.article.count({ where: { reviewStatus: "pending" } }),
  ]);
  const trashArticles = results[0] as ArticleData[];
  const recycleArticles = results[1] as ArticleData[];
  const palaceArticles = results[2] as ArticleData[];
  const totalCount = results[3] as number;
  const reviewCount = results[4] as number;

  // Compute per-author article counts for badges
  const authorCounts = new Map<string, number>();
  for (const a of [...trashArticles, ...recycleArticles, ...palaceArticles]) {
    authorCounts.set(a.authorName, (authorCounts.get(a.authorName) || 0) + 1);
  }
  // Also count from all articles to be accurate
  const allArticles = (await prisma.article.findMany()) as ArticleData[];
  const fullAuthorCounts = new Map<string, number>();
  for (const a of allArticles) {
    fullAuthorCounts.set(a.authorName, (fullAuthorCounts.get(a.authorName) || 0) + 1);
  }

  return (
    <div>
      <HeroSection />
      <EditorialSection />
      <HomeCTA />
      <ZoneNav />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
          {[
            { label: "已回收垃圾", value: totalCount, emoji: "📄", color: "bg-amber-100 text-amber-800" },
            { label: "待审核", value: reviewCount, emoji: "⏳", color: "bg-blue-100 text-blue-800" },
            { label: "垃圾宝殿", value: palaceArticles.length, emoji: "👑", color: "bg-yellow-100 text-yellow-800" },
            { label: "活跃嗅探兽", value: "1 (AI)", emoji: "🐾", color: "bg-green-100 text-green-800" },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`${stat.color} rounded-2xl p-4 text-center shadow-sm`}
            >
              <div className="text-3xl mb-1">{stat.emoji}</div>
              <div className="text-2xl font-extrabold">{stat.value}</div>
              <div className="text-xs font-medium opacity-70">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Palace Section */}
        {palaceArticles.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-extrabold text-gray-800 flex items-center gap-2">
                <span className="text-3xl">👑</span> 垃圾宝殿
                <span className="text-sm font-normal text-gray-400">
                  永恒的垃圾之王
                </span>
              </h2>
              <Link
                href="/zone/palace"
                className="text-sm text-amber-600 hover:text-amber-800 font-medium"
              >
                查看全部 →
              </Link>
            </div>
            <ArticleList
              articles={palaceArticles.map(a => ({
                ...a, createdAt: new Date(a.createdAt),
                _authorCount: fullAuthorCounts.get(a.authorName) || 1
              }))}
            />
          </section>
        )}

        {/* Recycle Section */}
        {recycleArticles.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-extrabold text-gray-800 flex items-center gap-2">
                <span className="text-3xl">♻️</span> 回收站精选
                <span className="text-sm font-normal text-gray-400">
                  可回收的好垃圾
                </span>
              </h2>
              <Link
                href="/zone/recycle"
                className="text-sm text-amber-600 hover:text-amber-800 font-medium"
              >
                查看全部 →
              </Link>
            </div>
            <ArticleList articles={recycleArticles.map(a => ({ ...a, createdAt: new Date(a.createdAt) }))} />
          </section>
        )}

        {/* Latest Trash */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-extrabold text-gray-800 flex items-center gap-2">
              <span className="text-3xl">🗑️</span> 最新垃圾
              <span className="text-sm font-normal text-gray-400">
                刚扔进来的新鲜垃圾
              </span>
            </h2>
            <Link
              href="/zone/trash"
              className="text-sm text-amber-600 hover:text-amber-800 font-medium"
            >
              查看全部 →
            </Link>
          </div>
          <ArticleList
            articles={trashArticles.map(a => ({ ...a, createdAt: new Date(a.createdAt) }))}
            emptyMessage="垃圾桶还是空的...快来扔第一包垃圾吧！🫳🗑️"
          />
        </section>
      </div>
    </div>
  );
}
