import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { articleId, authorName, content } = body;

    if (!articleId || !content || content.length > 500) {
      return NextResponse.json(
        { error: "内容不能为空或超过500字" },
        { status: 400 }
      );
    }

    const comment = await prisma.comment.create({
      data: {
        articleId,
        authorName: authorName || "匿名路人",
        content: content.trim(),
      },
    });

    return NextResponse.json({ success: true, comment });
  } catch {
    return NextResponse.json(
      { error: "评论失败" },
      { status: 500 }
    );
  }
}
