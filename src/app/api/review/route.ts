import { NextRequest, NextResponse } from "next/server";
import { submitReview, getSession, getAllReviews } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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

    // 클리어 여부 확인
    if (!session.isCleared && session.currentRoom <= 10) {
      return NextResponse.json(
        { success: false, message: "사건을 모두 해결(클리어)한 탐정만 후기를 등록할 수 있습니다." },
        { status: 403 }
      );
    }

    // 중복 작성/수정 방지 (1회 제한)
    if (session.hasReviewed) {
      return NextResponse.json(
        { success: false, message: "이미 후기를 등록하셨습니다. 후기는 1인당 1회만 등록 가능하며 수정할 수 없습니다." },
        { status: 400 }
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

    // [Google Sheets Webhook 연동]
    const googleSheetUrl =
      process.env.GOOGLE_SHEET_WEBHOOK_URL ||
      "https://script.google.com/macros/s/AKfycbxKY3sFsMUaUN2fuYFXLcSDrzlc7SC7PcBxZtHBWa0YRkoUg-bCJVTrCYouFnuLMqu9-w/exec";
    if (googleSheetUrl) {
      try {
        console.log(`Forwarding review for PIN ${pin} to Google Sheets...`);
        const sheetRes = await fetch(googleSheetUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pin,
            name,
            content,
            photo: photo || null,
            createdAt: new Date().toISOString(),
          }),
          redirect: "follow",
        });
        const sheetData = await sheetRes.text();
        console.log("Google Sheets response:", sheetData);
      } catch (sheetErr) {
        console.error("Failed to forward review to Google Sheets:", sheetErr);
      }
    }

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

    if (!pin) {
      return NextResponse.json(
        { success: false, message: "수사 암호(PIN)가 필요합니다." },
        { status: 401 }
      );
    }

    const session = getSession(pin);
    if (!session) {
      return NextResponse.json(
        { success: false, message: "유효하지 않은 수사 암호입니다." },
        { status: 404 }
      );
    }

    // 클리어한 사람만 후기 게시판을 볼 수 있도록 통제
    const isCleared = !!session.isCleared || session.currentRoom > 10;
    if (!isCleared) {
      return NextResponse.json(
        {
          success: false,
          isCleared: false,
          message: "사건을 모두 해결(클리어)한 명탐정만 후기 게시판을 열람할 수 있습니다.",
        },
        { status: 403 }
      );
    }

    const reviews = getAllReviews();
    return NextResponse.json({
      success: true,
      isCleared: true,
      hasReviewed: !!session.hasReviewed,
      myPin: session.pin,
      myReview: session.review || null,
      total: reviews.length,
      reviews,
    });
  } catch (error) {
    console.error("Review fetch error:", error);
    return NextResponse.json(
      { success: false, message: "후기를 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
