import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateArticleZone } from "@/lib/zones";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { articleId, score, voterFp } = body;

    if (!articleId || !score || score < 1 || score > 5) {
      return NextResponse.json(
        { error: "无效的投票数据" },
        { status: 400 }
      );
    }

    // Check if article exists
    const article = await prisma.article.findUnique({
      where: { id: articleId },
    });

    if (!article) {
      return NextResponse.json(
        { error: "文章不存在" },
        { status: 404 }
      );
    }

    // Check for duplicate vote
    const existingVote = await prisma.vote.findFirst({
      where: {
        articleId,
        voterFp: voterFp || "",
      },
    });

    if (existingVote) {
      return NextResponse.json(
        { error: "你已经投过票了！每包垃圾只能投一次。" },
        { status: 409 }
      );
    }

    // Determine if this is up or down (4-5 = up, 1-2 = down, 3 = neutral)
    const isUpvote = score >= 4;

    // Create vote + update article in transaction
    await prisma.$transaction([
      prisma.vote.create({
        data: {
          articleId,
          score,
          voterFp: voterFp || "",
        },
      }),
      prisma.article.update({
        where: { id: articleId },
        data: {
          upvotes: isUpvote ? { increment: 1 } : undefined,
          downvotes: !isUpvote ? { increment: 1 } : undefined,
          totalVotes: { increment: 1 },
        },
      }),
    ]);

    // Recalculate zone
    const zoneResult = await updateArticleZone(articleId);

    return NextResponse.json({
      success: true,
      newZone: zoneResult?.newZoneId,
      wilsonScore: zoneResult?.wilson,
    });
  } catch (error) {
    console.error("Vote error:", error);
    return NextResponse.json(
      { error: "投票失败，请稍后再试。" },
      { status: 500 }
    );
  }
}
