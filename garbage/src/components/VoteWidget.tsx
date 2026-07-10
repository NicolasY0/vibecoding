"use client";

import { useState } from "react";

interface VoteWidgetProps {
  articleId: number;
  currentScore: number;
  totalVotes: number;
  onVote: (score: number) => Promise<void>;
}

export default function VoteWidget({
  articleId,
  currentScore,
  totalVotes,
  onVote,
}: VoteWidgetProps) {
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [hoveredScore, setHoveredScore] = useState<number | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [animate, setAnimate] = useState(false);

  const handleVote = async (score: number) => {
    if (isVoting || hasVoted) return;
    setIsVoting(true);
    setAnimate(true);
    try {
      await onVote(score);
      setSelectedScore(score);
      setHasVoted(true);
    } catch {
      // silently fail, let parent handle
    } finally {
      setIsVoting(false);
      setTimeout(() => setAnimate(false), 800);
    }
  };

  const displayScore = hoveredScore || selectedScore;

  const labels = ["🤮", "🤢", "😐", "🤔", "🤩"]; // 1-5 stars

  return (
    <div className="bg-amber-50 rounded-2xl p-6 border border-amber-200">
      <h3 className="text-sm font-bold text-gray-600 mb-3">
        ♻️ 垃圾分类投票
        {hasVoted && (
          <span className="text-green-600 ml-2">— 已投票 ✅</span>
        )}
      </h3>

      {/* Star Buttons */}
      <div className="flex items-center justify-center gap-2 mb-3">
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            disabled={hasVoted || isVoting}
            onClick={() => handleVote(score)}
            onMouseEnter={() => setHoveredScore(score)}
            onMouseLeave={() => setHoveredScore(null)}
            className={`text-4xl transition-all p-1 rounded-xl ${
              !hasVoted ? "hover:scale-125 cursor-pointer" : "cursor-default"
            } ${
              displayScore !== null && score <= displayScore
                ? "opacity-100"
                : "opacity-40 grayscale"
            } ${animate ? "animate-bounce" : ""}`}
            title={`${score}星 — ${["", "垃圾", "勉强可回收", "有点意思", "好东西", "垃圾中的黄金"][score]}`}
          >
            {labels[score - 1]}
          </button>
        ))}
      </div>

      {/* Score Display */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 text-sm text-gray-500">
          <span>
            含金量{" "}
            <strong className="text-amber-600 text-lg">
              {(currentScore * 100).toFixed(0)}%
            </strong>
          </span>
          <span className="text-gray-300">|</span>
          <span>
            {totalVotes} 次垃圾分类
          </span>
        </div>
      </div>
    </div>
  );
}
