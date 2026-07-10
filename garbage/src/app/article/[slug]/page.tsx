import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { getZoneById } from "@/lib/zones";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import ReviewBadge from "@/components/ReviewBadge";
import CommentSection from "@/components/CommentSection";
import VoteClient from "./VoteClient";

export const dynamic = "force-dynamic";

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const article = await prisma.article.findUnique({
    where: { slug },
  }) as {
    id: number; title: string; slug: string; authorName: string;
    abstract: string | null; content: string; tags: string[];
    zoneId: number; upvotes: number; downvotes: number;
    wilsonScore: number; totalVotes: number;
    reviewStatus: string; reviewComment: string | null;
    reviewScore: number | null; reviewedBy: string;
    viewCount: number; createdAt: Date; updatedAt: Date;
    userId: string | null;
  } | null;

  if (!article) {
    notFound();
  }

  // Fetch comments
  const comments = (await prisma.comment.findMany({
    where: { articleId: article.id },
    orderBy: { createdAt: "asc" },
  })) as { id: number; authorName: string; content: string; createdAt: Date }[];

  // Increment view count (fire and forget)
  prisma
    .article.update({
      where: { id: article.id },
      data: { viewCount: { increment: 1 } },
    })
    .catch(() => {});

  const zone = getZoneById(article.zoneId);

  return (
    <article className="max-w-4xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="mb-8">
        {/* Zone Badge */}
        <div className="flex items-center gap-3 mb-4">
          <span
            className={`text-sm font-bold px-3 py-1 rounded-full text-white ${zone.color}`}
          >
            {zone.emoji} {zone.name}
          </span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-800 mb-4 leading-tight">
          {article.title}
        </h1>

        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            🧑‍🔧 {article.authorName}
          </span>
          <span>📅 {formatDate(article.createdAt)}</span>
          <span>👁 {article.viewCount + 1} 次阅读</span>
          {article.tags.length > 0 && (
            <div className="flex gap-1">
              {(article.tags as string[]).map((tag: string) => (
                <span
                  key={tag}
                  className="text-xs bg-gray-100 text-gray-600 rounded-md px-2 py-0.5"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* AI Review Badge */}
      <div className="mb-8">
        <ReviewBadge
          reviewStatus={article.reviewStatus}
          reviewScore={article.reviewScore}
          reviewComment={article.reviewComment}
          reviewedBy={article.reviewedBy}
        />
      </div>

      {/* Abstract */}
      {article.abstract && (
        <div className="bg-gray-50 border-l-4 border-amber-400 p-5 rounded-r-xl mb-8">
          <h3 className="text-sm font-bold text-gray-600 mb-2">📋 摘要</h3>
          <p className="text-gray-700 leading-relaxed">{article.abstract}</p>
        </div>
      )}

      {/* Content */}
      <div className="mb-10 bg-white rounded-2xl p-6 sm:p-10 shadow-sm border border-gray-100">
        <MarkdownRenderer content={article.content} />
      </div>

      {/* Voting */}
      <div className="mb-10">
        <VoteClient
          articleId={article.id}
          initialScore={article.wilsonScore}
          initialVotes={article.totalVotes}
          initialUpvotes={article.upvotes}
          initialDownvotes={article.downvotes}
        />
      </div>

      {/* Comments */}
      <div className="mb-10">
        <CommentSection articleId={article.id} initialComments={comments} />
      </div>

      {/* Zone Info */}
      <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
        <h3 className="text-sm font-bold text-gray-600 mb-3">
          🗺️ 关于 {zone.name}
        </h3>
        <p className="text-sm text-gray-500">{zone.description}</p>
        {zone.slug === "trash" && (
          <p className="text-xs text-gray-400 mt-2">
            需要 20+ 次投票且含金量 ≥ 65% 才能升级到 ♻️ 回收站
          </p>
        )}
        {zone.slug === "recycle" && (
          <p className="text-xs text-gray-400 mt-2">
            需要 50+ 次投票且含金量 ≥ 80% 才能升级到 👑 垃圾宝殿
          </p>
        )}
      </div>
    </article>
  );
}
