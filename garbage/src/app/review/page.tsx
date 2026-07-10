export default function ReviewPage() {
  return (
    <div className="max-w-md mx-auto px-4 py-20 sm:px-6 lg:px-8">
      <div className="text-center mb-8">
        <span className="text-5xl block mb-4">🐾</span>
        <h1 className="text-3xl font-extrabold text-gray-800 mb-2">
          审核中心
        </h1>
        <p className="text-gray-500">嗅探兽的工作台</p>
      </div>

      <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm text-center">
        <div className="text-6xl mb-4">🚧</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">
          需要登录和嗅探兽权限
        </h2>
        <p className="text-gray-500 text-sm leading-relaxed">
          审核中心仅对认证嗅探兽开放。
          <br />
          目前 AI 嗅探兽（DeepSeek）正在自动处理所有审核工作。
          <br />
          人类嗅探兽申请功能即将开放！
        </p>
        <a
          href="/about"
          className="inline-block mt-4 px-6 py-2 bg-amber-400 hover:bg-amber-500 text-gray-800 rounded-full font-bold text-sm transition-all"
        >
          📜 了解更多
        </a>
      </div>
    </div>
  );
}
