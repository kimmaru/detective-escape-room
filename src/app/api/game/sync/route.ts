import { NextRequest, NextResponse } from "next/server";
import { syncClientSession } from "@/lib/store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body || !body.pin) {
      return NextResponse.json({ error: "PIN is required" }, { status: 400 });
    }

    const updated = syncClientSession(body);
    return NextResponse.json({ success: true, session: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to sync" }, { status: 500 });
  }
}
