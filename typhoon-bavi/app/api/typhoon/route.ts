import { NextRequest, NextResponse } from "next/server";
import { getTyphoonBavi } from "@/lib/cache";
import { DEFAULT_LANG, type Lang } from "@/lib/jma";

export const runtime = "nodejs"; // 我们使用 AbortController
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const langParam = (req.nextUrl.searchParams.get("lang") || "").toLowerCase();
  const allowed: Lang[] = ["cn_zs", "cn_zt", "en"];
  const lang: Lang = (allowed as string[]).includes(langParam)
    ? (langParam as Lang)
    : DEFAULT_LANG;

  try {
    const data = await getTyphoonBavi(lang);
    return NextResponse.json(data, {
      status: data.ok || data.current ? 200 : 503,
      headers: {
        // 客户端可以缓存 60s, 5 分钟后真正过期
        "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
