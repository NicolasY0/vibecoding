import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, authorName, tags } = body;

    if (!title || !description) {
      return NextResponse.json(
        { success: false, message: "标题和描述不能为空" },
        { status: 400 }
      );
    }

    const slug = slugify(title);

    await prisma.topic.create({
      data: {
        title,
        slug,
        description,
        authorName: authorName || "匿名拾荒者",
        tags: tags || [],
      },
    });

    return NextResponse.json({ success: true, slug });
  } catch (error) {
    console.error("Topic submit error:", error);
    return NextResponse.json(
      { success: false, message: "提交失败" },
      { status: 500 }
    );
  }
}
