import fs from "fs";
import path from "path";

export interface PlayerSession {
  pin: string; // 6-character code
  nickname: string;
  currentRoom: number;
  startedAt: number | null;
  roomEnteredAt: number | null;
  unlockedHints: number[]; // index array of hints unlocked in current room [0, 1, 2, 3]
  lastHintUnlockedAt: number | null;
  isCleared: boolean;
  clearedAt: number | null;
  totalTimeSeconds: number;
  lastActiveAt: number | null;
  status: "ready" | "playing" | "cleared" | "inactive";
}

export function generateDefaultPins(): Record<string, PlayerSession> {
  const map: Record<string, PlayerSession> = {};

  try {
    const filePath = path.join(process.cwd(), "passwords.json");
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const list = JSON.parse(raw);
      list.forEach((item: any) => {
        const code = String(item.code).toUpperCase().trim();
        map[code] = {
          pin: code,
          nickname: item.nickname || `탐정_${code}`,
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
      });
      return map;
    }
  } catch (e) {
    console.error("Failed to load passwords.json:", e);
  }

  return map;
}
