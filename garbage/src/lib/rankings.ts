/**
 * Contributor ranking & title system for garbage journal.
 * Aggregates stats by authorName across articles, topics, comments, and votes.
 */

import { prisma } from "./prisma";

// ---- Title definitions ----

export const AUTHOR_TITLES = [
  { min: 20, title: "垃圾之神", suffix: "🌟", color: "text-yellow-500" },
  { min: 10, title: "垃圾领主", suffix: "👑", color: "text-amber-500" },
  { min: 5, title: "垃圾大亨", suffix: "🏭", color: "text-orange-500" },
  { min: 2, title: "资深拾荒者", suffix: "🧹", color: "text-green-600" },
  { min: 1, title: "初级拾荒者", suffix: "🧑‍🔧", color: "text-blue-500" },
  { min: 0, title: "路人", suffix: "🚶", color: "text-gray-400" },
];

export const VOTER_TITLES = [
  { min: 100, title: "嗅探之王", suffix: "🤴", color: "text-yellow-500" },
  { min: 50, title: "嗅探大师", suffix: "🧙", color: "text-purple-500" },
  { min: 20, title: "金牌嗅探兽", suffix: "🥇", color: "text-amber-500" },
  { min: 5, title: "见习嗅探兽", suffix: "🐾", color: "text-green-600" },
  { min: 0, title: "嗅探宝宝", suffix: "👶", color: "text-gray-400" },
];

export const COMMENTER_TITLES = [
  { min: 30, title: "键盘侠", suffix: "⌨️", color: "text-red-500" },
  { min: 10, title: "评论区霸主", suffix: "📢", color: "text-purple-500" },
  { min: 3, title: "话痨", suffix: "💬", color: "text-blue-500" },
  { min: 0, title: "沉默路人", suffix: "🤐", color: "text-gray-400" },
];

export const OVERALL_TITLES = [
  { min: 200, title: "垃圾之神", suffix: "🌟", color: "bg-yellow-400" },
  { min: 100, title: "垃圾之王", suffix: "👑", color: "bg-amber-400" },
  { min: 50, title: "垃圾大师", suffix: "🎓", color: "bg-orange-400" },
  { min: 20, title: "垃圾收集者", suffix: "🗃️", color: "bg-green-400" },
  { min: 5, title: "垃圾爱好者", suffix: "❤️", color: "bg-blue-400" },
  { min: 0, title: "新来的垃圾", suffix: "🆕", color: "bg-gray-300" },
];

// ---- Helpers ----

export function getTitle(
  count: number,
  titles: typeof AUTHOR_TITLES
): (typeof AUTHOR_TITLES)[number] {
  return titles.find((t) => count >= t.min) || titles[titles.length - 1];
}

// ---- Contributor Stats ----

export interface ContributorStats {
  name: string;
  articles: number;
  topics: number;
  comments: number;
  votes: number;
  totalScore: number;
}

export async function getContributorRankings(): Promise<ContributorStats[]> {
  // Aggregate from mock DB via prisma
  const allArticles = (await prisma.article.findMany()) as Array<{
    authorName: string;
    totalVotes: number;
  }>;
  const allTopics = (await prisma.topic.findMany()) as Array<{
    authorName: string;
  }>;
  const allComments = (await prisma.comment.findMany({
    orderBy: { createdAt: "desc" },
  })) as Array<{ authorName: string }>;

  const statsMap = new Map<string, ContributorStats>();

  const getOrCreate = (name: string) => {
    if (!statsMap.has(name)) {
      statsMap.set(name, {
        name,
        articles: 0,
        topics: 0,
        comments: 0,
        votes: 0,
        totalScore: 0,
      });
    }
    return statsMap.get(name)!;
  };

  for (const a of allArticles) {
    const s = getOrCreate(a.authorName);
    s.articles++;
    s.totalScore += 10;
    s.votes += a.totalVotes || 0;
  }

  for (const t of allTopics) {
    const s = getOrCreate(t.authorName);
    s.topics++;
    s.totalScore += 8;
  }

  // Count comments per name (need to fetch all)
  try {
    // Mock DB doesn't support findMany without where, so we use the raw array
    const allRawComments = (allComments || []) as Array<{
      authorName: string;
    }>;
    for (const c of allRawComments) {
      const s = getOrCreate(c.authorName);
      s.comments++;
      s.totalScore += 3;
    }
  } catch {
    // fallback
  }

  return Array.from(statsMap.values()).sort(
    (a, b) => b.totalScore - a.totalScore
  );
}

export async function getAuthorStats(
  authorName: string
): Promise<ContributorStats | null> {
  const rankings = await getContributorRankings();
  return rankings.find((r) => r.name === authorName) || null;
}
