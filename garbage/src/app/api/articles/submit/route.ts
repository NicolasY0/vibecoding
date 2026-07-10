import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { aiReview } from "@/lib/review";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, authorName, abstract, content, tags } = body;

    if (!title || !content) {
      return NextResponse.json(
        { success: false, message: "标题和正文不能为空" },
        { status: 400 }
      );
    }

    // Generate slug
    const slug = slugify(title);

    // Run AI review
    const reviewResult = await aiReview(
      title,
      abstract || "",
      content,
      authorName || "匿名拾荒者"
    );

    // Create article
    const article = await prisma.article.create({
      data: {
        title,
        slug,
        authorName: authorName || "匿名拾荒者",
        abstract: abstract || "",
        content,
        tags: tags || [],
        reviewStatus: reviewResult.approved ? "approved" : "rejected",
        reviewComment: reviewResult.comment,
        reviewScore: reviewResult.score,
        reviewedBy: "AI嗅探兽",
        zoneId: reviewResult.approved ? 1 : 1, // always start in TRASH if approved
      },
    });

    return NextResponse.json({
      success: true,
      slug: article.slug,
      reviewResult: {
        approved: reviewResult.approved,
        score: reviewResult.score,
        comment: reviewResult.comment,
        originality: reviewResult.originality,
        academicFormat: reviewResult.academicFormat,
        absurdity: reviewResult.absurdity,
        logicCoherence: reviewResult.logicCoherence,
        garbageValue: reviewResult.garbageValue,
      },
    });
  } catch (error) {
    console.error("Submit error:", error);
    return NextResponse.json(
      { success: false, message: "投稿失败，服务器出了问题。" },
      { status: 500 }
    );
  }
}
