import { NextRequest, NextResponse } from "next/server";
import { submitAnswer } from "@/lib/store";

export async function POST(req: NextRequest) {
  try {
    const { pin, answer, roomNumber } = await req.json();

    if (!pin || answer === undefined) {
      return NextResponse.json({ error: "PIN and answer are required" }, { status: 400 });
    }

    const result = submitAnswer(pin, String(answer), roomNumber);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to submit answer" }, { status: 500 });
  }
}
