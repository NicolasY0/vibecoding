"use client";

import ArticleCard from "@/components/ArticleCard";

interface SearchResultsProps {
  query: string;
  results: Array<{
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
}

export default function SearchResults({ query, results }: SearchResultsProps) {
  if (!query) {
    return (
      <div className="text-center py-16 text-gray-400">
        <span className="text-6xl block mb-4">🔍</span>
        <p className="text-lg">输入关键词，开始在垃圾堆里翻找…</p>
        <p className="text-sm mt-2">可以搜索标题、作者、摘要、标签</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <span className="text-6xl block mb-4">🫤</span>
        <p className="text-lg">
          翻遍了垃圾堆，没找到和 <strong className="text-gray-600">&ldquo;{query}&rdquo;</strong> 相关的垃圾
        </p>
        <p className="text-sm mt-2">试试换个关键词？</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-6">
        找到 <strong className="text-gray-800">{results.length}</strong> 篇与
        &ldquo;<strong className="text-gray-800">{query}</strong>&rdquo; 相关的垃圾
      </p>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {results.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>
    </div>
  );
}
