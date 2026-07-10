import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, reason } = body;

    if (!userId || !reason) {
      return NextResponse.json(
        { error: "请填写申请理由" },
        { status: 400 }
      );
    }

    const existing = await prisma.reviewerApplication.findUnique({
      where: { userId },
    });

    if (existing) {
      return NextResponse.json(
        { error: "你已经申请过了" },
        { status: 409 }
      );
    }

    await prisma.reviewerApplication.create({
      data: { userId, reason },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Apply reviewer error:", error);
    return NextResponse.json(
      { error: "申请失败" },
      { status: 500 }
    );
  }
}
