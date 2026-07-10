export default function LoginPage() {
  return (
    <div className="max-w-md mx-auto px-4 py-20 sm:px-6 lg:px-8">
      <div className="text-center mb-8">
        <span className="text-5xl block mb-4">🗑️</span>
        <h1 className="text-3xl font-extrabold text-gray-800 mb-2">登录</h1>
        <p className="text-gray-500">
          登录后可以追踪投稿、申请成为嗅探兽
        </p>
      </div>

      <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm text-center">
        <div className="text-6xl mb-4">🚧</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">
          认证系统即将上线
        </h2>
        <p className="text-gray-500 text-sm leading-relaxed">
          Supabase Auth 集成正在开发中。
          <br />
          目前你可以匿名投稿和投票——无需登录！
        </p>
        <a
          href="/submit"
          className="inline-block mt-4 px-6 py-2 bg-amber-400 hover:bg-amber-500 text-gray-800 rounded-full font-bold text-sm transition-all"
        >
          🫳 直接去扔垃圾
        </a>
      </div>
    </div>
  );
}
