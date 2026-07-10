import { prisma } from "@/lib/prisma";
import SearchBar from "@/components/SearchBar";
import SearchResults from "./SearchResults";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q || "";

  let results: Array<{
    id: number;
    slug: string;
    title: string;
    authorName: string;
    abstract: string | null;
    tags: string[];
    zoneId: number;
    wilsonScore: number;
    totalVotes: number;
    viewCount: number;
    createdAt: Date;
    reviewStatus: string;
  }> = [];

  if (query) {
    const articles = await prisma.article.findMany({
      orderBy: { wilsonScore: "desc" },
      take: 50,
    });

    const lowerQuery = query.toLowerCase();
    results = (articles as typeof results).filter(
      (a) =>
        a.title.toLowerCase().includes(lowerQuery) ||
        a.authorName.toLowerCase().includes(lowerQuery) ||
        (a.abstract && a.abstract.toLowerCase().includes(lowerQuery)) ||
        (a.tags && a.tags.some((t: string) => t.toLowerCase().includes(lowerQuery))) ||
        a.reviewStatus === "approved"
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-extrabold text-gray-800 mb-2">
          🔍 翻垃圾堆
        </h1>
        <p className="text-gray-500 mb-6">在垃圾堆里找到你想要的宝藏</p>
        <div className="flex justify-center">
          <SearchBar />
        </div>
      </div>

      <SearchResults query={query} results={results} />
    </div>
  );
}
