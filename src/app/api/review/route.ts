import { NextRequest, NextResponse } from "next/server";
import { submitReview, getSession, getAllReviews, syncClientSession } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pin, name, content, photo, isCleared, currentRoom } = body;

    if (!pin) {
      return NextResponse.json(
        { success: false, message: "수사 암호(PIN)가 필요합니다." },
        { status: 400 }
      );
    }

    let session = getSession(pin);
    if (!session) {
      return NextResponse.json(
        { success: false, message: "유효하지 않은 수사 암호입니다." },
        { status: 404 }
      );
    }

    // 서버리스 환경 대응: 클라이언트에서 클리어 상태를 보냈거나 currentRoom > 10인 경우 세션 동기화
    if (isCleared || currentRoom > 10) {
      session = syncClientSession({
        pin,
        isCleared: true,
        currentRoom: 11,
        totalTimeSeconds: body.totalTimeSeconds,
        clearedAt: body.clearedAt || Date.now(),
      });
    }

    // 클리어 여부 확인
    const userCleared = !!session.isCleared || session.currentRoom > 10 || isCleared === true;
    if (!userCleared) {
      return NextResponse.json(
        { success: false, message: "사건을 모두 해결(클리어)한 탐정만 후기를 등록할 수 있습니다." },
        { status: 403 }
      );
    }

    // 이미 작성된 후기가 있는 경우
    if (session.hasReviewed) {
      return NextResponse.json(
        { success: false, message: "이미 소중한 후기가 등록되어 있습니다." },
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
      isCleared: userCleared,
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
    const isClientCleared = searchParams.get("cleared") === "true";

    if (!pin) {
      return NextResponse.json(
        { success: false, message: "수사 암호(PIN)가 필요합니다." },
        { status: 401 }
      );
    }

    let session = getSession(pin);
    if (!session) {
      return NextResponse.json(
        { success: false, message: "유효하지 않은 수사 암호입니다." },
        { status: 404 }
      );
    }

    // 클라이언트가 클리어 상태로 요청 시 서버 세션 동기화
    if (isClientCleared && !session.isCleared) {
      session = syncClientSession({ pin, isCleared: true, currentRoom: 11 });
    }

    // 클리어한 사람만 후기 게시판을 볼 수 있도록 통제
    const isCleared = !!session.isCleared || session.currentRoom > 10 || isClientCleared;
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

    const reviews = getAllReviews(false);
    return NextResponse.json(
      {
        success: true,
        isCleared: true,
        hasReviewed: !!session.hasReviewed,
        myPin: session.pin,
        myReview: session.review || null,
        total: reviews.length,
        reviews,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error("Review fetch error:", error);
    return NextResponse.json(
      { success: false, message: "후기를 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
