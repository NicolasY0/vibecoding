export default function ApplyReviewerPage() {
  return (
    <div className="max-w-md mx-auto px-4 py-20 sm:px-6 lg:px-8">
      <div className="text-center mb-8">
        <span className="text-5xl block mb-4">🐾</span>
        <h1 className="text-3xl font-extrabold text-gray-800 mb-2">
          申请成为嗅探兽
        </h1>
        <p className="text-gray-500">
          用你的鼻子为社区服务——甄别垃圾的含金量
        </p>
      </div>

      <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm text-center">
        <div className="text-6xl mb-4">🚧</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">
          功能即将开放
        </h2>
        <p className="text-gray-500 text-sm leading-relaxed">
          人类嗅探兽申请系统正在开发中。
          <br />
          目前由 AI（DeepSeek）负责所有审核。
          <br />
          敬请期待！
        </p>
        <a
          href="/submit"
          className="inline-block mt-4 px-6 py-2 bg-amber-400 hover:bg-amber-500 text-gray-800 rounded-full font-bold text-sm transition-all"
        >
          🫳 先去扔垃圾
        </a>
      </div>
    </div>
  );
}
