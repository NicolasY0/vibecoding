export default function Footer() {
  return (
    <footer className="mt-auto border-t border-gray-200 bg-amber-50/50">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <span>🗑️</span>
            <span>
              garbage 学术底刊 © {new Date().getFullYear()}
            </span>
          </div>
          <p className="text-xs text-gray-400 max-w-md">
            &ldquo;Truth fades, garbage lasts. 真理会过时，垃圾永留存。&rdquo;
            <br />
            一个社区驱动的学术垃圾回收与分类平台。
          </p>
          <div className="flex gap-4 text-xs text-gray-400">
            <a href="/about" className="hover:text-gray-600">
              关于我们
            </a>
            <span>·</span>
            <a href="#" className="hover:text-gray-600">
              用户条款
            </a>
            <span>·</span>
            <a href="#" className="hover:text-gray-600">
              投稿规则
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
