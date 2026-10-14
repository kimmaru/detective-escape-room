import { NextRequest, NextResponse } from "next/server";
import { unlockHintAsync } from "@/lib/store";

export async function POST(req: NextRequest) {
  try {
    const { pin, roomNumber } = await req.json();

    if (!pin) {
      return NextResponse.json({ error: "PIN is required" }, { status: 400 });
    }

    const result = await unlockHintAsync(pin, roomNumber);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to unlock hint" }, { status: 500 });
  }
}
