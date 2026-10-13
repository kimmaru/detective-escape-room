import { NextRequest, NextResponse } from "next/server";
import { submitReview, getSession, getAllReviews } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pin, name, content, photo } = body;

    if (!pin) {
      return NextResponse.json(
        { success: false, message: "수사 암호(PIN)가 필요합니다." },
        { status: 400 }
      );
    }

    const session = getSession(pin);
    if (!session) {
      return NextResponse.json(
        { success: false, message: "유효하지 않은 수사 암호입니다." },
        { status: 404 }
      );
    }

    if (session.hasReviewed) {
      return NextResponse.json(
        {
          success: false,
          message: "이미 후기를 등록하셨습니다. (1인 1회 제한)",
          review: session.review,
        },
        { status: 409 }
      );
    }

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, message: "참가자 이름을 입력해주세요." },
        { status: 400 }
      );
    }

    if (!content || !content.trim()) {
      return NextResponse.json(
        { success: false, message: "후기 내용을 입력해주세요." },
        { status: 400 }
      );
    }

    const result = submitReview(pin, {
      name,
      content,
      photo: photo || null,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 400 }
      );
    }

    // [향후 외부 저장소 연동 확장 포인트]
    // 예: Google Sheets Webhook, Notion API, Discord Webhook 등을 이곳에서 비동기 호출 가능

    return NextResponse.json({
      success: true,
      message: result.message,
      review: result.review,
      session: result.session,
    });
  } catch (error: any) {
    console.error("Review submission error:", error);
    return NextResponse.json(
      { success: false, message: "후기 저장 중 서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const pin = searchParams.get("pin");

    if (pin) {
      const session = getSession(pin);
      return NextResponse.json({
        hasReviewed: !!session?.hasReviewed,
        review: session?.review || null,
      });
    }

    const reviews = getAllReviews();
    return NextResponse.json({
      total: reviews.length,
      reviews,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch reviews" },
      { status: 500 }
    );
  }
}
