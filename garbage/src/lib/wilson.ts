/**
 * Wilson Score Interval (Lower Bound)
 * A statistically sound way to rank items with ratings.
 *
 * Prevents items with few votes from ranking above items with many votes.
 * For example: an article with 5 upvotes/0 downvotes shouldn't outrank
 * one with 100 upvotes/5 downvotes.
 */
export function wilsonScore(
  upvotes: number,
  downvotes: number,
  z: number = 1.96 // 95% confidence
): number {
  const n = upvotes + downvotes;
  if (n === 0) return 0;

  const p = upvotes / n;

  // Wilson score lower bound
  const z2 = z * z;
  const n2 = n * n;
  const denominator = 1 + z2 / n;
  const numerator =
    p + z2 / (2 * n) - z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n2));

  return numerator / denominator;
}

/**
 * Calculate Wilson Score when votes are 1-5 star ratings.
 * Converts to binary up/down by treating 4-5 stars as "up" and 1-2 as "down".
 */
export function wilsonScoreFromStars(
  totalVotes: number,
  avgScore: number,
  z: number = 1.96
): number {
  // Convert 1-5 scale to binary proportion
  // avgScore of 3 = 50% positive, avgScore of 5 = 100% positive
  const p = (avgScore - 1) / 4; // normalize to 0-1
  const n = totalVotes;
  if (n === 0) return 0;

  const z2 = z * z;
  const denominator = 1 + z2 / n;
  const numerator =
    p + z2 / (2 * n) - z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));

  return numerator / denominator;
}
