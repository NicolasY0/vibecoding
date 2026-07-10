import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query) {
      return Response.json({ results: [] });
    }

    const articles = (await prisma.article.findMany({
      orderBy: { wilsonScore: "desc" },
      take: 100,
    })) as Array<{
      id: number; slug: string; title: string; authorName: string;
      abstract: string | null; tags: string[]; zoneId: number;
      wilsonScore: number; totalVotes: number; viewCount: number;
      createdAt: string; reviewStatus: string;
    }>;

    const lowerQuery = query.toLowerCase();
    const results = articles.filter(
      (a) =>
        a.title.toLowerCase().includes(lowerQuery) ||
        a.authorName.toLowerCase().includes(lowerQuery) ||
        (a.abstract && a.abstract.toLowerCase().includes(lowerQuery)) ||
        (a.tags && a.tags.some((t: string) => t.toLowerCase().includes(lowerQuery)))
    );

    return Response.json({ results });
  } catch {
    return Response.json({ error: "搜索出错" }, { status: 500 });
  }
}
