import { NextRequest, NextResponse } from "next/server";
import { startOrResumeSession } from "@/lib/store";

export async function POST(req: NextRequest) {
  try {
    const { pin, nickname } = await req.json();

    if (!pin || typeof pin !== "string") {
      return NextResponse.json({ error: "PIN 번호를 입력해주세요." }, { status: 400 });
    }

    const cleanPin = pin.trim().toUpperCase();
    const session = startOrResumeSession(cleanPin, nickname);

    const res = NextResponse.json({
      success: true,
      session,
    });

    res.cookies.set("escape_auth", session.pin, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return res;
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "로그인 중 오류가 발생했습니다." },
      { status: 400 }
    );
  }
}
