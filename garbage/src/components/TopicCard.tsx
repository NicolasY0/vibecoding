import Link from "next/link";
import { formatDate, truncate } from "@/lib/utils";

interface TopicCardProps {
  topic: {
    id: number;
    title: string;
    slug: string;
    description: string;
    authorName: string;
    tags: string[];
    paperCount: number;
    createdAt: Date;
  };
}

export default function TopicCard({ topic }: TopicCardProps) {
  return (
    <Link href={`/topic/${topic.slug}`} className="block group">
      <article className="bg-white rounded-2xl border border-green-200 p-5 shadow-sm hover:shadow-md hover:border-green-300 transition-all h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
            🧫 课题
          </span>
          {topic.paperCount > 0 && (
            <span className="text-xs text-gray-400">
              {topic.paperCount} 篇投稿
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-gray-800 group-hover:text-green-600 transition-colors mb-2 line-clamp-2">
          {topic.title}
        </h3>

        {/* Description */}
        <p className="text-sm text-gray-500 mb-3 line-clamp-2 flex-1">
          {truncate(topic.description, 100)}
        </p>

        {/* Tags */}
        {topic.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {topic.tags.slice(0, 3).map((tag) => (
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
          <span>🧑‍🔧 {topic.authorName}</span>
          <span>{formatDate(topic.createdAt)}</span>
        </div>
      </article>
    </Link>
  );
}
