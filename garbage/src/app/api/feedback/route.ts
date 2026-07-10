import { NextRequest, NextResponse } from "next/server";

// In-memory feedback store (compatible with mock mode)
const feedbacks: Array<{
  id: number; category: string; content: string; contact: string; createdAt: Date;
}> = [];
let feedbackId = 1;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { category, content, contact } = body;

    if (!content || content.length > 2000) {
      return NextResponse.json(
        { error: "内容不能为空且不超过2000字" },
        { status: 400 }
      );
    }

    const feedback = {
      id: feedbackId++,
      category: category || "other",
      content,
      contact: contact || "",
      createdAt: new Date(),
    };
    feedbacks.push(feedback);

    console.log("📮 New feedback:", feedback);

    return NextResponse.json({ success: true, id: feedback.id });
  } catch {
    return NextResponse.json(
      { error: "提交失败" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ feedbacks });
}
