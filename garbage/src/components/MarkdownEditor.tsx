"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function MarkdownEditor({
  value,
  onChange,
  placeholder = "开始写你的学术垃圾…（支持 Markdown）",
}: MarkdownEditorProps) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="border border-gray-300 rounded-2xl overflow-hidden">
      {/* Tabs */}
      <div className="flex bg-gray-50 border-b border-gray-200">
        <button
          onClick={() => setShowPreview(false)}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            !showPreview
              ? "bg-white text-gray-800 border-b-2 border-amber-400"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          ✍️ 编辑
        </button>
        <button
          onClick={() => setShowPreview(true)}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            showPreview
              ? "bg-white text-gray-800 border-b-2 border-amber-400"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          👁 预览
        </button>
      </div>

      {/* Editor */}
      {!showPreview ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={16}
          className="w-full p-4 text-gray-800 font-mono text-sm resize-y focus:outline-none"
        />
      ) : (
        <div className="p-4 prose prose-sm max-w-none min-h-[300px] bg-white">
          {value ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
            >
              {value}
            </ReactMarkdown>
          ) : (
            <p className="text-gray-400 italic">还没有写任何内容…</p>
          )}
        </div>
      )}
    </div>
  );
}
