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
