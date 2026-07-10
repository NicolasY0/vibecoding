import {
  getContributorRankings,
  getTitle,
  OVERALL_TITLES,
  AUTHOR_TITLES,
  VOTER_TITLES,
  COMMENTER_TITLES,
} from "@/lib/rankings";

export const dynamic = "force-dynamic";

export default async function RankingsPage() {
  const contributors = await getContributorRankings();

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
      <div className="text-center mb-10">
        <span className="text-5xl block mb-4">🏆</span>
        <h1 className="text-4xl font-extrabold text-gray-800 mb-2">
          贡献排行榜
        </h1>
        <p className="text-gray-500">谁是这个垃圾堆里最活跃的拾荒者？</p>
      </div>

      {/* Title Legend */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-8 shadow-sm">
        <h2 className="text-sm font-bold text-gray-600 mb-4">🏅 等级体系</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">
              拾荒者 (投稿)
            </h3>
            {AUTHOR_TITLES.map((t) => (
              <div key={t.title} className="flex items-center gap-2 py-0.5">
                <span className={t.color}>{t.suffix}</span>
                <span className="text-gray-600">{t.title}</span>
                <span className="text-xs text-gray-400 ml-auto">
                  {'>='}{t.min}篇
                </span>
              </div>
            ))}
          </div>
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">
              嗅探兽 (投票)
            </h3>
            {VOTER_TITLES.map((t) => (
              <div key={t.title} className="flex items-center gap-2 py-0.5">
                <span className={t.color}>{t.suffix}</span>
                <span className="text-gray-600">{t.title}</span>
                <span className="text-xs text-gray-400 ml-auto">
                  {'>='}{t.min}次
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-4">
          <h2 className="font-bold text-gray-800">👑 总贡献排名</h2>
        </div>

        {contributors.length === 0 ? (
          <div className="px-6 py-16 text-center text-gray-400">
            <span className="text-5xl block mb-3">🏆</span>
            <p>还没有贡献数据。快来扔第一包垃圾吧！</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {contributors.map((c, i) => {
              const overallTitle = getTitle(c.totalScore, OVERALL_TITLES);
              const authorTitle = getTitle(c.articles, AUTHOR_TITLES);
              const voterTitle = getTitle(c.votes, VOTER_TITLES);
              const commenterTitle = getTitle(c.comments, COMMENTER_TITLES);

              return (
                <div
                  key={c.name}
                  className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors"
                >
                  {/* Rank */}
                  <div className="flex-shrink-0 w-8 text-center">
                    {i === 0 && <span className="text-2xl">🥇</span>}
                    {i === 1 && <span className="text-2xl">🥈</span>}
                    {i === 2 && <span className="text-2xl">🥉</span>}
                    {i > 2 && (
                      <span className="text-sm font-bold text-gray-400">
                        #{i + 1}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-800 truncate">
                        {c.name}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium text-white ${overallTitle.color}`}
                      >
                        {overallTitle.suffix} {overallTitle.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                      <span>
                        {authorTitle.suffix} {authorTitle.title}
                      </span>
                      <span>·</span>
                      <span>
                        {voterTitle.suffix} {voterTitle.title}
                      </span>
                      <span>·</span>
                      <span>
                        {commenterTitle.suffix} {commenterTitle.title}
                      </span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-3 text-right flex-shrink-0 text-sm">
                    <div className="text-center min-w-[40px]">
                      <div className="font-bold text-gray-800">{c.articles}</div>
                      <div className="text-[10px] text-gray-400">投稿</div>
                    </div>
                    <div className="text-center min-w-[40px]">
                      <div className="font-bold text-gray-800">{c.comments}</div>
                      <div className="text-[10px] text-gray-400">评论</div>
                    </div>
                    <div className="text-center min-w-[50px]">
                      <div className="font-extrabold text-amber-600 text-lg">
                        {c.totalScore}
                      </div>
                      <div className="text-[10px] text-gray-400">积分</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
