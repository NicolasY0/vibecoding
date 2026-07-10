import { prisma } from "@/lib/prisma";
import TopicCard from "@/components/TopicCard";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TopicsPage() {
  const topics = (await prisma.topic.findMany({
    orderBy: { createdAt: "desc" },
  })) as Array<{
    id: number; title: string; slug: string; description: string;
    authorName: string; tags: string[]; paperCount: number; createdAt: Date;
  }>;

  const topicCount = await prisma.topic.count();

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
      <div className="text-center mb-10">
        <span className="text-5xl block mb-4">🧫</span>
        <h1 className="text-4xl font-extrabold text-gray-800 mb-2">
          培养皿
        </h1>
        <p className="text-gray-500 max-w-lg mx-auto">
          社区提出的研究课题。看到感兴趣的？围绕它写一篇论文投稿吧！
        </p>
        <div className="flex items-center justify-center gap-3 mt-4">
          <Link
            href="/submit?type=topic"
            className="px-5 py-2 bg-green-400 hover:bg-green-500 text-white rounded-full font-bold text-sm transition-all shadow-sm"
          >
            🧫 提出新课题
          </Link>
          <Link
            href="/submit?type=paper"
            className="px-5 py-2 bg-amber-400 hover:bg-amber-500 text-gray-800 rounded-full font-bold text-sm transition-all shadow-sm"
          >
            🫳 投稿论文
          </Link>
        </div>
      </div>

      {topics.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <span className="text-6xl block mb-4">🧫</span>
          <p className="text-lg">培养皿还是空的… 来提出第一个课题吧！</p>
        </div>
      ) : (
        <div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {topics.map((topic) => (
            <TopicCard key={topic.id} topic={topic} />
          ))}
        </div>
      )}
    </div>
  );
}
