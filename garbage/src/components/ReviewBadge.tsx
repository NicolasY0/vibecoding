interface ReviewBadgeProps {
  reviewStatus: string;
  reviewScore: number | null;
  reviewComment: string | null;
  reviewedBy: string;
}

export default function ReviewBadge({
  reviewStatus,
  reviewScore,
  reviewComment,
  reviewedBy,
}: ReviewBadgeProps) {
  if (reviewStatus === "pending") {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-center gap-2 text-blue-700 text-sm font-medium">
          <span className="text-xl">⏳</span>
          <span>等待 AI 嗅探兽审核中…</span>
        </div>
      </div>
    );
  }

  if (reviewStatus === "rejected") {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <div className="flex items-center gap-2 text-red-700 text-sm font-medium mb-2">
          <span className="text-xl">🚫</span>
          <span>审核未通过 — {reviewedBy}</span>
        </div>
        {reviewComment && (
          <p className="text-red-600 text-sm">{reviewComment}</p>
        )}
      </div>
    );
  }

  const stars = reviewScore ? "⭐".repeat(reviewScore) : "";

  return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
      <div className="flex items-center gap-2 text-green-700 text-sm font-medium mb-2">
        <span className="text-xl">✅</span>
        <span>审核通过 — {reviewedBy}</span>
        <span className="ml-auto text-base">{stars}</span>
      </div>
      {reviewComment && (
        <p className="text-green-600 text-sm">{reviewComment}</p>
      )}
    </div>
  );
}
