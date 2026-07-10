export default function EditorialSection() {
  return (
    <section className="py-16 px-4 bg-gradient-to-b from-white to-amber-50/50">
      <div className="max-w-3xl mx-auto">
        {/* Pre-title */}
        <div className="text-center mb-2">
          <span className="text-xs font-bold text-amber-500 uppercase tracking-[0.2em]">
            Editorial / 社论
          </span>
        </div>

        {/* Main Title */}
        <h2 className="text-3xl sm:text-4xl font-extrabold text-center text-gray-800 mb-4 leading-tight">
          A Manifesto for Academic Decentralization
        </h2>
        <h3 className="text-xl sm:text-2xl font-bold text-center text-amber-500 mb-10">
          全民学术人宣言
        </h3>

        {/* Manifesto Card */}
        <div className="bg-white border-2 border-amber-200 rounded-3xl p-8 sm:p-10 shadow-lg relative overflow-hidden">
          {/* Decorative top bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-300 via-amber-500 to-amber-300" />

          {/* Quote */}
          <div className="relative">
            {/* Large opening quote mark */}
            <span className="absolute -top-4 -left-2 text-7xl text-amber-200 font-serif leading-none select-none">
              &ldquo;
            </span>

            <p className="text-lg sm:text-xl text-gray-700 leading-relaxed mb-8 pl-6">
              <span className="font-extrabold text-gray-800">garbage</span>{" "}
              试图回答一个问题：
            </p>

            <p className="text-xl sm:text-2xl font-bold text-gray-800 leading-relaxed mb-8 text-center py-6 px-4 bg-amber-50 rounded-2xl border border-amber-100">
              如果把编辑部的权力交还给社区，
              <br />
              学术评价会变得更好还是更糟？
            </p>

            <p className="text-base sm:text-lg text-gray-600 leading-relaxed pl-6">
              在这里，没有学术大佬，没有权威学阀。
            </p>
            <p className="text-base sm:text-lg text-gray-600 leading-relaxed pl-6">
              每一项课题、每一篇论证都将经历一场近乎残酷的
              <strong className="text-gray-800">&ldquo;进化论&rdquo;</strong>。
            </p>
            <p className="text-base sm:text-lg text-gray-600 leading-relaxed pl-6">
              好的思想会自己浮上来，坏的自然沉底。
            </p>

            {/* Closing quote */}
            <div className="text-right mt-2">
              <span className="text-7xl text-amber-200 font-serif leading-none select-none">
                &rdquo;
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-amber-200" />
            <span className="text-2xl">🗑️</span>
            <div className="flex-1 h-px bg-amber-200" />
          </div>

          {/* Bottom tagline */}
          <div className="text-center">
            <p className="text-sm text-gray-400 italic">
              &ldquo;Truth fades, garbage lasts. 真理会过时，垃圾永留存。&rdquo;
            </p>
            <p className="text-xs text-gray-300 mt-2">
              — garbage 学术底刊 · 编辑部
            </p>
          </div>
        </div>

        {/* Three Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10">
          {[
            {
              emoji: "🗳️",
              title: "去中心化",
              desc: "没有学阀，没有编辑垄断。社区就是审稿人。",
            },
            {
              emoji: "🧬",
              title: "学术进化论",
              desc: "好的思想浮上来，坏的自然沉底。让质量自己说话。",
            },
            {
              emoji: "🎭",
              title: "严肃的荒诞",
              desc: "用学术的格式，装荒诞的灵魂。一本正经地胡说八道。",
            },
          ].map((pillar) => (
            <div
              key={pillar.title}
              className="bg-white rounded-2xl p-5 border border-gray-200 text-center shadow-sm hover:shadow-md transition-shadow"
            >
              <span className="text-4xl block mb-2">{pillar.emoji}</span>
              <h4 className="font-bold text-gray-800 mb-1">{pillar.title}</h4>
              <p className="text-sm text-gray-500">{pillar.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
