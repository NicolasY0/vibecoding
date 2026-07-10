"use client";

import VoteWidget from "@/components/VoteWidget";

interface VoteClientProps {
  articleId: number;
  initialScore: number;
  initialVotes: number;
  initialUpvotes: number;
  initialDownvotes: number;
}

export default function VoteClient({
  articleId,
  initialScore,
  initialVotes,
  initialUpvotes,
  initialDownvotes,
}: VoteClientProps) {
  const handleVote = async (score: number) => {
    const voterFp = localStorage.getItem("voter_fp") || crypto.randomUUID();
    localStorage.setItem("voter_fp", voterFp);

    const res = await fetch("/api/articles/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId, score, voterFp }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "投票失败");
    }
  };

  return (
    <VoteWidget
      articleId={articleId}
      currentScore={initialScore}
      totalVotes={initialVotes}
      onVote={handleVote}
    />
  );
}
