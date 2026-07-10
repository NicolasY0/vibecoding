import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getZoneBySlug } from "@/lib/zones";
import ArticleList from "@/components/ArticleList";

export const dynamic = "force-dynamic";

export default async function ZonePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { slug } = await params;
  const { sort } = await searchParams;
  const zone = getZoneBySlug(slug);

  if (!zone || zone.slug !== slug) {
    notFound();
  }

  const orderBy: Record<string, string> =
    sort === "votes"
      ? { totalVotes: "desc" }
      : sort === "score"
        ? { wilsonScore: "desc" }
        : { createdAt: "desc" };

  const articles = (await prisma.article.findMany({
    where: {
      zoneId: zone.id,
      reviewStatus: "approved",
    },
    orderBy,
    take: 50,
  })) as import("@/types").ArticleData[];

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
      {/* Zone Header */}
      <div className="text-center mb-10">
        <span className="text-6xl mb-4 block">{zone.emoji}</span>
        <h1 className="text-4xl font-extrabold text-gray-800 mb-2">
          {zone.name}
        </h1>
        <p className="text-gray-500 max-w-md mx-auto">{zone.description}</p>

        {/* Zone flow info */}
        <div className="mt-4 inline-flex items-center gap-2 text-xs text-gray-400 bg-gray-100 rounded-full px-4 py-2">
          {zone.slug === "trash" && (
            <>
              🗑️ 垃圾桶 → 20票+含金量65% → ♻️ 回收站 → 50票+含金量80% → 👑 垃圾宝殿
            </>
          )}
          {zone.slug === "recycle" && (
            <>
              🗑️ 垃圾桶 → 20票+含金量65% → ♻️ 回收站 → 50票+含金量80% → 👑 垃圾宝殿
            </>
          )}
          {zone.slug === "palace" && (
            <>
              👑 垃圾宝殿 — 最高荣誉，永不降级。永远的垃圾之王！
            </>
          )}
          {zone.slug === "landfill" && (
            <>
              🪦 填埋场 — 分数不够的垃圾在这里沉睡。含金量回升到55%可以复活！
            </>
          )}
        </div>
      </div>

      {/* Sort Controls */}
      <div className="flex justify-end gap-2 mb-6">
        {[
          { value: "", label: "🕐 最新" },
          { value: "score", label: "🪙 含金量" },
          { value: "votes", label: "🔥 最热" },
        ].map((s) => {
          const currentSort = sort || "";
          const isActive = currentSort === s.value;
          return (
            <a
              key={s.value}
              href={`/zone/${slug}${s.value ? `?sort=${s.value}` : ""}`}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                isActive
                  ? "bg-amber-400 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              {s.label}
            </a>
          );
        })}
      </div>

      {/* Articles */}
      <ArticleList
        articles={articles.map((a) => ({
          ...a,
          createdAt: new Date(a.createdAt),
        }))}
        emptyMessage={`${zone.emoji} ${zone.name}还空着...`}
      />
    </div>
  );
}
