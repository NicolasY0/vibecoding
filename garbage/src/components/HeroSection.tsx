import { ZONES } from "@/lib/zones";

export default function HeroSection() {
  return (
    <section className="text-center py-16 px-4 bg-gradient-to-b from-amber-50 to-white">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-5xl sm:text-7xl font-extrabold text-gray-800 mb-4 tracking-tight">
          <span className="inline-block animate-bounce">🗑️</span>
        </h1>
        <h2 className="text-3xl sm:text-5xl font-extrabold text-gray-800 mb-4">
          garbage{" "}
          <span className="text-amber-500 text-2xl sm:text-3xl">
            学术底刊
          </span>
        </h2>
        <p className="text-lg sm:text-xl text-gray-500 mb-6 max-w-xl mx-auto leading-relaxed">
          &ldquo;Truth fades, garbage lasts.&rdquo;
          <br />
          <span className="text-gray-400 text-sm">
            真理会过时，垃圾永留存。
          </span>
        </p>
        <p className="text-gray-500 text-sm mb-8 max-w-lg mx-auto">
          一个社区驱动的学术垃圾回收与分类平台。
          <br />
          扔下你的学术垃圾，让嗅探兽来闻一闻，社区来分类。
        </p>
        <div className="flex items-center justify-center gap-3">
          <a
            href="/submit"
            className="px-6 py-3 bg-amber-400 hover:bg-amber-500 text-gray-800 rounded-full font-bold text-lg transition-all shadow-lg hover:shadow-xl hover:scale-105"
          >
            🫳 扔垃圾
          </a>
          <a
            href="/zone/trash"
            className="px-6 py-3 bg-white border-2 border-gray-300 hover:border-amber-300 text-gray-600 rounded-full font-bold text-lg transition-all"
          >
            🔍 翻垃圾桶
          </a>
        </div>
      </div>
    </section>
  );
}
