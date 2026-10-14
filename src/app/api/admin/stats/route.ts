import { NextRequest, NextResponse } from "next/server";
import { getAllSessions, getAllReviews, syncReviewsFromGoogleSheet } from "@/lib/store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    await syncReviewsFromGoogleSheet();
  } catch {}

  const sessions = getAllSessions();
  const reviews = getAllReviews(true);
  const now = Date.now();

  const roomDistribution: Record<string, number> = {
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
    "5": 0,
    "6": 0,
    "7": 0,
    "8": 0,
    "9": 0,
    "10": 0,
    "clear": 0,
  };

  let activeCount = 0;
  let clearedCount = 0;
  let startedCount = 0;
  let totalTimeSum = 0;

  sessions.forEach((s) => {
    if (s.startedAt) {
      startedCount++;
    }

    // Active in last 3 minutes
    if (s.lastActiveAt && now - s.lastActiveAt < 3 * 60 * 1000) {
      activeCount++;
    }

    if (s.isCleared) {
      clearedCount++;
      roomDistribution["clear"]++;
      if (s.totalTimeSeconds) {
        totalTimeSum += s.totalTimeSeconds;
      }
    } else if (s.startedAt) {
      const roomKey = String(s.currentRoom);
      if (roomDistribution[roomKey] !== undefined) {
        roomDistribution[roomKey]++;
      }
    }
  });

  const avgClearSeconds = clearedCount > 0 ? Math.round(totalTimeSum / clearedCount) : 0;

  // Identify bottlenecks (rooms with >= 5 people or average dwell > 5 min)
  const bottlenecks: number[] = [];
  for (let r = 1; r <= 10; r++) {
    if (roomDistribution[String(r)] >= 6) {
      bottlenecks.push(r);
    }
  }

  // Sort users: Cleared first, then highest room, then most recently active
  const sortedUsers = [...sessions].sort((a, b) => {
    if (a.isCleared && !b.isCleared) return -1;
    if (!a.isCleared && b.isCleared) return 1;
    if (a.currentRoom !== b.currentRoom) return b.currentRoom - a.currentRoom;
    return (b.lastActiveAt || 0) - (a.lastActiveAt || 0);
  });

  const totalReviews = reviews.length;
  const hiddenReviews = reviews.filter((r) => r.hidden).length;

  return NextResponse.json({
    totalUsers: sessions.length,
    startedCount,
    activeCount,
    clearedCount,
    avgClearSeconds,
    totalReviews,
    hiddenReviews,
    reviews,
    roomDistribution,
    bottlenecks,
    users: sortedUsers,
  });
}
