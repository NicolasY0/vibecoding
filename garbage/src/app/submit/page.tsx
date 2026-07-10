"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import MarkdownEditor from "@/components/MarkdownEditor";

function SubmitForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitType, setSubmitType] = useState<"paper" | "topic">("paper");
  const [title, setTitle] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [abstract, setAbstract] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    slug?: string;
    reviewResult?: {
      approved: boolean;
      score: number;
      comment: string;
      originality: number;
      academicFormat: number;
      absurdity: number;
      logicCoherence: number;
      garbageValue: number;
    };
  } | null>(null);

  // Read query params for type and topic
  useEffect(() => {
    const type = searchParams.get("type");
    if (type === "topic") setSubmitType("topic");
    const topicParam = searchParams.get("topic");
    if (topicParam) {
      setTitle(topicParam);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (submitType === "paper" && !content.trim()) return;
    if (submitType === "topic" && !abstract.trim()) return;

    setSubmitting(true);
    setResult(null);

    try {
      if (submitType === "topic") {
        const res = await fetch("/api/topics/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            description: abstract.trim(),
            authorName: authorName.trim() || "匿名拾荒者",
            tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          }),
        });
        const data = await res.json();
        setResult({ success: data.success, message: data.success ? "课题已提交！" : data.message, slug: data.slug });
        if (data.success) setTimeout(() => router.push(`/topic/${data.slug}`), 2000);
        return;
      }

      const res = await fetch("/api/articles/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          authorName: authorName.trim() || "匿名拾荒者",
          abstract: abstract.trim(),
          content: content.trim(),
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });

      const data = await res.json();
      setResult(data);

      if (data.success) {
        // Redirect to article after 3 seconds
        setTimeout(() => {
          router.push(`/article/${data.slug}`);
        }, 3000);
      }
    } catch {
      setResult({
        success: false,
        message: "投稿失败，请稍后再试。可能是网络或服务器出了问题。",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-extrabold text-gray-800 mb-2">
          {submitType === "topic" ? "🧫 提出课题" : "🫳 扔垃圾"}
        </h1>
        <p className="text-gray-500">
          {submitType === "topic"
            ? "提出一个研究课题，让其他拾荒者围绕它投稿论文。"
            : "提交你的学术垃圾。AI 嗅探兽会先闻一闻，然后交给社区垃圾分类。"}
        </p>

        {/* Type Toggle */}
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            type="button"
            onClick={() => setSubmitType("paper")}
            className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${
              submitType === "paper"
                ? "bg-amber-400 text-gray-800 shadow-md"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            🫳 投稿论文
          </button>
          <button
            type="button"
            onClick={() => setSubmitType("topic")}
            className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${
              submitType === "topic"
                ? "bg-green-400 text-white shadow-md"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            🧫 提出课题
          </button>
        </div>
      </div>

      {/* Result Display */}
      {result && (
        <div
          className={`mb-8 rounded-2xl p-6 border-2 ${
            result.success
              ? "bg-green-50 border-green-300"
              : "bg-red-50 border-red-300"
          }`}
        >
          {result.success && !result.reviewResult ? (
            <div>
              <h3 className="text-xl font-bold text-green-800 mb-3">
                {submitType === "topic" ? "🧫 课题已提交！" : "✅ 提交成功！"}
              </h3>
              <p className="text-green-700 mb-4">{result.message}</p>
              <p className="text-xs text-gray-400">即将跳转...</p>
            </div>
          ) : result.success && result.reviewResult ? (
            <div>
              <h3 className="text-xl font-bold text-green-800 mb-3">
                {result.reviewResult.approved ? "✅ 审核通过！" : "🚫 审核未通过"}
              </h3>
              <p className="text-green-700 mb-4">{result.reviewResult.comment}</p>

              {/* Review Scores Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
                {[
                  { label: "原创性", value: result.reviewResult.originality, emoji: "💡" },
                  { label: "学术格式", value: result.reviewResult.academicFormat, emoji: "📐" },
                  { label: "荒诞度", value: result.reviewResult.absurdity, emoji: "🤪" },
                  { label: "逻辑自洽", value: result.reviewResult.logicCoherence, emoji: "🧠" },
                  { label: "垃圾值", value: result.reviewResult.garbageValue, emoji: "🪙" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="bg-white rounded-xl p-3 text-center border border-gray-200"
                  >
                    <div className="text-lg">{item.emoji}</div>
                    <div className="text-xs text-gray-500">{item.label}</div>
                    <div className="text-xl font-bold text-amber-600">{item.value}/5</div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-400">
                即将跳转到你的文章页面...
              </p>
            </div>
          ) : (
            <div>
              <h3 className="text-xl font-bold text-red-800 mb-2">投稿失败</h3>
              <p className="text-red-600">{result.message}</p>
            </div>
          )}
        </div>
      )}

      {/* Submit Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            📝 文章标题 *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：地府货币膨胀——东亚父母该烧多少钱才能保证孩子不会乱花"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-amber-400 text-gray-800"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              🧑‍🔧 拾荒者名字
            </label>
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="匿名拾荒者"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-amber-400 text-gray-800"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              🏷️ 标签（用逗号分隔）
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="经济学, 冥币, 通货膨胀"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-amber-400 text-gray-800"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            {submitType === "topic" ? "📋 课题描述 *" : "📋 摘要"}
          </label>
          <textarea
            value={abstract}
            onChange={(e) => setAbstract(e.target.value)}
            rows={submitType === "topic" ? 6 : 3}
            placeholder={
              submitType === "topic"
                ? "详细描述这个课题，包括研究背景、需要解决的问题、欢迎什么方向的投稿..."
                : "用一两句话概括你的垃圾..."
            }
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-amber-400 text-gray-800 resize-y"
            required={submitType === "topic"}
          />
        </div>

        {submitType === "paper" && (
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              📄 正文（Markdown）*
            </label>
            <MarkdownEditor value={content} onChange={setContent} />
          </div>
        )}

        <div className="flex justify-center">
          <button
            type="submit"
            disabled={
              submitting ||
              !title.trim() ||
              (submitType === "paper" && !content.trim()) ||
              (submitType === "topic" && !abstract.trim())
            }
            className={`px-8 py-3 rounded-full font-bold text-lg transition-all shadow-lg hover:shadow-xl disabled:bg-gray-300 disabled:cursor-not-allowed ${
              submitType === "topic"
                ? "bg-green-400 hover:bg-green-500 text-white"
                : "bg-amber-400 hover:bg-amber-500 text-gray-800"
            }`}
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⏳</span> 提交中...
              </span>
            ) : submitType === "topic" ? (
              "🧫 提交课题"
            ) : (
              "🫳 提交垃圾"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function SubmitPage() {
  return (
    <Suspense>
      <SubmitForm />
    </Suspense>
  );
}
