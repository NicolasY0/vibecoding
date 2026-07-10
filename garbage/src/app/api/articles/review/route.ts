import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_request: NextRequest) {
  try {
    const articles = await prisma.article.findMany({
      where: { reviewStatus: "pending" },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    return NextResponse.json({ articles });
  } catch (error) {
    console.error("Review fetch error:", error);
    return NextResponse.json(
      { error: "获取待审文章失败" },
      { status: 500 }
    );
  }
}
