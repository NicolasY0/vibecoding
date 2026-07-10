"use client";

import { useState } from "react";
import { formatDate } from "@/lib/utils";

interface Comment {
  id: number;
  authorName: string;
  content: string;
  createdAt: Date;
}

interface CommentSectionProps {
  articleId: number;
  initialComments: Comment[];
}

export default function CommentSection({
  articleId,
  initialComments,
}: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [authorName, setAuthorName] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/articles/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId,
          authorName: authorName.trim() || "匿名路人",
          content: content.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setComments((prev) => [
          ...prev,
          { ...data.comment, createdAt: new Date(data.comment.createdAt) },
        ]);
        setContent("");
      }
    } catch {
      // fail silently
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          💬 评论区
          {comments.length > 0 && (
            <span className="text-sm font-normal text-gray-400">
              ({comments.length} 条)
            </span>
          )}
        </h3>
      </div>

      {/* Comment List */}
      <div className="divide-y divide-gray-100">
        {comments.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400">
            <span className="text-4xl block mb-2">💬</span>
            <p className="text-sm">还没有评论，来抢沙发吧！</p>
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="px-6 py-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-xs">
                  👤
                </span>
                <span className="text-sm font-medium text-gray-800">
                  {comment.authorName}
                </span>
                <span className="text-xs text-gray-400">
                  {formatDate(comment.createdAt)}
                </span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed pl-9">
                {comment.content}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Comment Form */}
      <div className="border-t border-gray-200 px-6 py-4 bg-gray-50/50">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-3">
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="你的昵称"
              maxLength={30}
              className="w-32 sm:w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="说点什么..."
              rows={2}
              maxLength={500}
              required
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 resize-none"
            />
          </div>
          <div className="flex justify-between items-center pl-[calc(8rem+0.75rem)] sm:pl-[calc(10rem+0.75rem)]">
            <span className="text-xs text-gray-400">{content.length}/500</span>
            <button
              type="submit"
              disabled={submitting || !content.trim()}
              className="px-4 py-1.5 bg-amber-400 hover:bg-amber-500 disabled:bg-gray-300 disabled:cursor-not-allowed text-gray-800 rounded-full font-bold text-sm transition-all"
            >
              {submitting ? "发送中..." : "💬 评论"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
