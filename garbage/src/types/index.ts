/** Shared types for the garbage journal app */

export interface ArticleData {
  id: number;
  title: string;
  slug: string;
  authorName: string;
  abstract: string | null;
  content: string;
  tags: string[];
  zoneId: number;
  upvotes: number;
  downvotes: number;
  wilsonScore: number;
  totalVotes: number;
  reviewStatus: string;
  reviewComment: string | null;
  reviewScore: number | null;
  reviewedBy: string;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
  userId: string | null;
}
