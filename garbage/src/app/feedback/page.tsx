"use client";

import { useState } from "react";

export default function FeedbackPage() {
  const [category, setCategory] = useState("suggestion");
  const [content, setContent] = useState("");
  const [contact, setContact] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setSubmitting(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, content: content.trim(), contact: contact.trim() }),
      });
      setSubmitted(true);
    } catch {
      // fail silently
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <span className="text-6xl block mb-4">📬</span>
        <h2 className="text-2xl font-extrabold text-gray-800 mb-2">
          意见已投递！
        </h2>
        <p className="text-gray-500 mb-6">
          感谢你的反馈，我们会认真翻看每一封来信。
        </p>
        <button
          onClick={() => { setSubmitted(false); setContent(""); }}
          className="px-6 py-2 bg-amber-400 hover:bg-amber-500 text-gray-800 rounded-full font-bold text-sm transition-all"
        >
          ✍️ 再写一条
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
      <div className="text-center mb-8">
        <span className="text-5xl block mb-4">📮</span>
        <h1 className="text-4xl font-extrabold text-gray-800 mb-2">
          意见箱
        </h1>
        <p className="text-gray-500">
          对 garbage 有任何建议、吐槽、bug 反馈？统统扔进来！
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6">
        {/* Category */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            📂 意见类型
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { value: "suggestion", label: "💡 功能建议" },
              { value: "bug", label: "🐛 Bug 反馈" },
              { value: "content", label: "📝 内容建议" },
              { value: "other", label: "💬 其他" },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setCategory(item.value)}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition-all border ${
                  category === item.value
                    ? "bg-amber-100 border-amber-400 text-amber-800"
                    : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            ✍️ 详细描述 *
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            placeholder="说说你的想法、遇到的bug、希望增加的功能..."
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-amber-400 text-gray-800 resize-y"
            required
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{content.length} / 2000</p>
        </div>

        {/* Contact */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            📧 联系方式 <span className="text-gray-400 font-normal">（可选）</span>
          </label>
          <input
            type="text"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="邮箱、微信、QQ… 方便我们回复你"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-amber-400 text-gray-800"
          />
        </div>

        {/* Submit */}
        <div className="flex justify-center pt-2">
          <button
            type="submit"
            disabled={submitting || !content.trim()}
            className="px-8 py-3 bg-amber-400 hover:bg-amber-500 disabled:bg-gray-300 disabled:cursor-not-allowed text-gray-800 rounded-full font-bold text-lg transition-all shadow-lg hover:shadow-xl"
          >
            {submitting ? "📬 投递中..." : "📮 投递意见"}
          </button>
        </div>
      </form>
    </div>
  );
}
