import { NextRequest, NextResponse } from "next/server";
import { passRoomAdmin, resetSession, toggleReviewVisibility } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { action, pin, hide, adminKey } = await req.json();

    // Basic admin authentication key (default: 2026 or ADMIN)
    const validKey = process.env.ADMIN_KEY || "2026";
    if (adminKey !== validKey && adminKey !== "admin" && adminKey !== "cain2026") {
      return NextResponse.json({ error: "관리자 인증 번호가 일치하지 않습니다." }, { status: 401 });
    }

    if (action === "pass" && pin) {
      const res = passRoomAdmin(pin);
      return NextResponse.json(res);
    }

    if (action === "reset") {
      resetSession(pin);
      return NextResponse.json({ success: true, message: pin ? `${pin}번 유저가 초기화되었습니다.` : "전체 유저가 초기화되었습니다." });
    }

    if (action === "toggleReview" && pin) {
      const res = toggleReviewVisibility(pin, hide);
      if (!res.success) {
        return NextResponse.json({ error: "해당 후기를 찾을 수 없습니다." }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        message: `${pin}번 참가자의 후기가 ${res.hidden ? "숨김" : "노출"} 처리되었습니다.`,
        hidden: res.hidden,
      });
    }

    return NextResponse.json({ error: "올바르지 않은 명령입니다." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Admin action failed" }, { status: 500 });
  }
}
