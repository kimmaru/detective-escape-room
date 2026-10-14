import { NextRequest, NextResponse } from "next/server";
import { submitAnswerAsync } from "@/lib/store";
import { PUZZLES } from "@/data/puzzles";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { pin, answer, roomNumber } = await req.json();

    if (!pin || answer === undefined) {
      return NextResponse.json({ error: "PIN and answer are required" }, { status: 400 });
    }

    const result = await submitAnswerAsync(pin, String(answer), roomNumber);

    // 다음 방이 있을 경우, 클라이언트가 깜빡임 없이 즉시 렌더링할 수 있도록 다음 방 퍼즐 정보 즉시 반환
    if (result.success && !result.isCleared && result.nextRoom) {
      const nextPuzzle = PUZZLES.find((p) => p.roomNumber === result.nextRoom);
      if (nextPuzzle) {
        return NextResponse.json({
          ...result,
          nextPuzzle: {
            roomNumber: nextPuzzle.roomNumber,
            title: nextPuzzle.title,
            image: nextPuzzle.image,
            dialogue: nextPuzzle.dialogue,
            question: nextPuzzle.question,
            formatGuide: nextPuzzle.formatGuide,
            totalHints: nextPuzzle.hints.length,
          },
        });
      }
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to submit answer" }, { status: 500 });
  }
}
