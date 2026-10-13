import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/store";
import { PUZZLES } from "@/data/puzzles";

export async function GET(req: NextRequest) {
  const pin = req.nextUrl.searchParams.get("pin");
  if (!pin) {
    return NextResponse.json({ error: "PIN is required" }, { status: 400 });
  }

  const session = getSession(pin);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.isCleared) {
    return NextResponse.json({
      session,
      isCleared: true,
      totalPuzzles: PUZZLES.length,
    });
  }

  const puzzle = PUZZLES.find((p) => p.roomNumber === session.currentRoom);
  if (!puzzle) {
    return NextResponse.json({ error: "Puzzle not found" }, { status: 404 });
  }

  // Calculate hint cooldown
  const now = Date.now();
  const baseTime = session.lastHintUnlockedAt || session.roomEnteredAt || session.startedAt || now;
  const timeSinceLast = now - baseTime;
  const COOLDOWN_MS = 120 * 1000;
  const remainingCooldown = Math.max(0, Math.ceil((COOLDOWN_MS - timeSinceLast) / 1000));

  // Build unlocked hints list
  const unlockedHintsList = session.unlockedHints.map((idx) => ({
    index: idx,
    text: puzzle.hints[idx],
  }));

  return NextResponse.json({
    session,
    puzzle: {
      roomNumber: puzzle.roomNumber,
      title: puzzle.title,
      image: puzzle.image,
      dialogue: puzzle.dialogue,
      question: puzzle.question,
      formatGuide: puzzle.formatGuide,
      totalHints: puzzle.hints.length,
    },
    unlockedHints: unlockedHintsList,
    hintCooldownRemaining: remainingCooldown,
    canUnlockHint: remainingCooldown === 0 && session.unlockedHints.length < puzzle.hints.length,
    totalPuzzles: PUZZLES.length,
  });
}
