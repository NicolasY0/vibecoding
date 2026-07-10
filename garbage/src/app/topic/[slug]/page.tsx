import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TopicDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const topic = (await prisma.topic.findUnique({
    where: { slug },
  })) as {
    id: number; title: string; slug: string; description: string;
    authorName: string; tags: string[]; paperCount: number; createdAt: Date;
  } | null;

  if (!topic) {
    notFound();
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <span className="text-xs font-bold px-3 py-1 rounded-full bg-green-100 text-green-700 inline-block mb-4">
          🧫 课题
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-800 mb-4 leading-tight">
          {topic.title}
        </h1>
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
          <span>🧑‍🔧 {topic.authorName}</span>
          <span>📅 {formatDate(topic.createdAt)}</span>
          <span>📄 {topic.paperCount} 篇投稿</span>
        </div>
        {topic.tags.length > 0 && (
          <div className="flex gap-1 mt-3">
            {topic.tags.map((tag: string) => (
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

      {/* Description */}
      <div className="bg-green-50 border border-green-200 rounded-2xl p-6 sm:p-8 mb-10">
        <h3 className="text-sm font-bold text-green-700 mb-3">📋 课题描述</h3>
        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
          {topic.description}
        </p>
      </div>

      {/* CTA */}
      <div className="text-center bg-amber-50 border border-amber-200 rounded-2xl p-8">
        <span className="text-4xl block mb-3">✍️</span>
        <h3 className="text-xl font-bold text-gray-800 mb-2">
          对这个课题感兴趣？
        </h3>
        <p className="text-gray-500 mb-4 text-sm">
          围绕这个课题写一篇论文，扔进垃圾桶让社区来分类！
        </p>
        <Link
          href={`/submit?type=paper&topic=${encodeURIComponent(topic.title)}`}
          className="inline-block px-6 py-3 bg-amber-400 hover:bg-amber-500 text-gray-800 rounded-full font-bold text-lg transition-all shadow-lg hover:shadow-xl"
        >
          🫳 为这个课题投稿
        </Link>
      </div>
    </div>
  );
}
