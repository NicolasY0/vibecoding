import ArticleCard from "./ArticleCard";

interface ArticleListProps {
  articles: Array<{
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
  }>;
  emptyMessage?: string;
}

export default function ArticleList({
  articles,
  emptyMessage = "这里还空荡荡的...快来扔第一包垃圾吧！🗑️",
}: ArticleListProps) {
  if (articles.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <span className="text-6xl block mb-4">🗑️</span>
        <p className="text-lg">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {articles.map((article) => (
        <ArticleCard key={article.id} article={article} />
      ))}
    </div>
  );
}
