import Link from "next/link";
import { formatDate, truncate } from "@/lib/utils";
import { getZoneById } from "@/lib/zones";

interface ArticleCardProps {
  article: {
    id: number;
    slug: string;
    title: string;
    authorName: string;
    abstract: string | null;
    tags: string[];
    zoneId: number;
    wilsonScore: number;
    totalVotes: number;
    viewCount: number;
    createdAt: Date;
    reviewStatus: string;
  };
  authorArticleCount?: number;
}

export default function ArticleCard({ article, authorArticleCount }: ArticleCardProps) {
  // Get author title
  const getAuthorBadge = (count: number) => {
    if (count >= 20) return { suffix: "🌟", title: "垃圾之神", color: "text-yellow-500" };
    if (count >= 10) return { suffix: "👑", title: "垃圾领主", color: "text-amber-500" };
    if (count >= 5) return { suffix: "🏭", title: "垃圾大亨", color: "text-orange-500" };
    if (count >= 2) return { suffix: "🧹", title: "资深拾荒者", color: "text-green-600" };
    if (count >= 1) return { suffix: "🧑‍🔧", title: "初级拾荒者", color: "text-blue-500" };
    return null;
  };
  const badge = authorArticleCount != null ? getAuthorBadge(authorArticleCount) : null;
  const zone = getZoneById(article.zoneId);

  return (
    <Link
      href={`/article/${article.slug}`}
      className="block group"
    >
      <article className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md hover:border-amber-300 transition-all h-full flex flex-col">
        {/* Zone Badge + Review Status */}
        <div className="flex items-center gap-2 mb-3">
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${zone.color}`}
          >
            {zone.emoji} {zone.name}
          </span>
          {article.reviewStatus === "approved" && (
            <span className="text-xs text-green-600 border border-green-300 rounded-full px-2 py-0.5">
              ✅ AI审核通过
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-gray-800 group-hover:text-amber-600 transition-colors mb-2 line-clamp-2">
          {article.title}
        </h3>

        {/* Abstract */}
        {article.abstract && (
          <p className="text-sm text-gray-500 mb-3 line-clamp-2 flex-1">
            {truncate(article.abstract, 120)}
          </p>
        )}

        {/* Tags */}
        {article.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {article.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-xs bg-gray-100 text-gray-600 rounded-md px-2 py-0.5"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Meta */}
        <div className="flex items-center justify-between text-xs text-gray-400 mt-auto pt-3 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              🧑‍🔧 {article.authorName}
              {badge && (
                <span className={`text-[10px] font-medium ${badge.color}`}>
                  {badge.suffix}
                </span>
              )}
            </span>
            <span>{formatDate(article.createdAt)}</span>
          </div>
          <div className="flex items-center gap-3">
            <span title="含金量">🪙 {(article.wilsonScore * 100).toFixed(0)}%</span>
            <span title="投票数">{article.totalVotes}票</span>
            <span title="阅读量">👁 {article.viewCount}</span>
          </div>
        </div>
      </article>
    </Link>
  );
}
