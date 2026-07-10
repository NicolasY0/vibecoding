export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
      <div className="text-center mb-10">
        <span className="text-6xl block mb-4">🗑️</span>
        <h1 className="text-4xl font-extrabold text-gray-800 mb-2">
          关于 garbage
        </h1>
        <p className="text-gray-500">
          &ldquo;Truth fades, garbage lasts. 真理会过时，垃圾永留存。&rdquo;
        </p>
      </div>

      <div className="prose prose-amber max-w-none space-y-6">
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <h2 className="text-xl font-bold text-gray-800 mt-0">
            🤔 这是什么？
          </h2>
          <p className="text-gray-600 leading-relaxed">
            <strong>garbage</strong>{" "}
            是一个社区驱动的学术垃圾回收与分类平台。我们相信，每一篇学术垃圾都有它的价值——只要放到合适的垃圾桶里。
          </p>
          <p className="text-gray-600 leading-relaxed">
            这里的"学术垃圾"不是贬义。它是对僵化学术体系的一种幽默反叛，是年轻人在严肃学术之外寻找表达自由的实验田。我们欢迎一本正经的胡说八道、荒诞不经的严肃论证、以及所有那些"正统期刊"不会收的有趣内容。
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <h2 className="text-xl font-bold text-gray-800 mt-0">
            🔄 垃圾分类系统
          </h2>
          <div className="space-y-4 mt-4">
            {[
              {
                emoji: "🗑️",
                name: "垃圾桶",
                desc: "新投稿的默认停留区。AI 嗅探兽会先闻一闻，通过审核后进入社区垃圾分类。20 次投票且含金量 ≥ 65% 升级。",
              },
              {
                emoji: "♻️",
                name: "回收站",
                desc: "社区认可的可回收垃圾！50 次投票且含金量 ≥ 80% 可以升级到垃圾宝殿。含金量低于 40% 则降级到填埋场。",
              },
              {
                emoji: "👑",
                name: "垃圾宝殿",
                desc: "垃圾中的王者，最高荣誉殿堂。一经入殿，永不降级！",
              },
              {
                emoji: "🪦",
                name: "填埋场",
                desc: "分数不够的垃圾在此沉睡。但好垃圾永远有机会——含金量回升到 55% 可以复活回回收站！",
              },
            ].map((item) => (
              <div key={item.name} className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">{item.emoji}</span>
                <div>
                  <h3 className="font-bold text-gray-800 mt-0">{item.name}</h3>
                  <p className="text-sm text-gray-500 m-0">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <h2 className="text-xl font-bold text-gray-800 mt-0">
            🐾 嗅探兽（审核员）
          </h2>
          <p className="text-gray-600 leading-relaxed">
            嗅探兽是 garbage 的审核员，负责在文章进入社区投票前进行初审。
            目前由 AI（DeepSeek）担任嗅探兽，将来会开放人类嗅探兽的申请。
          </p>
          <p className="text-gray-600 leading-relaxed">
            嗅探兽从五个维度评分：原创性、学术格式、荒诞度、逻辑自洽、垃圾值（含金量）。
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <h2 className="text-xl font-bold text-gray-800 mt-0">
            🛠️ 技术
          </h2>
          <p className="text-gray-600 leading-relaxed">
            本站基于 Next.js 16 + Tailwind CSS v4 + Supabase + Prisma 构建，
            部署在 Vercel 上。AI 审核由 DeepSeek API 驱动。
          </p>
        </div>
      </div>
    </div>
  );
}
