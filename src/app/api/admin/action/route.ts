import { NextRequest, NextResponse } from "next/server";
import { passRoomAdmin, resetSession } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { action, pin, adminKey } = await req.json();

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

    return NextResponse.json({ error: "올바르지 않은 명령입니다." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Admin action failed" }, { status: 500 });
  }
}
