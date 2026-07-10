import Link from "next/link";

export default function HomeCTA() {
  return (
    <section className="py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Discover Topics */}
          <Link
            href="/topics"
            className="group bg-white rounded-2xl border-2 border-green-200 p-6 shadow-sm hover:shadow-md hover:border-green-300 transition-all"
          >
            <div className="flex items-start gap-4">
              <span className="text-4xl flex-shrink-0">🧫</span>
              <div>
                <h3 className="text-lg font-extrabold text-gray-800 group-hover:text-green-600 transition-colors mb-1">
                  发现课题
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  浏览社区提出的研究课题，找到你感兴趣的方向，投稿你的论文。
                </p>
                <span className="inline-block mt-3 text-sm font-bold text-green-600 group-hover:underline">
                  去看看 →
                </span>
              </div>
            </div>
          </Link>

          {/* Submit */}
          <Link
            href="/submit"
            className="group bg-white rounded-2xl border-2 border-amber-200 p-6 shadow-sm hover:shadow-md hover:border-amber-300 transition-all"
          >
            <div className="flex items-start gap-4">
              <span className="text-4xl flex-shrink-0">🫳</span>
              <div>
                <h3 className="text-lg font-extrabold text-gray-800 group-hover:text-amber-500 transition-colors mb-1">
                  扔垃圾
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  投稿一篇论文或提出一个新课题。AI 嗅探兽会闻一闻，社区来分类。
                </p>
                <span className="inline-block mt-3 text-sm font-bold text-amber-600 group-hover:underline">
                  去投稿 →
                </span>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
