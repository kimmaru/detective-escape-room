export interface PlayerSession {
  pin: string;
  nickname: string;
  currentRoom: number;
  startedAt: number | null;
  roomEnteredAt: number | null;
  unlockedHints: number[]; // index array of hints unlocked in current room [0, 1, 2]
  lastHintUnlockedAt: number | null;
  isCleared: boolean;
  clearedAt: number | null;
  totalTimeSeconds: number;
  lastActiveAt: number | null;
  status: "ready" | "playing" | "cleared" | "inactive";
}

// Generate default 100 pins (1001 ~ 1100)
export function generateDefaultPins(): Record<string, PlayerSession> {
  const map: Record<string, PlayerSession> = {};
  for (let i = 1; i <= 100; i++) {
    const pin = (1000 + i).toString();
    const pad = String(i).padStart(2, "0");
    map[pin] = {
      pin,
      nickname: `탐정조수_${pad}`,
      currentRoom: 1,
      startedAt: null,
      roomEnteredAt: null,
      unlockedHints: [],
      lastHintUnlockedAt: null,
      isCleared: false,
      clearedAt: null,
      totalTimeSeconds: 0,
      lastActiveAt: null,
      status: "ready",
    };
  }
  return map;
}
